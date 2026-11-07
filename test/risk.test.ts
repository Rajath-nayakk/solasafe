import { describe, it, expect } from "vitest";
import { evaluateTransactionRisk } from "../lib/risk";
import { ParsedAction, SimulationResult, Contact, TxHistoryItem } from "../lib/types";
import { SYSTEM_PROGRAM_ID } from "../lib/constants";

describe("SolSafe Deterministic Risk Engine", () => {
  const mockSender = "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK";
  const mockAmit = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
  const mockUnknown = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU";

  const contacts: Contact[] = [
    { name: "Amit", address: mockAmit, addedAt: Date.now() },
  ];

  const successfulSimulation: SimulationResult = {
    success: true,
    err: null,
    computeUnits: 150,
    fee: 0.000005,
    programsInvoked: [SYSTEM_PROGRAM_ID],
    senderSolDelta: -0.100005,
    recipientSolDelta: 0.1,
    tokenDeltas: [],
    rawLogs: ["Program 11111111111111111111111111111111 success"],
  };

  it("evaluates a standard safe transfer to a known contact as 'Safe'", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts,
      txHistory: [],
    });

    expect(result.overallRisk).toBe("Safe");
    expect(result.hasDanger).toBe(false);
    expect(result.hasWarning).toBe(false);
    expect(result.flags.some((f) => f.id === "CLEAN_CHECKS")).toBe(true);
  });

  it("flags a new recipient (not in contacts and no history) with a 'warning' and 'Review'", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: mockUnknown,
      recipientLabel: null,
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts,
      txHistory: [],
    });

    expect(result.overallRisk).toBe("Review");
    expect(result.hasWarning).toBe(true);
    expect(result.flags.some((f) => f.id === "NEW_RECIPIENT")).toBe(true);
  });

  it("flags amount > 50% balance as a warning, and >= 90% as danger", () => {
    const actionWarning: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.6,
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const resultWarning = evaluateTransactionRisk({
      action: actionWarning,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 1.0,
      contacts,
      txHistory: [],
    });

    expect(resultWarning.flags.some((f) => f.id === "LARGE_PERCENTAGE_AMOUNT")).toBe(true);
    expect(resultWarning.overallRisk).toBe("Review");

    const actionDanger: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.95,
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const resultDanger = evaluateTransactionRisk({
      action: actionDanger,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 1.0,
      contacts,
      txHistory: [],
    });

    expect(resultDanger.flags.some((f) => f.id === "CRITICAL_DRAIN_AMOUNT")).toBe(true);
    expect(resultDanger.overallRisk).toBe("Risky");
    expect(resultDanger.hasDanger).toBe(true);
  });

  it("flags self-transfer with a warning", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: mockSender,
      recipientLabel: null,
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts,
      txHistory: [],
    });

    expect(result.flags.some((f) => f.id === "SELF_TRANSFER")).toBe(true);
    expect(result.overallRisk).toBe("Review");
  });

  it("flags unknown non-standard program invocation with danger ('Risky')", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const riskySim: SimulationResult = {
      ...successfulSimulation,
      programsInvoked: [SYSTEM_PROGRAM_ID, "MaliciousDrainer111111111111111111111111111"],
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: riskySim,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts,
      txHistory: [],
    });

    expect(result.flags.some((f) => f.id === "UNKNOWN_PROGRAM_INVOKED")).toBe(true);
    expect(result.overallRisk).toBe("Risky");
    expect(result.hasDanger).toBe(true);
  });

  it("flags insufficient rent/fees reserve with danger", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 1.0, // Leaving 0.0001 SOL (< 0.002 MIN_RENT_RESERVE_SOL)
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 1.0001,
      contacts,
      txHistory: [],
    });

    expect(result.flags.some((f) => f.id === "INSUFFICIENT_RENT_RESERVE")).toBe(true);
    expect(result.overallRisk).toBe("Risky");
  });

  it("flags daily spending limit exceeded with danger", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.8,
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 5.0,
      contacts,
      txHistory: [],
      dailySpendingLimitSol: 1.0,
      dailySpentSolSoFar: 0.5, // 0.5 + 0.8 = 1.3 > 1.0
    });

    expect(result.flags.some((f) => f.id === "DAILY_LIMIT_EXCEEDED")).toBe(true);
    expect(result.overallRisk).toBe("Risky");
    expect(result.hasDanger).toBe(true);
  });

  it("flags known malicious scam / drainer addresses with critical danger", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: "8F9U2Gj2F9K8N9kY4vBvG1gN9kY4vBvG1gN9kY4vBvG1", // In KNOWN_SCAM_ADDRESSES
      recipientLabel: null,
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts,
      txHistory: [],
    });

    expect(result.flags.some((f) => f.id === "KNOWN_SCAM_ADDRESS")).toBe(true);
    expect(result.overallRisk).toBe("Risky");
    expect(result.hasDanger).toBe(true);
  });

  it("verifies on-chain interaction and does not flag unknown recipient as warning", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: mockUnknown,
      recipientLabel: null,
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts: [],
      txHistory: [],
      securityEnrichment: {
        hasOnChainInteraction: true,
      },
    });

    expect(result.flags.some((f) => f.id === "ON_CHAIN_INTERACTION_FOUND")).toBe(true);
    expect(result.flags.some((f) => f.id === "NEW_RECIPIENT")).toBe(false);
    expect(result.overallRisk).toBe("Safe");
  });

  it("flags executable program recipient with danger ('Risky')", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts,
      txHistory: [],
      securityEnrichment: {
        recipientMeta: {
          exists: true,
          executable: true,
          owner: "BPFLoaderUpgradeab1e11111111111111111111111",
          lamports: 1000000,
        },
      },
    });

    expect(result.flags.some((f) => f.id === "EXECUTABLE_RECIPIENT")).toBe(true);
    expect(result.overallRisk).toBe("Risky");
    expect(result.hasDanger).toBe(true);
  });

  it("flags new uninitialized recipient (0 SOL, non-existent) with a warning", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts,
      txHistory: [],
      securityEnrichment: {
        recipientMeta: {
          exists: false,
          executable: false,
          owner: SYSTEM_PROGRAM_ID,
          lamports: 0,
        },
      },
    });

    expect(result.flags.some((f) => f.id === "UNINITIALIZED_RECIPIENT")).toBe(true);
    expect(result.overallRisk).toBe("Review");
    expect(result.hasWarning).toBe(true);
  });

  it("flags off-curve Program Derived Address (PDA) with an advisory warning", () => {
    const offCurvePda = "H68a6HmNocBWoDtYo2PDxX3ciRHLUosfsnH9b2r7xNPJ";
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: offCurvePda,
      recipientLabel: null,
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts: [{ name: "PDA Vault", address: offCurvePda, addedAt: Date.now() }],
      txHistory: [],
    });

    expect(result.flags.some((f) => f.id === "OFF_CURVE_RECIPIENT")).toBe(true);
    expect(result.overallRisk).toBe("Review");
  });

  it("flags excessive compute units (> 200,000 CU) anomaly with danger", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const heavySimulation: SimulationResult = {
      ...successfulSimulation,
      computeUnits: 250000,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: heavySimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts,
      txHistory: [],
    });

    expect(result.flags.some((f) => f.id === "HIGH_COMPUTE_UNITS")).toBe(true);
    expect(result.overallRisk).toBe("Risky");
    expect(result.hasDanger).toBe(true);
  });

  it("flags active mint authority and freeze authority on SPL tokens", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "USDC",
      amount: 5,
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts,
      txHistory: [],
      securityEnrichment: {
        tokenMeta: {
          mint: "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU",
          mintAuthority: "MintAuth11111111111111111111111111111111111",
          freezeAuthority: "FreezeAuth1111111111111111111111111111111111",
          isToken2022: false,
        },
      },
    });

    expect(result.flags.some((f) => f.id === "ACTIVE_MINT_AUTHORITY")).toBe(true);
    expect(result.flags.some((f) => f.id === "ACTIVE_FREEZE_AUTHORITY")).toBe(true);
    expect(result.overallRisk).toBe("Review");
  });

  it("flags Token-2022 TransferHook and PermanentDelegate extensions with danger", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "T2022",
      amount: 10,
      recipient: mockAmit,
      recipientLabel: "Amit",
      clarification: null,
    };

    const result = evaluateTransactionRisk({
      action,
      simulation: successfulSimulation,
      senderAddress: mockSender,
      senderBalanceSol: 2.0,
      contacts,
      txHistory: [],
      securityEnrichment: {
        tokenMeta: {
          mint: "Token2022Mint111111111111111111111111111111",
          mintAuthority: null,
          freezeAuthority: null,
          isToken2022: true,
          hasTransferHook: true,
          hasPermanentDelegate: true,
          hasTransferFee: true,
        },
      },
    });

    expect(result.flags.some((f) => f.id === "TOKEN_2022_TRANSFER_HOOK")).toBe(true);
    expect(result.flags.some((f) => f.id === "TOKEN_2022_PERMANENT_DELEGATE")).toBe(true);
    expect(result.flags.some((f) => f.id === "TOKEN_2022_TRANSFER_FEE")).toBe(true);
    expect(result.overallRisk).toBe("Risky");
    expect(result.hasDanger).toBe(true);
  });
});

