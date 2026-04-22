/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const publicKey = "GA2NUAFIJ6XN2QXRPWYGGGLSRIENLE4KISERJOSQS2IA37Z3PQVOLE43";
  
  console.log("Seeding user and market into database...");

  // 1. Ensure User exists
  await prisma.user.upsert({
    where: { publicKey },
    update: {},
    create: {
      publicKey,
      name: "Cosmic Deployer",
      bio: "GravityFlow platform architect and first oracle.",
      balance: 100 // Matches our on-chain deposit
    },
  });

  // 2. Create Market 1
  await prisma.market.upsert({
    where: { contractMarketId: 1 },
    update: {
        title: "SpaceX Mars Landing by 2026",
        description: "Will SpaceX successfully land a crewed mission on the surface of Mars by the end of 2026?",
        closeDate: new Date("2026-12-31T23:59:59Z"),
        status: "OPEN",
    },
    create: {
      title: "SpaceX Mars Landing by 2026",
      description: "Will SpaceX successfully land a crewed mission on the surface of Mars by the end of 2026?",
      creatorId: publicKey,
      closeDate: new Date("2026-12-31T23:59:59Z"),
      contractMarketId: 1,
      status: "OPEN",
      bondAmount: 50,
      totalVolume: 0
    },
  });
  
  console.log("✅ Seeded Market ID 1 (on-chain ref) into Prisma.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
