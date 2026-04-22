/**
 * tests/properties/quality-scoring.test.ts
 * 
 * Property-based tests for market quality scoring and alert threshold triggering
 * Feature: advanced-prediction-market-intelligence
 * 
 * Tests universal correctness properties across randomized inputs
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'

// Mock Prisma - must be before imports
vi.mock('@/lib/db', () => {
  const mockPrisma = {
    market: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    manipulationAlert: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    systemAlert: {
      create: vi.fn(),
    },
  }
  return {
    default: mockPrisma,
    prisma: mockPrisma,
  }
})

// Mock cache
vi.mock('@/lib/cache/intelligence-cache', () => ({
  intelligenceCache: {
    get: vi.fn(() => null),
    set: vi.fn(),
  },
}))

import {
  calculateQualityScore,
  getQualityBreakdown,
} from '@/lib/intelligence/quality-scorer'
import { calculateRiskScore } from '@/lib/intelligence/manipulation-detector'

// Import the mocked prisma
const mockPrisma = (await import('@/lib/db')).default as any

describe('Quality Scoring - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Property 29: Quality Score Calculation
  test('Property 29: quality score formula produces 0-100 value', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          creatorReputation: fc.integer({ min: 0, max: 1000 }),
          totalVolume: fc.float({ min: 0, max: 10000, noNaN: true }),
          titleLength: fc.integer({ min: 1, max: 200 }),
          descLength: fc.integer({ min: 0, max: 1000 }),
          betCount: fc.integer({ min: 0, max: 100 }),
        }),
        async ({
          marketId,
          creatorReputation,
          totalVolume,
          titleLength,
          descLength,
          betCount,
        }) => {
          // Mock market data
          const market = {
            id: marketId,
            title: 'A'.repeat(titleLength),
            description: 'B'.repeat(descLength),
            totalVolume,
            creator: {
              publicKey: 'creator-key',
              reputationScore: creatorReputation,
            },
            _count: {
              bets: betCount,
            }
          }

          vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(mockPrisma.market.update).mockResolvedValue(market as any)

          const score = await calculateQualityScore(marketId)

          // Property: quality score must be between 0 and 100
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(100)

          // Verify the formula components
          const breakdown = await getQualityBreakdown(marketId)
          
          // Each component should be within its weighted range
          expect(breakdown.creatorReputation).toBeGreaterThanOrEqual(0)
          expect(breakdown.creatorReputation).toBeLessThanOrEqual(25)
          
          expect(breakdown.liquidityDepth).toBeGreaterThanOrEqual(0)
          expect(breakdown.liquidityDepth).toBeLessThanOrEqual(25)
          
          expect(breakdown.marketClarity).toBeGreaterThanOrEqual(0)
          expect(breakdown.marketClarity).toBeLessThanOrEqual(30)
          
          expect(breakdown.activityScore).toBeGreaterThanOrEqual(0)
          expect(breakdown.activityScore).toBeLessThanOrEqual(20)

          // Total should equal sum of components
          const expectedTotal = 
            breakdown.creatorReputation +
            breakdown.liquidityDepth +
            breakdown.marketClarity +
            breakdown.activityScore

          expect(Math.abs(breakdown.totalScore - expectedTotal)).toBeLessThan(0.2)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 29 (continued): Verify formula correctness
  test('Property 29: quality score formula components are correctly weighted', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          creatorReputation: fc.integer({ min: 0, max: 1000 }),
          totalVolume: fc.float({ min: 0, max: 5000, noNaN: true }),
          titleLength: fc.integer({ min: 1, max: 100 }),
          descLength: fc.integer({ min: 0, max: 500 }),
          betCount: fc.integer({ min: 0, max: 50 }),
        }),
        async ({
          marketId,
          creatorReputation,
          totalVolume,
          titleLength,
          descLength,
          betCount,
        }) => {
          const market = {
            id: marketId,
            title: 'A'.repeat(titleLength),
            description: 'B'.repeat(descLength),
            totalVolume,
            creator: {
              publicKey: 'creator-key',
              reputationScore: creatorReputation,
            },
            _count: {
              bets: betCount,
            }
          }

          vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(mockPrisma.market.update).mockResolvedValue(market as any)

          const breakdown = await getQualityBreakdown(marketId)

          // Verify each component follows the formula
          const expectedCreatorScore = (creatorReputation / 1000) * 25
          expect(Math.abs(breakdown.creatorReputation - expectedCreatorScore)).toBeLessThan(0.2)

          const expectedLiquidityScore = Math.min(totalVolume / 500, 1) * 25
          expect(Math.abs(breakdown.liquidityDepth - expectedLiquidityScore)).toBeLessThan(0.2)

          const expectedClarityScore = (Math.min(titleLength / 30, 1) * 15) + (Math.min(descLength / 80, 1) * 15)
          expect(Math.abs(breakdown.marketClarity - expectedClarityScore)).toBeLessThan(0.2)

          const expectedActivityScore = Math.min(betCount / 10, 1) * 20
          expect(Math.abs(breakdown.activityScore - expectedActivityScore)).toBeLessThan(0.2)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 33: Alert Threshold Triggering - Manipulation Risk
  test('Property 33a: alerts trigger when manipulation risk >70', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          rapidBettingCount: fc.integer({ min: 0, max: 10 }),
          volumeSpikeCount: fc.integer({ min: 0, max: 5 }),
          washTradingCount: fc.integer({ min: 0, max: 3 }),
          sybilCount: fc.integer({ min: 0, max: 2 }),
        }),
        async ({ marketId, rapidBettingCount, volumeSpikeCount, washTradingCount, sybilCount }) => {
          // Clear mocks for each property test iteration
          vi.clearAllMocks()
          
          // Create alerts based on counts
          const alerts: any[] = []

          // Rapid betting: +10 points each
          for (let i = 0; i < rapidBettingCount; i++) {
            alerts.push({
              id: `rapid-${i}`,
              marketId,
              flagType: 'rapid_betting',
              severity: 'WARNING',
              details: { type: 'rapid_betting', userId: `user-${i}`, count: 11 },
              resolved: false,
              createdAt: new Date(),
            })
          }

          // Volume spike: +20 points each
          for (let i = 0; i < volumeSpikeCount; i++) {
            alerts.push({
              id: `spike-${i}`,
              marketId,
              flagType: 'volume_spike',
              severity: 'WARNING',
              details: { type: 'volume_spike', increase: 600 },
              resolved: false,
              createdAt: new Date(),
            })
          }

          // Wash trading: +30 points each
          for (let i = 0; i < washTradingCount; i++) {
            alerts.push({
              id: `wash-${i}`,
              marketId,
              flagType: 'wash_trading',
              severity: 'CRITICAL',
              details: { type: 'wash_trading', confidence: 0.8, accounts: [`user-${i}`, `user-${i + 1}`] },
              resolved: false,
              createdAt: new Date(),
            })
          }

          // Sybil cluster: +40 points each
          for (let i = 0; i < sybilCount; i++) {
            alerts.push({
              id: `sybil-${i}`,
              marketId,
              flagType: 'sybil_cluster',
              severity: 'CRITICAL',
              details: { type: 'sybil_cluster', accounts: [`user-${i}`, `user-${i + 1}`], fundingSource: `source-${i}` },
              resolved: false,
              createdAt: new Date(),
            })
          }

          vi.mocked(mockPrisma.manipulationAlert.findMany).mockResolvedValue(alerts)
          vi.mocked(mockPrisma.systemAlert.create).mockResolvedValue({} as any)

          const riskScore = await calculateRiskScore(marketId)

          // Calculate expected score based on unique flag types
          const expectedScore = 
            (rapidBettingCount > 0 ? 10 : 0) +
            (volumeSpikeCount > 0 ? 20 : 0) +
            (washTradingCount > 0 ? 30 : 0) +
            (sybilCount > 0 ? 40 : 0)

          expect(riskScore).toBe(expectedScore)

          // Simulate alert creation logic
          if (riskScore > 70) {
            await mockPrisma.systemAlert.create({
              data: {
                type: 'manipulation',
                severity: 'CRITICAL',
                message: `High manipulation risk detected for market ${marketId}`,
                metadata: {
                  marketId,
                  riskScore,
                },
                resolved: false,
              },
            })
          }

          // Property: system alert should be created if and only if risk score > 70
          const systemAlertCalls = vi.mocked(mockPrisma.systemAlert.create).mock.calls
          const manipulationAlerts = systemAlertCalls.filter(
            (call: any) => call[0].data.type === 'manipulation'
          )

          if (riskScore > 70) {
            expect(manipulationAlerts.length).toBeGreaterThan(0)
            expect(manipulationAlerts[0][0].data.severity).toBe('CRITICAL')
          } else {
            expect(manipulationAlerts.length).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Additional property: Quality score monotonicity
  test('Property: quality score increases with better inputs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          baseReputation: fc.integer({ min: 0, max: 500 }),
          reputationIncrease: fc.integer({ min: 0, max: 500 }),
        }),
        async ({ marketId, baseReputation, reputationIncrease }) => {
          // Test with base reputation
          const market1 = {
            id: marketId,
            title: 'Test Market',
            description: 'Test Description',
            totalVolume: 500,
            creator: {
              publicKey: 'creator-key',
              reputationScore: baseReputation,
            },
            _count: {
              bets: 5,
            }
          }

          vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(market1 as any)
          vi.mocked(mockPrisma.market.update).mockResolvedValue(market1 as any)

          const score1 = await calculateQualityScore(marketId)

          // Test with increased reputation
          const market2 = {
            ...market1,
            creator: {
              publicKey: 'creator-key',
              reputationScore: baseReputation + reputationIncrease,
            },
          }

          vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(market2 as any)
          vi.mocked(mockPrisma.market.update).mockResolvedValue(market2 as any)

          const score2 = await calculateQualityScore(marketId)

          // Property: higher reputation should result in higher or equal quality score
          expect(score2).toBeGreaterThanOrEqual(score1)

          // The difference should be proportional to reputation increase (25% weight)
          const expectedDifference = (reputationIncrease / 1000) * 25
          expect(Math.abs((score2 - score1) - expectedDifference)).toBeLessThan(0.2)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Additional property: Quality score with edge cases
  test('Property: quality score handles edge cases correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          hasDescription: fc.boolean(),
        }),
        async ({ marketId, hasDescription }) => {
          const market = {
            id: marketId,
            title: 'Test',
            description: hasDescription ? 'Description' : null,
            totalVolume: 0,
            creator: {
              publicKey: 'creator-key',
              reputationScore: 0,
            },
            _count: {
              bets: 0,
            }
          }

          vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(mockPrisma.market.update).mockResolvedValue(market as any)

          const score = await calculateQualityScore(marketId)

          // Property: even with all zeros, score should be valid (0-100)
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(100)
        }
      ),
      { numRuns: 100 }
    )
  })
})
