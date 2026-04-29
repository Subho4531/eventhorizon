import * as dotenv from 'dotenv'
import * as path from 'path'

// Load .env from the root directory
dotenv.config({ path: path.resolve(__dirname, '../.env') })

import { prisma } from '../lib/db'

async function checkConnections() {
  try {
    const result = await prisma.$queryRawUnsafe('SELECT count(*) FROM pg_stat_activity')
    console.log('Active connections:', result)
    
    const settings = await prisma.$queryRawUnsafe('SHOW max_connections')
    console.log('Max connections:', settings)
  } catch (error) {
    console.error('Failed to check connections:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkConnections()
