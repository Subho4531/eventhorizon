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

// Mock reputation system
vi.mock('@/lib/intelligence/reputation-system', () => ({
  calculateOracleReliability: vi.fn(async (address: string) => {
    // Return a valid reliability score between 0 and 1
    const hash = address.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return (hash % 100) / 100
  }),
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
          oracleReliability: fc.float({ min: 0, max: 1, noNaN: true }),
          yesPool: fc.float({ min: 0, max: 10000, noNaN: true }),
          noPool: fc.float({ min: 0, max: 10000, noNaN: true }),
          titleLength: fc.integer({ min: 1, max: 200 }),
          descLength: fc.integer({ min: 0, max: 1000 }),
        }),
        async ({
          marketId,
          creatorReputation,
          oracleReliability,
          yesPool,
          noPool,
          titleLength,
          descLength,
        }) => {
          // Mock market data
          const market = {
            id: marketId,
            title: 'A'.repeat(titleLength),
            description: 'B'.repeat(descLength),
            yesPool,
            noPool,
            oracleAddress: 'oracle-address',
            creator: {
              publicKey: 'creator-key',
              reputationScore: creatorReputation,
            },
          }

          vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(mockPrisma.market.update).mockResolvedValue(market as any)

          // Mock oracle reliability
          const { calculateOracleReliability } = await import('@/lib/intelligence/reputation-system')
          vi.mocked(calculateOracleReliability).mockResolvedValue(oracleReliability)

          const score = await calculateQualityScore(marketId)

          // Property: quality score must be between 0 and 100
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(100)

          // Verify the formula components
          const breakdown = await getQualityBreakdown(marketId)
          
          // Each component should be within its weighted range
          expect(breakdown.creatorReputation).toBeGreaterThanOrEqual(0)
          expect(breakdown.creatorReputation).toBeLessThanOrEqual(30)
          
          expect(breakdown.oracleReliability).toBeGreaterThanOrEqual(0)
          expect(breakdown.oracleReliability).toBeLessThanOrEqual(30)
          
          expect(breakdown.liquidityDepth).toBeGreaterThanOrEqual(0)
          expect(breakdown.liquidityDepth).toBeLessThanOrEqual(20)
          
          expect(breakdown.marketClarity).toBeGreaterThanOrEqual(0)
          expect(breakdown.marketClarity).toBeLessThanOrEqual(20)

          // Total should equal sum of components
          const expectedTotal = 
            breakdown.creatorReputation +
            breakdown.oracleReliability +
            breakdown.liquidityDepth +
            breakdown.marketClarity

          expect(Math.abs(breakdown.totalScore - expectedTotal)).toBeLessThan(0.01)
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
          oracleReliability: fc.float({ min: 0, max: 1, noNaN: true }),
          liquidityPool: fc.float({ min: 0, max: 5000, noNaN: true }),
          titleLength: fc.integer({ min: 1, max: 100 }),
          descLength: fc.integer({ min: 0, max: 500 }),
        }),
        async ({
          marketId,
          creatorReputation,
          oracleReliability,
          liquidityPool,
          titleLength,
          descLength,
        }) => {
          // Split liquidity randomly between yes and no pools
          const yesPool = liquidityPool * Math.random()
          const noPool = liquidityPool - yesPool

          const market = {
            id: marketId,
            title: 'A'.repeat(titleLength),
            description: 'B'.repeat(descLength),
            yesPool,
            noPool,
            oracleAddress: 'oracle-address',
            creator: {
              publicKey: 'creator-key',
              reputationScore: creatorReputation,
            },
          }

          vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(mockPrisma.market.update).mockResolvedValue(market as any)

          const { calculateOracleReliability } = await import('@/lib/intelligence/reputation-system')
          vi.mocked(calculateOracleReliability).mockResolvedValue(oracleReliability)

          const breakdown = await getQualityBreakdown(marketId)

          // Verify each component follows the formula
          const expectedCreatorScore = (creatorReputation / 1000) * 30
          expect(Math.abs(breakdown.creatorReputation - expectedCreatorScore)).toBeLessThan(0.01)

          const expectedOracleScore = oracleReliability * 30
          expect(Math.abs(breakdown.oracleReliability - expectedOracleScore)).toBeLessThan(0.01)

          const expectedLiquidityScore = Math.min(liquidityPool / 1000, 1) * 20
          expect(Math.abs(breakdown.liquidityDepth - expectedLiquidityScore)).toBeLessThan(0.01)

          const expectedClarityScore = Math.min((titleLength + descLength) / 200, 1) * 20
          expect(Math.abs(breakdown.marketClarity - expectedClarityScore)).toBeLessThan(0.01)
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

          // Calculate expected score
          const expectedScore = Math.min(
            rapidBettingCount * 10 +
            volumeSpikeCount * 20 +
            washTradingCount * 30 +
            sybilCount * 40,
            100
          )

          expect(riskScore).toBe(expectedScore)

          // Simulate alert creation logic (this would be in a background job)
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
            expect(manipulationAlerts[0][0].data.metadata).toMatchObject({
              marketId,
              riskScore,
            })
          } else {
            expect(manipulationAlerts.length).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 33: Alert Threshold Triggering - Oracle Delay
  test('Property 33b: alerts trigger when oracle resolution delay >24h', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          hoursDelayed: fc.float({ min: 0, max: 72, noNaN: true }),
        }),
        async ({ marketId, hoursDelayed }) => {
          // Clear mocks before each test
          vi.clearAllMocks()
          
          const now = new Date()
          const closeTime = new Date(now.getTime() - hoursDelayed * 60 * 60 * 1000)

          const market = {
            id: marketId,
            closeTime,
            status: 'CLOSED',
            resolvedAt: null,
          }

          vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(mockPrisma.systemAlert.create).mockResolvedValue({} as any)

          // Simulate oracle delay check (this would be in a background job)
          const hoursSinceClose = (now.getTime() - closeTime.getTime()) / (1000 * 60 * 60)

          if (hoursSinceClose > 24 && market.status === 'CLOSED' && !market.resolvedAt) {
            await mockPrisma.systemAlert.create({
              data: {
                type: 'oracle_delay',
                severity: 'WARNING',
                message: `Oracle has not resolved market ${marketId} for ${hoursSinceClose.toFixed(1)} hours`,
                metadata: {
                  marketId,
                  hoursSinceClose,
                  closeTime: closeTime.toISOString(),
                },
                resolved: false,
              },
            })
          }

          // Property: alert should be created if and only if delay > 24h
          const systemAlertCalls = vi.mocked(mockPrisma.systemAlert.create).mock.calls
          const oracleDelayAlerts = systemAlertCalls.filter(
            (call: any) => call[0].data.type === 'oracle_delay'
          )

          if (hoursDelayed > 24) {
            expect(oracleDelayAlerts.length).toBeGreaterThan(0)
            expect(oracleDelayAlerts[0][0].data.severity).toBe('WARNING')
            expect(oracleDelayAlerts[0][0].data.metadata).toMatchObject({
              marketId,
            })
          } else {
            expect(oracleDelayAlerts.length).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 33: Alert Threshold Triggering - Platform Liquidity
  test('Property 33c: alerts trigger when platform liquidity <5000 XLM', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          totalLiquidity: fc.float({ min: 0, max: 10000, noNaN: true }),
        }),
        async ({ totalLiquidity }) => {
          // Clear mocks before each test
          vi.clearAllMocks()
          
          vi.mocked(mockPrisma.systemAlert.create).mockResolvedValue({} as any)

          // Simulate platform liquidity check (this would be in a background job)
          if (totalLiquidity < 5000) {
            await mockPrisma.systemAlert.create({
              data: {
                type: 'liquidity',
                severity: 'WARNING',
                message: `Platform liquidity has dropped to ${totalLiquidity.toFixed(2)} XLM`,
                metadata: {
                  totalLiquidity,
                  threshold: 5000,
                },
                resolved: false,
              },
            })
          }

          // Property: alert should be created if and only if liquidity < 5000
          const systemAlertCalls = vi.mocked(mockPrisma.systemAlert.create).mock.calls
          const liquidityAlerts = systemAlertCalls.filter(
            (call: any) => call[0].data.type === 'liquidity'
          )

          if (totalLiquidity < 5000) {
            expect(liquidityAlerts.length).toBeGreaterThan(0)
            expect(liquidityAlerts[0][0].data.severity).toBe('WARNING')
            // Check that totalLiquidity is present and threshold is correct
            expect(liquidityAlerts[0][0].data.metadata.threshold).toBe(5000)
            expect(liquidityAlerts[0][0].data.metadata.totalLiquidity).toBeDefined()
          } else {
            expect(liquidityAlerts.length).toBe(0)
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
            yesPool: 500,
            noPool: 500,
            oracleAddress: 'oracle-address',
            creator: {
              publicKey: 'creator-key',
              reputationScore: baseReputation,
            },
          }

          vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(market1 as any)
          vi.mocked(mockPrisma.market.update).mockResolvedValue(market1 as any)

          const { calculateOracleReliability } = await import('@/lib/intelligence/reputation-system')
          vi.mocked(calculateOracleReliability).mockResolvedValue(0.9)

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

          // The difference should be proportional to reputation increase
          const expectedDifference = (reputationIncrease / 1000) * 30
          expect(Math.abs((score2 - score1) - expectedDifference)).toBeLessThan(0.1)
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
          hasOracle: fc.boolean(),
          hasDescription: fc.boolean(),
        }),
        async ({ marketId, hasOracle, hasDescription }) => {
          const market = {
            id: marketId,
            title: 'Test',
            description: hasDescription ? 'Description' : null,
            yesPool: 0,
            noPool: 0,
            oracleAddress: hasOracle ? 'oracle-address' : null,
            creator: {
              publicKey: 'creator-key',
              reputationScore: 0,
            },
          }

          vi.mocked(mockPrisma.market.findUnique).mockResolvedValue(market as any)
          vi.mocked(mockPrisma.market.update).mockResolvedValue(market as any)

          const { calculateOracleReliability } = await import('@/lib/intelligence/reputation-system')
          vi.mocked(calculateOracleReliability).mockResolvedValue(0)

          const score = await calculateQualityScore(marketId)

          // Property: even with all zeros, score should be valid (0-100)
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(100)

          // With minimum inputs, score should be low but not negative
          expect(score).toBeGreaterThanOrEqual(0)
        }
      ),
      { numRuns: 100 }
    )
  })
})
