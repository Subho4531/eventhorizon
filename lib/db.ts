import { PrismaClient } from "@prisma/client";

// In Prisma 7, the connection URL is passed directly to PrismaClient
// via `datasourceUrl` (not via schema.prisma or adapter).
// This ensures the DATABASE_URL env var from Vercel/Netlify is picked up at runtime.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Add it to your Vercel/Netlify environment variables."
    );
  }
  return new PrismaClient({
    datasourceUrl: url,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
