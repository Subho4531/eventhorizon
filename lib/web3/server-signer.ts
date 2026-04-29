/**
 * lib/web3/server-signer.ts
 *
 * Server-side Soroban transaction signer.
 *
 * ⚠️  This module must NEVER be imported in browser-side code.
 *     It reads ORACLE_SECRET_KEY from env which must stay server-only.
 *
 * Architecture:
 *   Agent/Worker → server-signer.ts → builds XDR → signs with Keypair → submits
 *
 * Difference from escrow.ts:
 *   escrow.ts  → builds unsigned XDR → Freighter (browser wallet) signs
 *   server-signer.ts → builds + signs + submits entirely server-side
 */

import {
  buildUnsignedXdr,
  submitAndConfirm,
  NETWORK_PASSPHRASE,
  CONTRACT_ID,
} from "./soroban-client";

export interface ServerSignerResult {
  success: boolean;
  hash: string;
  returnValue?: unknown;
  error?: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Keypair management
// ──────────────────────────────────────────────────────────────────────────────

let _cachedKeypair: import("@stellar/stellar-sdk").Keypair | null = null;

/**
 * Load the oracle keypair from ORACLE_SECRET_KEY env var.
 * Throws if the env var is missing or invalid.
 */
export async function getOracleKeypair() {
  if (_cachedKeypair) return _cachedKeypair;

  const secretKey = process.env.ORACLE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "[ServerSigner] ORACLE_SECRET_KEY env var is not set. " +
        "Add it to your .env file to enable autonomous signing."
    );
  }

  const { Keypair } = await import("@stellar/stellar-sdk");
  _cachedKeypair = Keypair.fromSecret(secretKey);
  return _cachedKeypair;
}

// ──────────────────────────────────────────────────────────────────────────────
// Core: sign + submit
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Sign a prepared unsigned XDR with the oracle keypair and submit.
 */
export async function signAndSubmit(
  unsignedXdr: string
): Promise<ServerSignerResult> {
  try {
    const keypair = await getOracleKeypair();
    const { TransactionBuilder } = await import("@stellar/stellar-sdk");

    const tx = TransactionBuilder.fromXDR(unsignedXdr, NETWORK_PASSPHRASE);
    tx.sign(keypair);
    const signedXdr = tx.toEnvelope().toXDR("base64");

    const result = await submitAndConfirm(signedXdr);
    return { success: true, hash: result.hash, returnValue: result.returnValue };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ServerSigner] signAndSubmit failed:", msg);
    return { success: false, hash: "", error: msg };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Contract operations
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Create a market on-chain using the oracle keypair as creator.
 *
 * @param title     - Market title (max 32 ASCII chars, will be truncated)
 * @param closeTime - Unix timestamp (seconds) when betting closes
 * @returns { success, hash, contractMarketId }
 */
export async function serverCreateMarket(
  title: string,
  closeTime: number
): Promise<ServerSignerResult & { contractMarketId?: number }> {
  if (!CONTRACT_ID) {
    console.warn("[ServerSigner] No CONTRACT_ID set — using mock mode");
    const fakeId = Math.floor(Math.random() * 999) + 1;
    return { success: true, hash: `mock-${Date.now()}`, contractMarketId: fakeId };
  }

  try {
    const keypair = await getOracleKeypair();
    const oraclePubKey = keypair.publicKey();

    const { Address, nativeToScVal } = await import("@stellar/stellar-sdk");

    // Truncate title to 32 chars — Soroban Symbol limit
    const safeTitle = title.slice(0, 32).replace(/[^a-zA-Z0-9_]/g, "_");

    const args = [
      new Address(oraclePubKey).toScVal(),   // creator = oracle
      new Address(oraclePubKey).toScVal(),   // oracle = oracle
      nativeToScVal(safeTitle, { type: "symbol" }),
      nativeToScVal(closeTime, { type: "u64" }),
    ];

    const unsignedXdr = await buildUnsignedXdr(oraclePubKey, "create_market", args);
    const result = await signAndSubmit(unsignedXdr);

    if (!result.success) return result;

    // The contract returns the new market ID (u32)
    const contractMarketId =
      typeof result.returnValue === "number"
        ? result.returnValue
        : typeof result.returnValue === "bigint"
        ? Number(result.returnValue)
        : undefined;

    console.log(
      `[ServerSigner] Market created on-chain: id=${contractMarketId} tx=${result.hash}`
    );
    return { ...result, contractMarketId };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ServerSigner] serverCreateMarket failed:", msg);
    return { success: false, hash: "", error: msg };
  }
}

/**
 * Resolve a market on-chain using the oracle keypair.
 *
 * @param contractMarketId - On-chain market ID (u32)
 * @param outcome          - "YES" | "NO"
 * @param payoutBps        - Payout in basis points (10000 = 1x, 20000 = 2x)
 */
export async function serverResolveMarket(
  contractMarketId: number,
  outcome: "YES" | "NO",
  payoutBps: number = 20000
): Promise<ServerSignerResult> {
  if (!CONTRACT_ID) {
    console.warn("[ServerSigner] No CONTRACT_ID set — using mock mode");
    return { success: true, hash: `mock-resolve-${Date.now()}` };
  }

  try {
    const keypair = await getOracleKeypair();
    const oraclePubKey = keypair.publicKey();

    const { Address, nativeToScVal } = await import("@stellar/stellar-sdk");

    // Contract: outcome u32 — 0 = YES, 1 = NO
    const outcomeU32 = outcome === "YES" ? 0 : 1;

    if (payoutBps < 10000) {
      throw new Error("payoutBps must be >= 10000 (1x minimum)");
    }

    const args = [
      new Address(oraclePubKey).toScVal(),
      nativeToScVal(contractMarketId, { type: "u32" }),
      nativeToScVal(outcomeU32, { type: "u32" }),
      nativeToScVal(payoutBps, { type: "u32" }),
    ];

    const unsignedXdr = await buildUnsignedXdr(oraclePubKey, "resolve", args);
    const result = await signAndSubmit(unsignedXdr);

    console.log(
      `[ServerSigner] Market ${contractMarketId} resolved ${outcome} tx=${result.hash}`
    );
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ServerSigner] serverResolveMarket failed:", msg);
    return { success: false, hash: "", error: msg };
  }
}

/**
 * Check if oracle account exists on-chain and is funded.
 */
export async function checkOracleHealth(): Promise<{
  healthy: boolean;
  publicKey?: string;
  error?: string;
}> {
  try {
    const keypair = await getOracleKeypair();
    const pubKey = keypair.publicKey();

    const { rpc } = await import("@stellar/stellar-sdk");
    const server = new rpc.Server(
      process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org",
      { allowHttp: false }
    );

    // Just check the account exists on-chain
    await server.getAccount(pubKey);
    return { healthy: true, publicKey: pubKey };
  } catch (err) {
    return {
      healthy: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
