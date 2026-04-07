import { PrismaClient } from "@prisma/client";
import { Horizon, rpc, Contract, scValToNative } from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();
const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID;
const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL || "https://soroban-testnet.stellar.org";

async function main() {
  if (!CONTRACT_ID) {
    console.error("NEXT_PUBLIC_ESCROW_CONTRACT_ID not set");
    return;
  }

  console.log("Synchronizing Database with On-Chain Market Count...");
  
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);
  
  // 1. Get on-chain market count
  // Using a dummy source for simulation
  const dummySource = "GA2NUAFIJ6XN2QXRPWYGGGLSRIENLE4KISERJOSQS2IA37Z3PQVOLE43";
  const { TransactionBuilder, Networks, BASE_FEE } = await import("@stellar/stellar-sdk");
  
  const account = await server.getAccount(dummySource);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: "Test SDF Network ; September 2015" })
    .addOperation(contract.call("market_count"))
    .setTimeout(0)
    .build();
    
  const sim = await server.simulateTransaction(tx);
  let onChainCount = 0;
  if (rpc.Api.isSimulationSuccess(sim) && sim.result?.retval) {
    onChainCount = scValToNative(sim.result.retval) as number;
    console.log(`On-chain Market Count: ${onChainCount}`);
  } else {
    throw new Error("Failed to fetch on-chain market count");
  }

  // 2. Find markets in DB with ID > onChainCount
  const staleMarkets = await prisma.market.findMany({
    where: {
      contractMarketId: {
        gt: onChainCount
      }
    }
  });

  if (staleMarkets.length === 0) {
    console.log("No stale markets found. Database is in sync.");
  } else {
    console.log(`Found ${staleMarkets.length} stale markets. Deleting...`);
    for (const m of staleMarkets) {
      console.log(`- Deleting Market "${m.title}" (Contract ID: ${m.contractMarketId})`);
      await prisma.market.delete({ where: { id: m.id } });
    }
    console.log("Cleanup complete.");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
