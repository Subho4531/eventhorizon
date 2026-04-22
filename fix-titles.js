/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
});

async function main() {
  const markets = await prisma.market.findMany();
  for (const m of markets) {
    if (!m.title.includes('_')) continue;
    let newTitle = m.title.replace(/_/g, ' ').trim();
    if (m.title.endsWith('_')) newTitle += '?';
    await prisma.market.update({ where: { id: m.id }, data: { title: newTitle }});
    console.log('Updated', m.title, '->', newTitle);
  }
  console.log('Done');
}

main().catch(console.error).finally(() => prisma.$disconnect());
