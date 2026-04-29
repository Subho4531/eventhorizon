import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // For migrations: use the direct connection (port 5432, no pgbouncer)
    // For runtime (PrismaClient via PrismaPg adapter): DATABASE_URL is used in lib/db.ts
    url: process.env.DIRECT_URL || process.env.DATABASE_URL!,
  },
});
