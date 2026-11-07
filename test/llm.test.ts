import { describe, it, expect } from "vitest";
import {
  cleanJsonString,
  getActiveProvider,
  fallbackParseIntent,
  fallbackExplain,
  parseIntentWithLLM,
  explainWithLLM,
} from "../lib/llm";
import { ParsedAction, RiskAnalysis, SimulationResult } from "../lib/types";

describe("LLM Provider & Utility Tests", () => {
  it("defaults to gemini provider", () => {
    expect(getActiveProvider()).toBe("gemini");
  });

  it("strips markdown code blocks properly", () => {
    const raw = '```json\n{\n  "action": "transfer",\n  "amount": 0.1\n}\n```';
    expect(cleanJsonString(raw)).toBe('{\n  "action": "transfer",\n  "amount": 0.1\n}');
  });

  it("handles fallback intent parsing when no keys are configured", async () => {
    const addressBook = {
      Amit: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    };
    const res = await parseIntentWithLLM({
      text: "Send 0.2 SOL to Amit",
      addressBook,
    });

    expect(res.action).toBe("transfer");
    expect(res.amount).toBe(0.2);
    expect(res.recipient).toBe("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
    expect(res.recipientLabel).toBe("Amit");
  });

  it("handles fallback explanation when no keys are configured", async () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 0.1,
      recipient: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      recipientLabel: "Amit",
      clarification: null,
    };
    const simulation: SimulationResult = {
      success: true,
      err: null,
      computeUnits: 450,
      fee: 0.000005,
      programsInvoked: ["11111111111111111111111111111111"],
      senderSolDelta: -0.100005,
      recipientSolDelta: 0.1,
      tokenDeltas: [],
      rawLogs: ["Program 11111111111111111111111111111111 invoke [1]"],
    };
    const riskAnalysis: RiskAnalysis = {
      overallRisk: "Safe",
      flags: [],
      hasDanger: false,
      hasWarning: false,
      score: 100,
    };

    const res = await explainWithLLM({
      action,
      simulation,
      riskAnalysis,
    });

    expect(res.isAiGenerated).toBe(false);
    expect(res.provider).toBeNull();
    expect(res.explanation).toContain("This transaction will transfer 0.1 SOL to Amit");
    expect(res.verdict).toBe("Standard transfer with normal risk profile.");
  });

  it("flags risky transactions in fallback explanation", () => {
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: 5.0,
      recipient: "11111111111111111111111111111111",
      recipientLabel: null,
      clarification: null,
    };
    const simulation: SimulationResult = {
      success: true,
      err: null,
      computeUnits: 450,
      fee: 0.000005,
      programsInvoked: [],
      senderSolDelta: -5.000005,
      recipientSolDelta: 5.0,
      tokenDeltas: [],
      rawLogs: [],
    };
    const riskAnalysis: RiskAnalysis = {
      overallRisk: "Risky",
      flags: [
        {
          id: "DRAIN_WARNING",
          severity: "danger",
          message: "Transferring 95% of total wallet balance.",
        },
      ],
      hasDanger: true,
      hasWarning: false,
      score: 10,
    };

    const res = fallbackExplain(action, simulation, riskAnalysis);
    expect(res.isAiGenerated).toBe(false);
    expect(res.provider).toBeNull();
    expect(res.explanation).toContain("detected high-risk flags");
    expect(res.verdict).toContain("High-risk transaction detected");
  });
});
