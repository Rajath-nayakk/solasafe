"use client";

import React from "react";
import { Check, Loader2, Sparkles, Cpu, ShieldCheck, FileCheck, Layers } from "lucide-react";

export type PipelineStage = "idle" | "parsing" | "building" | "simulating" | "explaining" | "ready";

interface StepProgressProps {
  currentStage: PipelineStage;
}

export function StepProgress({ currentStage }: StepProgressProps) {
  if (currentStage === "idle") return null;

  const steps = [
    { id: "parsing", label: "Intent Parsing", desc: "Anthropic Claude", icon: Sparkles },
    { id: "building", label: "Tx Building", desc: "Versioned Msg", icon: Layers },
    { id: "simulating", label: "Simulation", desc: "Devnet Pre-flight", icon: Cpu },
    { id: "explaining", label: "Risk & Plain English", desc: "Security Engine", icon: ShieldCheck },
  ];

  const getStageIndex = (stage: PipelineStage) => {
    switch (stage) {
      case "parsing":
        return 0;
      case "building":
        return 1;
      case "simulating":
        return 2;
      case "explaining":
        return 3;
      case "ready":
        return 4;
      default:
        return -1;
    }
  };

  const activeIndex = getStageIndex(currentStage);

  return (
    <div className="rounded-2xl bg-[#0c101d]/80 border border-white/[0.08] p-4 backdrop-blur-xl animate-fade-in shadow-xl">
      <div className="flex items-center justify-between max-w-xl mx-auto gap-2">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isDone = activeIndex > idx;
          const isCurrent = activeIndex === idx;

          return (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    isDone
                      ? "bg-emerald-500/20 text-[#14F195] border border-emerald-500/40"
                      : isCurrent
                      ? "bg-gradient-to-tr from-[#9945FF] to-[#14F195] text-zinc-950 font-bold shadow-lg shadow-purple-500/30 animate-pulse"
                      : "bg-white/[0.04] text-zinc-500 border border-white/[0.08]"
                  }`}
                >
                  {isDone ? (
                    <Check className="w-4 h-4 text-[#14F195]" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-950" />
                  ) : (
                    <span className="text-xs font-semibold">{idx + 1}</span>
                  )}
                </div>
                <div className="hidden sm:block text-left">
                  <div
                    className={`text-xs font-bold ${
                      isDone
                        ? "text-zinc-200"
                        : isCurrent
                        ? "text-[#14F195]"
                        : "text-zinc-500"
                    }`}
                  >
                    {step.label}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">{step.desc}</div>
                </div>
              </div>

              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-[2px] rounded-full transition-all duration-300 ${
                    activeIndex > idx
                      ? "bg-gradient-to-r from-[#9945FF] to-[#14F195]"
                      : "bg-white/[0.08]"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
