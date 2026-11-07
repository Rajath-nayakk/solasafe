import {
  RiskAnalysis,
  RiskFlag,
  OverallRisk,
  SimulationResult,
  ParsedAction,
  Contact,
  TxHistoryItem,
} from "./types";
import {
  ALLOWED_TRANSFER_PROGRAMS,
  MIN_RENT_RESERVE_SOL,
  KNOWN_SCAM_ADDRESSES,
} from "./constants";
import { isValidSolanaAddress } from "./solana";

export interface EvaluateRiskParams {
  action: ParsedAction;
  simulation: SimulationResult | null;
  senderAddress: string;
  senderBalanceSol: number;
  contacts: Contact[];
  txHistory: TxHistoryItem[];
  dailySpendingLimitSol?: number | null;
  dailySpentSolSoFar?: number;
}

/**
 * Deterministic Risk Engine for SolSafe.
 * Runs strictly deterministic security rules on the parsed action, simulation results, and wallet state.
 */
export function evaluateTransactionRisk({
  action,
  simulation,
  senderAddress,
  senderBalanceSol,
  contacts,
  txHistory,
  dailySpendingLimitSol,
  dailySpentSolSoFar = 0,
}: EvaluateRiskParams): RiskAnalysis {
  const flags: RiskFlag[] = [];

  const recipient = action.recipient;
  const rawAmount = action.amount;
  const numAmount =
    typeof rawAmount === "number"
      ? rawAmount
      : rawAmount === "half"
      ? senderBalanceSol / 2
      : senderBalanceSol;

  // 1. Recipient validity and self-transfer check
  if (!recipient || !isValidSolanaAddress(recipient)) {
    flags.push({
      id: "INVALID_RECIPIENT",
      severity: "warning",
      message: "Recipient address is invalid or not found on curve.",
      detail: `Provided address: ${recipient || "None"}`,
    });
  } else if (
    senderAddress &&
    recipient.toLowerCase() === senderAddress.toLowerCase()
  ) {
    flags.push({
      id: "SELF_TRANSFER",
      severity: "warning",
      message: "Recipient is your own wallet address.",
      detail: "You are sending funds back to the current connected wallet.",
    });
  }

  // 1b. Known Scam / Drainer Check (Stretch Goal)
  if (recipient && KNOWN_SCAM_ADDRESSES.has(recipient)) {
    flags.push({
      id: "KNOWN_SCAM_ADDRESS",
      severity: "danger",
      message: "CRITICAL THREAT: Recipient is a confirmed malicious scam / drainer address!",
      detail: "This address has been blacklisted as a known phishing drainer. Transferring funds will result in irreversible theft.",
    });
  }

  // 2. First-time recipient check (not in contacts and no prior history)
  if (recipient && isValidSolanaAddress(recipient)) {
    const inAddressBook = contacts.some(
      (c) => c.address.toLowerCase() === recipient.toLowerCase()
    );
    const inTxHistory = txHistory.some(
      (tx) => tx.recipient.toLowerCase() === recipient.toLowerCase()
    );

    if (!inAddressBook && !inTxHistory) {
      flags.push({
        id: "NEW_RECIPIENT",
        severity: "warning",
        message: "New recipient: You have never interacted with this address before.",
        detail: "Address is not in your saved contacts and has no prior transaction history.",
      });
    }
  }

  // 3. Amount vs Sender Balance checks
  if (action.token.toUpperCase() === "SOL" && senderBalanceSol > 0) {
    const fraction = numAmount / senderBalanceSol;

    if (fraction >= 0.9) {
      flags.push({
        id: "CRITICAL_DRAIN_AMOUNT",
        severity: "danger",
        message: `High risk: Transfer amounts to ${(fraction * 100).toFixed(0)}% of your wallet's SOL balance.`,
        detail: `Attempting to send ${numAmount} SOL out of ${senderBalanceSol.toFixed(4)} SOL.`,
      });
    } else if (fraction > 0.5) {
      flags.push({
        id: "LARGE_PERCENTAGE_AMOUNT",
        severity: "warning",
        message: `Large transfer: Amount is ${(fraction * 100).toFixed(0)}% of your total SOL balance.`,
        detail: `Sending more than half your available SOL balance (${numAmount} SOL).`,
      });
    }

    // 4. Rent / fees reserve check
    const remainingBalance = senderBalanceSol - numAmount - (simulation?.fee || 0.000005);
    if (remainingBalance < MIN_RENT_RESERVE_SOL) {
      flags.push({
        id: "INSUFFICIENT_RENT_RESERVE",
        severity: "danger",
        message: "Dangerous: Transfer leaves insufficient SOL to pay for network rent or future transaction fees.",
        detail: `Estimated remaining balance: ${Math.max(0, remainingBalance).toFixed(5)} SOL (Recommended reserve: >= ${MIN_RENT_RESERVE_SOL} SOL).`,
      });
    }
  }

  // 5. Invoked program checks (simulation inspection)
  if (simulation && simulation.programsInvoked.length > 0) {
    const unknownPrograms = simulation.programsInvoked.filter(
      (programId) => !ALLOWED_TRANSFER_PROGRAMS.has(programId)
    );

    if (unknownPrograms.length > 0) {
      flags.push({
        id: "UNKNOWN_PROGRAM_INVOKED",
        severity: "danger",
        message: "Untrusted Program: Transaction invokes unexpected non-standard program(s).",
        detail: `Invoked program ID: ${unknownPrograms.join(", ")}. Standard transfers only invoke System, Token, or Associated Token programs.`,
      });
    }
  }

  // 6. Simulation failure check
  if (simulation && !simulation.success) {
    flags.push({
      id: "SIMULATION_FAILED",
      severity: "danger",
      message: "Devnet Simulation Failed: Transaction cannot succeed on-chain.",
      detail: simulation.err || "Unknown simulation failure.",
    });
  }

  // 7. Daily spending limit check
  if (
    dailySpendingLimitSol !== undefined &&
    dailySpendingLimitSol !== null &&
    dailySpendingLimitSol > 0 &&
    action.token.toUpperCase() === "SOL"
  ) {
    const totalDailyProjected = dailySpentSolSoFar + numAmount;
    if (totalDailyProjected > dailySpendingLimitSol) {
      flags.push({
        id: "DAILY_LIMIT_EXCEEDED",
        severity: "danger",
        message: `Daily spending limit exceeded: Projected ${totalDailyProjected.toFixed(3)} SOL exceeds daily cap of ${dailySpendingLimitSol.toFixed(3)} SOL.`,
        detail: `Already spent today: ${dailySpentSolSoFar.toFixed(3)} SOL, attempting to send ${numAmount.toFixed(3)} SOL.`,
      });
    }
  }

  // If no warnings or dangers exist, add an info flag
  if (flags.length === 0) {
    flags.push({
      id: "CLEAN_CHECKS",
      severity: "info",
      message: "All deterministic safety checks passed.",
      detail: "Known recipient, normal amount ratio, safe standard programs invoked.",
    });
  }

  // Calculate overall risk
  const hasDanger = flags.some((f) => f.severity === "danger");
  const hasWarning = flags.some((f) => f.severity === "warning");

  let overallRisk: OverallRisk = "Safe";
  if (hasDanger) {
    overallRisk = "Risky";
  } else if (hasWarning) {
    overallRisk = "Review";
  } else {
    overallRisk = "Safe";
  }

  return {
    overallRisk,
    flags,
    hasDanger,
    hasWarning,
  };
}

