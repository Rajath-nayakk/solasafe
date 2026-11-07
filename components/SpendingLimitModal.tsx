"use client";

import React, { useState } from "react";
import { X, Sliders, Check } from "lucide-react";

interface SpendingLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  dailyLimitSol: number | null;
  dailySpentSol: number;
  onSaveLimit: (limit: number | null) => void;
}

export function SpendingLimitModal({
  isOpen,
  onClose,
  dailyLimitSol,
  dailySpentSol,
  onSaveLimit,
}: SpendingLimitModalProps) {
  const [limitInput, setLimitInput] = useState(
    dailyLimitSol !== null ? dailyLimitSol.toString() : "1.0"
  );
  const [isEnabled, setIsEnabled] = useState(dailyLimitSol !== null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEnabled) {
      onSaveLimit(null);
    } else {
      const val = parseFloat(limitInput);
      if (!isNaN(val) && val > 0) {
        onSaveLimit(val);
      } else {
        onSaveLimit(1.0);
      }
    }
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  const remaining = dailyLimitSol !== null ? Math.max(0, dailyLimitSol - dailySpentSol) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#0c101d] border border-white/[0.1] rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Daily Spending Limit</h2>
              <p className="text-[11px] text-zinc-400">Autonomous safety threshold per day</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-white/[0.06] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="p-5 space-y-5">
          <p className="text-xs text-zinc-400 leading-relaxed">
            Set an autonomous safety threshold. Transactions that cause today's cumulative transfer volume to exceed this cap trigger a mandatory <strong>Danger</strong> risk flag.
          </p>

          {/* Current Day Stats */}
          <div className="bg-black/30 p-3.5 rounded-2xl border border-white/[0.06] space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Spent Today (Devnet):</span>
              <span className="font-mono font-bold text-white">{dailySpentSol.toFixed(3)} SOL</span>
            </div>
            {dailyLimitSol !== null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Remaining Quota:</span>
                <span className="font-mono font-bold text-[#14F195]">
                  {remaining?.toFixed(3)} SOL
                </span>
              </div>
            )}
          </div>

          {/* Toggle Enable */}
          <div className="flex items-center justify-between bg-black/30 p-3 rounded-xl border border-white/[0.06]">
            <span className="text-xs font-semibold text-zinc-200">Enforce Daily Limit</span>
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-700 text-purple-600 focus:ring-purple-500 bg-zinc-900"
            />
          </div>

          {/* Input Limit */}
          {isEnabled && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300">
                Max SOL Allowed Per 24h
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  min="0.01"
                  value={limitInput}
                  onChange={(e) => setLimitInput(e.target.value)}
                  placeholder="1.0"
                  className="w-full bg-[#121626] border border-white/[0.08] rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-zinc-500 focus:outline-none focus:border-purple-500"
                />
                <span className="absolute right-3.5 top-2 text-xs font-bold text-zinc-500">
                  SOL
                </span>
              </div>
            </div>
          )}

          {savedSuccess && (
            <div className="p-2.5 bg-emerald-950/40 border border-emerald-800 text-[#14F195] text-xs rounded-xl flex items-center gap-2">
              <Check className="w-3.5 h-3.5" />
              <span>Limit updated successfully!</span>
            </div>
          )}

          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-zinc-300 text-xs font-semibold rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 solana-gradient-btn text-xs font-bold rounded-xl transition shadow-lg"
            >
              Save Cap
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
