/**
 * tests/setup.ts
 * 
 * Global test setup for vitest
 */

// Mock Prisma client for tests
import { vi } from 'vitest'

// Mock the database module
vi.mock('@/lib/db', () => ({
  prisma: {
    market: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    probabilityHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}))
