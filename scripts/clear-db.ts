import * as dotenv from 'dotenv'
import * as path from 'path'
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { prisma } from '../lib/db'

async function clearDatabase() {
  console.log('Clearing database...')
  try {
    // Order matters for foreign keys
    await prisma.transaction.deleteMany()
    await prisma.bet.deleteMany()
    await prisma.manipulationAlert.deleteMany()
    await prisma.probabilityHistory.deleteMany()
    await prisma.market.deleteMany()
    await prisma.user.deleteMany()
    
    console.log('Database cleared successfully!')
  } catch (error) {
    console.error('Failed to clear database:', error)
  } finally {
    await prisma.$disconnect()
  }
}

clearDatabase()
