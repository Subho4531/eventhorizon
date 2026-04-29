import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Prisma 7 requires a driver adapter to pass the connection URL at runtime.
// datasourceUrl was removed from the PrismaClient constructor in v7.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // Use DIRECT_URL if available for better stability with driver-level pooling
  // Fallback to DATABASE_URL if DIRECT_URL is not set
  const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error(
      "Neither DIRECT_URL nor DATABASE_URL is set. Add them to your environment variables."
    );
  }
  
  const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false }, // Required for Supabase/Neon DB
    max: 20, // Increased from 10 to 20
    idleTimeoutMillis: 60000, // Increased from 30000 to 60000
    connectionTimeoutMillis: 30000, // Increased to 30s to handle pooler latency
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

