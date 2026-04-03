/**
 * lib/intelligence/analytics-dashboard.test.ts
 *
 * Tests for the analytics dashboard service.
 *
 * Feature: advanced-prediction-market-intelligence
 * Task: 7 - Market Quality Scoring + Analytics Dashboard
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import { getDashboardMetrics, type DashboardMetrics } from './analytics-dashboard'
import { prisma } from '@/lib/db'

describe('Analytics Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('returns complete dashboard metrics', async () => {
    vi.mocked(prisma.market.count).mockResolvedValue(25)
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 5000, noPool: 3000 },
    } as any)
    vi.mocked(prisma.bet.aggregate).mockResolvedValue({
      _sum: { amount: 1200 },
    } as any)
    vi.mocked(prisma.disputeChallenge.count).mockResolvedValue(3)
    vi.mocked(prisma.user.aggregate).mockResolvedValue({
      _avg: { avgResolutionTime: 12.5, oracleReliability: 0.92 },
    } as any)

    const metrics = await getDashboardMetrics()

    expect(metrics.activeMarkets).toBe(25)
    expect(metrics.totalLiquidity).toBe(8000)
    expect(metrics.volume24h).toBe(1200)
    expect(metrics.highRiskMarkets).toBeGreaterThanOrEqual(0)
    expect(metrics.pendingDisputes).toBe(3)
    expect(metrics.oracleMetrics.avgResolutionTime).toBe(12.5)
    expect(metrics.oracleMetrics.avgReliability).toBe(0.92)
  })

  test('handles zero liquidity', async () => {
    vi.mocked(prisma.market.count).mockResolvedValue(0)
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: null, noPool: null },
    } as any)
    vi.mocked(prisma.bet.aggregate).mockResolvedValue({
      _sum: { amount: null },
    } as any)
    vi.mocked(prisma.disputeChallenge.count).mockResolvedValue(0)
    vi.mocked(prisma.user.aggregate).mockResolvedValue({
      _avg: { avgResolutionTime: null, oracleReliability: null },
    } as any)

    const metrics = await getDashboardMetrics()

    expect(metrics.activeMarkets).toBe(0)
    expect(metrics.totalLiquidity).toBe(0)
    expect(metrics.volume24h).toBe(0)
    expect(metrics.oracleMetrics.avgResolutionTime).toBe(0)
    expect(metrics.oracleMetrics.avgReliability).toBe(0)
  })

  test('counts only active and closed markets', async () => {
    vi.mocked(prisma.market.count).mockResolvedValue(15)
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 1000, noPool: 1000 },
    } as any)
    vi.mocked(prisma.bet.aggregate).mockResolvedValue({
      _sum: { amount: 500 },
    } as any)
    vi.mocked(prisma.disputeChallenge.count).mockResolvedValue(0)
    vi.mocked(prisma.user.aggregate).mockResolvedValue({
      _avg: { avgResolutionTime: 24, oracleReliability: 0.85 },
    } as any)

    const metrics = await getDashboardMetrics()

    expect(metrics.activeMarkets).toBe(15)
    expect(vi.mocked(prisma.market.count)).toHaveBeenCalledWith({
      where: { status: { in: ['OPEN', 'CLOSED'] } },
    })
  })

  test('calculates 24h volume correctly', async () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    vi.mocked(prisma.market.count).mockResolvedValue(10)
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 2000, noPool: 2000 },
    } as any)
    vi.mocked(prisma.bet.aggregate).mockResolvedValue({
      _sum: { amount: 850 },
    } as any)
    vi.mocked(prisma.disputeChallenge.count).mockResolvedValue(1)
    vi.mocked(prisma.user.aggregate).mockResolvedValue({
      _avg: { avgResolutionTime: 18, oracleReliability: 0.88 },
    } as any)

    const metrics = await getDashboardMetrics()

    expect(metrics.volume24h).toBe(850)
    
    // Verify the bet aggregate was called with correct time filter
    const betAggregateCall = vi.mocked(prisma.bet.aggregate).mock.calls[0][0]
    expect(betAggregateCall?.where?.createdAt?.gte).toBeInstanceOf(Date)
  })

  test('identifies high-risk markets', async () => {
    vi.mocked(prisma.market.count)
      .mockResolvedValueOnce(20) // active markets
      .mockResolvedValueOnce(5)  // high-risk markets

    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 3000, noPool: 2000 },
    } as any)
    vi.mocked(prisma.bet.aggregate).mockResolvedValue({
      _sum: { amount: 600 },
    } as any)
    vi.mocked(prisma.disputeChallenge.count).mockResolvedValue(2)
    vi.mocked(prisma.user.aggregate).mockResolvedValue({
      _avg: { avgResolutionTime: 15, oracleReliability: 0.90 },
    } as any)

    const metrics = await getDashboardMetrics()

    expect(metrics.highRiskMarkets).toBe(5)
  })

  test('counts pending disputes only', async () => {
    vi.mocked(prisma.market.count).mockResolvedValue(12)
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 1500, noPool: 1500 },
    } as any)
    vi.mocked(prisma.bet.aggregate).mockResolvedValue({
      _sum: { amount: 400 },
    } as any)
    vi.mocked(prisma.disputeChallenge.count).mockResolvedValue(7)
    vi.mocked(prisma.user.aggregate).mockResolvedValue({
      _avg: { avgResolutionTime: 20, oracleReliability: 0.87 },
    } as any)

    const metrics = await getDashboardMetrics()

    expect(metrics.pendingDisputes).toBe(7)
    expect(vi.mocked(prisma.disputeChallenge.count)).toHaveBeenCalledWith({
      where: { status: 'PENDING' },
    })
  })

  test('calculates oracle metrics from users with resolutions', async () => {
    vi.mocked(prisma.market.count).mockResolvedValue(18)
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 2500, noPool: 2500 },
    } as any)
    vi.mocked(prisma.bet.aggregate).mockResolvedValue({
      _sum: { amount: 700 },
    } as any)
    vi.mocked(prisma.disputeChallenge.count).mockResolvedValue(4)
    vi.mocked(prisma.user.aggregate).mockResolvedValue({
      _avg: { avgResolutionTime: 16.8, oracleReliability: 0.93 },
    } as any)

    const metrics = await getDashboardMetrics()

    expect(metrics.oracleMetrics.avgResolutionTime).toBe(16.8)
    expect(metrics.oracleMetrics.avgReliability).toBe(0.93)
    
    expect(vi.mocked(prisma.user.aggregate)).toHaveBeenCalledWith({
      where: { totalResolutions: { gt: 0 } },
      _avg: { avgResolutionTime: true, oracleReliability: true },
    })
  })
})
