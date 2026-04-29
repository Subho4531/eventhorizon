import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Prisma 7 requires a driver adapter to pass the connection URL at runtime.
// datasourceUrl was removed from the PrismaClient constructor in v7.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Use DATABASE_URL (Transaction Pooler) by default for serverless environments.
  // DIRECT_URL (Session) should only be used for migrations or administrative tasks.
  const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
  
  if (!connectionString) {
    throw new Error(
      "Neither DATABASE_URL nor DIRECT_URL is set. Add them to your environment variables."
    );
  }
  
  const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_URL;
  
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }, // Required for Supabase/Neon DB
    max: isVercel ? 2 : 10, // Reduced from 20 to 2 in serverless, 10 in dev
    idleTimeoutMillis: 30000, 
    connectionTimeoutMillis: 10000, 
  });

  // Important: handle background connection errors
  pool.on('error', (err) => {
    console.error('[PrismaPool] Unexpected error on idle client', err);
  });
  
  const adapter = new PrismaPg(pool);
  
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;

