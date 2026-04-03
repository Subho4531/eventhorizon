/**
 * Property-Based Tests for Liquidity Manager
 * Feature: advanced-prediction-market-intelligence
 * 
 * These tests validate universal correctness properties across randomized inputs
 * using fast-check property-based testing library.
 */

import { describe, test, expect, vi, beforeEach } from 'vitest'
import fc from 'fast-check'
import {
  calculateMinBetSize,
  getIncentiveMultiplier,
  creditLiquidityPoints,
  distributeLiquidityRewards,
} from '@/lib/intelligence/liquidity-manager'
import prisma from '@/lib/db'

// Mock Prisma
vi.mock('@/lib/db', () => ({
  default: {
    market: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    bet: {
      findMany: vi.fn(),
    },
    liquidityReward: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    probabilityHistory: {
      findMany: vi.fn(),
    },
  },
}))

describe('Liquidity Manager - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Property 6: Liquidity Parameter Bounds
   * For any market, the minimum bet size must always be between 1 XLM and 100 XLM inclusive,
   * regardless of volume-based adjustments.
   * 
   * Validates: Requirements 3.3
   */
  test('Property 6: min bet size always stays within 1-100 XLM bounds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          currentMinBet: fc.float({ min: 1, max: 100, noNaN: true }),
          hourlyVolume: fc.float({ min: 0, max: 10000, noNaN: true }),
          dailyVolume: fc.float({ min: 0, max: 50000, noNaN: true }),
        }),
        async ({ marketId, currentMinBet, hourlyVolume, dailyVolume }) => {
          // Setup mocks
          vi.mocked(prisma.market.findUnique).mockResolvedValue({
            id: marketId,
            minBetSize: currentMinBet,
          } as any)

          vi.mocked(prisma.bet.findMany).mockImplementation((args: any) => {
            const isHourly = args.where.createdAt.gte.getTime() > Date.now() - 2 * 60 * 60 * 1000
            const volume = isHourly ? hourlyVolume : dailyVolume
            const betCount = Math.floor(volume / 10)
            return Promise.resolve(
              Array(betCount).fill(null).map(() => ({ amount: 10 }))
            ) as any
          })

          vi.mocked(prisma.market.update).mockImplementation((args: any) => {
            return Promise.resolve({ ...args.data }) as any
          })

          // Execute
          const result = await calculateMinBetSize(marketId)

          // Assert: Result must be within bounds
          expect(result).toBeGreaterThanOrEqual(1)
          expect(result).toBeLessThanOrEqual(100)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7: Volume-Based Bet Size Adjustment
   * For any market, if trading volume exceeds 1000 XLM in 1 hour, then the minimum bet size
   * must increase by 10%; if volume falls below 100 XLM in 24 hours, then the minimum bet size
   * must decrease by 10%.
   * 
   * Validates: Requirements 3.1, 3.2
   */
  test('Property 7: volume-based adjustments follow correct thresholds', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          currentMinBet: fc.float({ min: 10, max: 50, noNaN: true }), // Mid-range to allow adjustments
          hourlyVolume: fc.oneof(
            fc.constant(1500), // High volume
            fc.constant(500),  // Medium volume
            fc.constant(50)    // Low volume
          ),
          dailyVolume: fc.oneof(
            fc.constant(5000), // High volume
            fc.constant(500),  // Medium volume
            fc.constant(50)    // Low volume
          ),
        }),
        async ({ marketId, currentMinBet, hourlyVolume, dailyVolume }) => {
          // Setup mocks
          vi.mocked(prisma.market.findUnique).mockResolvedValue({
            id: marketId,
            minBetSize: currentMinBet,
          } as any)

          vi.mocked(prisma.bet.findMany).mockImplementation((args: any) => {
            const isHourly = args.where.createdAt.gte.getTime() > Date.now() - 2 * 60 * 60 * 1000
            const volume = isHourly ? hourlyVolume : dailyVolume
            const betCount = Math.floor(volume / 10)
            return Promise.resolve(
              Array(betCount).fill(null).map(() => ({ amount: 10 }))
            ) as any
          })

          let capturedMinBet: number | undefined

          vi.mocked(prisma.market.update).mockImplementation((args: any) => {
            capturedMinBet = args.data.minBetSize
            return Promise.resolve({ minBetSize: capturedMinBet }) as any
          })

          // Execute
          await calculateMinBetSize(marketId)

          // Assert: Check adjustment logic
          if (hourlyVolume > 1000 && dailyVolume >= 100) {
            // Should increase by 10%
            const expected = Math.min(100, currentMinBet * 1.10)
            expect(capturedMinBet).toBeCloseTo(expected, 0)
          } else if (hourlyVolume <= 1000 && dailyVolume < 100) {
            // Should decrease by 10%
            const expected = Math.max(1, currentMinBet * 0.90)
            expect(capturedMinBet).toBeCloseTo(expected, 0)
          } else if (hourlyVolume > 1000 && dailyVolume < 100) {
            // Both adjustments: +10% then -10% = 0.99x
            const expected = Math.max(1, Math.min(100, currentMinBet * 1.10 * 0.90))
            expect(capturedMinBet).toBeCloseTo(expected, 0)
          }
          // If hourlyVolume <= 1000 && dailyVolume >= 100, no adjustment
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8: Low-Liquidity Incentive
   * For any market with total liquidity pool below 500 XLM, the liquidity incentive multiplier
   * must be set to 1.05× for winning payouts.
   * 
   * Validates: Requirements 3.4, 12.2
   */
  test('Property 8: 1.05× multiplier applied when pool < 500 XLM', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          yesPool: fc.float({ min: 0, max: 1000, noNaN: true }),
          noPool: fc.float({ min: 0, max: 1000, noNaN: true }),
        }),
        async ({ marketId, yesPool, noPool }) => {
          // Setup mocks
          vi.mocked(prisma.market.findUnique).mockResolvedValue({
            id: marketId,
            yesPool,
            noPool,
          } as any)

          vi.mocked(prisma.market.update).mockImplementation((args: any) => {
            return Promise.resolve({ incentiveMultiplier: args.data.incentiveMultiplier }) as any
          })

          // Execute
          const result = await getIncentiveMultiplier(marketId)

          // Assert: Check multiplier based on pool size
          const totalPool = yesPool + noPool
          if (totalPool < 500) {
            expect(result).toBe(1.05)
          } else {
            expect(result).toBe(1.0)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 30: Low-Liquidity Classification
   * For any market with total volume below 200 XLM, the system must classify it as
   * a low-liquidity market.
   * 
   * Validates: Requirements 12.1
   */
  test('Property 30: markets < 200 XLM classified as low-liquidity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          userId: fc.string({ minLength: 1 }),
          betAmount: fc.float({ min: 1, max: 100, noNaN: true }),
          yesPool: fc.float({ min: 0, max: 500, noNaN: true }),
          noPool: fc.float({ min: 0, max: 500, noNaN: true }),
        }),
        async ({ marketId, userId, betAmount, yesPool, noPool }) => {
          // Setup mocks
          vi.mocked(prisma.market.findUnique).mockResolvedValue({
            id: marketId,
            yesPool,
            noPool,
          } as any)

          vi.mocked(prisma.liquidityReward.findFirst).mockResolvedValue(null)

          let pointsAwarded = false
          vi.mocked(prisma.liquidityReward.create).mockImplementation(() => {
            pointsAwarded = true
            return Promise.resolve({} as any)
          })

          // Execute
          await creditLiquidityPoints(userId, marketId, betAmount)

          // Assert: Points should only be awarded if pool < 200 XLM
          const totalPool = yesPool + noPool
          if (totalPool < 200) {
            expect(pointsAwarded).toBe(true)
          } else {
            expect(pointsAwarded).toBe(false)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 31: Liquidity Reward Points Calculation
   * For any bet placed on a low-liquidity market, the user must be credited with
   * reward points equal to bet_amount / 10.
   * 
   * Validates: Requirements 12.4
   */
  test('Property 31: reward points = bet_amount / 10', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          marketId: fc.string({ minLength: 1 }),
          userId: fc.string({ minLength: 1 }),
          betAmount: fc.float({ min: 10, max: 100, noNaN: true }),
          yesPool: fc.float({ min: 0, max: 100, noNaN: true }), // Ensure low liquidity
          noPool: fc.float({ min: 0, max: 99, noNaN: true }),
        }),
        async ({ marketId, userId, betAmount, yesPool, noPool }) => {
          // Setup mocks
          vi.mocked(prisma.market.findUnique).mockResolvedValue({
            id: marketId,
            yesPool,
            noPool,
          } as any)

          vi.mocked(prisma.liquidityReward.findFirst).mockResolvedValue(null)

          let capturedPoints: number | undefined
          vi.mocked(prisma.liquidityReward.create).mockImplementation((args: any) => {
            capturedPoints = args.data.points
            return Promise.resolve({} as any)
          })

          // Execute
          await creditLiquidityPoints(userId, marketId, betAmount)

          // Assert: Points should equal bet_amount / 10
          const expectedPoints = betAmount / 10
          expect(capturedPoints).toBeCloseTo(expectedPoints, 2)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 32: Weekly Reward Distribution
   * For any weekly incentive period end, the 1000 XLM incentive pool must be distributed
   * proportionally to users based on their accumulated reward points, and all reward points
   * must be reset to zero.
   * 
   * Validates: Requirements 12.5, 12.6
   */
  test('Property 32: 1000 XLM distributed proportionally, points reset', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            userId: fc.string({ minLength: 1 }),
            points: fc.float({ min: 1, max: 1000, noNaN: true }),
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (users) => {
          const WEEKLY_POOL = 1000

          // Ensure unique userIds by appending index
          const uniqueUsers = users.map((user, index) => ({
            userId: `${user.userId}-${index}`,
            points: user.points,
          }))

          // Create mock reward records
          const mockRewards = uniqueUsers.map((user, index) => ({
            id: `reward-${index}`,
            userId: user.userId,
            weekStart: new Date(),
            points: user.points,
            reward: null,
            claimed: false,
            createdAt: new Date(),
          }))

          // Setup mocks
          vi.mocked(prisma.liquidityReward.findMany).mockResolvedValue(mockRewards as any)

          const updatedRewards: Array<{ id: string; reward: number }> = []
          vi.mocked(prisma.liquidityReward.update).mockImplementation((args: any) => {
            updatedRewards.push({
              id: args.where.id,
              reward: args.data.reward,
            })
            return Promise.resolve({} as any)
          })

          const createdRewards: Array<{ userId: string; points: number }> = []
          vi.mocked(prisma.liquidityReward.create).mockImplementation((args: any) => {
            createdRewards.push({
              userId: args.data.userId,
              points: args.data.points,
            })
            return Promise.resolve({} as any)
          })

          // Execute
          await distributeLiquidityRewards()

          // Assert: Total distributed should equal WEEKLY_POOL
          const totalDistributed = updatedRewards.reduce((sum, r) => sum + r.reward, 0)
          expect(totalDistributed).toBeCloseTo(WEEKLY_POOL, 2)

          // Assert: Distribution should be proportional to points
          const totalPoints = uniqueUsers.reduce((sum, u) => sum + u.points, 0)
          for (let i = 0; i < uniqueUsers.length; i++) {
            const expectedReward = (uniqueUsers[i].points / totalPoints) * WEEKLY_POOL
            const actualReward = updatedRewards.find(r => r.id === `reward-${i}`)?.reward
            expect(actualReward).toBeCloseTo(expectedReward, 2)
          }

          // Assert: New records created with 0 points for next week
          expect(createdRewards.length).toBe(uniqueUsers.length)
          for (const created of createdRewards) {
            expect(created.points).toBe(0)
          }
        }
      ),
      { numRuns: 50 } // Fewer runs due to complexity
    )
  })
})
