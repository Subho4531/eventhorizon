/**
 * lib/intelligence/quality-scorer.test.ts
 *
 * Tests for the market quality scoring system.
 * Uses both unit tests and property-based tests.
 *
 * Feature: advanced-prediction-market-intelligence
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import {
  calculateQualityScore,
  getQualityBreakdown,
} from './quality-scorer'
import { prisma } from '@/lib/db'

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    market: {
      findUnique: vi.fn(),
      update: vi.fn(),
    }
  }
}))

describe('Property 29: Quality Score Calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('quality score is always between 0 and 100', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.uuid(),
          title: fc.string({ minLength: 1, maxLength: 200 }),
          description: fc.option(fc.string({ maxLength: 500 }), { nil: null }),
          totalVolume: fc.double({ min: 0, max: 10000, noNaN: true }),
          creator: fc.record({
            reputationScore: fc.integer({ min: 0, max: 1000 }),
          }),
          _count: fc.record({
            bets: fc.integer({ min: 0, max: 100 }),
          }),
        }),
        async (market) => {
          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)

          const score = await calculateQualityScore(market.id)

          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(100)
          expect(Number.isFinite(score)).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('quality score formula matches specification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          creatorRep: fc.integer({ min: 0, max: 1000 }),
          totalVolume: fc.double({ min: 0, max: 10000, noNaN: true }),
          titleLen: fc.integer({ min: 0, max: 100 }),
          descLen: fc.integer({ min: 0, max: 200 }),
          betCount: fc.integer({ min: 0, max: 50 }),
        }),
        async ({ creatorRep, totalVolume, titleLen, descLen, betCount }) => {
          const market = {
            id: 'test-market',
            title: 'x'.repeat(titleLen),
            description: descLen > 0 ? 'y'.repeat(descLen) : null,
            totalVolume,
            creator: {
              reputationScore: creatorRep,
            },
            _count: {
              bets: betCount,
            },
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)

          const breakdown = await getQualityBreakdown(market.id)

          // 1. Creator Reputation (25% weight)
          const expectedCreatorScore = (creatorRep / 1000) * 25
          
          // 2. Liquidity (25% weight, cap at 500)
          const expectedLiquidityScore = Math.min(totalVolume / 500, 1) * 25
          
          // 3. Clarity (30% weight: 15 for title, 15 for desc)
          const expectedTitleScore = Math.min(titleLen / 30, 1) * 15
          const expectedDescScore = Math.min(descLen / 80, 1) * 15
          const expectedClarityScore = expectedTitleScore + expectedDescScore
          
          // 4. Activity (20% weight, cap at 10)
          const expectedActivityScore = Math.min(betCount / 10, 1) * 20

          expect(breakdown.creatorReputation).toBeCloseTo(expectedCreatorScore, 1)
          expect(breakdown.liquidityDepth).toBeCloseTo(expectedLiquidityScore, 1)
          expect(breakdown.marketClarity).toBeCloseTo(expectedClarityScore, 1)
          expect(breakdown.activityScore).toBeCloseTo(expectedActivityScore, 1)

          const expectedTotal = 
            expectedCreatorScore + 
            expectedLiquidityScore + 
            expectedClarityScore + 
            expectedActivityScore

          expect(breakdown.totalScore).toBeCloseTo(Math.min(100, expectedTotal), 1)
        }
      ),
      { numRuns: 100 }
    )
  })
})

describe('Quality Scorer: Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('perfect market scores 100', async () => {
    const market = {
      id: 'test-market',
      title: 'x'.repeat(30),
      description: 'y'.repeat(80),
      totalVolume: 500,
      creator: {
        reputationScore: 1000,
      },
      _count: {
        bets: 10,
      },
    }

    vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
    vi.mocked(prisma.market.update).mockResolvedValue({} as any)

    const breakdown = await getQualityBreakdown(market.id)
    expect(breakdown.totalScore).toBe(100)
  })

  test('throws error for non-existent market', async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null)
    await expect(calculateQualityScore('non-existent')).rejects.toThrow('Market non-existent not found')
  })
})
