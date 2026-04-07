require("dotenv").config();
const { neonConfig } = require("@neondatabase/serverless");
const { PrismaNeon } = require("@prisma/adapter-neon");
const { PrismaClient } = require("@prisma/client");
const ws = require("ws");

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const CREATOR_ID = "GCVSH65WNB6IM3LPC5DMEEY5WXQ5ISX62STSGBYIRKRWSEMZ4S2LHPD7";

async function main() {
  // Ensure creator/oracle user exists
  await prisma.user.upsert({
    where: { publicKey: CREATOR_ID },
    update: {},
    create: {
      publicKey: CREATOR_ID,
      name: "GravityFlow Oracle",
      balance: 0,
    },
  });

  const markets = [
    {
      contractMarketId: 3,
      title: "Will Bitcoin hit $150,000 by end of 2026?",
      description:
        "Resolves YES if BTC/USD closes above $150,000 on any major exchange before December 31, 2026.",
      category: "Crypto",
      closeDate: new Date("2027-01-01"),
      yesPool: 12400,
      noPool: 8800,
      totalVolume: 21200,
    },
    {
      title: "Will Ethereum Complete Its Next Major Upgrade Before Q4 2026?",
      description:
        "Resolves YES if the Ethereum network deploys a major consensus upgrade before October 1, 2026.",
      category: "Crypto",
      closeDate: new Date("2026-10-01"),
      yesPool: 6200,
      noPool: 9100,
      totalVolume: 15300,
    },
    {
      title: "Will Stellar XLM reach $1.00 before 2027?",
      description:
        "Resolves YES if XLM/USD price closes above $1.00 on any major exchange before January 1, 2027.",
      category: "Crypto",
      closeDate: new Date("2027-01-01"),
      yesPool: 4400,
      noPool: 7200,
      totalVolume: 11600,
    },
    {
      title: "Will the US Federal Reserve cut rates 3+ times in 2026?",
      description:
        "Resolves YES if the FOMC announces 3 or more rate cuts during calendar year 2026.",
      category: "Finance",
      closeDate: new Date("2027-01-15"),
      yesPool: 9800,
      noPool: 5600,
      totalVolume: 15400,
    },
    {
      title: "Will OpenAI release GPT-5 in 2026?",
      description:
        "Resolves YES if OpenAI officially releases a model publicly branded as 'GPT-5' by December 31, 2026.",
      category: "Technology",
      closeDate: new Date("2027-01-01"),
      yesPool: 18200,
      noPool: 3100,
      totalVolume: 21300,
    },
    {
      title: "Will any sovereign nation adopt Bitcoin as legal tender in 2026?",
      description:
        "Resolves YES if a sovereign nation officially adopts Bitcoin as legal tender during calendar year 2026.",
      category: "Politics",
      closeDate: new Date("2027-01-01"),
      yesPool: 3200,
      noPool: 11400,
      totalVolume: 14600,
    },
  ];

  for (const m of markets) {
    const { contractMarketId, ...rest } = m;
    const data = {
      ...rest,
      bondAmount: 100,
      status: "OPEN",
      oracleAddress: CREATOR_ID,
      creatorId: CREATOR_ID,
    };
    if (contractMarketId !== undefined) {
      data.contractMarketId = contractMarketId;
    }
    await prisma.market.create({ data });
    console.log(`✅ Seeded: ${m.title}`);
  }

  console.log("\n🚀 Seeding complete — 6 markets created.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
