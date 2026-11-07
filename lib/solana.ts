import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { SOLANA_DEVNET_RPC } from "./constants";

// Global connection instance
let connectionInstance: Connection | null = null;

export function getSolanaConnection(): Connection {
  if (!connectionInstance) {
    const endpoint =
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL || SOLANA_DEVNET_RPC;
    connectionInstance = new Connection(endpoint, {
      commitment: "confirmed",
    });
  }
  return connectionInstance;
}

// Check if string is a valid Solana public key
export function isValidSolanaAddress(address: string | null | undefined): boolean {
  if (!address || typeof address !== "string") return false;
  try {
    const pubkey = new PublicKey(address);
    return PublicKey.isOnCurve(pubkey.toBytes());
  } catch {
    return false;
  }
}

// Truncate public key for display
export function truncateAddress(address: string, chars = 4): string {
  if (!address) return "";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Fetch SOL balance in SOL (float)
export async function getSolBalance(
  connection: Connection,
  pubkey: PublicKey
): Promise<number> {
  try {
    const lamports = await connection.getBalance(pubkey, "confirmed");
    return lamports / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Error fetching SOL balance:", error);
    return 0;
  }
}

// Build a versioned transaction for SOL transfer
export async function buildSolTransferTx({
  connection,
  fromPubkey,
  toPubkey,
  amountSol,
}: {
  connection: Connection,
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  amountSol: number,
}): Promise<VersionedTransaction> {
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
  const transferIx = SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports,
  });

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: blockhash,
    instructions: [transferIx],
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
}

// Build a versioned transaction for SPL Token transfer (with ATA creation if recipient ATA is missing)
export async function buildSplTransferTx({
  connection,
  fromPubkey,
  toPubkey,
  mintPubkey,
  amountTokens,
  decimals,
}: {
  connection: Connection,
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  mintPubkey: PublicKey,
  amountTokens: number,
  decimals: number,
}): Promise<VersionedTransaction> {
  const instructions = [];

  const senderAta = getAssociatedTokenAddressSync(mintPubkey, fromPubkey);
  const recipientAta = getAssociatedTokenAddressSync(mintPubkey, toPubkey);

  // Check if recipient ATA exists
  let recipientAtaExists = false;
  try {
    await getAccount(connection, recipientAta);
    recipientAtaExists = true;
  } catch {
    recipientAtaExists = false;
  }

  // If recipient ATA does not exist, insert createAssociatedTokenAccountInstruction
  if (!recipientAtaExists) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        fromPubkey, // payer
        recipientAta,
        toPubkey, // owner
        mintPubkey
      )
    );
  }

  // Calculate raw amount
  const rawAmount = BigInt(Math.round(amountTokens * Math.pow(10, decimals)));

  instructions.push(
    createTransferInstruction(
      senderAta,
      recipientAta,
      fromPubkey,
      rawAmount,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
}

