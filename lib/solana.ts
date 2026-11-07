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
  getMint,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getExtensionTypes,
} from "@solana/spl-token";
import { SOLANA_DEVNET_RPC } from "./constants";
import { RecipientSecurityMeta, TokenSecurityMeta } from "./types";

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

// Check if string is a valid Solana public key (accepts on-curve and off-curve/PDA keys)
export function isValidSolanaAddress(address: string | null | undefined): boolean {
  if (!address || typeof address !== "string") return false;
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Check if a valid public key is off-curve (e.g., a Program Derived Address / PDA)
export function isOffCurveAddress(address: string | null | undefined): boolean {
  if (!address || typeof address !== "string") return false;
  try {
    const pubkey = new PublicKey(address);
    return !PublicKey.isOnCurve(pubkey.toBytes());
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

/**
 * Robust RPC call wrapper with exponential backoff and jitter for HTTP 429 & network timeouts
 */
export async function fetchWithRpcRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  baseDelayMs = 500
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const isRateLimit =
        err?.message?.includes("429") ||
        err?.status === 429 ||
        err?.toString()?.includes("Too Many Requests");
      const isTimeout =
        err?.message?.includes("timeout") ||
        err?.message?.includes("ETIMEDOUT") ||
        err?.message?.includes("fetch failed");

      if (attempt < retries - 1 && (isRateLimit || isTimeout)) {
        const jitter = Math.random() * 200;
        const delay = Math.pow(2, attempt) * baseDelayMs + jitter;
        await new Promise((res) => setTimeout(res, delay));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

/**
 * Check if the sender has interacted with recipient on Devnet previously via getSignaturesForAddress
 */
export async function checkOnChainInteraction(
  connection: Connection,
  sender: PublicKey,
  recipient: PublicKey
): Promise<boolean> {
  try {
    return await fetchWithRpcRetry(async () => {
      const senderSigs = await connection.getSignaturesForAddress(sender, { limit: 100 });
      if (senderSigs.length === 0) return false;

      const senderSigSet = new Set(senderSigs.map((s) => s.signature));
      const recipientSigs = await connection.getSignaturesForAddress(recipient, { limit: 25 });
      return recipientSigs.some((s) => senderSigSet.has(s.signature));
    });
  } catch (error) {
    console.warn("Could not check on-chain interaction history:", error);
    return false;
  }
}

/**
 * Query recipient account state (exists, executable, lamport balance, owner)
 */
export async function fetchRecipientSecurityMeta(
  connection: Connection,
  recipient: PublicKey
): Promise<RecipientSecurityMeta> {
  try {
    const accountInfo = await fetchWithRpcRetry(() => connection.getAccountInfo(recipient));
    if (!accountInfo) {
      return {
        exists: false,
        executable: false,
        owner: SystemProgram.programId.toBase58(),
        lamports: 0,
      };
    }
    return {
      exists: true,
      executable: accountInfo.executable,
      owner: accountInfo.owner.toBase58(),
      lamports: accountInfo.lamports,
    };
  } catch (error) {
    console.warn("Could not fetch recipient account info:", error);
    return {
      exists: true,
      executable: false,
      owner: SystemProgram.programId.toBase58(),
      lamports: 1,
    };
  }
}

/**
 * Fetch SPL token mint security metadata (mint authority, freeze authority, Token-2022 extensions)
 */
export async function fetchTokenSecurityMeta(
  connection: Connection,
  mint: PublicKey
): Promise<TokenSecurityMeta | null> {
  try {
    const info = await fetchWithRpcRetry(() => connection.getAccountInfo(mint));
    if (!info) return null;

    const isToken2022 = info.owner.equals(TOKEN_2022_PROGRAM_ID);
    const isStandardToken = info.owner.equals(TOKEN_PROGRAM_ID);

    if (!isToken2022 && !isStandardToken) {
      return null;
    }

    const mintData = await getMint(
      connection,
      mint,
      "confirmed",
      isToken2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
    );

    let hasTransferHook = false;
    let hasPermanentDelegate = false;
    let hasTransferFee = false;

    if (isToken2022) {
      try {
        const extensions = getExtensionTypes(info.data);
        hasTransferHook = extensions.includes(ExtensionType.TransferHook);
        hasPermanentDelegate = extensions.includes(ExtensionType.PermanentDelegate);
        hasTransferFee = extensions.includes(ExtensionType.TransferFeeConfig);
      } catch (e) {
        console.warn("Could not parse Token-2022 extensions:", e);
      }
    }

    return {
      mint: mint.toBase58(),
      mintAuthority: mintData.mintAuthority ? mintData.mintAuthority.toBase58() : null,
      freezeAuthority: mintData.freezeAuthority ? mintData.freezeAuthority.toBase58() : null,
      isToken2022,
      hasTransferHook,
      hasPermanentDelegate,
      hasTransferFee,
    };
  } catch (error) {
    console.warn("Could not fetch token security metadata:", error);
    return null;
  }
}

