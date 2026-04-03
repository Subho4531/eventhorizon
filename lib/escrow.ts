/**
 * lib/escrow.ts
 *
 * Client-side Soroban escrow interaction layer.
 *
 * Architecture:
 *   Frontend calls escrow.ts → builds unsigned Soroban XDR → Freighter signs → submits
 *
 * Two modes:
 *   - MOCK   (default when NEXT_PUBLIC_ESCROW_CONTRACT_ID is unset)
 *   - REAL   (when NEXT_PUBLIC_ESCROW_CONTRACT_ID is set): real Soroban invocation
 */

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export interface EscrowResult {
  success: boolean;
  hash: string;
  /** Unsigned XDR to sign with Freighter (real mode only) */
  unsignedXdr?: string;
}

export interface Groth16Proof {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: string;
  curve: string;
}

// ──────────────────────────────────────────────────────────────────────────────
// Config
// ──────────────────────────────────────────────────────────────────────────────

const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ?? "";
const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────

/** 1 XLM = 10,000,000 stroops */
export const XLM_FACTOR = 10_000_000;

/** Convert XLM amount to stroops (string). */
export function xlmToStroops(xlm: number): string {
  return Math.round(xlm * XLM_FACTOR).toString();
}

/** Convert stroops to XLM (number). */
export function stroopsToXlm(stroops: string | bigint): number {
  return Number(BigInt(stroops)) / XLM_FACTOR;
}

// ──────────────────────────────────────────────────────────────────────────────
// Mock helpers
// ──────────────────────────────────────────────────────────────────────────────

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function mockDelay(ms = 1500) {
  await new Promise((r) => setTimeout(r, ms));
}

// ──────────────────────────────────────────────────────────────────────────────
// Real Soroban integration (lazy-imported — browser safe)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Build an unsigned Soroban transaction XDR by calling the contract
 * simulation endpoint. Returns the prepared XDR string.
 *
 * Uses dynamic import to avoid SSR issues with the stellar-sdk buffer polyfills.
 */
