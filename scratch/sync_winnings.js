
/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const { PrismaNeon } = require('@prisma/adapter-neon');
const ws = require('ws');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const connectionString = process.env.DATABASE_URL;

const { neonConfig } = require('@neondatabase/serverless');
neonConfig.webSocketConstructor = ws;

async function main() {
  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    console.log('Fetching all users...');
    const users = await prisma.user.findMany();
    console.log(`Found ${users.length} users.`);

    for (const user of users) {
      console.log(`Processing user: ${user.publicKey}`);
      const claims = await prisma.transaction.aggregate({
        where: {
          userPublicKey: user.publicKey,
          type: 'CLAIM'
        },
        _sum: {
          amount: true
        }
      });

      const totalWinnings = claims._sum.amount || 0;
      console.log(`Setting totalWinnings to ${totalWinnings} for user ${user.publicKey}`);
      
      await prisma.user.update({
        where: { publicKey: user.publicKey },
        data: { totalWinnings }
      });
    }

    console.log('Data synchronization complete.');
  } catch (error) {
    console.error('Sync error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
