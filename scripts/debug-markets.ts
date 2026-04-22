import { PrismaClient } from "@prisma/client";
import "dotenv/config";

async function main() {
  const prisma = new PrismaClient();

  try {
    const markets = await prisma.market.findMany({
      select: { id: true, title: true, contractMarketId: true }
    });
    console.log("Current Markets in DB:");
    console.table(markets);
  } catch (err) {
    console.error("DB Error:", err instanceof Error ? err.message : String(err));
  } finally {
    await prisma.$disconnect();
  }
}

main();
