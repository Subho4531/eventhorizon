
import { prisma } from '../lib/db';

async function main() {
  try {
    console.log('Attempting to add totalWinnings column...');
    await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalWinnings" DOUBLE PRECISION DEFAULT 0;');
    console.log('Successfully added totalWinnings column.');
  } catch (error) {
    console.error('Error adding column:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
