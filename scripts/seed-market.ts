import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import ws from "ws";

// Initialize properly
neonConfig.webSocketConstructor = ws;
const connectionString = process.env.DATABASE_URL;
const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const contractMarketId = 1;
  const creatorId = "GA2NUAFIJ6XN2QXRPWYGGGLSRIENLE4KISERJOSQS2IA37Z3PQVOLE43"; // deployer pubkey
  const closeDate = new Date();
  closeDate.setMonth(closeDate.getMonth() + 1);

  // Check if user exists
  await prisma.user.upsert({
    where: { publicKey: creatorId },
    update: {},
    create: {
      publicKey: creatorId,
      name: "Admin",
      balance: 10000
    }
  });

  const market = await prisma.market.upsert({
    where: { contractMarketId },
    update: { title: "Stellar hits $1 by 2026?" },
    create: {
      contractMarketId,
      title: "Stellar hits $1 by 2026?",
      description: "Prediction market for XLM reaching $1.",
      creatorId,
      closeDate,
      status: "OPEN",
      yesPool: 50,
      noPool: 30,
      totalVolume: 80
    }
  });

  console.log("Market seeded:", market.id);

  const market2 = await prisma.market.upsert({
    where: { contractMarketId: 2 },
    update: { title: "GPT-5 Released in 2026?" },
    create: {
      contractMarketId: 2,
      title: "GPT-5 Released in 2026?",
      description: "Betting on OpenAI release timeline.",
      creatorId,
      closeDate,
      status: "OPEN",
      yesPool: 15,
      noPool: 20,
      totalVolume: 35
    }
  });

  console.log("Market seeded:", market2.id);
}

main()
  .catch(e => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
