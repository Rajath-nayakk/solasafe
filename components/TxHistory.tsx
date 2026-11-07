"use client";

import React, { useState } from "react";
import { History, ExternalLink, Copy, Check, Trash2, ArrowUpRight } from "lucide-react";
import { TxHistoryItem } from "@/lib/types";
import { RiskBadge } from "./RiskBadge";
import { truncateAddress } from "@/lib/solana";

interface TxHistoryProps {
  history: TxHistoryItem[];
  onClearHistory: () => void;
}

export function TxHistory({ history, onClearHistory }: TxHistoryProps) {
  const [copiedSig, setCopiedSig] = useState<string | null>(null);

  const handleCopy = (sig: string) => {
    navigator.clipboard.writeText(sig);
    setCopiedSig(sig);
    setTimeout(() => setCopiedSig(null), 2000);
  };

  if (history.length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-[#0c101d]/70 border border-white/[0.08] p-5 sm:p-6 backdrop-blur-xl space-y-3.5 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold text-xs text-white uppercase tracking-wider">
            Session Activity ({history.length})
          </h3>
        </div>
        <button
          onClick={onClearHistory}
          className="text-[11px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition"
          title="Clear session history"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Clear</span>
        </button>
      </div>

      <div className="space-y-2">
        {history.map((tx) => (
          <div
            key={tx.signature}
            className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 group hover:border-purple-500/30 transition"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <ArrowUpRight className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-xs text-white flex items-center gap-2">
                  <span>Send {tx.amount} {tx.token}</span>
                  <RiskBadge level={tx.riskLevel} size="sm" />
                </div>
                <div className="text-[11px] text-zinc-400 truncate mt-0.5">
                  To: <span className="font-mono text-zinc-300">{tx.recipientLabel || truncateAddress(tx.recipient, 4)}</span>
                  <span className="text-zinc-600 ml-2">
                    {new Date(tx.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <button
                onClick={() => handleCopy(tx.signature)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg bg-white/[0.04] border border-white/[0.06] transition"
                title="Copy Signature"
              >
                {copiedSig === tx.signature ? (
                  <Check className="w-3 h-3 text-[#14F195]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>

              <a
                href={`https://explorer.solana.com/tx/${tx.signature}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 text-[11px] font-semibold text-[#14F195] hover:underline bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-1 transition"
                title="View on Solana Explorer"
              >
                <span>Explorer</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
