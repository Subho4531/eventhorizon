import { rpc, Contract, scValToNative, nativeToScVal } from "@stellar/stellar-sdk";
import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
dotenv.config();

const prisma = new PrismaClient();
const CONTRACT_ID = process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID!;
const RPC_URL = process.env.NEXT_PUBLIC_SOROBAN_RPC_URL!;
const ADMIN_ID = process.env.NEXT_PUBLIC_ADMIN_ID!;

async function sync() {
  console.log("Starting full market re-sync...");
  const server = new rpc.Server(RPC_URL);
  const contract = new Contract(CONTRACT_ID);

  try {
    // 1. Get Market Count
    const dummy = "GA2NUAFIJ6XN2QXRPWYGGGLSRIENLE4KISERJOSQS2IA37Z3PQVOLE43";
    const acc = await server.getAccount(dummy);
    const { TransactionBuilder, Networks, BASE_FEE } = await import("@stellar/stellar-sdk");
    const txCount = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: "Test SDF Network ; September 2015" })
      .addOperation(contract.call("market_count"))
      .setTimeout(0)
      .build();
    const simCount = await server.simulateTransaction(txCount);
    if (!rpc.Api.isSimulationSuccess(simCount)) throw new Error("Failed to get count");
    const count = scValToNative(simCount.result.retval);
    console.log(`On-chain Market Count: ${count}`);

    // 2. Sync each market
    for (let i = 1; i <= count; i++) {
       console.log(`Checking Market ${i}...`);
       const txM = new TransactionBuilder(acc, { fee: BASE_FEE, networkPassphrase: "Test SDF Network ; September 2015" })
         .addOperation(contract.call("get_market", nativeToScVal(i, { type: "u32" })))
         .setTimeout(0)
         .build();
       const simM = await server.simulateTransaction(txM);
       if (rpc.Api.isSimulationSuccess(simM)) {
         const m = scValToNative(simM.result.retval);
         
         const statusMap: Record<number, string> = { 0: "OPEN", 1: "RESOLVED" };
         const status = typeof m.status === 'object' ? Object.keys(m.status)[0].toUpperCase() : (statusMap[m.status] || "OPEN");

         await prisma.market.upsert({
           where: { contractMarketId: i },
           update: {
             title: m.title,
             status: status as any,
             closeDate: new Date(Number(m.close_time) * 1000),
             outcome: m.outcome !== undefined ? (m.outcome === 0 ? "YES" : "NO") : null,
             payoutBps: m.payout_bps,
           },
           create: {
             contractMarketId: i,
             title: m.title,
             description: "Synced from on-chain",
             creatorId: ADMIN_ID,
             closeDate: new Date(Number(m.close_time) * 1000),
             category: "Crypto",
             status: status as any,
             outcome: m.outcome !== undefined ? (m.outcome === 0 ? "YES" : "NO") : null,
             payoutBps: m.payout_bps,
           }
         });
         console.log(`- Market ${i} ("${m.title}") synced.`);
       }
    }
  } catch (err) {
    console.error("Sync failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

sync();
