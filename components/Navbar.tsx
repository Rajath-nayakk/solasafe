"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  ShieldAlert,
  Droplets,
  Copy,
  Check,
  RefreshCw,
  BookUser,
  Sliders,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { truncateAddress } from "@/lib/solana";

interface NavbarProps {
  onOpenAddressBook: () => void;
  onOpenSpendingLimit: () => void;
  solBalance: number | null;
  onRefreshBalance: () => void;
  isRefreshingBalance: boolean;
}

export function Navbar({
  onOpenAddressBook,
  onOpenSpendingLimit,
  solBalance,
  onRefreshBalance,
  isRefreshingBalance,
}: NavbarProps) {
  const { publicKey } = useWallet();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#070913]/80 backdrop-blur-xl transition-all">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#9945FF] to-[#14F195] p-[1px] shadow-lg shadow-purple-500/20">
            <div className="w-full h-full rounded-[11px] bg-[#0d111e] flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-[#14F195]" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-white">
              Sol<span className="text-[#14F195]">Safe</span>
            </span>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-500/10 text-[#14F195] border border-emerald-500/20 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#14F195] animate-pulse"></span>
              Devnet
            </span>
          </div>
        </div>

        {/* Action Controls & Wallet */}
        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Faucet Link */}
          <a
            href="https://faucet.solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition group"
            title="Get free Devnet SOL from the official faucet"
          >
            <Droplets className="w-4 h-4 text-sky-400 group-hover:scale-110 transition-transform" />
          </a>

          {/* Address Book Modal Trigger */}
          <button
            onClick={onOpenAddressBook}
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition group"
            title="Manage Contacts (Address Book)"
          >
            <BookUser className="w-4 h-4 text-indigo-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Spending Limit Modal Trigger */}
          <button
            onClick={onOpenSpendingLimit}
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] flex items-center justify-center text-zinc-300 hover:text-white transition group"
            title="Configure Daily Spending Cap"
          >
            <Sliders className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
          </button>

          {/* Demo Mode Button */}
          <a
            href="/demo"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-xl bg-purple-950/40 hover:bg-purple-900/50 border border-purple-700/40 text-purple-300 transition"
            title="Preset scenario presentation mode"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Demo Mode</span>
          </a>

          {/* Connected Address & Balance Display */}
          {publicKey && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 bg-white/[0.04] border border-white/[0.08] rounded-xl text-xs">
              <span className="text-zinc-400 font-mono text-[11px]">
                {truncateAddress(publicKey.toBase58(), 4)}
              </span>
              <button
                onClick={handleCopy}
                className="text-zinc-500 hover:text-zinc-200 transition"
                title="Copy address"
              >
                {copied ? (
                  <Check className="w-3 h-3 text-[#14F195]" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
              <div className="h-3 w-[1px] bg-white/10 mx-0.5" />
              <span className="font-bold text-[#14F195] font-mono text-[11px]">
                {solBalance !== null ? `${solBalance.toFixed(3)} SOL` : "..."}
              </span>
              <button
                onClick={onRefreshBalance}
                disabled={isRefreshingBalance}
                className={`text-zinc-400 hover:text-white transition ${
                  isRefreshingBalance ? "animate-spin" : ""
                }`}
                title="Refresh SOL balance"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Solana Wallet Adapter MultiButton */}
          <div className="wallet-button-container">
            <WalletMultiButton />
          </div>
        </div>
      </div>
    </header>
  );
}
