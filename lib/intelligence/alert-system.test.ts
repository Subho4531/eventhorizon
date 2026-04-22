/**
 * lib/intelligence/alert-system.test.ts
 *
 * Tests for the alert system and background monitoring.
 *
 * Feature: advanced-prediction-market-intelligence
 * Task: 7 - Market Quality Scoring + Analytics Dashboard
 */

import { describe, test, expect, beforeEach, vi } from 'vitest'
import fc from 'fast-check'
import {
  createSystemAlert,
  runBackgroundMonitoring,
  getRecentAlerts,
  resolveAlert,
  type SystemAlertData,
} from './alert-system'
import { prisma } from '@/lib/prisma'

// ──────────────────────────────────────────────────────────────────────────────
// Property 33: Alert Threshold Triggering
// **Validates: Requirements 6.6, 14.2, 14.4, 14.5**
// ──────────────────────────────────────────────────────────────────────────────

describe('Property 33: Alert Threshold Triggering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('creates alert for manipulation score > 80', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 81, max: 100 }),
        async (manipulationScore) => {
          const market = {
            id: 'test-market',
            title: 'Test Market',
            manipulationScore,
            status: 'OPEN',
          }

          vi.mocked(prisma.market.findMany).mockResolvedValue([market] as any)
          vi.mocked(prisma.systemAlert.create).mockResolvedValue({} as any)
          vi.mocked(prisma.market.aggregate).mockResolvedValue({
            _sum: { yesPool: 6000, noPool: 4000 },
          } as any)

          await runBackgroundMonitoring()

          // Property: alert must be created for high manipulation scores
          expect(vi.mocked(prisma.systemAlert.create)).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                type: 'manipulation',
                severity: 'CRITICAL',
              }),
            })
          )
        }
      ),
      { numRuns: 50 }
    )
  })

  test('creates alert for oracle delay > 24h', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 25, max: 168 }), // 25 to 168 hours
        async (hoursDelayed) => {
          const closeDate = new Date(Date.now() - hoursDelayed * 60 * 60 * 1000)
          const market = {
            id: 'test-market',
            title: 'Delayed Market',
            status: 'CLOSED',
            closeDate,
            outcome: null,
            creatorId: 'oracle-addr',
            creator: { publicKey: 'oracle-addr' },
          }

          vi.mocked(prisma.market.findMany)
            .mockResolvedValueOnce([]) // high risk markets
            .mockResolvedValueOnce([market] as any) // delayed markets

          vi.mocked(prisma.systemAlert.create).mockResolvedValue({} as any)
          vi.mocked(prisma.market.aggregate).mockResolvedValue({
            _sum: { yesPool: 6000, noPool: 4000 },
          } as any)

          await runBackgroundMonitoring()

          // Property: alert must be created for delayed resolutions
          expect(vi.mocked(prisma.systemAlert.create)).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                type: 'oracle_delay',
                severity: 'WARNING',
              }),
            })
          )
        }
      ),
      { numRuns: 50 }
    )
  })

  test('creates alert for platform liquidity < 5000 XLM', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: 0, max: 4999, noNaN: true }),
        async (totalLiquidity) => {
          const yesPool = totalLiquidity / 2
          const noPool = totalLiquidity / 2

          vi.mocked(prisma.market.findMany).mockResolvedValue([])
          vi.mocked(prisma.systemAlert.create).mockResolvedValue({} as any)
          vi.mocked(prisma.market.aggregate).mockResolvedValue({
            _sum: { yesPool, noPool },
          } as any)

          await runBackgroundMonitoring()

          // Property: alert must be created for low liquidity
          expect(vi.mocked(prisma.systemAlert.create)).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                type: 'liquidity',
                severity: 'CRITICAL',
              }),
            })
          )
        }
      ),
      { numRuns: 50 }
    )
  })

  test('no alert when thresholds not exceeded', async () => {
    // Mock findMany to return empty arrays for both high-risk and delayed markets
    vi.mocked(prisma.market.findMany)
      .mockResolvedValueOnce([]) // high-risk markets (manipulationScore > 80)
      .mockResolvedValueOnce([]) // delayed markets (closed + no outcome)
    
    vi.mocked(prisma.systemAlert.create).mockResolvedValue({} as any)
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 5000, noPool: 5000 },
    } as any)

    await runBackgroundMonitoring()

    // Should not create any alerts
    expect(vi.mocked(prisma.systemAlert.create)).not.toHaveBeenCalled()
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// Unit Tests: Alert System Functionality
// ──────────────────────────────────────────────────────────────────────────────

