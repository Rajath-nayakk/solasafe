"use client";

import React, { useState } from "react";
import { ArrowRight, Sparkles, ShieldCheck, AlertTriangle, ShieldAlert, Zap } from "lucide-react";

interface PromptBoxProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function PromptBox({ onSubmit, isLoading, disabled = false }: PromptBoxProps) {
  const [prompt, setPrompt] = useState("");

  const examples = [
    {
      label: "Send 0.1 SOL to Amit",
      prompt: "Send 0.1 SOL to Amit",
      desc: "Verified contact",
      badge: "Safe",
      badgeStyle: "bg-emerald-500/15 text-[#14F195] border-emerald-500/30",
    },
    {
      label: "Send 0.6 SOL to Bob",
      prompt: "Send 0.6 SOL to Bob",
      desc: ">50% wallet balance",
      badge: "Review",
      badgeStyle: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    },
    {
      label: "Send 5 SOL to Unknown",
      prompt: "Send 5 SOL to 8F9U2Gj2F9K8N9kY4vBvG1gN9kY4vBvG1gN9kY4vBvG1",
      desc: "Untrusted drainer",
      badge: "Risky",
      badgeStyle: "bg-rose-500/15 text-rose-400 border-rose-500/30",
    },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading || disabled) return;
    onSubmit(prompt.trim());
  };

  const handleSelectExample = (text: string) => {
    setPrompt(text);
    if (!isLoading && !disabled) {
      onSubmit(text);
    }
  };

  return (
    <div className="space-y-4">
      {/* Centerpiece Prompt Box with glowing focus */}
      <form onSubmit={handleSubmit} className="relative group">
        {/* Glow backdrop behind prompt box */}
        <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-r from-[#9945FF]/40 via-purple-600/30 to-[#14F195]/40 opacity-40 group-focus-within:opacity-100 blur-xl transition-all duration-300 -z-10" />

        <div className="relative rounded-2xl bg-[#0c101d]/90 border border-white/[0.12] p-2.5 shadow-2xl transition-all duration-200 group-focus-within:border-[#9945FF] group-focus-within:ring-2 group-focus-within:ring-[#9945FF]/20">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isLoading || disabled}
            rows={2}
            placeholder='Type a command in plain English... e.g. "Send 0.1 SOL to Amit"'
            className="w-full bg-transparent px-3 py-2 text-white placeholder-zinc-500 text-sm sm:text-base focus:outline-none resize-none font-normal"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />

          <div className="flex items-center justify-between pt-2 px-2 border-t border-white/[0.06] mt-1">
            <span className="text-[11px] text-zinc-400 flex items-center gap-1.5 hidden sm:flex">
              <span>Press</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white/[0.08] text-zinc-300 font-mono text-[10px]">Enter</kbd>
              <span>to simulate & audit</span>
            </span>

            <button
              type="submit"
              disabled={!prompt.trim() || isLoading || disabled}
              className="ml-auto px-4 py-2 rounded-xl solana-gradient-btn text-xs sm:text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all"
            >
              {isLoading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-zinc-950/20 border-t-zinc-950 rounded-full animate-spin" />
                  <span>Auditing...</span>
                </>
              ) : (
                <>
                  <span>Simulate & Check Safety</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Scenario Chips as Pill Buttons */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span>Interactive Test Scenarios:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {examples.map((ex) => (
            <button
              key={ex.label}
              onClick={() => handleSelectExample(ex.prompt)}
              disabled={isLoading || disabled}
              className="group p-3 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-purple-500/40 text-left transition-all flex flex-col justify-between gap-1.5"
            >
              <div className="flex items-center justify-between gap-1 w-full">
                <span className="text-xs font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                  {ex.label}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ex.badgeStyle}`}>
                  {ex.badge}
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 truncate">{ex.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
