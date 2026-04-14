const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    const markets = await prisma.market.findMany({
      select: { id: true, title: true, contractMarketId: true }
    });
    console.log("Current Markets in DB:");
    console.table(markets);
  } catch (err) {
    console.error("DB Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
