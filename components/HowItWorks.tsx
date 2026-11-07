"use client";

import React from "react";
import { MessageSquareText, Cpu, ShieldCheck, FileCheck } from "lucide-react";

export function HowItWorks() {
  const steps = [
    {
      num: "01",
      title: "Plain-English Intent",
      desc: "Type commands naturally. SolSafe parses recipient, token, and amount while strictly matching saved address book contacts.",
      icon: MessageSquareText,
      accent: "from-indigo-500/20 to-purple-500/10 border-indigo-500/30 text-indigo-400",
    },
    {
      num: "02",
      title: "Versioned Tx Builder",
      desc: "Builds atomic Solana VersionedTransactions, automatically detecting and creating missing Associated Token Accounts (ATAs).",
      icon: Cpu,
      accent: "from-purple-500/20 to-pink-500/10 border-purple-500/30 text-purple-400",
    },
    {
      num: "03",
      title: "Devnet Simulation",
      desc: "Executes simulateTransaction on-chain before signing. Audits compute units, fees, and exact balance modifications.",
      icon: FileCheck,
      accent: "from-sky-500/20 to-cyan-500/10 border-sky-500/30 text-sky-400",
    },
    {
      num: "04",
      title: "Deterministic Safety",
      desc: "Audits hard security rules (drains, blacklisted scam addresses, daily caps) and translates everything to plain English.",
      icon: ShieldCheck,
      accent: "from-emerald-500/20 to-[#14F195]/10 border-emerald-500/30 text-[#14F195]",
    },
  ];

  return (
    <div className="rounded-2xl bg-[#0c101d]/60 border border-white/[0.08] p-6 sm:p-7 backdrop-blur-xl shadow-xl space-y-5">
      <div className="max-w-xl mx-auto text-center">
        <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
          How SolSafe Protects You
        </h3>
        <p className="text-xs text-zinc-400 mt-1">
          Zero blind signing. Full pre-flight transparency in 4 autonomous stages.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {steps.map((st) => {
          const Icon = st.icon;
          return (
            <div
              key={st.num}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06] hover:border-purple-500/30 transition-all flex flex-col justify-between space-y-3 group"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${st.accent} border flex items-center justify-center shadow-sm`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-mono text-[11px] font-bold text-zinc-600 group-hover:text-zinc-400 transition-colors">
                    {st.num}
                  </span>
                </div>
                <h4 className="font-bold text-xs text-white group-hover:text-purple-300 transition-colors">
                  {st.title}
                </h4>
                <p className="text-[11px] text-zinc-400 leading-relaxed mt-1">
                  {st.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
