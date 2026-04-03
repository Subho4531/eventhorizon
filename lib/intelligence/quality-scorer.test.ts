/**
 * lib/intelligence/quality-scorer.test.ts
 *
 * Tests for the market quality scoring system.
 * Uses both unit tests and property-based tests.
 *
 * Feature: advanced-prediction-market-intelligence
 * Task: 7 - Market Quality Scoring + Analytics Dashboard
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import {
  calculateQualityScore,
  getQualityBreakdown,
  type QualityBreakdown,
} from './quality-scorer'
import { prisma } from '@/lib/db'
import * as reputationSystem from './reputation-system'

// ──────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ──────────────────────────────────────────────────────────────────────────────

const marketArbitrary = fc.record({
  id: fc.uuid(),
  title: fc.string({ minLength: 10, maxLength: 200 }),
  description: fc.option(fc.string({ minLength: 20, maxLength: 500 }), { nil: null }),
  yesPool: fc.float({ min: 0, max: 10000, noNaN: true }),
  noPool: fc.float({ min: 0, max: 10000, noNaN: true }),
  oracleAddress: fc.option(fc.string(), { nil: null }),
  creator: fc.record({
    publicKey: fc.string(),
    reputationScore: fc.integer({ min: 0, max: 1000 }),
  }),
})

// ──────────────────────────────────────────────────────────────────────────────
// Property 29: Quality Score Calculation
// **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**
// ──────────────────────────────────────────────────────────────────────────────

describe('Property 29: Quality Score Calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('quality score is always between 0 and 100', async () => {
    await fc.assert(
      fc.asyncProperty(
        marketArbitrary,
        fc.float({ min: 0, max: 1, noNaN: true }),
        async (market, oracleReliability) => {
          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)
          vi.spyOn(reputationSystem, 'calculateOracleReliability').mockResolvedValue(oracleReliability)

          const score = await calculateQualityScore(market.id)

          // Property: score must be in [0, 100]
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
        fc.integer({ min: 0, max: 1000 }),
        fc.float({ min: 0, max: 1, noNaN: true }),
        fc.float({ min: 0, max: 10000, noNaN: true }),
        fc.float({ min: 0, max: 10000, noNaN: true }),
        fc.integer({ min: 10, max: 200 }),
        fc.integer({ min: 0, max: 500 }),
        async (creatorRep, oracleRel, yesPool, noPool, titleLen, descLen) => {
          const market = {
            id: 'test-market',
            title: 'x'.repeat(titleLen),
            description: 'y'.repeat(descLen),
            yesPool,
            noPool,
            oracleAddress: 'oracle-addr',
            creator: {
              publicKey: 'creator-key',
              reputationScore: creatorRep,
            },
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)
          vi.spyOn(reputationSystem, 'calculateOracleReliability').mockResolvedValue(oracleRel)

          const breakdown = await getQualityBreakdown(market.id)

          // Property: formula components match specification
          const expectedCreatorScore = (creatorRep / 1000) * 30
          const expectedOracleScore = oracleRel * 30
          const totalPool = yesPool + noPool
          const expectedLiquidityScore = Math.min(totalPool / 1000, 1) * 20
          const expectedClarityScore = Math.min((titleLen + descLen) / 200, 1) * 20

          expect(breakdown.creatorReputation).toBeCloseTo(expectedCreatorScore, 1)
          expect(breakdown.oracleReliability).toBeCloseTo(expectedOracleScore, 1)
          expect(breakdown.liquidityDepth).toBeCloseTo(expectedLiquidityScore, 1)
          expect(breakdown.marketClarity).toBeCloseTo(expectedClarityScore, 1)

          // Property: total score is sum of components
          const expectedTotal = 
            expectedCreatorScore + 
            expectedOracleScore + 
            expectedLiquidityScore + 
            expectedClarityScore

          expect(breakdown.totalScore).toBeCloseTo(expectedTotal, 1)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('creator reputation contributes 30% weight', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 1000 }),
        async (reputationScore) => {
          const market = {
            id: 'test-market',
            title: 'Test Market Title',
            description: 'Test Description',
            yesPool: 0,
            noPool: 0,
            oracleAddress: null,
            creator: {
              publicKey: 'creator-key',
              reputationScore,
            },
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)

          const breakdown = await getQualityBreakdown(market.id)

          // Property: creator reputation component is (score/1000) * 30
          const expectedComponent = (reputationScore / 1000) * 30
          expect(breakdown.creatorReputation).toBeCloseTo(expectedComponent, 2)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('oracle reliability contributes 30% weight', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 1, noNaN: true }),
        async (reliability) => {
          const market = {
            id: 'test-market',
            title: 'Test Market Title',
            description: 'Test Description',
            yesPool: 0,
            noPool: 0,
            oracleAddress: 'oracle-addr',
            creator: {
              publicKey: 'creator-key',
              reputationScore: 500,
            },
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)
          vi.spyOn(reputationSystem, 'calculateOracleReliability').mockResolvedValue(reliability)

          const breakdown = await getQualityBreakdown(market.id)

          // Property: oracle reliability component is reliability * 30
          const expectedComponent = reliability * 30
          expect(breakdown.oracleReliability).toBeCloseTo(expectedComponent, 2)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('liquidity depth contributes 20% weight with cap at 1000 XLM', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 10000, noNaN: true }),
        fc.float({ min: 0, max: 10000, noNaN: true }),
        async (yesPool, noPool) => {
          const market = {
            id: 'test-market',
            title: 'Test Market Title',
            description: 'Test Description',
            yesPool,
            noPool,
            oracleAddress: null,
            creator: {
              publicKey: 'creator-key',
              reputationScore: 500,
            },
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)

          const breakdown = await getQualityBreakdown(market.id)

          // Property: liquidity component is min(pool/1000, 1) * 20
          const totalPool = yesPool + noPool
          const expectedComponent = Math.min(totalPool / 1000, 1) * 20
          expect(breakdown.liquidityDepth).toBeCloseTo(expectedComponent, 2)

          // Property: liquidity component never exceeds 20
          expect(breakdown.liquidityDepth).toBeLessThanOrEqual(20)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('market clarity contributes 20% weight based on text length', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 300 }),
        fc.integer({ min: 0, max: 700 }),
        async (titleLen, descLen) => {
          const market = {
            id: 'test-market',
            title: 'x'.repeat(titleLen),
            description: descLen > 0 ? 'y'.repeat(descLen) : null,
            yesPool: 0,
            noPool: 0,
            oracleAddress: null,
            creator: {
              publicKey: 'creator-key',
              reputationScore: 500,
            },
          }

          vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)

          const breakdown = await getQualityBreakdown(market.id)

          // Property: clarity component is min((titleLen + descLen)/200, 1) * 20
          const totalLength = titleLen + (descLen || 0)
          const expectedComponent = Math.min(totalLength / 200, 1) * 20
          expect(breakdown.marketClarity).toBeCloseTo(expectedComponent, 2)

          // Property: clarity component never exceeds 20
          expect(breakdown.marketClarity).toBeLessThanOrEqual(20)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Unit Tests: Edge Cases and Integration
// ──────────────────────────────────────────────────────────────────────────────

describe('Quality Scorer: Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('handles market with no oracle address', async () => {
    const market = {
      id: 'test-market',
      title: 'Test Market',
      description: 'Description',
      yesPool: 500,
      noPool: 500,
      oracleAddress: null,
      creator: {
        publicKey: 'creator-key',
        reputationScore: 600,
      },
    }

    vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
    vi.mocked(prisma.market.update).mockResolvedValue({} as any)

    const breakdown = await getQualityBreakdown(market.id)

    expect(breakdown.oracleReliability).toBe(0)
    expect(breakdown.totalScore).toBeGreaterThan(0)
  })

  test('handles market with null description', async () => {
    const market = {
      id: 'test-market',
      title: 'Test Market Title',
      description: null,
      yesPool: 500,
      noPool: 500,
      oracleAddress: 'oracle-addr',
      creator: {
        publicKey: 'creator-key',
        reputationScore: 600,
      },
    }

    vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
    vi.mocked(prisma.market.update).mockResolvedValue({} as any)
    vi.spyOn(reputationSystem, 'calculateOracleReliability').mockResolvedValue(0.9)

    const breakdown = await getQualityBreakdown(market.id)

    // Should use only title length for clarity
    expect(breakdown.marketClarity).toBeGreaterThan(0)
    expect(breakdown.totalScore).toBeGreaterThan(0)
  })

  test('handles oracle reliability calculation failure', async () => {
    const market = {
      id: 'test-market',
      title: 'Test Market',
      description: 'Description',
      yesPool: 500,
      noPool: 500,
      oracleAddress: 'oracle-addr',
      creator: {
        publicKey: 'creator-key',
        reputationScore: 600,
      },
    }

    vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
    vi.mocked(prisma.market.update).mockResolvedValue({} as any)
    vi.spyOn(reputationSystem, 'calculateOracleReliability').mockRejectedValue(
      new Error('Oracle not found')
    )

    const breakdown = await getQualityBreakdown(market.id)

    // Should default to 0 for oracle reliability
    expect(breakdown.oracleReliability).toBe(0)
    expect(breakdown.totalScore).toBeGreaterThan(0)
  })

  test('throws error for non-existent market', async () => {
    vi.mocked(prisma.market.findUnique).mockResolvedValue(null)

    await expect(calculateQualityScore('non-existent')).rejects.toThrow('Market non-existent not found')
  })

  test('caches quality scores with 60-second TTL', async () => {
    const market = {
      id: 'test-market',
      title: 'Test Market',
      description: 'Description',
      yesPool: 500,
      noPool: 500,
      oracleAddress: null,
      creator: {
        publicKey: 'creator-key',
        reputationScore: 600,
      },
    }

    vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
    vi.mocked(prisma.market.update).mockResolvedValue({} as any)

    // First call
    const score1 = await calculateQualityScore(market.id)
    
    // Second call should use cache
    const score2 = await calculateQualityScore(market.id)

    expect(score1).toBe(score2)
    // Should only call findUnique once due to caching
    expect(vi.mocked(prisma.market.findUnique)).toHaveBeenCalledTimes(1)
  })

  test('perfect market scores 100', async () => {
    const market = {
      id: 'test-market',
      title: 'x'.repeat(100),
      description: 'y'.repeat(100),
      yesPool: 5000,
      noPool: 5000,
      oracleAddress: 'oracle-addr',
      creator: {
        publicKey: 'creator-key',
        reputationScore: 1000,
      },
    }

    vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
    vi.mocked(prisma.market.update).mockResolvedValue({} as any)
    vi.spyOn(reputationSystem, 'calculateOracleReliability').mockResolvedValue(1.0)

    const breakdown = await getQualityBreakdown(market.id)

    expect(breakdown.totalScore).toBe(100)
  })

  test('empty market with novice creator scores low', async () => {
    const market = {
      id: 'test-market',
      title: 'Test',
      description: null,
      yesPool: 0,
      noPool: 0,
      oracleAddress: null,
      creator: {
        publicKey: 'creator-key',
        reputationScore: 0,
      },
    }

    vi.mocked(prisma.market.findUnique).mockResolvedValue(market as any)
    vi.mocked(prisma.market.update).mockResolvedValue({} as any)

    const breakdown = await getQualityBreakdown(market.id)

    expect(breakdown.totalScore).toBeLessThan(10)
  })
})
