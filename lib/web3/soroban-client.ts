/**
 * lib/web3/soroban-client.ts
 *
 * Shared low-level Soroban RPC helpers.
 * Used by both:
 *   - escrow.ts (client-side, Freighter signing)
 *   - server-signer.ts (server-side, keypair signing)
 */

const RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_STELLAR_NETWORK === "mainnet"
    ? "Public Global Stellar Network ; September 2015"
    : "Test SDF Network ; September 2015";

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID ?? "";

/** 1 XLM = 10_000_000 stroops */
export const XLM_FACTOR = 10_000_000;

export function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * XLM_FACTOR));
}

export function stroopsToXlm(stroops: bigint | string): number {
  return Number(BigInt(stroops)) / XLM_FACTOR;
}

/**
 * Build an unsigned Soroban transaction XDR via simulation.
 * `senderPublicKey` is the account that will sign — used to fetch the sequence number.
 */
export async function buildUnsignedXdr(
  senderPublicKey: string,
  method: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[]
): Promise<string> {
  const {
    Contract,
    TransactionBuilder,
    BASE_FEE,
    rpc,
  } = await import("@stellar/stellar-sdk");

  const server = new rpc.Server(RPC_URL, { allowHttp: false });
  const account = await server.getAccount(senderPublicKey);
  const contract = new Contract(CONTRACT_ID);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(300)
    .build();

  const simResult = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(simResult)) {
    throw new Error(`Simulation failed for ${method}: ${simResult.error}`);
  }

  const prepared = rpc.assembleTransaction(tx, simResult).build();
  return prepared.toEnvelope().toXDR("base64");
}

/**
 * Submit a fully-signed XDR and wait for confirmation.
 * Returns { hash, returnValue }.
 */
export async function submitAndConfirm(
  signedXdr: string
): Promise<{ hash: string; returnValue?: unknown }> {
  const { TransactionBuilder, rpc } = await import("@stellar/stellar-sdk");

  const server = new rpc.Server(RPC_URL, { allowHttp: false });
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const send = await server.sendTransaction(tx);

  if (send.status === "ERROR") {
    throw new Error(`Submit error: ${JSON.stringify(send.errorResult)}`);
  }

  // Poll for confirmation — up to 30s
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await server.getTransaction(send.hash);

    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      let returnValue: unknown;
      if (status.returnValue) {
        const { scValToNative } = await import("@stellar/stellar-sdk");
        returnValue = scValToNative(status.returnValue);
      }
      return { hash: send.hash, returnValue };
    }

    if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error(
        `Transaction failed on-chain: ${status.resultMetaXdr?.toXDR("base64") ?? JSON.stringify(status)}`
      );
    }
  }
  throw new Error("Transaction confirmation timeout after 30s");
}
