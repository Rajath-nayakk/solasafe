"use client";

import React, { useState } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowDownRight,
  Wallet,
} from "lucide-react";
import {
  ParsedAction,
  SimulationResult,
  RiskAnalysis,
  ExplainResponse,
} from "@/lib/types";
import { RiskBadge, SeverityPill } from "./RiskBadge";
import { truncateAddress } from "@/lib/solana";

interface ConfirmationCardProps {
  action: ParsedAction;
  simulation: SimulationResult | null;
  riskAnalysis: RiskAnalysis;
  explanation: ExplainResponse;
  senderAddress: string;
  senderBalanceSol: number;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isSending: boolean;
  txSignature: string | null;
  sendError: string | null;
}

export function ConfirmationCard({
  action,
  simulation,
  riskAnalysis,
  explanation,
  senderAddress,
  senderBalanceSol,
  onConfirm,
  onCancel,
  isSending,
  txSignature,
  sendError,
}: ConfirmationCardProps) {
  const [understoodDanger, setUnderstoodDanger] = useState(false);
  const [copiedSig, setCopiedSig] = useState(false);

  const numAmount =
    typeof action.amount === "number"
      ? action.amount
      : action.amount === "half"
      ? senderBalanceSol / 2
      : senderBalanceSol;

  const estimatedFee = simulation?.fee || 0.000005;
  const projectedBalanceAfter = Math.max(0, senderBalanceSol - numAmount - estimatedFee);

  const canConfirm = !riskAnalysis.hasDanger || understoodDanger;

  const handleCopySignature = () => {
    if (txSignature) {
      navigator.clipboard.writeText(txSignature);
      setCopiedSig(true);
      setTimeout(() => setCopiedSig(false), 2000);
    }
  };

  // SUCCESS STATE
  if (txSignature) {
    return (
      <div className="rounded-2xl bg-[#0c101d]/90 border border-emerald-500/30 p-6 sm:p-8 shadow-2xl animate-fade-in space-y-6">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
            <CheckCircle2 className="w-6 h-6 text-[#14F195]" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Transaction Confirmed!</h2>
            <p className="text-xs text-zinc-400">Successfully finalized and verified on Solana Devnet.</p>
          </div>
        </div>

        <div className="bg-black/40 p-4 rounded-xl border border-white/[0.08] space-y-3">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Transaction Signature</span>
            <button
              onClick={handleCopySignature}
              className="flex items-center gap-1 text-[#14F195] hover:underline"
            >
              {copiedSig ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
          <div className="font-mono text-xs text-zinc-300 break-all select-all bg-white/[0.03] p-2.5 rounded-lg border border-white/[0.06]">
            {txSignature}
          </div>

          <a
            href={`https://explorer.solana.com/tx/${txSignature}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 solana-gradient-btn rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition shadow-lg"
          >
            <span>Inspect on Solana Explorer</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <button
          onClick={onCancel}
          className="w-full py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 rounded-xl text-xs font-semibold transition"
        >
          Done · Return to SolSafe
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-[#0c101d]/90 border border-white/[0.1] p-6 sm:p-8 shadow-2xl animate-fade-in space-y-6">
      {/* Top Header: Risk Level & Action Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
        <div>
          <div className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider mb-1">
            Pre-Signing Security Audit
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            Send <span className="solana-gradient-text">{numAmount} {action.token}</span>
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <RiskBadge level={riskAnalysis.overallRisk} size="lg" />
        </div>
      </div>

      {/* Plain English AI Explanation Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/30 via-[#0d1222] to-emerald-950/20 border border-purple-500/30 p-5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#14F195] mb-2.5">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="tracking-wide">PLAIN-ENGLISH EXPLANATION</span>
          {explanation.isAiGenerated ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium text-purple-300 bg-purple-950/70 px-2.5 py-0.5 rounded-full border border-purple-500/40 shadow-sm shadow-purple-500/20">
              <Sparkles className="w-3 h-3 text-purple-400" />
              AI explanation ({explanation.provider === "anthropic" ? "Claude" : "Gemini"})
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Template fallback
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-200 leading-relaxed font-normal">
          {explanation.explanation}
        </p>
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-xs text-zinc-300">
          <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-bold">Verdict:</span>
          <span className="italic text-zinc-200">{explanation.verdict}</span>
        </div>
      </div>

      {/* Transaction Details & Balance Delta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Recipient Details */}
        <div className="bg-black/30 p-4 rounded-2xl border border-white/[0.06] space-y-2">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">
            Recipient
          </div>
          <div className="font-bold text-sm text-white flex items-center gap-2">
            <span>{action.recipientLabel || "Direct Solana Key"}</span>
            {action.recipientLabel && (
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full border border-purple-500/30">
                Contact
              </span>
            )}
          </div>
          <div className="text-xs font-mono text-zinc-400 truncate">
            {action.recipient || "None"}
          </div>
        </div>

        {/* Balance Change Preview */}
        <div className="bg-black/30 p-4 rounded-2xl border border-white/[0.06] space-y-2">
          <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold flex items-center justify-between">
            <span>Sender Balance Delta</span>
            <span className="text-zinc-500 font-mono text-[10px]">Fee: ~{estimatedFee.toFixed(6)} SOL</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-0.5">
            <span className="text-zinc-400">Before:</span>
            <span className="font-mono text-zinc-300 font-semibold">{senderBalanceSol.toFixed(4)} SOL</span>
          </div>
          <div className="pt-1.5 border-t border-white/[0.06] flex items-center justify-between text-xs font-bold">
            <span className="text-zinc-300 flex items-center gap-1">
              <span>After:</span>
              <ArrowDownRight className="w-3.5 h-3.5 text-zinc-500" />
            </span>
            <span
              className={`font-mono text-xs ${
                projectedBalanceAfter < 0.002 ? "text-rose-400" : "text-[#14F195]"
              }`}
            >
              {projectedBalanceAfter.toFixed(4)} SOL
            </span>
          </div>
        </div>
      </div>

      {/* Deterministic Risk Flags */}
      <div className="space-y-2.5">
        <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
          Safety Engine Checks ({riskAnalysis.flags.length})
        </div>
        <div className="space-y-2">
          {riskAnalysis.flags.map((flag) => (
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

      {/* Simulation Diagnostics Strip */}
      {simulation && (
        <div className="p-3 bg-black/40 rounded-xl border border-white/[0.06] flex items-center justify-between text-xs text-zinc-400">
          <div className="flex items-center gap-3">
            <span>
              Compute: <strong className="text-zinc-200 font-mono">{simulation.computeUnits.toLocaleString()} CU</strong>
            </span>
            <span>·</span>
            <span>
              Programs: <strong className="text-zinc-200 font-mono">{simulation.programsInvoked.length} verified</strong>
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              simulation.success
                ? "bg-emerald-500/10 text-[#14F195] border border-emerald-500/30"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
            }`}
          >
            {simulation.success ? "Devnet Simulated OK" : "Simulation Error"}
          </span>
        </div>
      )}

      {/* Error Banner if Signing or Sending Failed */}
      {sendError && (
        <div className="p-3 bg-rose-950/40 border border-rose-800 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{sendError}</span>
        </div>
      )}

      {/* Danger Safety Gate Checkbox */}
      {riskAnalysis.hasDanger && (
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

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={onCancel}
          disabled={isSending}
          className="flex-1 py-3 px-4 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 font-semibold text-xs sm:text-sm rounded-xl transition"
        >
          Cancel
        </button>

        <button
          onClick={onConfirm}
          disabled={!canConfirm || isSending}
          className={`flex-2 py-3 px-6 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xl ${
            !canConfirm
              ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700"
              : riskAnalysis.hasDanger
              ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30"
              : "solana-gradient-btn shadow-purple-600/30"
          }`}
        >
          {isSending ? (
            <>
              <span className="w-4 h-4 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
              <span>Sign in Phantom & Confirm...</span>
            </>
          ) : (
            <>
              <span>Confirm & Sign in Wallet</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
