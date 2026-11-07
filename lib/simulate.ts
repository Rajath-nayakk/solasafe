import {
  Connection,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
  SimulatedTransactionResponse,
} from "@solana/web3.js";
import { SimulationResult, TokenDelta } from "./types";

/**
 * Simulate a VersionedTransaction with sigVerify off and replaceRecentBlockhash on.
 * Extracts compute units, error states, program IDs invoked, and balance changes.
 */
export async function simulateSolanaTransaction({
  connection,
  transaction,
  senderPubkey,
  recipientPubkey,
  amount,
  tokenSymbol = "SOL",
}: {
  connection: Connection;
  transaction: VersionedTransaction;
  senderPubkey: PublicKey;
  recipientPubkey: PublicKey;
  amount: number;
  tokenSymbol?: string;
}): Promise<SimulationResult> {
  try {
    // Collect static programs invoked from the compiled message
    const staticAccountKeys = transaction.message.staticAccountKeys;
    const compiledInstructions = transaction.message.compiledInstructions;
    const staticProgramIds = new Set<string>();

    for (const ix of compiledInstructions) {
      if (ix.programIdIndex < staticAccountKeys.length) {
        staticProgramIds.add(staticAccountKeys[ix.programIdIndex].toBase58());
      }
    }

    // Call simulateTransaction with replaceRecentBlockhash and sigVerify: false
    const simResponse = await connection.simulateTransaction(transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: "confirmed",
    });

    const simValue: SimulatedTransactionResponse = simResponse.value;
    const rawLogs = simValue.logs || [];

    // Extract program IDs from logs as well (includes CPIs)
    const allProgramsInvoked = new Set<string>(staticProgramIds);
    const logProgramRegex = /Program\s+([1-9A-HJ-NP-za-km-z]{32,44})\s+invoke/g;
    for (const log of rawLogs) {
      let match;
      while ((match = logProgramRegex.exec(log)) !== null) {
        allProgramsInvoked.add(match[1]);
      }
    }

    // Default fee estimate on Solana is 5000 lamports (0.000005 SOL)
    const estimatedFeeSol = 0.000005;

    // Determine simulation error if any
    let errorMessage: string | null = null;
    let isSuccess = simValue.err === null;

    if (simValue.err) {
      errorMessage = formatSimulationError(simValue.err, rawLogs);
      isSuccess = false;
    }

    // Calculate balance changes
    let senderSolDelta = 0;
    let recipientSolDelta = 0;
    const tokenDeltas: TokenDelta[] = [];

    if (tokenSymbol.toUpperCase() === "SOL") {
      senderSolDelta = -(amount + estimatedFeeSol);
      recipientSolDelta = amount;
    } else {
      // For SPL tokens: sender pays fee in SOL
      senderSolDelta = -estimatedFeeSol;
      recipientSolDelta = 0;

      tokenDeltas.push(
        {
          mint: "SPL",
          symbol: tokenSymbol.toUpperCase(),
          delta: -amount,
          owner: senderPubkey.toBase58(),
        },
        {
          mint: "SPL",
          symbol: tokenSymbol.toUpperCase(),
          delta: amount,
          owner: recipientPubkey.toBase58(),
        }
      );
    }

    return {
      success: isSuccess,
      err: errorMessage,
      computeUnits: simValue.unitsConsumed || 0,
      fee: estimatedFeeSol,
      programsInvoked: Array.from(allProgramsInvoked),
      senderSolDelta,
      recipientSolDelta,
      tokenDeltas,
      rawLogs,
    };
  } catch (error: any) {
    console.error("Simulation RPC exception:", error);
    return {
      success: false,
      err: error?.message || "Simulation failed due to RPC network error.",
      computeUnits: 0,
      fee: 0.000005,
      programsInvoked: [],
      senderSolDelta: 0,
      recipientSolDelta: 0,
      tokenDeltas: [],
      rawLogs: [],
    };
  }
}

/**
 * Format raw Solana RPC simulation errors into clear plain English
 */
export function formatSimulationError(err: any, logs: string[]): string {
  if (typeof err === "string") {
    if (err.includes("InsufficientFundsForRent")) {
      return "Transaction failed: Insufficient funds to meet the rent exemption requirement.";
    }
    return `Simulation failed: ${err}`;
  }

  if (typeof err === "object") {
    // Look for InstructionError
    if (err.InstructionError) {
      const [index, errorDetail] = err.InstructionError;
      if (typeof errorDetail === "string") {
        if (errorDetail === "Custom: 1") {
          return "Simulation failed: Insufficient funds in wallet for this transfer amount and fee.";
        }
        return `Instruction #${index} failed: ${errorDetail}`;
      }
      if (typeof errorDetail === "object") {
        const errorKey = Object.keys(errorDetail)[0];
        return `Instruction #${index} failed with ${errorKey}: ${JSON.stringify(errorDetail[errorKey])}`;
      }
    }

    // Check logs for specific custom error strings
    for (const log of logs) {
      if (log.includes("insufficient funds") || log.includes("Insufficient lamports")) {
        return "Simulation failed: Insufficient funds in wallet for this transaction.";
      }
      if (log.includes("Transfer: insufficient lamports")) {
        return "Simulation failed: Wallet balance is too low to complete the transfer.";
      }
    }

    return `Simulation failed: ${JSON.stringify(err)}`;
  }

  return "Simulation failed: Unknown Solana instruction error.";
}

