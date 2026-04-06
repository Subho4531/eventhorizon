import { prisma } from '@/lib/prisma'

export interface LiquidityParams {
  minBetSize: number  // 1-100 XLM
  incentiveMultiplier: number  // 1.0-1.10
  bondRequirement: number  // base + adjustments
  lastUpdated: Date
}

interface VolumeData {
  hourlyVolume: number
  dailyVolume: number
}

interface VolatilityData {
  probabilityChangeRate: number
}

/**
 * Calculate minimum bet size based on trading volume
 * >1000 XLM/hour → +10%, <100 XLM/24h → -10%, bounds 1-100 XLM
 */
export async function calculateMinBetSize(marketId: string): Promise<number> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { minBetSize: true }
  })

  if (!market) {
    throw new Error(`Market ${marketId} not found`)
  }

  const volumeData = await getVolumeData(marketId)
  let newMinBetSize = market.minBetSize

  // Increase by 10% if hourly volume > 1000 XLM
  if (volumeData.hourlyVolume > 1000) {
    newMinBetSize = newMinBetSize * 1.10
  }

  // Decrease by 10% if daily volume < 100 XLM
  if (volumeData.dailyVolume < 100) {
    newMinBetSize = newMinBetSize * 0.90
  }

  // Enforce bounds [1, 100]
  newMinBetSize = Math.max(1, Math.min(100, newMinBetSize))

  // Update in database
  await prisma.market.update({
    where: { id: marketId },
    data: { minBetSize: newMinBetSize }
  })

  return newMinBetSize
}

/**
 * Get incentive multiplier for low-liquidity markets
 * Pool <500 XLM → 1.05×
 */
export async function getIncentiveMultiplier(marketId: string): Promise<number> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { yesPool: true, noPool: true }
  })

  if (!market) {
    throw new Error(`Market ${marketId} not found`)
  }

  // Calculate total pool
  const totalPool = market.yesPool + market.noPool

  // Apply 1.05× multiplier for pools below 500 XLM
  const multiplier = totalPool < 500 ? 1.05 : 1.0

  // Update in database
  await prisma.market.update({
    where: { id: marketId },
    data: { incentiveMultiplier: multiplier }
  })

  return multiplier
}

/**
 * Adjust bond requirement based on market volatility
 * Volatility >0.20/hour → +20%
 */
export async function adjustBondRequirement(marketId: string): Promise<number> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { bondAmount: true }
  })

  if (!market) {
    throw new Error(`Market ${marketId} not found`)
  }

  const volatilityData = await getVolatilityData(marketId)
  let bondRequirement = market.bondAmount

  // Increase by 20% if volatility > 0.20/hour
  if (volatilityData.probabilityChangeRate > 0.20) {
    bondRequirement = bondRequirement * 1.20
  }

  return bondRequirement
}

/**
 * Distribute weekly liquidity rewards
 * 1000 XLM pool, points = bet_amount/10, proportional distribution
 */
export async function distributeLiquidityRewards(): Promise<void> {
  const WEEKLY_POOL = 1000 // XLM
  const now = new Date()
  const weekStart = getWeekStart(now)

  // Get all unclaimed rewards for the current week
  const rewards = await prisma.liquidityReward.findMany({
    where: {
      weekStart,
      claimed: false
    }
  })

  if (rewards.length === 0) {
    return
  }

  // Calculate total points
  const totalPoints = rewards.reduce((sum, r) => sum + r.points, 0)

  if (totalPoints === 0) {
    return
  }

  // Distribute proportionally
  for (const reward of rewards) {
    const userReward = (reward.points / totalPoints) * WEEKLY_POOL

    await prisma.liquidityReward.update({
      where: { id: reward.id },
      data: {
        reward: userReward,
        claimed: true
      }
    })
  }

  // Reset points for next week (create new records with 0 points)
  const uniqueUserIds = [...new Set(rewards.map(r => r.userId))]
  const nextWeekStart = new Date(weekStart)
  nextWeekStart.setDate(nextWeekStart.getDate() + 7)

  for (const userId of uniqueUserIds) {
    await prisma.liquidityReward.create({
      data: {
        userId,
        weekStart: nextWeekStart,
        points: 0,
        claimed: false
      }
    })
  }
}

/**
 * Get current liquidity parameters for a market
 */
export async function getLiquidityParams(marketId: string): Promise<LiquidityParams> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: {
      minBetSize: true,
      incentiveMultiplier: true,
      bondAmount: true,
      updatedAt: true
    }
  })

  if (!market) {
    throw new Error(`Market ${marketId} not found`)
  }

  return {
    minBetSize: market.minBetSize,
    incentiveMultiplier: market.incentiveMultiplier,
    bondRequirement: market.bondAmount,
    lastUpdated: market.updatedAt
  }
}

/**
 * Credit liquidity reward points for a bet on a low-liquidity market
 * Points = bet_amount / 10
 * 
 * Usage: Call this function after a bet is successfully placed
 * Example in app/api/bets/route.ts:
 * ```
 * import { creditLiquidityPoints } from '@/lib/intelligence/liquidity-manager'
 * 
 * // After bet creation:
 * await creditLiquidityPoints(userPublicKey, marketId, amount)
 * ```
 */
export async function creditLiquidityPoints(
  userId: string,
  marketId: string,
  betAmount: number
): Promise<void> {
  // Check if market is low-liquidity (<200 XLM)
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    select: { yesPool: true, noPool: true }
  })

  if (!market) {
    return
  }

  const totalPool = market.yesPool + market.noPool
  
  if (totalPool >= 200) {
    return // Not a low-liquidity market
  }

  const points = betAmount / 10
  const weekStart = getWeekStart(new Date())

  // Find or create reward record for this week
  const existingReward = await prisma.liquidityReward.findFirst({
    where: {
      userId,
      weekStart,
      claimed: false
    }
  })

  if (existingReward) {
    await prisma.liquidityReward.update({
      where: { id: existingReward.id },
      data: {
        points: existingReward.points + points
      }
    })
  } else {
    await prisma.liquidityReward.create({
      data: {
        userId,
        weekStart,
        points,
        claimed: false
      }
    })
  }
}

// Helper functions

async function getVolumeData(marketId: string): Promise<VolumeData> {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

  // Get bets in the last hour
  const hourlyBets = await prisma.bet.findMany({
    where: {
      marketId,
      createdAt: { gte: oneHourAgo }
    },
    select: { amount: true }
  })

  // Get bets in the last 24 hours
  const dailyBets = await prisma.bet.findMany({
    where: {
      marketId,
      createdAt: { gte: oneDayAgo }
    },
    select: { amount: true }
  })

  return {
    hourlyVolume: hourlyBets.reduce((sum, bet) => sum + bet.amount, 0),
    dailyVolume: dailyBets.reduce((sum, bet) => sum + bet.amount, 0)
  }
}

async function getVolatilityData(marketId: string): Promise<VolatilityData> {
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

  // Get probability history from the last hour
  const probabilities = await prisma.probabilityHistory.findMany({
    where: {
      marketId,
      createdAt: { gte: oneHourAgo }
    },
    orderBy: { createdAt: 'asc' },
    select: { probability: true }
  })

  if (probabilities.length < 2) {
    return { probabilityChangeRate: 0 }
  }

  // Calculate max change rate
  let maxChange = 0
  for (let i = 1; i < probabilities.length; i++) {
    const change = Math.abs(probabilities[i].probability - probabilities[i - 1].probability)
    maxChange = Math.max(maxChange, change)
  }

  return { probabilityChangeRate: maxChange }
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}
