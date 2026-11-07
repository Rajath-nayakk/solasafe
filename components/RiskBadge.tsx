"use client";

import React from "react";
import { ShieldCheck, AlertTriangle, ShieldAlert, Info } from "lucide-react";
import { OverallRisk, RiskSeverity } from "@/lib/types";

interface RiskBadgeProps {
  level: OverallRisk;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
}

export function RiskBadge({ level, showIcon = true, size = "md" }: RiskBadgeProps) {
  const configs = {
    Safe: {
      bg: "bg-emerald-500/15 border-emerald-500/30 text-[#14F195]",
      icon: ShieldCheck,
      label: "Safe",
      glow: "shadow-emerald-500/10",
    },
    Review: {
      bg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
      icon: AlertTriangle,
      label: "Review Needed",
      glow: "shadow-amber-500/10",
    },
    Risky: {
      bg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
      icon: ShieldAlert,
      label: "Risky",
      glow: "shadow-rose-500/10",
    },
  };

  const config = configs[level] || configs.Safe;
  const Icon = config.icon;

  const sizeClasses = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs font-semibold gap-1.5",
    lg: "px-3.5 py-1.5 text-xs sm:text-sm font-bold gap-2",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border shadow-sm ${config.bg} ${config.glow} ${sizeClasses[size]}`}
    >
      {showIcon && <Icon className={size === "sm" ? "w-3 h-3" : size === "md" ? "w-3.5 h-3.5" : "w-4 h-4"} />}
      <span>{config.label}</span>
    </span>
  );
}

export function SeverityPill({ severity }: { severity: RiskSeverity }) {
  if (severity === "danger") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-rose-950/60 text-rose-400 border border-rose-800/60">
        <ShieldAlert className="w-3 h-3 text-rose-400" />
        <span>Danger</span>
      </span>
    );
  }
  if (severity === "warning") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-amber-950/60 text-amber-400 border border-amber-800/60">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        <span>Warning</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-md bg-sky-950/60 text-sky-400 border border-sky-800/60">
      <Info className="w-3 h-3 text-sky-400" />
      <span>Info</span>
    </span>
  );
}
