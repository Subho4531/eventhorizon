// Simple script to list all markets in the database
// Run with: node scripts/list-markets.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listMarkets() {
  try {
    console.log('Fetching all markets from database...\n');
    
    const markets = await prisma.market.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        contractMarketId: true,
        closeDate: true,
        yesPool: true,
        noPool: true,
        createdAt: true,
      }
    });
    
    if (markets.length === 0) {
      console.log('❌ No markets found in database!\n');
      console.log('You need to create a market first. Options:');
      console.log('1. Use the CreateMarketModal in the dashboard');
      console.log('2. Use POST /api/markets endpoint');
      console.log('3. Create directly in database\n');
      return;
    }
    
    console.log(`Found ${markets.length} market(s):\n`);
    
    markets.forEach((m, i) => {
      console.log(`${i + 1}. [${m.status}] ${m.title}`);
      console.log(`   ID: ${m.id}`);
      console.log(`   Contract ID: ${m.contractMarketId || 'N/A'}`);
      console.log(`   Close Date: ${m.closeDate.toISOString()}`);
      console.log(`   Pools: YES=${m.yesPool} XLM, NO=${m.noPool} XLM`);
      console.log(`   Created: ${m.createdAt.toISOString()}`);
      console.log('');
    });
    
    const openMarkets = markets.filter(m => m.status === 'OPEN');
    console.log(`\n✅ OPEN markets available for betting: ${openMarkets.length}`);
    
    if (openMarkets.length === 0) {
      console.log('\n⚠️  No OPEN markets found!');
      console.log('The bet creation form will be empty.');
      console.log('You need to either:');
      console.log('1. Create a new market with status="OPEN"');
      console.log('2. Update an existing market status to "OPEN"\n');
    } else {
      console.log('\nOPEN markets:');
      openMarkets.forEach(m => {
        console.log(`  - ${m.title} (ID: ${m.id})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

listMarkets();
