/**
 * tests/setup.ts
 * 
 * Vitest setup file for test environment configuration
 */

import { vi } from 'vitest'

// Mock Prisma client
vi.mock('@/lib/db', () => ({
  prisma: {
    market: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    bet: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    probabilityHistory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    disputeChallenge: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    systemAlert: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
  default: {
    market: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    bet: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    probabilityHistory: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    disputeChallenge: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    systemAlert: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}))