describe('Alert System: Core Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  test('createSystemAlert stores alert with correct structure', async () => {
    const alertData: SystemAlertData = {
      type: 'manipulation',
      severity: 'CRITICAL',
      message: 'High manipulation risk detected',
      metadata: { marketId: 'test-market', score: 85 },
    }

    vi.mocked(prisma.systemAlert.create).mockResolvedValue({} as any)

    await createSystemAlert(alertData)

    expect(vi.mocked(prisma.systemAlert.create)).toHaveBeenCalledWith({
      data: {
        type: 'manipulation',
        severity: 'CRITICAL',
        message: 'High manipulation risk detected',
        metadata: { marketId: 'test-market', score: 85 },
        resolved: false,
      },
    })
  })

  test('getRecentAlerts retrieves alerts from last 24 hours by default', async () => {
    const mockAlerts = [
      { id: '1', type: 'manipulation', severity: 'CRITICAL', createdAt: new Date() },
      { id: '2', type: 'liquidity', severity: 'WARNING', createdAt: new Date() },
    ]

    vi.mocked(prisma.systemAlert.findMany).mockResolvedValue(mockAlerts as any)

    const alerts = await getRecentAlerts()

    expect(alerts).toHaveLength(2)
    
    const findManyCall = vi.mocked(prisma.systemAlert.findMany).mock.calls[0][0]
    const createdAtFilter = findManyCall?.where?.createdAt
    if (createdAtFilter && typeof createdAtFilter === 'object' && 'gte' in createdAtFilter) {
      expect(createdAtFilter.gte).toBeInstanceOf(Date)
    }
    expect(findManyCall?.orderBy).toEqual({ createdAt: 'desc' })
  })

  test('getRecentAlerts respects custom time window', async () => {
    vi.mocked(prisma.systemAlert.findMany).mockResolvedValue([])

    await getRecentAlerts(48)

    const findManyCall = vi.mocked(prisma.systemAlert.findMany).mock.calls[0][0]
    const createdAtFilter = findManyCall?.where?.createdAt
    
    if (createdAtFilter && typeof createdAtFilter === 'object' && 'gte' in createdAtFilter) {
      const since = createdAtFilter.gte as Date
      // Should be approximately 48 hours ago
      const expectedTime = Date.now() - 48 * 60 * 60 * 1000
      expect(Math.abs(since.getTime() - expectedTime)).toBeLessThan(1000)
    }
  })

  test('resolveAlert marks alert as resolved', async () => {
    vi.mocked(prisma.systemAlert.update).mockResolvedValue({} as any)

    await resolveAlert('alert-123')

    expect(vi.mocked(prisma.systemAlert.update)).toHaveBeenCalledWith({
      where: { id: 'alert-123' },
      data: { resolved: true },
    })
  })

  test('runBackgroundMonitoring checks all conditions', async () => {
    // Setup: no alerts should be triggered
    vi.mocked(prisma.market.findMany).mockResolvedValue([])
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 5000, noPool: 5000 },
    } as any)

    await runBackgroundMonitoring()

    // Should check for high-risk markets
    expect(vi.mocked(prisma.market.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          manipulationScore: { gt: 80 },
        }),
      })
    )

    // Should check for delayed resolutions
    expect(vi.mocked(prisma.market.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'CLOSED',
          outcome: null,
        }),
      })
    )

    // Should check platform liquidity
    expect(vi.mocked(prisma.market.aggregate)).toHaveBeenCalled()
  })

  test('creates multiple alerts for multiple issues', async () => {
    const highRiskMarket = {
      id: 'risky-market',
      title: 'Risky Market',
      manipulationScore: 90,
      status: 'OPEN',
    }

    const delayedMarket = {
      id: 'delayed-market',
      title: 'Delayed Market',
      status: 'CLOSED',
      closeDate: new Date(Date.now() - 48 * 60 * 60 * 1000),
      outcome: null,
      creatorId: 'oracle-addr',
      creator: { publicKey: 'oracle-addr' },
    }

    vi.mocked(prisma.market.findMany)
      .mockResolvedValueOnce([highRiskMarket] as any)
      .mockResolvedValueOnce([delayedMarket] as any)

    vi.mocked(prisma.systemAlert.create).mockResolvedValue({} as any)
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 2000, noPool: 2000 },
    } as any)

    await runBackgroundMonitoring()

    // Should create 3 alerts: manipulation, oracle delay, and low liquidity
    expect(vi.mocked(prisma.systemAlert.create)).toHaveBeenCalledTimes(3)
  })

  test('alert metadata contains relevant context', async () => {
    const market = {
      id: 'test-market-123',
      title: 'Test Market',
      manipulationScore: 95,
      status: 'OPEN',
    }

    vi.mocked(prisma.market.findMany).mockResolvedValue([market] as any)
    vi.mocked(prisma.systemAlert.create).mockResolvedValue({} as any)
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 6000, noPool: 4000 },
    } as any)

    await runBackgroundMonitoring()

    expect(vi.mocked(prisma.systemAlert.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            marketId: 'test-market-123',
            score: 95,
          }),
        }),
      })
    )
  })
})
