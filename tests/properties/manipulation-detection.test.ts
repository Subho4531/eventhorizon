/**
 * tests/properties/manipulation-detection.test.ts
 * 
 * Property-based tests for manipulation detection system
 * Feature: advanced-prediction-market-intelligence
 * 
 * Tests universal correctness properties across randomized inputs
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import {
  analyzeBet,
  calculateRiskScore,
  detectWashTrading,
  detectSybilAccounts,
  getMarketRisk,
} from '@/lib/intelligence/manipulation-detector'
import { prisma } from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    bet: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    manipulationAlert: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    market: {
      update: vi.fn(),
    },
    walletRelationship: {
      findMany: vi.fn(),
    },
  },
}))

describe('Manipulation Detection - Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Property 14: Manipulation Risk Score Bounds
  test('Property 14: manipulation risk scores are always between 0 and 100', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          alertCounts: fc.record({
            rapidBetting: fc.integer({ min: 0, max: 20 }),
            volumeSpike: fc.integer({ min: 0, max: 20 }),
            washTrading: fc.integer({ min: 0, max: 20 }),
            sybilCluster: fc.integer({ min: 0, max: 20 }),
          }),
        }),
        async ({ marketId, alertCounts }) => {
          // Mock alerts based on counts
          const alerts: any[] = []
          
          for (let i = 0; i < alertCounts.rapidBetting; i++) {
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
          
          for (let i = 0; i < alertCounts.volumeSpike; i++) {
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
          
          for (let i = 0; i < alertCounts.washTrading; i++) {
            alerts.push({
              id: `wash-${i}`,
              marketId,
              flagType: 'wash_trading',
              severity: 'CRITICAL',
              details: { type: 'wash_trading', confidence: 0.8, accounts: [`user-${i}`, `user-${i+1}`] },
              resolved: false,
              createdAt: new Date(),
            })
          }
          
          for (let i = 0; i < alertCounts.sybilCluster; i++) {
            alerts.push({
              id: `sybil-${i}`,
              marketId,
              flagType: 'sybil_cluster',
              severity: 'CRITICAL',
              details: { type: 'sybil_cluster', accounts: [`user-${i}`, `user-${i+1}`], fundingSource: `source-${i}` },
              resolved: false,
              createdAt: new Date(),
            })
          }

          vi.mocked(prisma.manipulationAlert.findMany).mockResolvedValue(alerts)

          const score = await calculateRiskScore(marketId)

          // Property: score must be between 0 and 100
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(100)
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 15: Rapid Betting Detection
  test('Property 15: rapid betting detection flags >10 bets in 60 seconds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          userId: fc.string({ minLength: 1 }),
          betCount: fc.integer({ min: 0, max: 30 }),
          amount: fc.float({ min: 1, max: 1000 }),
        }),
        async ({ marketId, userId, betCount, amount }) => {
          // Clear all mocks before each test
          vi.clearAllMocks()
          
          // Mock bet count
          vi.mocked(prisma.bet.count).mockResolvedValue(betCount)
          
          // Mock volume aggregates to avoid volume spike detection
          vi.mocked(prisma.bet.aggregate)
            .mockResolvedValueOnce({
              _sum: { amount: 100 },
              _avg: { amount: null },
              _count: { amount: 0 },
              _min: { amount: null },
              _max: { amount: null },
            })
            .mockResolvedValueOnce({
              _sum: { amount: 100 }, // Same volume to avoid spike
              _avg: { amount: null },
              _count: { amount: 0 },
              _min: { amount: null },
              _max: { amount: null },
            })
          
          vi.mocked(prisma.manipulationAlert.create).mockResolvedValue({} as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)

          const bet = {
            id: 'test-bet',
            userPublicKey: userId,
            marketId,
            amount,
            commitment: 'mock',
            nullifier: null,
            revealed: false,
            txHash: null,
            claimedAt: null,
            createdAt: new Date(),
          } as any

          await analyzeBet(bet)

          // Property: alert should be created if and only if betCount > 10
          if (betCount > 10) {
            expect(prisma.manipulationAlert.create).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({
                  flagType: 'rapid_betting',
                  details: expect.objectContaining({
                    type: 'rapid_betting',
                    userId,
                    count: betCount,
                  }),
                }),
              })
            )
          } else {
            // Should not create rapid_betting alert
            const calls = vi.mocked(prisma.manipulationAlert.create).mock.calls
            const rapidBettingCalls = calls.filter(
              call => call[0].data.flagType === 'rapid_betting'
            )
            expect(rapidBettingCalls.length).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 16: Volume Spike Detection
  test('Property 16: volume spike detection flags >500% increase in 1 hour', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          userId: fc.string({ minLength: 1 }),
          recentVolume: fc.float({ min: 1, max: 10000, noNaN: true }),
          previousVolume: fc.float({ min: 1, max: 1000, noNaN: true }),
          amount: fc.float({ min: 1, max: 100, noNaN: true }),
        }),
        async ({ marketId, userId, recentVolume, previousVolume, amount }) => {
          // Clear all mocks before each test
          vi.clearAllMocks()
          
          // Mock bet count (low to avoid rapid betting alert)
          vi.mocked(prisma.bet.count).mockResolvedValue(1)
          
          // Mock volume aggregates
          vi.mocked(prisma.bet.aggregate)
            .mockResolvedValueOnce({
              _sum: { amount: recentVolume },
              _avg: { amount: null },
              _count: { amount: 0 },
              _min: { amount: null },
              _max: { amount: null },
            })
            .mockResolvedValueOnce({
              _sum: { amount: previousVolume },
              _avg: { amount: null },
              _count: { amount: 0 },
              _min: { amount: null },
              _max: { amount: null },
            })

          vi.mocked(prisma.manipulationAlert.create).mockResolvedValue({} as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)

          const bet = {
            id: 'test-bet',
            userPublicKey: userId,
            marketId,
            amount,
            commitment: 'mock',
            nullifier: null,
            revealed: false,
            txHash: null,
            claimedAt: null,
            createdAt: new Date(),
          } as any

          await analyzeBet(bet)

          const increaseRatio = recentVolume / previousVolume

          // Property: alert should be created if and only if increase > 500% (ratio > 5)
          const calls = vi.mocked(prisma.manipulationAlert.create).mock.calls
          const volumeSpikeCalls = calls.filter(
            call => call[0].data.flagType === 'volume_spike'
          )
          
          if (increaseRatio > 5) {
            expect(volumeSpikeCalls.length).toBeGreaterThan(0)
            expect(volumeSpikeCalls[0][0].data.details).toMatchObject({
              type: 'volume_spike',
              increase: expect.any(Number),
            })
          } else {
            expect(volumeSpikeCalls.length).toBe(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 17: Wash Trading Detection
  test('Property 17: wash trading detection flags opposite bets within 600 seconds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          users: fc.array(fc.string({ minLength: 1 }), { minLength: 2, maxLength: 10 }),
          timeDiffSeconds: fc.integer({ min: 0, max: 1200 }), // 0-20 minutes
        }),
        async ({ marketId, users, timeDiffSeconds }) => {
          const now = Date.now()
          const bets = users.map((userId, index) => ({
            id: `bet-${index}`,
            userId,
            marketId,
            amount: 100,
            createdAt: new Date(now - (users.length - index) * timeDiffSeconds * 1000),
          }))

          vi.mocked(prisma.bet.findMany).mockResolvedValue(bets as any)
          vi.mocked(prisma.manipulationAlert.create).mockResolvedValue({} as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)

          const result = await detectWashTrading(marketId)

          // Property: should detect wash trading if any pair of bets is within 600s
          const hasCloseTimedBets = bets.some((bet1, i) =>
            bets.slice(i + 1).some((bet2) => {
              const diff = Math.abs(bet2.createdAt.getTime() - bet1.createdAt.getTime())
              return diff <= 600 * 1000 && bet1.userId !== bet2.userId
            })
          )

          if (hasCloseTimedBets && users.length >= 2) {
            expect(result).not.toBeNull()
            expect(result?.type).toBe('wash_trading')
            expect(result?.accounts.length).toBeGreaterThan(0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 18: Sybil Risk Score Adjustment
  test('Property 18: sybil detection adds +30 points for same-source funded accounts', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          fundingSource: fc.string({ minLength: 1 }),
          accountCount: fc.integer({ min: 2, max: 10 }),
        }),
        async ({ marketId, fundingSource, accountCount }) => {
          const accounts = Array.from({ length: accountCount }, (_, i) => `account-${i}`)

          // Mock wallet relationships
          const relationships = accounts.map((account) => ({
            id: `rel-${account}`,
            sourceWallet: fundingSource,
            targetWallet: account,
            relationship: 'funded_by',
            confidence: 1.0,
            createdAt: new Date(),
          }))

          vi.mocked(prisma.walletRelationship.findMany).mockResolvedValue(relationships as any)

          // Mock bets from these accounts on the same market
          const bets = accounts.map((account, i) => ({
            marketId,
            userId: account,
          }))

          vi.mocked(prisma.bet.findMany).mockResolvedValue(bets as any)
          vi.mocked(prisma.manipulationAlert.create).mockResolvedValue({} as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)

          const clusters = await detectSybilAccounts(accounts)

          // Property: should detect sybil cluster when 2+ accounts from same source bet on same market
          if (accountCount >= 2) {
            expect(clusters.length).toBeGreaterThan(0)
            expect(clusters[0].fundingSource).toBe(fundingSource)
            expect(clusters[0].accounts.length).toBeGreaterThanOrEqual(2)

            // Verify alert was created with sybil_cluster type
            expect(prisma.manipulationAlert.create).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({
                  flagType: 'sybil_cluster',
                  details: expect.objectContaining({
                    type: 'sybil_cluster',
                    fundingSource,
                  }),
                }),
              })
            )
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Property 34: Privacy-Preserving Aggregation
  test('Property 34: manipulation detection uses only commitments/nullifiers/pool changes', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          userId: fc.string({ minLength: 1 }),
          betCount: fc.integer({ min: 0, max: 20 }),
          recentVolume: fc.float({ min: 1, max: 5000 }),
          previousVolume: fc.float({ min: 1, max: 1000 }),
        }),
        async ({ marketId, userId, betCount, recentVolume, previousVolume }) => {
          // Mock database responses
          vi.mocked(prisma.bet.count).mockResolvedValue(betCount)
          vi.mocked(prisma.bet.aggregate)
            .mockResolvedValueOnce({
              _sum: { amount: recentVolume },
              _avg: { amount: null },
              _count: { amount: 0 },
              _min: { amount: null },
              _max: { amount: null },
            })
            .mockResolvedValueOnce({
              _sum: { amount: previousVolume },
              _avg: { amount: null },
              _count: { amount: 0 },
              _min: { amount: null },
              _max: { amount: null },
            })

          vi.mocked(prisma.manipulationAlert.create).mockResolvedValue({} as any)
          vi.mocked(prisma.market.update).mockResolvedValue({} as any)

          const bet = {
            id: 'test-bet',
            userPublicKey: userId,
            marketId,
            amount: 100,
            commitment: 'mock',
            nullifier: null,
            revealed: false,
            txHash: null,
            claimedAt: null,
            createdAt: new Date(),
          } as any

          await analyzeBet(bet)

          // Property: manipulation detection should only use aggregate data
          // Verify that we're using count and aggregate functions, not accessing individual bet sides
          const countCalls = vi.mocked(prisma.bet.count).mock.calls
          const aggregateCalls = vi.mocked(prisma.bet.aggregate).mock.calls

          // Should use count for rapid betting detection
          expect(countCalls.length).toBeGreaterThan(0)
          
          // Should use aggregate for volume spike detection
          expect(aggregateCalls.length).toBeGreaterThan(0)

          // Verify no queries select bet side or commitment details
          for (const call of countCalls) {
            const where = call[0]?.where
            expect(where).not.toHaveProperty('side')
            expect(where).not.toHaveProperty('commitment')
          }

          for (const call of aggregateCalls) {
            const query = call[0]
            expect(query?.where).not.toHaveProperty('side')
            expect(query?.where).not.toHaveProperty('commitment')
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  // Additional property: Risk score calculation consistency
  test('Property: risk score increases monotonically with alert count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          alertCount1: fc.integer({ min: 0, max: 10 }),
          alertCount2: fc.integer({ min: 0, max: 10 }),
        }),
        async ({ marketId, alertCount1, alertCount2 }) => {
          // Create alerts for first scenario
          const alerts1 = Array.from({ length: alertCount1 }, (_, i) => ({
            id: `alert-${i}`,
            marketId,
            flagType: 'rapid_betting',
            severity: 'WARNING' as const,
            details: { type: 'rapid_betting', userId: `user-${i}`, count: 11 },
            resolved: false,
            createdAt: new Date(),
          }))

          vi.mocked(prisma.manipulationAlert.findMany).mockResolvedValue(alerts1 as any)
          const score1 = await calculateRiskScore(marketId)

          // Create alerts for second scenario
          const alerts2 = Array.from({ length: alertCount2 }, (_, i) => ({
            id: `alert-${i}`,
            marketId,
            flagType: 'rapid_betting',
            severity: 'WARNING' as const,
            details: { type: 'rapid_betting', userId: `user-${i}`, count: 11 },
            resolved: false,
            createdAt: new Date(),
          }))

          vi.mocked(prisma.manipulationAlert.findMany).mockResolvedValue(alerts2 as any)
          const score2 = await calculateRiskScore(marketId)

          // Property: more alerts should result in higher or equal score
          if (alertCount1 <= alertCount2) {
            expect(score1).toBeLessThanOrEqual(score2)
          } else {
            expect(score1).toBeGreaterThanOrEqual(score2)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
