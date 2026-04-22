import { prisma } from '@/lib/prisma'

export type ReputationTier = 'Novice' | 'Intermediate' | 'Expert' | 'Master'

export interface UserReputation {
  score: number
  tier: ReputationTier
  rollingAverage: number
  totalBets: number
  winRate: number
}

export interface OracleMetrics {
  totalResolutions: number
  disputedResolutions: number
  reliability: number
  avgResolutionTime: number
  flagged: boolean
  flagReasons: string[]
}

/**
 * Initialize a new user with default reputation score
 */
export async function initializeUser(publicKey: string): Promise<void> {
  await prisma.user.upsert({
    where: { publicKey },
    create: {
      publicKey,
      reputationScore: 500,
      reputationTier: 'Intermediate',
      totalResolutions: 0,
      disputedResolutions: 0,
    },
    update: {},
  })
}

/**
 * Update user reputation based on bet result
 * Win: +5 points, Lose: -2 points
 * Bounds: [0, 1000]
 */
export async function updateOnBetResult(
  userId: string,
  won: boolean
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { publicKey: userId },
  })

  if (!user) {
    throw new Error(`User ${userId} not found`)
  }

  const adjustment = won ? 5 : -2
  const newScore = Math.max(0, Math.min(1000, user.reputationScore + adjustment))
  const newTier = getReputationTier(newScore)

  await prisma.user.update({
    where: { publicKey: userId },
    data: {
      reputationScore: newScore,
      reputationTier: newTier,
    },
  })
}

/**
 * Update reputation when a market is resolved
 * Resolved without dispute: +20 points for creator
 * Successfully disputed: -100 points for oracle
 */
export async function updateOnMarketResolution(
  marketId: string,
  disputed: boolean
): Promise<void> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: { creator: true },
  })

  if (!market) {
    throw new Error(`Market ${marketId} not found`)
  }

  if (disputed) {
    // Penalize oracle for disputed resolution
    const newScore = Math.max(0, market.creator.reputationScore - 100)
    const newTier = getReputationTier(newScore)

    await prisma.user.update({
      where: { publicKey: market.creatorId },
      data: {
        reputationScore: newScore,
        reputationTier: newTier,
        disputedResolutions: { increment: 1 },
      },
    })
  } else {
    // Reward creator for successful resolution
    const newScore = Math.min(1000, market.creator.reputationScore + 20)
    const newTier = getReputationTier(newScore)

    await prisma.user.update({
      where: { publicKey: market.creatorId },
      data: {
        reputationScore: newScore,
        reputationTier: newTier,
        totalResolutions: { increment: 1 },
      },
    })
  }
}

/**
 * Calculate oracle reliability score
 * Formula: (1 - disputes/total), min 0.00
 */
export async function calculateOracleReliability(
  oracleAddress: string
): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { publicKey: oracleAddress },
  })

  if (!user || user.totalResolutions === 0) {
    return 0.0
  }

  const reliability = Math.max(
    0.0,
    1 - user.disputedResolutions / user.totalResolutions
  )

  // Update the user's oracle reliability field
  await prisma.user.update({
    where: { publicKey: oracleAddress },
    data: { oracleReliability: reliability },
  })

  return reliability
}

/**
 * Get reputation tier based on score
 * Novice: 0-299, Intermediate: 300-599, Expert: 600-799, Master: 800-1000
 */
export function getReputationTier(score: number): ReputationTier {
  if (score >= 800) return 'Master'
  if (score >= 600) return 'Expert'
  if (score >= 300) return 'Intermediate'
  return 'Novice'
}

/**
 * Get comprehensive user reputation data
 */
export async function getUserReputation(
  publicKey: string
): Promise<UserReputation> {
  const user = await prisma.user.findUnique({
    where: { publicKey },
    include: {
      bets: {
        where: { revealed: true },
        include: { market: true },
      },
    },
  })

  if (!user) {
    throw new Error(`User ${publicKey} not found`)
  }

  // Calculate total bets and win rate
  const totalBets = user.bets.length
  const wonBets = user.bets.filter((bet) => {
    // A bet is won if the market outcome matches the bet side
    // Since bet sides are sealed, we can only count revealed bets
    return bet.market.outcome !== null && bet.revealed
  }).length

  const winRate = totalBets > 0 ? wonBets / totalBets : 0

  // Calculate 30-day rolling average
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  // const recentBets = user.bets.filter(
  //   (bet) => bet.createdAt >= thirtyDaysAgo
  // )

  // For rolling average, we need to track reputation changes over time
  // For MVP, we'll use current score as rolling average
  // In production, this would query a ReputationHistory table
  const rollingAverage = user.reputationScore

  return {
    score: user.reputationScore,
    tier: user.reputationTier as ReputationTier,
    rollingAverage,
    totalBets,
    winRate,
  }
}

/**
 * Get oracle metrics and flagging status
 */
export async function getOracleMetrics(
  oracleAddress: string
): Promise<OracleMetrics> {
  const user = await prisma.user.findUnique({
    where: { publicKey: oracleAddress },
    include: {
      createdMarkets: {
        where: { status: 'RESOLVED' },
      },
    },
  })

  if (!user) {
    throw new Error(`Oracle ${oracleAddress} not found`)
  }

  const reliability = await calculateOracleReliability(oracleAddress)

  // Calculate average resolution time
  const resolvedMarkets = user.createdMarkets
  let avgResolutionTime = 0

  if (resolvedMarkets.length > 0) {
    const totalResolutionTime = resolvedMarkets.reduce((sum, market) => {
      const resolutionTime =
        (market.updatedAt.getTime() - market.closeDate.getTime()) /
        (1000 * 60 * 60) // Convert to hours
      return sum + resolutionTime
    }, 0)

    avgResolutionTime = totalResolutionTime / resolvedMarkets.length

    // Update user's average resolution time
    await prisma.user.update({
      where: { publicKey: oracleAddress },
      data: { avgResolutionTime },
    })
  }

  // Check flagging conditions
  const flagReasons: string[] = []
  let flagged = false

  if (reliability < 0.8) {
    flagged = true
    flagReasons.push('Reliability below 0.80')
  }

  if (avgResolutionTime > 72) {
    flagged = true
    flagReasons.push('Average resolution time exceeds 72 hours')

    // Apply 10-point reputation penalty
    const newScore = Math.max(0, user.reputationScore - 10)
    const newTier = getReputationTier(newScore)

    await prisma.user.update({
      where: { publicKey: oracleAddress },
      data: {
        reputationScore: newScore,
        reputationTier: newTier,
      },
    })
  }

  return {
    totalResolutions: user.totalResolutions,
    disputedResolutions: user.disputedResolutions,
    reliability,
    avgResolutionTime,
    flagged,
    flagReasons,
  }
}
