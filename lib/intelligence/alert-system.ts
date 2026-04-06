import { prisma } from '@/lib/prisma'

export type AlertSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export type AlertType = 'manipulation' | 'dispute' | 'oracle_delay' | 'liquidity'

export interface SystemAlertData {
  type: AlertType
  severity: AlertSeverity
  message: string
  metadata: Record<string, any>
}

/**
 * Create a system alert
 */
export async function createSystemAlert(data: SystemAlertData): Promise<void> {
  await prisma.systemAlert.create({
    data: {
      type: data.type,
      severity: data.severity,
      message: data.message,
      metadata: data.metadata,
      resolved: false
    }
  })
}

/**
 * Background monitoring function - runs every 60 seconds
 * Checks for:
 * - Manipulation score > 80
 * - Oracle delay > 24h
 * - Platform liquidity < 5000 XLM
 */
export async function runBackgroundMonitoring(): Promise<void> {
  // Check for high manipulation scores
  const highRiskMarkets = await prisma.market.findMany({
    where: {
      manipulationScore: { gt: 80 },
      status: { in: ['OPEN', 'CLOSED'] }
    },
    select: {
      id: true,
      title: true,
      manipulationScore: true
    }
  })

  if (highRiskMarkets && Array.isArray(highRiskMarkets)) {
    for (const market of highRiskMarkets) {
      await createSystemAlert({
        type: 'manipulation',
        severity: 'CRITICAL',
        message: `Market "${market.title}" has critical manipulation risk (score: ${market.manipulationScore})`,
        metadata: {
          marketId: market.id,
          score: market.manipulationScore
        }
      })
    }
  }

  // Check for delayed oracle resolutions (>24h after close)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const delayedMarkets = await prisma.market.findMany({
    where: {
      status: 'CLOSED',
      closeDate: { lt: oneDayAgo },
      outcome: null
    },
    include: {
      creator: true
    }
  })

  if (delayedMarkets && Array.isArray(delayedMarkets)) {
    for (const market of delayedMarkets) {
      await createSystemAlert({
        type: 'oracle_delay',
        severity: 'WARNING',
        message: `Market "${market.title}" has not been resolved 24h after close`,
        metadata: {
          marketId: market.id,
          oracleAddress: market.creatorId,
          closeDate: market.closeDate
        }
      })
    }
  }

  // Check platform liquidity
  const liquidityData = await prisma.market.aggregate({
    _sum: {
      yesPool: true,
      noPool: true
    }
  })

  const totalLiquidity = ((liquidityData?._sum?.yesPool) || 0) + ((liquidityData?._sum?.noPool) || 0)

  if (totalLiquidity < 5000) {
    await createSystemAlert({
      type: 'liquidity',
      severity: 'CRITICAL',
      message: `Platform liquidity critically low: ${totalLiquidity.toFixed(2)} XLM`,
      metadata: {
        totalLiquidity,
        threshold: 5000
      }
    })
  }
}

/**
 * Get recent alerts (last 24 hours by default)
 */
export async function getRecentAlerts(hours: number = 24): Promise<any[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)

  return await prisma.systemAlert.findMany({
    where: {
      createdAt: { gte: since }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
}

/**
 * Mark an alert as resolved
 */
export async function resolveAlert(alertId: string): Promise<void> {
  await prisma.systemAlert.update({
    where: { id: alertId },
    data: { resolved: true }
  })
}
