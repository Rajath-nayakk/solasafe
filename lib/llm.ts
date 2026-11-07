import Anthropic from "@anthropic-ai/sdk";
import { ParsedAction, ParsedActionSchema, ExplainResponse } from "./types";
import { isValidSolanaAddress } from "./solana";

const DEFAULT_MODEL = process.env.LLM_MODEL || "claude-3-5-sonnet-20241022";

function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "" || apiKey === "your_anthropic_api_key_here") {
    return null;
  }
  return new Anthropic({ apiKey });
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
 * Parse user text command using Anthropic Claude (with smart deterministic fallback)
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
  const anthropic = getAnthropicClient();

  if (anthropic) {
    try {
      const userPrompt = `Address Book (name -> address):
${JSON.stringify(addressBook, null, 2)}

Available Tokens:
${JSON.stringify(tokenList, null, 2)}

User request: "${text}"

Respond with ONLY raw JSON.`;

      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 400,
        temperature: 0,
        system: INTENT_PARSING_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      // Extract text content
      const firstBlock = response.content[0];
      if (firstBlock && firstBlock.type === "text") {
        let rawJson = firstBlock.text.trim();
        // Strip markdown backticks if model wrapped in ```json
        if (rawJson.startsWith("```")) {
          rawJson = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        }

        const parsed = JSON.parse(rawJson);
        const validated = ParsedActionSchema.safeParse(parsed);
        if (validated.success) {
          return validated.data;
        }
      }
    } catch (err) {
      console.warn("Anthropic API call failed for intent parsing, using robust fallback:", err);
    }
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
  // e.g., "send 0.1 SOL to Amit", "send 5 USDC to Bob", "send half SOL to 9x..."
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
1. Keep the explanation under 4 sentences.
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
  const anthropic = getAnthropicClient();

  if (anthropic) {
    try {
      const userPrompt = `Transaction Data:
Parsed Action: ${JSON.stringify(action, null, 2)}
Simulation Results: ${JSON.stringify(simulation, null, 2)}
Risk Analysis: ${JSON.stringify(riskAnalysis, null, 2)}

Provide a plain-English explanation and verdict. Respond with ONLY raw JSON matching { "explanation": "...", "verdict": "..." }.`;

      const response = await anthropic.messages.create({
        model: DEFAULT_MODEL,
        max_tokens: 400,
        temperature: 0.2,
        system: EXPLAIN_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const firstBlock = response.content[0];
      if (firstBlock && firstBlock.type === "text") {
        let rawJson = firstBlock.text.trim();
        if (rawJson.startsWith("```")) {
          rawJson = rawJson.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
        }

        const parsed = JSON.parse(rawJson);
        if (parsed.explanation && parsed.verdict) {
          return {
            explanation: parsed.explanation,
            verdict: parsed.verdict,
            isAiGenerated: true,
          };
        }
      }
    } catch (err) {
      console.warn("Anthropic API call failed for explanation, falling back to template:", err);
    }
  }

  // Graceful fallback template (demo never breaks!)
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
    };
  }

  return {
    explanation: `This transaction will transfer ${amountStr} to ${targetName}. The Solana network fee is minimal (${feeStr}), and your remaining balance is healthy.`,
    verdict: "Standard transfer with normal risk profile.",
    isAiGenerated: false,
  };
}

