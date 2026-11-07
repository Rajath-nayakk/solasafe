import { z } from "zod";

// Zod schema for parsed LLM intent action
export const ParsedActionSchema = z.object({
  action: z.enum(["transfer", "swap", "unknown"]),
  token: z.string().default("SOL"),
  amount: z.union([z.number(), z.literal("half"), z.literal("all")]),
  recipient: z.string().nullable(),
  recipientLabel: z.string().nullable(),
  clarification: z.string().nullable(),
});

export type ParsedAction = z.infer<typeof ParsedActionSchema>;

// Simulation details
export interface TokenDelta {
  mint: string;
  symbol: string;
  delta: number;
  owner: string;
}

export interface SimulationResult {
  success: boolean;
  err: string | null;
  computeUnits: number;
  fee: number; // in SOL
  programsInvoked: string[];
  senderSolDelta: number; // in SOL (typically negative for sender)
  recipientSolDelta: number; // in SOL
  tokenDeltas: TokenDelta[];
  rawLogs: string[];
}

// Risk Flag
export type RiskSeverity = "info" | "warning" | "danger";

export interface RiskFlag {
  id: string;
  severity: RiskSeverity;
  message: string;
  detail?: string;
}

export type OverallRisk = "Safe" | "Review" | "Risky";

export interface RiskAnalysis {
  overallRisk: OverallRisk;
  flags: RiskFlag[];
  hasDanger: boolean;
  hasWarning: boolean;
}

export interface RecipientSecurityMeta {
  exists: boolean;
  executable: boolean;
  owner: string;
  lamports: number;
}

export interface TokenSecurityMeta {
  mint: string;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  isToken2022: boolean;
  hasTransferHook?: boolean;
  hasPermanentDelegate?: boolean;
  hasTransferFee?: boolean;
  transferFeeBasisPoints?: number;
}

export interface SecurityEnrichment {
  hasOnChainInteraction?: boolean;
  recipientMeta?: RecipientSecurityMeta | null;
  tokenMeta?: TokenSecurityMeta | null;
  isOffCurve?: boolean;
}

// Contact in Address Book
export interface Contact {
  name: string;
  address: string;
  addedAt: number;
}

// Transaction History item
export interface TxHistoryItem {
  signature: string;
  timestamp: number;
  description: string;
  amount: number;
  token: string;
  recipient: string;
  recipientLabel?: string;
  riskLevel: OverallRisk;
  status: "confirmed" | "failed";
}

// Explanation API response
export interface ExplainResponse {
  explanation: string;
  verdict: string;
  isAiGenerated: boolean;
  provider?: "gemini" | "anthropic" | null;
}

