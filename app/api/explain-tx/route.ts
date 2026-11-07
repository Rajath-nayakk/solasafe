import { NextRequest, NextResponse } from "next/server";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getSolanaConnection, fetchWithRpcRetry } from "@/lib/solana";
import { evaluateTransactionRisk } from "@/lib/risk";
import { explainWithLLM } from "@/lib/llm";
import { ParsedAction, SimulationResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const { signature } = await req.json();

    if (!signature || typeof signature !== "string" || signature.trim().length < 32) {
      return NextResponse.json(
        { error: "Please provide a valid 64-88 character Solana transaction signature." },
        { status: 400 }
      );
    }

    const cleanSig = signature.trim();
    const connection = getSolanaConnection();

    // Fetch confirmed transaction with version 0 support
    const tx = await fetchWithRpcRetry(() =>
      connection.getTransaction(cleanSig, {
        maxSupportedTransactionVersion: 0,
        commitment: "confirmed",
      })
    );

    if (!tx || !tx.meta) {
      return NextResponse.json(
        {
          error:
            "Transaction signature not found on Solana Devnet. Confirm the transaction was sent on Devnet and has finalized.",
        },
        { status: 404 }
      );
    }

    // Resolve all account keys (handling address table lookups)
    let accountKeyStrings: string[] = [];
    if ("getAccountKeys" in tx.transaction.message) {
      const keys = (tx.transaction.message as any).getAccountKeys({
        accountKeysFromLookups: tx.meta.loadedAddresses,
      });
      accountKeyStrings = keys.keySegments ? keys.keySegments().flat().map((k: any) => k.toBase58()) : [];
    } else {
      accountKeyStrings = (tx.transaction.message as any).accountKeys.map((k: any) =>
        typeof k === "string" ? k : k.toBase58()
      );
    }

    const preBalances = tx.meta.preBalances || [];
    const postBalances = tx.meta.postBalances || [];
    const feeSol = (tx.meta.fee || 0) / LAMPORTS_PER_SOL;
    const computeUnits = tx.meta.computeUnitsConsumed || 0;
    const isSuccess = tx.meta.err === null;

    // Calculate balance deltas for all accounts
    const balanceDeltas = accountKeyStrings.map((key, i) => {
      const pre = (preBalances[i] || 0) / LAMPORTS_PER_SOL;
      const post = (postBalances[i] || 0) / LAMPORTS_PER_SOL;
      const delta = post - pre;
      return {
        account: key,
        pre,
        post,
        delta,
        role: i === 0 ? "Fee Payer / Sender" : delta > 0 ? "Recipient / Receiver" : "Participant",
      };
    });

    // Extract invoked program IDs
    const programIdsSet = new Set<string>();
    const instructions = (tx.transaction.message as any).compiledInstructions || [];
    for (const ix of instructions) {
      const pId = accountKeyStrings[ix.programIdIndex];
      if (pId) programIdsSet.add(pId);
    }
    const programsInvoked = Array.from(programIdsSet);

    // Identify primary sender and recipient
    const sender = accountKeyStrings[0] || "UnknownSender";
    const recipientEntry = balanceDeltas.find((d) => d.delta > 0);
    const recipient = recipientEntry ? recipientEntry.account : accountKeyStrings[1] || sender;
    const transferAmountSol = recipientEntry ? recipientEntry.delta : Math.abs(balanceDeltas[0]?.delta || 0) - feeSol;

    // Synthesize structured action
    const action: ParsedAction = {
      action: "transfer",
      token: "SOL",
      amount: Math.max(0, parseFloat(transferAmountSol.toFixed(6))),
      recipient,
      recipientLabel: null,
      clarification: null,
    };

    // Synthesize simulation result
    const simulation: SimulationResult = {
      success: isSuccess,
      err: tx.meta.err ? JSON.stringify(tx.meta.err) : null,
      computeUnits,
      fee: feeSol,
      programsInvoked,
      senderSolDelta: balanceDeltas[0]?.delta || -feeSol,
      recipientSolDelta: recipientEntry?.delta || 0,
      tokenDeltas: [],
      rawLogs: tx.meta.logMessages || [],
    };

    // Run deterministic risk evaluation
    const senderBalanceSol = (preBalances[0] || 0) / LAMPORTS_PER_SOL;
    const riskAnalysis = evaluateTransactionRisk({
      action,
      simulation,
      senderAddress: sender,
      senderBalanceSol: senderBalanceSol > 0 ? senderBalanceSol : 1.0,
      contacts: [],
      txHistory: [],
    });

    // Generate plain-English AI explanation
    const explanation = await explainWithLLM({
      action,
      simulation,
      riskAnalysis,
    });

    return NextResponse.json({
      signature: cleanSig,
      slot: tx.slot,
      blockTime: tx.blockTime,
      isSuccess,
      feeSol,
      computeUnits,
      sender,
      recipient,
      action,
      simulation,
      riskAnalysis,
      explanation,
      balanceDeltas,
      programsInvoked,
    });
  } catch (err: any) {
    console.error("Error in /api/explain-tx:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to inspect and explain transaction." },
      { status: 500 }
    );
  }
}

