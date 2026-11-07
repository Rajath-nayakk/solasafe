"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, VersionedTransaction } from "@solana/web3.js";
import { Navbar } from "@/components/Navbar";
import { PromptBox } from "@/components/PromptBox";
import { StepProgress, PipelineStage } from "@/components/StepProgress";
import { ConfirmationCard } from "@/components/ConfirmationCard";
import { AddressBookModal } from "@/components/AddressBookModal";
import { SpendingLimitModal } from "@/components/SpendingLimitModal";
import { TxHistory } from "@/components/TxHistory";
import { HowItWorks } from "@/components/HowItWorks";
import {
  getSolBalance,
  truncateAddress,
  buildSolTransferTx,
  buildSplTransferTx,
} from "@/lib/solana";
import { simulateSolanaTransaction } from "@/lib/simulate";
import { evaluateTransactionRisk } from "@/lib/risk";
import {
  ParsedAction,
  SimulationResult,
  RiskAnalysis,
  ExplainResponse,
  Contact,
  TxHistoryItem,
} from "@/lib/types";
import {
  DEFAULT_DAILY_LIMIT_SOL,
  DEVNET_KNOWN_TOKENS,
} from "@/lib/constants";
import {
  ShieldAlert,
  Sparkles,
  HelpCircle,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

// Default seeded contacts for testing
const DEFAULT_CONTACTS: Contact[] = [
  {
    name: "Amit",
    address: "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin",
    addedAt: Date.now() - 86400000,
  },
  {
    name: "Bob",
    address: "Bob5Gj2F9K8N9kY4vBvG1gN9kY4vBvG1gN9kY4vBvG1",
    addedAt: Date.now() - 43200000,
  },
];

export default function Home() {
  const { connection } = useConnection();
  const { publicKey, connected, sendTransaction } = useWallet();

  // State
  const [solBalance, setSolBalance] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stage, setStage] = useState<PipelineStage>("idle");
  const [errorToast, setErrorToast] = useState<string | null>(null);

  // Address book & spending limit
  const [contacts, setContacts] = useState<Contact[]>(DEFAULT_CONTACTS);
  const [addressBookOpen, setAddressBookOpen] = useState(false);
  const [spendingLimitOpen, setSpendingLimitOpen] = useState(false);
  const [dailyLimitSol, setDailyLimitSol] = useState<number | null>(DEFAULT_DAILY_LIMIT_SOL);
  const [dailySpentSol, setDailySpentSol] = useState<number>(0);
  const [txHistory, setTxHistory] = useState<TxHistoryItem[]>([]);

  // Current audit pipeline state
  const [currentAction, setCurrentAction] = useState<ParsedAction | null>(null);
  const [currentTx, setCurrentTx] = useState<VersionedTransaction | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [riskAnalysis, setRiskAnalysis] = useState<RiskAnalysis | null>(null);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [clarificationPrompt, setClarificationPrompt] = useState<string | null>(null);

  // Sending transaction state
  const [isSending, setIsSending] = useState(false);
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedContacts = localStorage.getItem("solsafe_contacts");
      if (savedContacts) {
        setContacts(JSON.parse(savedContacts));
      }

      const savedLimit = localStorage.getItem("solsafe_daily_limit");
      if (savedLimit !== null) {
        setDailyLimitSol(savedLimit === "null" ? null : parseFloat(savedLimit));
      }

      const savedHistory = localStorage.getItem("solsafe_tx_history");
      if (savedHistory) {
        const hist: TxHistoryItem[] = JSON.parse(savedHistory);
        setTxHistory(hist);

        // Compute spent today
        const startOfDay = new Date().setHours(0, 0, 0, 0);
        const spentToday = hist
          .filter((tx) => tx.timestamp >= startOfDay && tx.status === "confirmed" && tx.token === "SOL")
          .reduce((acc, curr) => acc + curr.amount, 0);
        setDailySpentSol(spentToday);
      }
    } catch (e) {
      console.warn("Error reading localStorage:", e);
    }
  }, []);

  // Fetch SOL balance
  const fetchBalance = useCallback(async () => {
    if (!publicKey) {
      setSolBalance(null);
      return;
    }
    try {
      setIsRefreshing(true);
      const bal = await getSolBalance(connection, publicKey);
      setSolBalance(bal);
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [connection, publicKey]);

  useEffect(() => {
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => clearInterval(interval);
  }, [fetchBalance]);

  // Save contacts
  const handleAddContact = (contact: Contact) => {
    const updated = [...contacts, contact];
    setContacts(updated);
    localStorage.setItem("solsafe_contacts", JSON.stringify(updated));
  };

  const handleRemoveContact = (name: string) => {
    const updated = contacts.filter((c) => c.name !== name);
    setContacts(updated);
    localStorage.setItem("solsafe_contacts", JSON.stringify(updated));
  };

  // Save spending limit
  const handleSaveLimit = (limit: number | null) => {
    setDailyLimitSol(limit);
    localStorage.setItem("solsafe_daily_limit", limit === null ? "null" : limit.toString());
  };

  // Clear history
  const handleClearHistory = () => {
    setTxHistory([]);
    setDailySpentSol(0);
    localStorage.removeItem("solsafe_tx_history");
  };

  // Main Pipeline: Parse -> Simulate -> Risk -> Explain
  const handleAnalyzePrompt = async (promptText: string) => {
    setErrorToast(null);
    setClarificationPrompt(null);
    setTxSignature(null);
    setSendError(null);

    // Fallback demo address if wallet not yet connected
    const senderPubkey =
      publicKey || new PublicKey("DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK");
    const activeBalance = solBalance !== null ? solBalance : 2.0;

    try {
      // 1. INTENT PARSING
      setStage("parsing");

      const addressBookMap: Record<string, string> = {};
      contacts.forEach((c) => {
        addressBookMap[c.name] = c.address;
      });

      const parseRes = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: promptText,
          addressBook: addressBookMap,
          tokenList: DEVNET_KNOWN_TOKENS,
        }),
      });

      if (!parseRes.ok) {
        throw new Error("Failed to parse intent.");
      }

      const actionData: ParsedAction = await parseRes.json();
      setCurrentAction(actionData);

      // Handle clarification or unknown
      if (actionData.action === "unknown" || !actionData.recipient) {
        setClarificationPrompt(
          actionData.clarification || "Could not determine recipient. Please check the address or contact name."
        );
        setStage("idle");
        return;
      }

      // Numeric amount
      const numAmount =
        typeof actionData.amount === "number"
          ? actionData.amount
          : actionData.amount === "half"
          ? activeBalance / 2
          : activeBalance;

      // 2. BUILD TRANSACTION & SIMULATE
      setStage("simulating");

      const recipientPubkey = new PublicKey(actionData.recipient);

      let tx: VersionedTransaction;
      if (actionData.token.toUpperCase() === "SOL") {
        tx = await buildSolTransferTx({
          connection,
          fromPubkey: senderPubkey,
          toPubkey: recipientPubkey,
          amountSol: numAmount,
        });
      } else {
        // SPL token transfer
        const tokenConfig = DEVNET_KNOWN_TOKENS.find(
          (t) => t.symbol.toUpperCase() === actionData.token.toUpperCase()
        );
        const mintPubkey = tokenConfig
          ? new PublicKey(tokenConfig.mint)
          : new PublicKey(DEVNET_KNOWN_TOKENS[1].mint);
        const decimals = tokenConfig ? tokenConfig.decimals : 6;

        tx = await buildSplTransferTx({
          connection,
          fromPubkey: senderPubkey,
          toPubkey: recipientPubkey,
          mintPubkey,
          amountTokens: numAmount,
          decimals,
        });
      }
      setCurrentTx(tx);

      // Simulate on Devnet
      const simResult = await simulateSolanaTransaction({
        connection,
        transaction: tx,
        senderPubkey,
        recipientPubkey,
        amount: numAmount,
        tokenSymbol: actionData.token,
      });
      setSimulation(simResult);

      // 3. DETERMINISTIC RISK EVALUATION
      const risk = evaluateTransactionRisk({
        action: actionData,
        simulation: simResult,
        senderAddress: senderPubkey.toBase58(),
        senderBalanceSol: activeBalance,
        contacts,
        txHistory,
        dailySpendingLimitSol: dailyLimitSol,
        dailySpentSolSoFar: dailySpentSol,
      });
      setRiskAnalysis(risk);

      // 4. PLAIN-ENGLISH AI EXPLANATION
      setStage("explaining");

      const explainRes = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: actionData,
          simulation: simResult,
          riskAnalysis: risk,
        }),
      });

      if (!explainRes.ok) {
        throw new Error("Failed to generate explanation.");
      }

      const explainData: ExplainResponse = await explainRes.json();
      setExplanation(explainData);

      setStage("ready");
    } catch (err: any) {
      console.error("Pipeline error:", err);
      setErrorToast(err?.message || "An unexpected error occurred during transaction simulation.");
      setStage("idle");
    }
  };

  // Sign and Send Transaction
  const handleConfirmTransaction = async () => {
    if (!currentTx || !currentAction) return;

    if (!connected || !publicKey) {
      setSendError("Please connect your Phantom wallet to sign and send transactions.");
      return;
    }

    try {
      setIsSending(true);
      setSendError(null);

      // Sign & send via wallet adapter
      const signature = await sendTransaction(currentTx, connection);

      // Await confirmation
      const latestBlockhash = await connection.getLatestBlockhash("confirmed");
      await connection.confirmTransaction(
        {
          signature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed"
      );

      setTxSignature(signature);

      const numAmount =
        typeof currentAction.amount === "number"
          ? currentAction.amount
          : currentAction.amount === "half"
          ? (solBalance || 1) / 2
          : solBalance || 1;

      // Update session history
      const newHistoryItem: TxHistoryItem = {
        signature,
        timestamp: Date.now(),
        description: `Sent ${numAmount} ${currentAction.token}`,
        amount: numAmount,
        token: currentAction.token,
        recipient: currentAction.recipient || "",
        recipientLabel: currentAction.recipientLabel || undefined,
        riskLevel: riskAnalysis?.overallRisk || "Safe",
        status: "confirmed",
      };

      const updatedHistory = [newHistoryItem, ...txHistory];
      setTxHistory(updatedHistory);
      localStorage.setItem("solsafe_tx_history", JSON.stringify(updatedHistory));

      if (currentAction.token.toUpperCase() === "SOL") {
        setDailySpentSol((prev) => prev + numAmount);
      }

      // Refresh balance
      setTimeout(fetchBalance, 1000);
    } catch (err: any) {
      console.error("Send transaction error:", err);
      if (err?.message?.includes("User rejected")) {
        setSendError("Transaction was declined in wallet.");
      } else {
        setSendError(err?.message || "Failed to confirm transaction on Solana Devnet.");
      }
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setStage("idle");
    setCurrentAction(null);
    setCurrentTx(null);
    setSimulation(null);
    setRiskAnalysis(null);
    setExplanation(null);
    setClarificationPrompt(null);
    setTxSignature(null);
    setSendError(null);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#070913] text-zinc-100 relative selection:bg-[#9945FF] selection:text-white">
      {/* Background ambient Solana glow accents */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-[#9945FF]/15 via-[#14F195]/5 to-transparent blur-[120px] pointer-events-none -z-10" />

      {/* Slim Glass Navbar */}
      <Navbar
        onOpenAddressBook={() => setAddressBookOpen(true)}
        onOpenSpendingLimit={() => setSpendingLimitOpen(true)}
        solBalance={solBalance}
        onRefreshBalance={fetchBalance}
        isRefreshingBalance={isRefreshing}
      />

      {/* Main Centered max-w-4xl Column */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-6">
        {/* Hero Section */}
        <div className="text-center max-w-2xl mx-auto pt-2 space-y-2.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] text-xs font-semibold text-zinc-300 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#14F195] animate-ping" />
            <span className="solana-gradient-text font-bold">AI Track Hackathon</span>
            <span className="text-zinc-500">·</span>
            <span className="text-zinc-400">Pre-Signing Safety</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black tracking-tight text-white leading-tight">
            Understand before you <span className="solana-gradient-text">sign</span>.
          </h1>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Convert natural language requests into Solana transactions. Simulate on-chain, audit deterministic security rules, and understand risks in plain English.
          </p>
        </div>

        {/* Stepper Progress */}
        <StepProgress currentStage={stage} />

        {/* Error Toast */}
        {errorToast && (
          <div className="p-3.5 rounded-2xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center justify-between animate-fade-in shadow-xl">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorToast}</span>
            </div>
            <button
              onClick={() => setErrorToast(null)}
              className="text-rose-400 hover:text-white text-xs underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Clarification prompt from LLM */}
        {clarificationPrompt && (
          <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/60 text-amber-200 text-xs flex items-center gap-3 animate-fade-in shadow-xl">
            <HelpCircle className="w-5 h-5 text-amber-400 shrink-0" />
            <div className="flex-1">
              <strong className="block text-white font-semibold mb-0.5">Clarification Required</strong>
              <span>{clarificationPrompt}</span>
            </div>
          </div>
        )}

        {/* Centerpiece: Prompt Box OR Confirmation Card */}
        {stage === "ready" && currentAction && riskAnalysis && explanation ? (
          <ConfirmationCard
            action={currentAction}
            simulation={simulation}
            riskAnalysis={riskAnalysis}
            explanation={explanation}
            senderAddress={publicKey?.toBase58() || "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK"}
            senderBalanceSol={solBalance !== null ? solBalance : 2.0}
            onConfirm={handleConfirmTransaction}
            onCancel={handleReset}
            isSending={isSending}
            txSignature={txSignature}
            sendError={sendError}
          />
        ) : (
          <PromptBox
            onSubmit={handleAnalyzePrompt}
            isLoading={stage !== "idle" && stage !== "ready"}
          />
        )}

        {/* Transaction History */}
        <TxHistory history={txHistory} onClearHistory={handleClearHistory} />

        {/* 4-Column "How SolSafe Protects You" Card Grid */}
        <HowItWorks />
      </main>

      {/* Modals */}
      <AddressBookModal
        isOpen={addressBookOpen}
        onClose={() => setAddressBookOpen(false)}
        contacts={contacts}
        onAddContact={handleAddContact}
        onRemoveContact={handleRemoveContact}
      />

      <SpendingLimitModal
        isOpen={spendingLimitOpen}
        onClose={() => setSpendingLimitOpen(false)}
        dailyLimitSol={dailyLimitSol}
        dailySpentSol={dailySpentSol}
        onSaveLimit={handleSaveLimit}
      />
    </div>
  );
}