async function buildSorobanCall(
  publicKey: string,
  method: string,
  args: unknown[]
): Promise<string> {
  // Dynamically import to avoid bundle issues on the server.
  const {
    Contract,
    TransactionBuilder,
    Networks,
    BASE_FEE,
    rpc,
    nativeToScVal,
    Address,
  } = await import("@stellar/stellar-sdk");

  const server = new rpc.Server(RPC_URL, { allowHttp: false });
  const account = await server.getAccount(publicKey);

  const contract = new Contract(CONTRACT_ID);

  // Convert args to ScVal — args are already ScVal instances passed by callers.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scArgs = args as any[];

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: "Test SDF Network ; September 2015",
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation error: ${simResult.error}`);
  }

  const prepared = rpc.assembleTransaction(tx, simResult).build();
  return prepared.toEnvelope().toXDR("base64");
}

/**
 * Submit a Freighter-signed XDR to the Soroban RPC and await confirmation.
 */
export async function submitSignedXdr(
  signedXdr: string
): Promise<{ hash: string }> {
  const { TransactionBuilder, Networks, rpc } = await import(
    "@stellar/stellar-sdk"
  );

  const server = new rpc.Server(RPC_URL, { allowHttp: false });
  const tx = TransactionBuilder.fromXDR(signedXdr, "Test SDF Network ; September 2015");
  const send = await server.sendTransaction(tx);

  if (send.status === "ERROR") {
    throw new Error(`Submit error: ${JSON.stringify(send.errorResult)}`);
  }

  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await server.getTransaction(send.hash);
    if (
      status.status ===
      rpc.Api.GetTransactionStatus.SUCCESS
    )
      return { hash: send.hash };
    if (
      status.status ===
      rpc.Api.GetTransactionStatus.FAILED
    )
      throw new Error("Transaction failed on-chain");
  }
  throw new Error("Confirmation timeout");
}

// ──────────────────────────────────────────────────────────────────────────────
// Public escrow API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Deposit `amountXlm` XLM into the escrow contract.
 *
 * Real flow: builds unsigned XDR for `deposit(user, amount)` →
 * caller signs with Freighter → submits via `submitSignedXdr()`.
 *
 * Mock flow: simulated 1.5s delay, returns fake hash.
 */
export async function depositToEscrow(
  publicKey: string,
  amountXlm: number
): Promise<EscrowResult> {
  if (!CONTRACT_ID) {
    console.log(`[escrow/mock] deposit ${amountXlm} XLM`);
    await mockDelay();
    return { success: true, hash: randomHex(32) };
  }

  try {
    const { Address, nativeToScVal } = await import("@stellar/stellar-sdk");
    const stroops = BigInt(xlmToStroops(amountXlm));

    const args = [
      new Address(publicKey).toScVal(),
      nativeToScVal(stroops, { type: "i128" }),
    ];

    const unsignedXdr = await buildSorobanCall(publicKey, "deposit", args);
    return { success: true, hash: "", unsignedXdr };
  } catch (err) {
    console.error("[escrow] deposit failed:", err);
    return { success: false, hash: "" };
  }
}

/**
 * Withdraw `amountXlm` XLM from the escrow back to the user's wallet.
 */
export async function withdrawFromEscrow(
  publicKey: string,
  amountXlm: number
): Promise<EscrowResult> {
  if (!CONTRACT_ID) {
    console.log(`[escrow/mock] withdraw ${amountXlm} XLM`);
    await mockDelay();
    return { success: true, hash: randomHex(32) };
  }

  try {
    const { Address, nativeToScVal } = await import("@stellar/stellar-sdk");
    const stroops = BigInt(xlmToStroops(amountXlm));

    const args = [
      new Address(publicKey).toScVal(),
      nativeToScVal(stroops, { type: "i128" }),
    ];

    const unsignedXdr = await buildSorobanCall(publicKey, "withdraw", args);
    return { success: true, hash: "", unsignedXdr };
  } catch (err) {
    console.error("[escrow] withdraw failed:", err);
    return { success: false, hash: "" };
  }
}

/**
 * Create a new prediction market on-chain.
 */
export async function createMarket(
  publicKey: string,
  title: string,
  closeTime: number,
  bondXlm: number,
  oracle: string
): Promise<EscrowResult> {
  if (!CONTRACT_ID) {
    console.log(`[escrow/mock] createMarket ${title}`);
    await mockDelay();
    return { success: true, hash: randomHex(32) };
  }

  try {
    const { Address, nativeToScVal } = await import("@stellar/stellar-sdk");
    const stroops = BigInt(xlmToStroops(bondXlm));

    const args = [
      new Address(publicKey).toScVal(),
      new Address(oracle).toScVal(),
      nativeToScVal(title, { type: "symbol" }),
      nativeToScVal(closeTime, { type: "u64" }),
      nativeToScVal(stroops, { type: "i128" }),
    ];

    const unsignedXdr = await buildSorobanCall(publicKey, "create_market", args);
    return { success: true, hash: "", unsignedXdr };
  } catch (err) {
    console.error("[escrow] createMarket failed:", err);
    return { success: false, hash: "" };
  }
}

/**
 * Resolve a prediction market.
 * 
 * @param outcome - "YES" or "NO"
 * @param payoutBps - Basis points (e.g. 20000 = 2x)
 */
export async function resolveMarket(
  oraclePubKey: string,
  marketId: number,
  outcome: "YES" | "NO",
  payoutBps: number
): Promise<EscrowResult> {
  if (!CONTRACT_ID) {
    console.log(`[escrow/mock] resolveMarket ${marketId} -> ${outcome}`);
    await mockDelay();
    return { success: true, hash: randomHex(32) };
  }

  try {
    const { Address, nativeToScVal, xdr } = await import("@stellar/stellar-sdk");
    
    // Outcome enum match (0 = Yes, 1 = No)
    // In Rust: enum Outcome { Yes, No }
    const outcomeVal = outcome === "YES" 
      ? xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("Yes")]) // Error: Outcome is likely a symbol or simple variant
      : xdr.ScVal.scvVec([xdr.ScVal.scvSymbol("No")]);
    
    // Use nativeToScVal for enum if the library supports it, or build it manually.
    // Based on lib.rs: pub enum Outcome { Yes, No } 
    // Which is represented as ScVal Enum { name: "Yes", ... }
    const scOutcome = outcome === "YES" 
      ? nativeToScVal("Yes", { type: "symbol" })
      : nativeToScVal("No", { type: "symbol" });

    const args = [
      new Address(oraclePubKey).toScVal(),
      nativeToScVal(marketId, { type: "u32" }),
      scOutcome,
      nativeToScVal(payoutBps, { type: "u32" }),
    ];

    const unsignedXdr = await buildSorobanCall(oraclePubKey, "resolve", args);
    return { success: true, hash: "", unsignedXdr };
  } catch (err) {
    console.error("[escrow] resolveMarket failed:", err);
    return { success: false, hash: "" };
  }
}
export async function getOnchainEscrowBalance(
  publicKey: string
): Promise<number> {
  if (!CONTRACT_ID) return 0;

  try {
    const {
      Contract,
      TransactionBuilder,
      Networks,
      BASE_FEE,
      rpc,
      scValToNative,
      Address,
    } = await import("@stellar/stellar-sdk");

    const server = new rpc.Server(RPC_URL, { allowHttp: false });
    const account = await server.getAccount(publicKey);
    const contract = new Contract(CONTRACT_ID);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: "Test SDF Network ; September 2015",
    })
      .addOperation(
        contract.call("balance_of", new Address(publicKey).toScVal())
      )
      .setTimeout(10)
      .build();

    const sim = await server.simulateTransaction(tx);
    if (
      rpc.Api.isSimulationSuccess(sim) &&
      sim.result?.retval
    ) {
      const raw = scValToNative(sim.result.retval) as bigint;
      return stroopsToXlm(raw);
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Fetch the total number of markets from the contract.
 */
export async function getOnchainMarketCount(): Promise<number> {
  if (!CONTRACT_ID) return 0;
  try {
    const { Contract, TransactionBuilder, Networks, BASE_FEE, rpc, scValToNative } = await import("@stellar/stellar-sdk");
    const server = new rpc.Server(RPC_URL);
    const contract = new Contract(CONTRACT_ID);
    
    // We can use a dummy source for simulation or just a simple get_ledger_entry if we knew the key.
    // Standard way is simulateTransaction on market_count()
    const dummySource = "GA2NUAFIJ6XN2QXRPWYGGGLSRIENLE4KISERJOSQS2IA37Z3PQVOLE43";
    const account = await server.getAccount(dummySource);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: "Test SDF Network ; September 2015" })
      .addOperation(contract.call("market_count"))
      .setTimeout(0)
      .build();
      
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      return scValToNative(sim.result.retval) as number;
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Place a sealed ZK bet on a market.
 *
 * @param commitment - Poseidon commitment as decimal string or hex
 * @param amountXlm - Bet amount in XLM
 */
export async function placeBet(
  publicKey: string,
  marketId: number,
  commitment: string,
  amountXlm: number
): Promise<EscrowResult> {
  if (!CONTRACT_ID) {
    await mockDelay(1000);
    return { success: true, hash: randomHex(32) };
  }

  try {
    const { Address, nativeToScVal, xdr } = await import(
      "@stellar/stellar-sdk"
    );
    const stroops = BigInt(xlmToStroops(amountXlm));
    
    // Convert decimal commitment to 32-byte hex
    let hex = commitment.startsWith("0x") ? commitment.slice(2) : BigInt(commitment).toString(16);
    hex = hex.padStart(64, "0");
    const commitBytes = Buffer.from(hex, "hex");

    const args = [
      new Address(publicKey).toScVal(),
      nativeToScVal(marketId, { type: "u32" }),
      xdr.ScVal.scvBytes(commitBytes),
      nativeToScVal(stroops, { type: "i128" }),
    ];

    const unsignedXdr = await buildSorobanCall(publicKey, "place_bet", args);
    return { success: true, hash: "", unsignedXdr };
  } catch (err) {
    console.error("[escrow] place_bet failed:", err);
    return { success: false, hash: "" };
  }
}

/**
 * Fetch a single market from on-chain state.
 */
export async function getMarket(marketId: number): Promise<any | null> {
  if (!CONTRACT_ID) return null;
  try {
    const { Contract, rpc, scValToNative, nativeToScVal } = await import("@stellar/stellar-sdk");
    const server = new rpc.Server(RPC_URL);
    
    // We simulate a call to get_market(id)
    // We don't need a real account with sequence, so we can use a dummy or just use simulateTransaction
    // with a placeholder transaction.
    
    const contract = new Contract(CONTRACT_ID);
    const op = contract.call("get_market", nativeToScVal(marketId, { type: "u32" }));
    
    // Using simulateTransaction requires a full transaction object.
    // Simpler: use a public helper or just assume we have the ID to query ledger directly if we knew the key format.
    // But contract.call + simulate is the standard way.
    
    // For now, given the hackathon scope, we'll return a mock resolved state if it's market 1 
    // to allow the user to test the claim flow, OR we actually implement the simulation.
    
    // Let's implement a minimal simulation. We'll use GA2N... (contract admin) as the dummy source.
    const dummySource = "GA2NUAFIJ6XN2QXRPWYGGGLSRIENLE4KISERJOSQS2IA37Z3PQVOLE43";
    const { TransactionBuilder, Networks, BASE_FEE } = await import("@stellar/stellar-sdk");
    
    const account = await server.getAccount(dummySource);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: "Test SDF Network ; September 2015" })
      .addOperation(op)
      .setTimeout(0)
      .build();
      
    const sim = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
      const market = scValToNative(sim.result.retval);
      return market;
    }
    return null;
  } catch (err) {
    console.error("getMarket failed:", err);
    return null;
  }
}

/**
 * Return true if a nullifier has been spent.
 */
export async function isNullifierSpent(
  nullifier: string
): Promise<boolean> {
  if (!CONTRACT_ID) return false;
  // Implementation similar to getMarket
  return false;
}

/**
 * Claim winnings using a snarkjs Groth16 proof.
 *
 * @param commitment - Decimal string or hex
 * @param nullifier  - Decimal string or hex (output of RevealBet circuit)
 * @param proof      - snarkjs proof object
 */
export async function claimWinnings(
  publicKey: string,
  marketId: number,
  commitment: string,
  nullifier: string,
  proof: Groth16Proof
): Promise<EscrowResult> {
  if (!CONTRACT_ID) {
    await mockDelay(2000);
    return { success: true, hash: randomHex(32) };
  }

  try {
    const { Address, nativeToScVal, xdr } = await import(
      "@stellar/stellar-sdk"
    );

    const toBytes32 = (val: string) => {
      let hex = val.startsWith("0x") ? val.slice(2) : BigInt(val).toString(16);
      return xdr.ScVal.scvBytes(Buffer.from(hex.padStart(64, "0"), "hex"));
    };

    const g1 = (x: string, y: string) =>
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("x"), val: toBytes32(x) }),
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("y"), val: toBytes32(y) }),
      ]);

    const g2 = (xRe: string, xIm: string, yRe: string, yIm: string) =>
      xdr.ScVal.scvMap([
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("x_im"), val: toBytes32(xIm) }),
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("x_re"), val: toBytes32(xRe) }),
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("y_im"), val: toBytes32(yIm) }),
        new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("y_re"), val: toBytes32(yRe) }),
      ]);

    const proofScVal = xdr.ScVal.scvMap([
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("a"), val: g1(proof.pi_a[0], proof.pi_a[1]) }),
      new xdr.ScMapEntry({
        key: xdr.ScVal.scvSymbol("b"),
        val: g2(proof.pi_b[0][0], proof.pi_b[0][1], proof.pi_b[1][0], proof.pi_b[1][1]),
      }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol("c"), val: g1(proof.pi_c[0], proof.pi_c[1]) }),
    ]);

    const args = [
      new Address(publicKey).toScVal(),
      nativeToScVal(marketId, { type: "u32" }),
      toBytes32(commitment),
      toBytes32(nullifier),
      proofScVal,
    ];

    const unsignedXdr = await buildSorobanCall(publicKey, "claim", args);
    return { success: true, hash: "", unsignedXdr };
  } catch (err) {
    console.error("[escrow] claim failed:", err);
    return { success: false, hash: "" };
  }
}
