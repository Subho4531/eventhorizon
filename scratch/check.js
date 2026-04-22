/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const txs = await prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } });
  console.log("ALL TRANSACTIONS:");
  txs.forEach(t => console.log(`${t.type} ${t.amount} XLM ${t.createdAt}`));

  const bets = await prisma.bet.findMany({ select: { id: true, amount: true, claimedAt: true } });
  console.log("\nALL BETS:");
  bets.forEach(b => console.log(`Bet ${b.id}: ${b.amount} XLM, Claimed: ${b.claimedAt}`));
}

check().catch(console.error).finally(() => prisma.$disconnect());
