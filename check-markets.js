const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkMarkets() {
  try {
    const markets = await prisma.market.findMany({
      select: {
        id: true,
        title: true,
        status: true,
        closeDate: true,
        contractMarketId: true,
      }
    });
    
    console.log('Total markets:', markets.length);
    console.log('\nMarkets:');
    markets.forEach(m => {
      console.log(`- [${m.status}] ${m.title} (ID: ${m.id}, Contract ID: ${m.contractMarketId})`);
      console.log(`  Close Date: ${m.closeDate}`);
    });
    
    const openMarkets = markets.filter(m => m.status === 'OPEN');
    console.log(`\nOPEN markets: ${openMarkets.length}`);
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkMarkets();
