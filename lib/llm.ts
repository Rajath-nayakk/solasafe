import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { ParsedAction, ParsedActionSchema, ExplainResponse } from "./types";
import { isValidSolanaAddress } from "./solana";

export type LLMProvider = "gemini" | "anthropic";

export interface GenerateTextParams {
  system?: string;
  user: string;
  json?: boolean;
}

export interface GenerateTextResult {
  text: string;
  provider: LLMProvider;
}

// In-memory cache to prevent burning free-tier quota on identical requests
interface CacheEntry {
  result: GenerateTextResult;
  timestamp: number;
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const llmCache = new Map<string, CacheEntry>();

export function getActiveProvider(): LLMProvider {
  const p = (process.env.LLM_PROVIDER || "gemini").toLowerCase().trim();
  return p === "anthropic" ? "anthropic" : "gemini";
}

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    return null;
  }
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_anthropic_api_key_here") {
    return null;
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

/**
 * Strips markdown code blocks (e.g. ```json ... ```)
 */
export function cleanJsonString(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return cleaned;
}

/**
 * Central LLM generation function: routes to chosen provider (Gemini default, Claude optional)
 * Includes in-memory request caching to protect free-tier rate limits
 */
export async function generateText({
  system,
  user,
  json = false,
}: GenerateTextParams): Promise<GenerateTextResult | null> {
  const provider = getActiveProvider();
  const cacheKey = `${provider}:${json ? "json" : "text"}:${system || ""}:${user}`;

  // Check in-memory cache
  const cached = llmCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.result;
  }

  const storeInCache = (res: GenerateTextResult) => {
    if (llmCache.size > 200) {
      const firstKey = llmCache.keys().next().value;
      if (firstKey) llmCache.delete(firstKey);
    }
    llmCache.set(cacheKey, { result: res, timestamp: Date.now() });
  };

  // 1. Google Gemini Provider (Default - Free Tier from Google AI Studio)
  if (provider === "gemini") {
    const ai = getGeminiClient();
    if (!ai) return null;

    try {
      const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
      const response = await ai.models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: json ? "application/json" : undefined,
          temperature: 0.1,
        },
      });

      if (response && response.text) {
        const res: GenerateTextResult = {
          text: response.text.trim(),
          provider: "gemini",
        };
        storeInCache(res);
        return res;
      }
    } catch (err: any) {
      console.warn("Google Gemini API call failed or rate-limited (HTTP 429):", err?.message || err);
      return null;
    }
  }

  // 2. Anthropic Claude Provider (Optional)
  if (provider === "anthropic") {
    const anthropic = getAnthropicClient();
    if (!anthropic) return null;

    try {
      const model = process.env.LLM_MODEL || "claude-sonnet-5-5";
      const response = await anthropic.messages.create({
        model,
        max_tokens: 500,
        temperature: 0.1,
        system: system || "",
        messages: [{ role: "user", content: user }],
      });

      const firstBlock = response.content[0];
      if (firstBlock && firstBlock.type === "text") {
        const res: GenerateTextResult = {
          text: firstBlock.text.trim(),
          provider: "anthropic",
        };
        storeInCache(res);
        return res;
      }
    } catch (err: any) {
      console.warn("Anthropic Claude API call failed or rate-limited:", err?.message || err);
      return null;
    }
  }

  return null;
}

/**
 * System prompt for parsing intent into strict JSON
 */
const INTENT_PARSING_SYSTEM_PROMPT = `You are SolSafe's Intent Parser, a security-critical engine for a Solana wallet assistant.
Your job is to convert user natural-language commands into a structured JSON action.

You MUST adhere to these STRICT security and parsing rules:
1. Output ONLY a valid JSON object matching the exact schema. No markdown formatting, no code fences, no extra text.
2. Supported actions are: "transfer", "swap", or "unknown".
3. NEVER invent, extrapolate, or hallucinate a recipient address.
   - If the user specifies a contact name (e.g., "Amit", "Bob"), look it up ONLY in the provided addressBook.
   - If found in addressBook, set recipient to the mapped Solana address, and recipientLabel to the contact name.
   - If the user provides a raw Solana address (base58, 32-44 chars), set recipient to that exact address and recipientLabel to null.
   - If the user specifies a name that is NOT in the addressBook and no valid address is provided, set action: "unknown", recipient: null, recipientLabel: name, and ask for their address in clarification.
4. Amount rules:
   - If specified as a number, parse as a positive float number.
   - If "half", set amount to "half".
   - If "all" or "everything" or "max", set amount to "all".
   - If no amount is specified or ambiguous, set action to "unknown" and ask in clarification.
5. Token rules:
   - Default is "SOL".
   - If user mentions "USDC", "USDT", "BONK", etc., match with available tokenList if present, or output the symbol string.
6. If the request is ambiguous, nonsensical, missing key parameters (recipient or amount), or unsupported:
   - set action: "unknown"
   - set clarification to a helpful, concise question asking for the missing info.

JSON Schema:
{
  "action": "transfer" | "swap" | "unknown",
  "token": string,
  "amount": number | "half" | "all",
  "recipient": string | null,
  "recipientLabel": string | null,
  "clarification": string | null
}`;

