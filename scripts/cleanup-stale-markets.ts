import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  const onChainCount = 5; // Hardcoded after CLI verification to be safe
  console.log(`Synchronizing Database with On-Chain Market Count Limit: ${onChainCount}`);
  
  try {
    const staleMarkets = await prisma.market.findMany({
      where: {
        contractMarketId: {
          gt: onChainCount
        }
      }
    });

    if (staleMarkets.length === 0) {
      console.log("No stale markets found (ID > 5). Database is in sync.");
    } else {
      console.log(`Found ${staleMarkets.length} stale markets. Deleting...`);
      for (const m of staleMarkets) {
        console.log(`- Deleting Market "${m.title}" (Contract ID: ${m.contractMarketId})`);
        // Note: We might need to delete related bets first due to foreign key constraints
        await prisma.bet.deleteMany({ where: { marketId: m.id } });
        await prisma.market.delete({ where: { id: m.id } });
      }
      console.log("Cleanup complete.");
    }
  } catch (err) {
    console.error("Cleanup Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
