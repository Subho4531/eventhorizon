
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const transactions = await prisma.transaction.groupBy({
    by: ['type'],
    _count: {
      type: true,
    },
  });

  console.log('Transaction counts by type:');
  console.log(JSON.stringify(transactions, null, 2));

  const totalBets = await prisma.bet.count();
  console.log('\nTotal bets in database:', totalBets);

  const betsWithTx = await prisma.bet.count({
    where: { txHash: { not: null } }
  });
  console.log('Bets with txHash:', betsWithTx);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
