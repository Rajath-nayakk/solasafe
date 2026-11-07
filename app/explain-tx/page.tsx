"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Search,
  ExternalLink,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Cpu,
  Layers,
  Coins,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  ArrowLeft,
} from "lucide-react";
import { RiskBadge, SeverityPill } from "@/components/RiskBadge";
import { truncateAddress } from "@/lib/solana";

const SAMPLE_TXS = [
  {
    label: "SOL Transfer",
    signature: "53HYNRxGnwGaU7EYjrU3LkpQeAnWjDJ9yJqGK1KE6e9unoopkSocU3PLzC2CeVT4Rv7PvHjpVSo45RLS1r46czzr",
    type: "Safe",
  },
  {
    label: "DeFi / Token Program",
    signature: "4n8USw2yHeLqcRTpBtwqBktU3z9DUGq8vasiWRBJJRPAGSKKpNVychWprTt85XbBCNopsvPzD5xPYvRCCuVaNQBs",
    type: "Review",
  },
  {
    label: "Complex Compute Execution",
    signature: "3AstqR7U7kuYCN3e9k6xr5rakLMoFrWqchZXFMkzTu1hCg2G1sHD34GnNNBxf199xc1CdsjXpTCQTr39hNvooeBT",
    type: "Heavy",
  },
];

