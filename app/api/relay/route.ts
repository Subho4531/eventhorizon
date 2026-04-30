/**
 * app/api/relay/route.ts
 *
 * Gasless Relay — Fee Bump Transaction Sponsor
 *
 * How it works:
 *   1. Client builds unsigned Soroban XDR → Freighter signs the INNER transaction
 *   2. Client POSTs that signed XDR here (user's auth signature is already inside)
 *   3. Server wraps it in a FeeBumpTransaction where the ORACLE pays the fee
 *   4. Fee-bumped TX is submitted to Soroban RPC
 *   5. User's on-chain account is NEVER charged a network fee
 *
 * Important: Freighter will always display the inner tx fee in its dialog — this is
 * a Freighter security feature and cannot be suppressed. However, the fee shown
 * is the MAXIMUM the inner tx can charge, and the fee bump OVERRIDES who pays it.
 * The user's Stellar account balance is NOT reduced by the fee.
 *
 * Rate limit: 20 sponsored transactions per public key per hour.
 */

import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// ── Rate limiter (in-memory, resets on server restart) ──────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_WINDOW_MS = 3_600_000; // 1 hour

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ── Network constants ────────────────────────────────────────────────────────
const NETWORK =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "mainnet"
    : "testnet";

const NETWORK_PASSPHRASE =
  NETWORK === "mainnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";

// Fee bump max fee: 200_000 stroops (0.02 XLM). More than enough for any Soroban call.
// The fee bump fee must be ≥ (number_of_operations + 1) × base_fee × multiplier.
// Setting it high ensures testnet inclusion without issue.
const FEE_BUMP_MAX_FEE = "200000";

// ── POST /api/relay ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let sponsorPublicKey = "";
  try {
    // 1. Parse request
    const body = await req.json();
    const { signedXdr, publicKey } = body as {
      signedXdr: string;
      publicKey?: string;
    };

    if (!signedXdr || typeof signedXdr !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid 'signedXdr'." },
        { status: 400 }
      );
    }

    // 2. Rate limit by user public key
    const limiterKey = publicKey?.trim() || "anonymous";
    if (!checkRateLimit(limiterKey)) {
      return NextResponse.json(
        { error: "Rate limit exceeded: max 20 gasless transactions per hour." },
        { status: 429 }
      );
    }

    // 3. Load sponsor secret (server-side only — never exposed to browser)
    const sponsorSecret = process.env.ORACLE_SECRET_KEY;
    if (!sponsorSecret) {
      console.error("[Relay] ORACLE_SECRET_KEY not configured.");
      return NextResponse.json(
        { error: "Relay not configured — ORACLE_SECRET_KEY missing." },
        { status: 503 }
      );
    }

    // 4. Import Stellar SDK dynamically (avoids browser bundle)
    const {
      Keypair,
      TransactionBuilder,
      Transaction,
      rpc: StellarRpc,
      scValToNative,
    } = await import("@stellar/stellar-sdk");

    const sponsorKeypair = Keypair.fromSecret(sponsorSecret);
    sponsorPublicKey = sponsorKeypair.publicKey();

    console.log(
      `[Relay] Received XDR from ${limiterKey.slice(0, 8)}... — wrapping with sponsor ${sponsorPublicKey.slice(0, 8)}...`
    );

    // 5. Reconstruct the inner transaction from the user's signed XDR
    const innerTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

    // Fee bump only works on regular Transaction (not FeeBumpTransaction)
    if (!(innerTx instanceof Transaction)) {
      return NextResponse.json(
        { error: "XDR is already a fee-bump transaction — cannot double-wrap." },
        { status: 400 }
      );
    }

    // 6. Build the FeeBumpTransaction (sponsor pays the actual fee)
    const feeBumpTx = TransactionBuilder.buildFeeBumpTransaction(
      sponsorKeypair,   // feeSource — this account pays the network fee
      FEE_BUMP_MAX_FEE, // maxFee in stroops (0.02 XLM)
      innerTx,          // inner signed transaction (with user's auth)
      NETWORK_PASSPHRASE
    );

    // 7. Sponsor signs the outer fee bump envelope
    feeBumpTx.sign(sponsorKeypair);

    console.log(`[Relay] Fee bump built — inner fee source: ${innerTx.source}`);
    console.log(`[Relay] Outer fee source (sponsor): ${sponsorPublicKey}`);

    // 8. Submit via Soroban RPC
    const server = new StellarRpc.Server(RPC_URL, { allowHttp: false });
    const sendResult = await server.sendTransaction(feeBumpTx);

    console.log(`[Relay] sendTransaction status: ${sendResult.status}`);

    if (sendResult.status === "ERROR") {
      const errDetail = sendResult.errorResult
        ? JSON.stringify(sendResult.errorResult)
        : "Unknown error";
      console.error("[Relay] Submission error:", errDetail);
      return NextResponse.json(
        { error: `Submission failed: ${errDetail}` },
        { status: 502 }
      );
    }

    // 9. Poll for confirmation (max 30 seconds, 20 × 1.5s)
    const txHash = sendResult.hash;
    console.log(`[Relay] Polling for confirmation: ${txHash}`);

    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const txStatus = await server.getTransaction(txHash);

      if (txStatus.status === StellarRpc.Api.GetTransactionStatus.SUCCESS) {
        let returnValue: unknown;
        try {
          if (txStatus.returnValue) {
            returnValue = scValToNative(txStatus.returnValue);
          }
        } catch {
          // returnValue decoding is best-effort
        }

        console.log(
          `[Relay] Confirmed: ${txHash}`
        );

        return NextResponse.json({
          success: true,
          hash: txHash,
          returnValue,
          sponsored: true,
          sponsorPublicKey,
        });
      }

      if (txStatus.status === StellarRpc.Api.GetTransactionStatus.FAILED) {
        console.error(
          "[Relay] TX failed on-chain:",
          JSON.stringify(txStatus)
        );
        return NextResponse.json(
          {
            error: "Transaction failed on-chain after fee bump.",
            hash: txHash,
          },
          { status: 502 }
        );
      }
      // PENDING or NOT_FOUND — keep polling
    }

    // 10. Timeout — the TX was submitted, just not confirmed in 30s
    console.warn(`[Relay] Confirmation timeout for ${txHash} — returning hash.`);
    return NextResponse.json(
      {
        success: true,
        hash: txHash,
        sponsored: true,
        pending: true,
        message: "Submitted but not yet confirmed. Use the hash to check on explorer.",
      },
      { status: 202 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Relay] Unexpected error:", msg);
    return NextResponse.json(
      { error: msg, sponsored: false },
      { status: 500 }
    );
  }
}
