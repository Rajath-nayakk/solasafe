"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Wallet,
  ArrowDownRight,
} from "lucide-react";
import { RiskBadge, SeverityPill } from "@/components/RiskBadge";
import { OverallRisk, ParsedAction, SimulationResult, RiskAnalysis, ExplainResponse } from "@/lib/types";

export default function DemoPage() {
  const [activeScenario, setActiveScenario] = useState<"safe" | "review" | "risky">("safe");
  const [understoodDanger, setUnderstoodDanger] = useState(false);
  const [txConfirmed, setTxConfirmed] = useState(false);

  const scenarios = {
    safe: {
      title: "Scenario 1: Safe Transfer",
      command: "Send 0.1 SOL to Amit",
      action: {
        action: "transfer",
        token: "SOL",
        amount: 0.1,
        recipient: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
        recipientLabel: "Amit",
        clarification: null,
      } as ParsedAction,
      simulation: {
        success: true,
        err: null,
        computeUnits: 150,
        fee: 0.000005,
        programsInvoked: ["11111111111111111111111111111111"],
        senderSolDelta: -0.100005,
        recipientSolDelta: 0.1,
        tokenDeltas: [],
        rawLogs: ["Program 11111111111111111111111111111111 invoke [1]", "Program 11111111111111111111111111111111 success"],
      } as SimulationResult,
      riskAnalysis: {
        overallRisk: "Safe" as OverallRisk,
        hasDanger: false,
        hasWarning: false,
        flags: [
          {
            id: "CLEAN_CHECKS",
            severity: "info",
            message: "All deterministic safety checks passed.",
            detail: "Recipient is a verified contact, transfer size is safe, standard System Program invoked.",
          },
        ],
      } as RiskAnalysis,
      explanation: {
        explanation:
          "This transaction transfers 0.1 SOL to your saved contact Amit. The Solana network fee is minimal (~0.000005 SOL), and your remaining balance (1.90 SOL) remains healthy for future transactions.",
        verdict: "Standard transfer to a known contact with safe risk parameters.",
        isAiGenerated: true,
      } as ExplainResponse,
      balanceBefore: 2.0,
    },
    review: {
      title: "Scenario 2: Warning Review",
      command: "Send 0.7 SOL to Bob",
      action: {
        action: "transfer",
        token: "SOL",
        amount: 0.7,
        recipient: "Bob5Gj2F9K8N9kY4vBvG1gN9kY4vBvG1gN9kY4vBvG1",
        recipientLabel: "Bob",
        clarification: null,
      } as ParsedAction,
      simulation: {
        success: true,
        err: null,
        computeUnits: 150,
        fee: 0.000005,
        programsInvoked: ["11111111111111111111111111111111"],
        senderSolDelta: -0.700005,
        recipientSolDelta: 0.7,
        tokenDeltas: [],
        rawLogs: ["Program 11111111111111111111111111111111 success"],
      } as SimulationResult,
      riskAnalysis: {
        overallRisk: "Review" as OverallRisk,
        hasDanger: false,
        hasWarning: true,
        flags: [
          {
            id: "LARGE_PERCENTAGE_AMOUNT",
            severity: "warning",
            message: "Large transfer: Amount is 70% of your total SOL balance.",
            detail: "Sending 0.7 SOL out of your 1.0 SOL total balance.",
          },
        ],
      } as RiskAnalysis,
      explanation: {
        explanation:
          "This transaction will send 0.7 SOL to Bob. Please note that this single transfer consumes 70% of your current wallet balance. The estimated network fee is ~0.000005 SOL.",
        verdict: "Review recommended: unusual transfer percentage (> 50% of wallet).",
        isAiGenerated: true,
      } as ExplainResponse,
      balanceBefore: 1.0,
    },
    risky: {
      title: "Scenario 3: Critical Danger",
      command: "Send 5 SOL to Unknown Drainer",
      action: {
        action: "transfer",
        token: "SOL",
        amount: 5.0,
        recipient: "8F9U2Gj2F9K8N9kY4vBvG1gN9kY4vBvG1gN9kY4vBvG1",
        recipientLabel: null,
        clarification: null,
      } as ParsedAction,
      simulation: {
        success: true,
        err: null,
        computeUnits: 150,
        fee: 0.000005,
        programsInvoked: ["11111111111111111111111111111111", "MaliciousDrainer111111111111111111111111111"],
        senderSolDelta: -5.000005,
        recipientSolDelta: 5.0,
        tokenDeltas: [],
        rawLogs: ["Program MaliciousDrainer111111111111111111111111111 invoke [1]"],
      } as SimulationResult,
      riskAnalysis: {
        overallRisk: "Risky" as OverallRisk,
        hasDanger: true,
        hasWarning: true,
        flags: [
          {
            id: "KNOWN_SCAM_ADDRESS",
            severity: "danger",
            message: "CRITICAL THREAT: Recipient is a confirmed malicious scam / drainer address!",
            detail: "This address has been blacklisted as a known phishing drainer. Transferring funds will result in irreversible theft.",
          },
          {
            id: "CRITICAL_DRAIN_AMOUNT",
            severity: "danger",
            message: "Critical balance drain: Transfer will drain 98% of your wallet's SOL.",
            detail: "Attempting to send 5.0 SOL out of 5.1 SOL available.",
          },
          {
            id: "UNKNOWN_PROGRAM_INVOKED",
            severity: "danger",
            message: "Untrusted Program: Transaction invokes non-standard program(s).",
            detail: "Invoked program ID: MaliciousDrainer111111111111111111111111111.",
          },
        ],
      } as RiskAnalysis,
      explanation: {
        explanation:
          "CRITICAL THREAT: This transaction sends 5.0 SOL to a confirmed malicious phishing drainer address blacklisted on Solana. In addition, it drains 98% of your wallet. Do NOT approve under any circumstance.",
        verdict: "Extremely high risk: confirmed drainer address and wallet drain detected.",
        isAiGenerated: true,
      } as ExplainResponse,
      balanceBefore: 5.1,
    },
  };

  const current = scenarios[activeScenario];
  const numAmount = current.action.amount as number;
  const projectedAfter = Math.max(0, current.balanceBefore - numAmount - current.simulation.fee);
  const canConfirm = !current.riskAnalysis.hasDanger || understoodDanger;

  return (
    <div className="min-h-screen bg-[#070913] text-zinc-100 flex flex-col relative selection:bg-[#9945FF] selection:text-white">
      {/* Background glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-purple-600/15 to-transparent blur-[120px] pointer-events-none -z-10" />

      {/* Slim Top Bar */}
      <header className="border-b border-white/[0.06] bg-[#070913]/80 backdrop-blur-xl px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Live App</span>
          </Link>
          <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[#14F195]" />
            <span>SolSafe Hackathon Presentation Mode</span>
          </span>
        </div>

        <span className="text-[11px] font-mono text-zinc-500">Offline Seeded Data</span>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Scenario Switcher */}
        <div className="rounded-2xl bg-[#0c101d]/90 border border-white/[0.08] p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl">
          <div className="text-xs font-bold text-zinc-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#14F195]" />
            <span>Select Demo Scenario:</span>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setActiveScenario("safe");
                setTxConfirmed(false);
                setUnderstoodDanger(false);
              }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeScenario === "safe"
                  ? "bg-emerald-500/20 text-[#14F195] border border-emerald-500/40 shadow-lg shadow-emerald-500/10"
                  : "bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              1. Safe Flow
            </button>
            <button
              onClick={() => {
                setActiveScenario("review");
                setTxConfirmed(false);
                setUnderstoodDanger(false);
              }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeScenario === "review"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-lg shadow-amber-500/10"
                  : "bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              2. Review Flow
            </button>
            <button
              onClick={() => {
                setActiveScenario("risky");
                setTxConfirmed(false);
                setUnderstoodDanger(false);
              }}
              className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeScenario === "risky"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/40 shadow-lg shadow-rose-500/10"
                  : "bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06]"
              }`}
            >
              3. Risky Flow
            </button>
          </div>
        </div>

        {/* Command Pill */}
        <div className="rounded-2xl bg-black/40 border border-white/[0.06] p-3.5 flex items-center justify-between text-xs">
          <div className="text-zinc-400">
            Simulated User Input: <strong className="text-white font-mono ml-1.5">"{current.command}"</strong>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono bg-white/[0.04] px-2 py-0.5 rounded-full">
            Devnet Seeded
          </span>
        </div>

        {/* Confirmed State */}
        {txConfirmed ? (
          <div className="rounded-2xl bg-[#0c101d]/90 border border-emerald-500/30 p-8 shadow-2xl space-y-6 animate-fade-in text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
              <CheckCircle2 className="w-8 h-8 text-[#14F195]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">Demo Transaction Confirmed!</h2>
              <p className="text-xs text-zinc-400 mt-1">Simulated execution confirmed on Solana Devnet.</p>
            </div>
            <div className="p-3 bg-black/40 rounded-xl font-mono text-xs text-zinc-300 select-all border border-white/[0.06] max-w-lg mx-auto break-all">
              5KnQGvU3XwLhMhKzP18K8N9kY4vBvG1gN9kY4vBvG19xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin
            </div>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => setTxConfirmed(false)}
                className="px-5 py-2.5 solana-gradient-btn text-xs font-bold rounded-xl transition shadow-lg"
              >
                Reset Demo Scenario
              </button>
              <Link
                href="/"
                className="px-5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-200 text-xs font-semibold rounded-xl transition"
              >
                Return to Live App
              </Link>
            </div>
          </div>
        ) : (
          /* Confirmation Card */
          <div className="rounded-2xl bg-[#0c101d]/90 border border-white/[0.1] p-6 sm:p-8 shadow-2xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
              <div>
                <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">
                  SolSafe Security Audit
                </div>
                <h2 className="text-2xl font-black text-white tracking-tight">
                  Send <span className="solana-gradient-text">{numAmount} {current.action.token}</span>
                </h2>
              </div>
              <RiskBadge level={current.riskAnalysis.overallRisk} size="lg" />
            </div>

            {/* AI Explanation */}
            <div className="rounded-2xl bg-gradient-to-r from-purple-950/30 via-[#0d1222] to-emerald-950/20 border border-purple-500/30 p-5">
              <div className="flex items-center gap-2 text-xs font-bold text-[#14F195] mb-2.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="tracking-wide">PLAIN-ENGLISH EXPLANATION</span>
                <span className="ml-auto text-[10px] font-normal text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded-full border border-purple-800/50">
                  Anthropic Claude
                </span>
              </div>
              <p className="text-sm text-zinc-200 leading-relaxed font-normal">
                {current.explanation.explanation}
              </p>
              <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-xs text-zinc-300">
                <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-bold">Verdict:</span>
                <span className="italic text-zinc-200">{current.explanation.verdict}</span>
              </div>
            </div>

            {/* Recipient & Balance Delta */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="bg-black/30 p-4 rounded-2xl border border-white/[0.06] space-y-2">
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
                  Recipient
                </div>
                <div className="font-bold text-sm text-white">
                  {current.action.recipientLabel || "Direct Solana Key"}
                </div>
                <div className="text-xs font-mono text-zinc-400 truncate">
                  {current.action.recipient}
                </div>
              </div>

              <div className="bg-black/30 p-4 rounded-2xl border border-white/[0.06] space-y-2">
                <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold flex items-center justify-between">
                  <span>Sender Balance Delta</span>
                  <span className="text-zinc-500 font-mono text-[10px]">Fee: ~0.000005 SOL</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-0.5">
                  <span className="text-zinc-400">Before:</span>
                  <span className="font-mono text-zinc-300 font-semibold">{current.balanceBefore.toFixed(2)} SOL</span>
                </div>
                <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold">
                  <span className="text-zinc-300 flex items-center gap-1">
                    <span>After:</span>
                    <ArrowDownRight className="w-3.5 h-3.5 text-zinc-500" />
                  </span>
                  <span className={`font-mono text-xs ${projectedAfter < 0.002 ? "text-rose-400" : "text-[#14F195]"}`}>
                    {projectedAfter.toFixed(4)} SOL
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Flags */}
            <div className="space-y-2.5">
              <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                Deterministic Risk Engine Checks ({current.riskAnalysis.flags.length})
              </div>
              <div className="space-y-2">
                {current.riskAnalysis.flags.map((flag) => (
                  <div
                    key={flag.id}
                    className={`p-3 rounded-2xl border flex items-start gap-3 transition-colors ${
                      flag.severity === "danger"
                        ? "bg-rose-950/25 border-rose-800/50 text-rose-200"
                        : flag.severity === "warning"
                        ? "bg-amber-950/25 border-amber-800/50 text-amber-200"
                        : "bg-black/30 border-white/[0.06] text-zinc-300"
                    }`}
                  >
                    <div className="mt-0.5">
                      <SeverityPill severity={flag.severity} />
                    </div>
                    <div className="min-w-0 text-xs">
                      <div className="font-semibold text-white">{flag.message}</div>
                      {flag.detail && <div className="text-zinc-400 mt-0.5 text-[11px] leading-relaxed">{flag.detail}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Danger acknowledgment checkbox */}
            {current.riskAnalysis.hasDanger && (
              <div className="p-4 bg-rose-950/30 border border-rose-700/60 rounded-2xl">
                <label className="flex items-start sm:items-center gap-3 cursor-pointer text-xs font-semibold text-rose-200 select-none">
                  <input
                    type="checkbox"
                    checked={understoodDanger}
                    onChange={(e) => setUnderstoodDanger(e.target.checked)}
                    className="w-4 h-4 mt-0.5 sm:mt-0 rounded border-rose-600 text-rose-600 focus:ring-rose-500 bg-zinc-900 shrink-0"
                  />
                  <span>I acknowledge the critical risk flags above and wish to proceed with signing anyway.</span>
                </label>
              </div>
            )}

            {/* Confirm Button */}
            <button
              onClick={() => setTxConfirmed(true)}
              disabled={!canConfirm}
              className={`w-full py-3 px-6 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition ${
                !canConfirm
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
                  : current.riskAnalysis.hasDanger
                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
                  : "solana-gradient-btn shadow-purple-600/30"
              }`}
            >
              <span>Confirm & Sign in Wallet (Simulated Demo)</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
