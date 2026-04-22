/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testCreate() {
  try {
    const data = {
      contractMarketId: Math.floor(Math.random() * 1000000),
      title: "Test Market " + Date.now(),
      description: "Test Description",
      creator: {
        connectOrCreate: {
          where: { publicKey: "GBTEST..." },
          create: { publicKey: "GBTEST...", name: "Test Creator" }
        }
      },
      closeDate: new Date(),
      category: "Crypto",
      status: "OPEN"
    };

    console.log('Attempting to create market with data:', JSON.stringify(data, null, 2));
    const market = await prisma.market.create({ data });
    console.log('Success! Created market:', market.id);
  } catch (error) {
    console.error('Error Details:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testCreate();
