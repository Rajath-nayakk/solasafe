import { PublicKey } from "@solana/web3.js";

// Standard Solana Program IDs allowed by safe transfer checks
export const SYSTEM_PROGRAM_ID = "11111111111111111111111111111111";
export const TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
export const ASSOCIATED_TOKEN_PROGRAM_ID = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
export const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";

export const ALLOWED_TRANSFER_PROGRAMS = new Set([
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  COMPUTE_BUDGET_PROGRAM_ID,
]);

// Known Malicious Drainer & Phishing Addresses (Stretch Goal: Scam Checklist)
export const KNOWN_SCAM_ADDRESSES = new Set([
  "ScamDrainer1111111111111111111111111111111",
  "8F9U2Gj2F9K8N9kY4vBvG1gN9kY4vBvG1gN9kY4vBvG1", // Mock malicious drainer address
  "DrainX49b9a67e91d8a391a27e31846b9a8972b918734",
  "BadActorPhantomDrainerMockAddress1111111111",
]);

// Minimum SOL balance to preserve for rent / subsequent fees (~0.002 SOL)
export const MIN_RENT_RESERVE_SOL = 0.002;

// Standard Devnet SPL Token Mints for testing
export const DEVNET_KNOWN_TOKENS = [
  {
    symbol: "SOL",
    name: "Solana",
    mint: "So11111111111111111111111111111111111111112",
    decimals: 9,
  },
  {
    symbol: "USDC",
    name: "USD Coin (Devnet)",
    mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU", // Circle Devnet USDC
    decimals: 6,
  },
];

export const SOLANA_DEVNET_RPC =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

// Default daily limit in SOL if user enables spending limits
export const DEFAULT_DAILY_LIMIT_SOL = 1.0;