/**
 * Parse user text command using LLM (routes to Gemini or Claude, with automatic retry and smart fallback)
 */
export async function parseIntentWithLLM({
  text,
  addressBook,
  tokenList = [],
}: {
  text: string;
  addressBook: Record<string, string>; // name -> address
  tokenList?: Array<{ symbol: string; mint: string; decimals: number }>;
}): Promise<ParsedAction> {
  const userPrompt = `Address Book (name -> address):
${JSON.stringify(addressBook, null, 2)}

Available Tokens:
${JSON.stringify(tokenList, null, 2)}

User request: "${text}"

Respond with ONLY raw JSON matching schema.`;

  // First Attempt
  const firstTry = await generateText({
    system: INTENT_PARSING_SYSTEM_PROMPT,
    user: userPrompt,
    json: true,
  });

  if (firstTry) {
    try {
      const cleaned = cleanJsonString(firstTry.text);
      const parsed = JSON.parse(cleaned);
      const validated = ParsedActionSchema.safeParse(parsed);
      if (validated.success) {
        return validated.data;
      }
    } catch {
      // First try JSON parse failed, proceed to retry
    }

    // Output was invalid, retry once
    try {
      const retryPrompt = `${userPrompt}\n\nIMPORTANT: Your previous output could not be parsed as valid JSON. You MUST return ONLY valid JSON matching the schema.`;
      const secondTry = await generateText({
        system: INTENT_PARSING_SYSTEM_PROMPT,
        user: retryPrompt,
        json: true,
      });

      if (secondTry) {
        const cleanedRetry = cleanJsonString(secondTry.text);
        const parsedRetry = JSON.parse(cleanedRetry);
        const validatedRetry = ParsedActionSchema.safeParse(parsedRetry);
        if (validatedRetry.success) {
          return validatedRetry.data;
        }
      }
    } catch (retryErr) {
      console.warn("LLM intent parsing retry failed:", retryErr);
    }

    // If both attempts produce invalid JSON, return a helpful clarification
    return {
      action: "unknown",
      token: "SOL",
      amount: 0,
      recipient: null,
      recipientLabel: null,
      clarification: `I could not clearly understand "${text}". Try saying "Send 0.1 SOL to Amit" or specifying the recipient address.`,
    };
  }

  // Robust Fallback Intent Parser (ensures demo works reliably 100% of the time)
  return fallbackParseIntent(text, addressBook);
}

/**
 * Deterministic fallback parser matching natural language transfer patterns
 */
export function fallbackParseIntent(
  text: string,
  addressBook: Record<string, string>
): ParsedAction {
  const clean = text.trim();
  const lower = clean.toLowerCase();

  // Check for swap intent
  if (lower.startsWith("swap") || lower.includes("swap ")) {
    return {
      action: "swap",
      token: "SOL",
      amount: 0.1,
      recipient: null,
      recipientLabel: null,
      clarification: "Swap detected. SolSafe currently specializes in secure transfers with pre-signing simulation.",
    };
  }

  // Match: "send [amount] [token] to [recipient]"
  const transferMatch = clean.match(
    /(?:send|transfer|pay)\s+([0-9.]+|half|all|everything|max)\s*([a-zA-Z0-9]+)?\s+to\s+([a-zA-Z0-9_-]+)/i
  );

  if (transferMatch) {
    const rawAmount = transferMatch[1].toLowerCase();
    const rawToken = (transferMatch[2] || "SOL").toUpperCase();
    const rawTarget = transferMatch[3].trim();

    let amount: number | "half" | "all" = 0.1;
    if (rawAmount === "half") {
      amount = "half";
    } else if (rawAmount === "all" || rawAmount === "everything" || rawAmount === "max") {
      amount = "all";
    } else {
      const num = parseFloat(rawAmount);
      if (!isNaN(num) && num > 0) {
        amount = num;
      }
    }

    // Resolve target in address book (case-insensitive)
    let recipient: string | null = null;
    let recipientLabel: string | null = null;

    const lowerTarget = rawTarget.toLowerCase();
    for (const [name, addr] of Object.entries(addressBook)) {
      if (name.toLowerCase() === lowerTarget) {
        recipient = addr;
        recipientLabel = name;
        break;
      }
    }

    // Check if rawTarget is a valid Solana public key
    if (!recipient && isValidSolanaAddress(rawTarget)) {
      recipient = rawTarget;
      recipientLabel = null;
    }

    if (recipient) {
      return {
        action: "transfer",
        token: rawToken,
        amount,
        recipient,
        recipientLabel,
        clarification: null,
      };
    } else {
      return {
        action: "unknown",
        token: rawToken,
        amount,
        recipient: null,
        recipientLabel: rawTarget,
        clarification: `I couldn't find "${rawTarget}" in your contacts, and it is not a valid Solana address. What is their Solana address?`,
      };
    }
  }

  // If pattern not recognized
  return {
    action: "unknown",
    token: "SOL",
    amount: 0,
    recipient: null,
    recipientLabel: null,
    clarification: 'I didn\'t quite catch that. Try saying "Send 0.1 SOL to Amit" or "Send 5 USDC to Bob".',
  };
}

