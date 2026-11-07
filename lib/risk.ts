import {
  RiskAnalysis,
  RiskFlag,
  OverallRisk,
  SimulationResult,
  ParsedAction,
  Contact,
  TxHistoryItem,
  SecurityEnrichment,
} from "./types";
import {
  ALLOWED_TRANSFER_PROGRAMS,
  MIN_RENT_RESERVE_SOL,
  KNOWN_SCAM_ADDRESSES,
} from "./constants";
import { isValidSolanaAddress, isOffCurveAddress } from "./solana";

export interface EvaluateRiskParams {
  action: ParsedAction;
  simulation: SimulationResult | null;
  senderAddress: string;
  senderBalanceSol: number;
  contacts: Contact[];
  txHistory: TxHistoryItem[];
  dailySpendingLimitSol?: number | null;
  dailySpentSolSoFar?: number;
  securityEnrichment?: SecurityEnrichment;
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
  securityEnrichment,
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
      message: "Recipient address is invalid or not found.",
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

  // 1c. Off-curve PDA check
  if (recipient && isValidSolanaAddress(recipient) && isOffCurveAddress(recipient)) {
    flags.push({
      id: "OFF_CURVE_RECIPIENT",
      severity: "warning",
      message: "Recipient address is off-curve (Program Derived Address / PDA).",
      detail: "This address does not lie on the ed25519 curve. Confirm this PDA is the intended destination.",
    });
  }

  // 1d. Recipient Account State Check (executable program vs uninitialized account)
  if (securityEnrichment?.recipientMeta) {
    if (securityEnrichment.recipientMeta.executable) {
      flags.push({
        id: "EXECUTABLE_RECIPIENT",
        severity: "danger",
        message: "Recipient is an executable Program, not a user wallet!",
        detail: `The address is owned by program loader (${securityEnrichment.recipientMeta.owner}) and is marked executable. Direct transfers may result in lost funds.`,
      });
    } else if (
      !securityEnrichment.recipientMeta.exists ||
      (securityEnrichment.recipientMeta.lamports === 0 && !securityEnrichment.hasOnChainInteraction)
    ) {
      flags.push({
        id: "UNINITIALIZED_RECIPIENT",
        severity: "warning",
        message: "Recipient is a new, uninitialized account (0 SOL balance, no history).",
        detail: "The destination address has zero balance and has not been created on-chain yet.",
      });
    }
  }

  // 2. First-time recipient check (with on-chain interaction verification)
  if (recipient && isValidSolanaAddress(recipient)) {
    const inAddressBook = contacts.some(
      (c) => c.address.toLowerCase() === recipient.toLowerCase()
    );
    const inTxHistory = txHistory.some(
      (tx) => tx.recipient.toLowerCase() === recipient.toLowerCase()
    );
    const hasOnChain = securityEnrichment?.hasOnChainInteraction === true;

    if (!inAddressBook && !inTxHistory && !hasOnChain) {
      flags.push({
        id: "NEW_RECIPIENT",
        severity: "warning",
        message: "New recipient: You have never interacted with this address before.",
        detail: "Address is not in your saved contacts and has no prior Devnet transaction history.",
      });
    } else if (hasOnChain && !inAddressBook) {
      flags.push({
        id: "ON_CHAIN_INTERACTION_FOUND",
        severity: "info",
        message: "Verified on-chain history: Prior interaction detected on Devnet.",
        detail: "Found matching transaction signatures between your wallet and this recipient.",
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

  // 5b. Compute Budget / Heavy Execution Anomaly (> 200,000 CU)
  if (simulation && simulation.computeUnits > 200000) {
    flags.push({
      id: "HIGH_COMPUTE_UNITS",
      severity: "danger",
      message: `Abnormal Compute Usage: Simulation consumed ${simulation.computeUnits.toLocaleString()} Compute Units (> 200,000 CU).`,
      detail: "Standard transfers consume under 1,000 CU. Excessively high compute usage indicates suspicious execution or drainer hooks.",
    });
  }

  // 5c. SPL Token Security Checks (mint authority, freeze authority, Token-2022 extensions)
  if (securityEnrichment?.tokenMeta) {
    const tm = securityEnrichment.tokenMeta;

    if (tm.mintAuthority) {
      flags.push({
        id: "ACTIVE_MINT_AUTHORITY",
        severity: "warning",
        message: "Active Mint Authority: The token issuer can mint unlimited tokens and dilute supply.",
        detail: `Mint Authority: ${tm.mintAuthority}`,
      });
    }

    if (tm.freezeAuthority) {
      flags.push({
        id: "ACTIVE_FREEZE_AUTHORITY",
        severity: "warning",
        message: "Active Freeze Authority: The token creator can freeze token accounts and prevent transfers.",
        detail: `Freeze Authority: ${tm.freezeAuthority}`,
      });
    }

    if (tm.hasTransferHook) {
      flags.push({
        id: "TOKEN_2022_TRANSFER_HOOK",
        severity: "danger",
        message: "Token-2022 Transfer Hook: Custom contract logic executes on transfer and could block or alter payments.",
        detail: "The token mint enforces an active TransferHook extension.",
      });
    }

    if (tm.hasPermanentDelegate) {
      flags.push({
        id: "TOKEN_2022_PERMANENT_DELEGATE",
        severity: "danger",
        message: "Token-2022 Permanent Delegate: A delegate key can transfer or burn your tokens without your consent.",
        detail: "The token mint has configured an irrevocable PermanentDelegate.",
      });
    }

    if (tm.hasTransferFee) {
      flags.push({
        id: "TOKEN_2022_TRANSFER_FEE",
        severity: "warning",
        message: "Token-2022 Transfer Fee: An on-chain protocol fee is deducted on every transfer.",
        detail: "The token mint enforces an active TransferFeeConfig extension.",
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

