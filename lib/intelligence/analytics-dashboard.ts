import { prisma } from '@/lib/prisma'

export interface DashboardMetrics {
  activeMarkets: number
  totalLiquidity: number
  volume24h: number
  highRiskMarkets: number
  pendingDisputes: number
  oracleMetrics: {
    avgResolutionTime: number
    avgReliability: number
  }
}

/**
 * Get comprehensive dashboard metrics
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  // Active markets count
  const activeMarkets = await prisma.market.count({
    where: {
      status: { in: ['OPEN', 'CLOSED'] }
    }
  })

  // Total liquidity across all markets
  const liquidityData = await prisma.market.aggregate({
    _sum: {
      yesPool: true,
      noPool: true
    }
  })

  const totalLiquidity = ((liquidityData?._sum?.yesPool) || 0) + ((liquidityData?._sum?.noPool) || 0)

  // 24h volume
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const volume24hData = await prisma.bet.aggregate({
    where: {
      createdAt: { gte: oneDayAgo }
    },
    _sum: {
      amount: true
    }
  })

  const volume24h = (volume24hData?._sum?.amount) || 0

  // High-risk markets (manipulation score > 60)
  const highRiskMarkets = await prisma.market.count({
    where: {
      manipulationScore: { gt: 60 }
    }
  })

  // Pending disputes
  const pendingDisputes = await prisma.disputeChallenge.count({
    where: {
      status: 'PENDING'
    }
  })

  // Oracle metrics
  const oracleData = await prisma.user.aggregate({
    where: {
      totalResolutions: { gt: 0 }
    },
    _avg: {
      avgResolutionTime: true,
      oracleReliability: true
    }
  })

  return {
    activeMarkets,
    totalLiquidity,
    volume24h,
    highRiskMarkets,
    pendingDisputes,
    oracleMetrics: {
      avgResolutionTime: oracleData?._avg?.avgResolutionTime || 0,
      avgReliability: oracleData?._avg?.oracleReliability || 0
    }
  }
}