/**
 * System prompt for AI plain-English transaction explanations
 */
const EXPLAIN_SYSTEM_PROMPT = `You are SolSafe's Plain-English Explainer. Your mission is to explain blockchain transactions to everyday users so they clearly understand what will happen BEFORE they approve the signature in their wallet.

CRITICAL RULES:
1. Keep the explanation strictly under 4 sentences.
2. Use simple, friendly, everyday English. Avoid dense blockchain jargon.
3. Clearly mention the amount, the token, the recipient, and what will happen to the sender's balance.
4. Highlight any risk flags or warnings prominently.
5. NEVER claim a transaction is "100% safe", "guaranteed safe", or "risk-free".
6. Output ONLY valid JSON:
{
  "explanation": "concise 2-4 sentence explanation",
  "verdict": "one-line plain English summary"
}`;

export async function explainWithLLM({
  action,
  simulation,
  riskAnalysis,
}: {
  action: ParsedAction;
  simulation: any;
  riskAnalysis: any;
}): Promise<ExplainResponse> {
  const userPrompt = `Transaction Data:
Parsed Action: ${JSON.stringify(action, null, 2)}
Simulation Results: ${JSON.stringify(simulation, null, 2)}
Risk Analysis: ${JSON.stringify(riskAnalysis, null, 2)}

Provide a plain-English explanation and verdict. Respond with ONLY raw JSON matching { "explanation": "...", "verdict": "..." }.`;

  const result = await generateText({
    system: EXPLAIN_SYSTEM_PROMPT,
    user: userPrompt,
    json: true,
  });

  if (result) {
    try {
      const cleaned = cleanJsonString(result.text);
      const parsed = JSON.parse(cleaned);
      if (parsed.explanation && parsed.verdict) {
        return {
          explanation: parsed.explanation,
          verdict: parsed.verdict,
          isAiGenerated: true,
          provider: result.provider,
        };
      }
    } catch (err) {
      console.warn("Failed to parse LLM explanation JSON, falling back to template:", err);
    }
  }

  // Graceful fallback template (shown when keys are not configured or on HTTP 429 rate limits)
  return fallbackExplain(action, simulation, riskAnalysis);
}

/**
 * Deterministic template fallback explanation
 */
export function fallbackExplain(
  action: ParsedAction,
  simulation: any,
  riskAnalysis: any
): ExplainResponse {
  const targetName = action.recipientLabel || (action.recipient ? `${action.recipient.slice(0, 4)}...${action.recipient.slice(-4)}` : "unknown recipient");
  const amountStr = `${action.amount} ${action.token}`;
  const feeStr = simulation?.fee ? `~${simulation.fee} SOL` : "~0.000005 SOL";

  if (riskAnalysis.overallRisk === "Risky") {
    const dangerFlags = (riskAnalysis.flags || [])
      .filter((f: any) => f.severity === "danger")
      .map((f: any) => f.message)
      .join(" ");

    return {
      explanation: `You are about to transfer ${amountStr} to ${targetName}. Our pre-signing security check detected high-risk flags: ${dangerFlags} Please review this transaction with extreme caution before approving.`,
      verdict: "High-risk transaction detected: verify details carefully before signing.",
      isAiGenerated: false,
      provider: null,
    };
  }

  if (riskAnalysis.overallRisk === "Review") {
    const warningFlags = (riskAnalysis.flags || [])
      .filter((f: any) => f.severity === "warning")
      .map((f: any) => f.message)
      .join(" ");

    return {
      explanation: `This transaction will send ${amountStr} to ${targetName}. Notice: ${warningFlags} The estimated network fee is ${feeStr}.`,
      verdict: "Review recommended: new recipient or unusual transfer percentage.",
      isAiGenerated: false,
      provider: null,
    };
  }

  return {
    explanation: `This transaction will transfer ${amountStr} to ${targetName}. The Solana network fee is minimal (${feeStr}), and your remaining balance is healthy.`,
    verdict: "Standard transfer with normal risk profile.",
    isAiGenerated: false,
    provider: null,
  };
}