export default function ExplainTxPage() {
  const [signature, setSignature] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [copiedAccount, setCopiedAccount] = useState<string | null>(null);

  const handleInspect = async (sigToInspect?: string) => {
    const targetSig = (sigToInspect || signature).trim();
    if (!targetSig) return;

    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch("/api/explain-tx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: targetSig }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to inspect transaction.");
      }
      setData(resData);
      setSignature(targetSig);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedAccount(text);
    setTimeout(() => setCopiedAccount(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#070913] text-zinc-100 flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070913]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Wallet</span>
            </Link>
            <div className="h-4 w-[1px] bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                Sol<span className="text-[#14F195]">Safe</span>
              </span>
              <span className="text-xs text-zinc-400 font-medium hidden sm:inline">
                / Transaction Inspector
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-[#14F195] border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse" />
              Devnet
            </span>
            <Link
              href="/demo"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-700/40 text-purple-300 transition"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Demo Scenarios</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#14F195]" />
            <span>Explain Any Devnet Transaction</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Understand What Happened <br />
            <span className="solana-gradient-text">In Plain English</span>
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Paste any finalized Solana Devnet transaction signature to parse net balance changes, identify programs, and generate an AI-powered safety audit.
          </p>
        </div>

        {/* Search Bar */}
        <div className="glass-card p-2 sm:p-2.5 rounded-2xl border border-white/10 shadow-2xl focus-within:border-purple-500/60 transition">
          <div className="flex items-center gap-2">
            <div className="pl-3 text-zinc-400">
              <Search className="w-5 h-5 text-purple-400" />
            </div>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleInspect()}
              placeholder="Paste Solana Devnet transaction signature..."
              className="flex-1 bg-transparent py-2.5 px-2 text-sm text-white placeholder-zinc-500 outline-none font-mono"
            />
            <button
              onClick={() => handleInspect()}
              disabled={loading || !signature.trim()}
              className="px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-[#9945FF] to-[#14F195] hover:opacity-90 disabled:opacity-50 text-white shadow-lg transition flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Inspecting...</span>
                </>
              ) : (
                <>
                  <span>Explain Tx</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Example Clickable Chips */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-zinc-500" />
            <span>Click an example transaction to test immediately:</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {SAMPLE_TXS.map((sample) => (
              <button
                key={sample.signature}
                onClick={() => handleInspect(sample.signature)}
                className="text-left p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] hover:border-purple-500/40 transition group space-y-1"
              >
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-zinc-200 group-hover:text-purple-300 transition">
                    {sample.label}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-zinc-400">
                    {sample.type}
                  </span>
                </div>
                <div className="text-[10px] font-mono text-zinc-500 truncate">
                  {sample.signature}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5 animate-fade-in">
            <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Result Inspection Card */}
        {data && (
          <div className="space-y-6 animate-fade-in">
            {/* Header Summary */}
            <div className="glass-card p-6 rounded-2xl border border-white/10 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400">
                      Signature: {truncateAddress(data.signature, 8)}
                    </span>
                    <button
                      onClick={() => handleCopy(data.signature)}
                      className="text-zinc-500 hover:text-white"
                      title="Copy full signature"
                    >
                      {copiedAccount === data.signature ? (
                        <Check className="w-3.5 h-3.5 text-[#14F195]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <a
                      href={`https://explorer.solana.com/tx/${data.signature}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#14F195] hover:underline flex items-center gap-1 text-xs"
                    >
                      <span>Solana Explorer</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-[11px] text-zinc-500 flex items-center gap-3">
                    <span>Slot: #{data.slot.toLocaleString()}</span>
                    {data.blockTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(data.blockTime * 1000).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <RiskBadge level={data.riskAnalysis.overallRisk} size="md" />
                  <span
                    className={`text-xs px-2.5 py-1 rounded-xl font-bold border ${
                      data.isSuccess
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                    }`}
                  >
                    {data.isSuccess ? "Confirmed" : "Failed"}
                  </span>
                </div>
              </div>

              {/* Plain English AI Explanation Card */}
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-950/30 via-[#0d1222] to-emerald-950/20 border border-purple-500/30 p-5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#14F195] mb-2.5">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="tracking-wide">PLAIN-ENGLISH AUDIT</span>
                  {data.explanation.isAiGenerated ? (
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium text-purple-300 bg-purple-950/70 px-2.5 py-0.5 rounded-full border border-purple-500/40">
                      <Sparkles className="w-3 h-3 text-purple-400" />
                      AI explanation ({data.explanation.provider === "anthropic" ? "Claude" : "Gemini"})
                    </span>
                  ) : (
                    <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-medium text-amber-300 bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-500/40">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Template fallback
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-200 leading-relaxed">
                  {data.explanation.explanation}
                </p>
                <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center gap-2 text-xs">
                  <span className="text-zinc-500 uppercase tracking-wider text-[10px] font-bold">Verdict:</span>
                  <span className="italic text-zinc-200">{data.explanation.verdict}</span>
                </div>
              </div>

              {/* Stat Highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-black/30 p-3 rounded-xl border border-white/[0.06] space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                    <Coins className="w-3 h-3 text-amber-400" />
                    <span>Amount</span>
                  </div>
                  <div className="text-sm font-bold text-white font-mono">
                    {data.action.amount} SOL
                  </div>
                </div>

                <div className="bg-black/30 p-3 rounded-xl border border-white/[0.06] space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                    <Coins className="w-3 h-3 text-emerald-400" />
                    <span>Network Fee</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-300 font-mono">
                    ~{data.feeSol.toFixed(6)} SOL
                  </div>
                </div>

                <div className="bg-black/30 p-3 rounded-xl border border-white/[0.06] space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                    <Cpu className="w-3 h-3 text-purple-400" />
                    <span>Compute Units</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-300 font-mono">
                    {data.computeUnits.toLocaleString()} CU
                  </div>
                </div>

                <div className="bg-black/30 p-3 rounded-xl border border-white/[0.06] space-y-1">
                  <div className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
                    <Layers className="w-3 h-3 text-indigo-400" />
                    <span>Programs</span>
                  </div>
                  <div className="text-sm font-bold text-zinc-300 font-mono">
                    {data.programsInvoked.length} Invoked
                  </div>
                </div>
              </div>

              {/* Deterministic Risk Flags */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Security Check Analysis
                </div>
                <div className="space-y-2">
                  {data.riskAnalysis.flags.map((flag: any) => (
                    <div
                      key={flag.id}
                      className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-start gap-3"
                    >
                      <SeverityPill severity={flag.severity} />
                      <div className="flex-1 space-y-0.5">
                        <div className="text-xs font-semibold text-zinc-200">
                          {flag.message}
                        </div>
                        {flag.detail && (
                          <div className="text-[11px] text-zinc-400 font-mono">
                            {flag.detail}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Balance Deltas Breakdown */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Account Balance Changes (Net Deltas)
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/[0.06] bg-black/40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-zinc-400 text-[10px] uppercase">
                        <th className="p-3">Account</th>
                        <th className="p-3">Role</th>
                        <th className="p-3 text-right">Pre-Balance</th>
                        <th className="p-3 text-right">Post-Balance</th>
                        <th className="p-3 text-right">Net Delta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04] font-mono">
                      {data.balanceDeltas.map((d: any, i: number) => (
                        <tr key={i} className="hover:bg-white/[0.02]">
                          <td className="p-3 flex items-center gap-1.5 text-zinc-300">
                            <span>{truncateAddress(d.account, 4)}</span>
                            <button
                              onClick={() => handleCopy(d.account)}
                              className="text-zinc-500 hover:text-white"
                            >
                              {copiedAccount === d.account ? (
                                <Check className="w-3 h-3 text-[#14F195]" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </td>
                          <td className="p-3 font-sans text-zinc-400 text-[11px]">
                            {d.role}
                          </td>
                          <td className="p-3 text-right text-zinc-400">
                            {d.pre.toFixed(4)} SOL
                          </td>
                          <td className="p-3 text-right text-zinc-400">
                            {d.post.toFixed(4)} SOL
                          </td>
                          <td
                            className={`p-3 text-right font-bold ${
                              d.delta > 0
                                ? "text-[#14F195]"
                                : d.delta < 0
                                ? "text-rose-400"
                                : "text-zinc-500"
                            }`}
                          >
                            {d.delta > 0 ? `+${d.delta.toFixed(6)}` : d.delta.toFixed(6)} SOL
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Invoked Programs */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Invoked Programs
                </div>
                <div className="flex flex-wrap gap-2">
                  {data.programsInvoked.map((pId: string) => (
                    <div
                      key={pId}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-xs font-mono text-zinc-300 flex items-center gap-2"
                    >
                      <Layers className="w-3.5 h-3.5 text-purple-400" />
                      <span>{pId}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

