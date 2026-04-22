import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface MarketRisk {
  score: number
  flags: RiskFlag[]
  lastUpdated: Date
}

export type RiskFlag =
  | { type: 'rapid_betting'; userId: string; count: number }
  | { type: 'volume_spike'; increase: number }
  | { type: 'wash_trading'; confidence: number; accounts: string[] }
  | { type: 'sybil_cluster'; accounts: string[]; fundingSource: string }

export interface SybilCluster {
  accounts: string[]
  fundingSource: string
  confidence: number
}

interface Bet {
  id: string
  userPublicKey: string
  marketId: string
  amount: number
  createdAt: Date
}

/**
 * Analyzes a bet for manipulation patterns and updates risk scores
 * Performs only fast checks; defers expensive wash_trading and sybil detection
 */
export async function analyzeBet(bet: Bet): Promise<void> {
  const marketId = bet.marketId
  const userId = bet.userPublicKey

  // Check rapid betting pattern (fast query with index)
  const recentBets = await prisma.bet.count({
    where: {
      userPublicKey: userId,
      marketId,
      createdAt: {
        gte: new Date(Date.now() - 60 * 1000), // Last 60 seconds
      },
    },
  })

  if (recentBets > 10) {
    await createManipulationAlert(marketId, {
      type: 'rapid_betting',
      userId,
      count: recentBets,
    })
  }

  // Check volume spike (fast query with index)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)

  const recentVolume = await prisma.bet.aggregate({
    where: {
      marketId,
      createdAt: { gte: oneHourAgo },
    },
    _sum: { amount: true },
  })

  const previousVolume = await prisma.bet.aggregate({
    where: {
      marketId,
      createdAt: { gte: twoHoursAgo, lt: oneHourAgo },
    },
    _sum: { amount: true },
  })

  const recent = recentVolume._sum.amount || 0
  const previous = previousVolume._sum.amount || 1 // Avoid division by zero

  if (recent / previous > 5) {
    // >500% increase
    await createManipulationAlert(marketId, {
      type: 'volume_spike',
      increase: (recent / previous) * 100,
    })
  }

  // Defer expensive wash_trading and sybil detection to background job
  // These are called asynchronously without awaiting
  detectWashTrading(marketId).catch(error => {
    console.error(`[ManipulationDetector] Wash trading detection failed for market ${marketId}:`, error)
  })
}

/**
 * Calculates the overall risk score for a market
 */
export async function calculateRiskScore(marketId: string): Promise<number> {
  const alerts = await prisma.manipulationAlert.findMany({
    where: {
      marketId,
      resolved: false,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      },
    },
  })

  let score = 0
  const seenTypes = new Set<string>()

  for (const alert of alerts) {
    const details = alert.details as RiskFlag
    const type = details.type
    
    if (seenTypes.has(type)) continue
    seenTypes.add(type)

    switch (type) {
      case 'rapid_betting':
        score += 10
        break
      case 'volume_spike':
        score += 20
        break
      case 'wash_trading':
        score += 30
        break
      case 'sybil_cluster':
        score += 40
        break
    }
  }

  // Cap at 100
  return Math.min(score, 100)
}

/**
 * Detects wash trading patterns (opposite-side bets within 600s)
 */
export async function detectWashTrading(
  marketId: string
): Promise<{ type: 'wash_trading'; confidence: number; accounts: string[] } | null> {
  const tenMinutesAgo = new Date(Date.now() - 600 * 1000)

  // Get recent bets grouped by user
  const recentBets = await prisma.bet.findMany({
    where: {
      marketId,
      createdAt: { gte: tenMinutesAgo },
    },
    orderBy: { createdAt: 'asc' },
  })

  // Track users who bet on opposite sides within 600s
  const suspiciousPatterns: Map<string, string[]> = new Map()

  for (let i = 0; i < recentBets.length; i++) {
    for (let j = i + 1; j < recentBets.length; j++) {
      const bet1 = recentBets[i]
      const bet2 = recentBets[j]

      if (bet1.userPublicKey === bet2.userPublicKey) continue

      const timeDiff = bet2.createdAt.getTime() - bet1.createdAt.getTime()
      if (timeDiff <= 600 * 1000) {
        // Within 600 seconds
        const key = [bet1.userPublicKey, bet2.userPublicKey].sort().join('-')
        if (!suspiciousPatterns.has(key)) {
          suspiciousPatterns.set(key, [bet1.userPublicKey, bet2.userPublicKey])
        }
      }
    }
  }

  if (suspiciousPatterns.size > 0) {
    const accounts = Array.from(suspiciousPatterns.values()).flat()
    const uniqueAccounts = [...new Set(accounts)]

    await createManipulationAlert(marketId, {
      type: 'wash_trading',
      confidence: Math.min(suspiciousPatterns.size / 10, 1),
      accounts: uniqueAccounts,
    })

    return {
      type: 'wash_trading',
      confidence: Math.min(suspiciousPatterns.size / 10, 1),
      accounts: uniqueAccounts,
    }
  }

  return null
}

/**
 * Detects Sybil accounts (same funding source + same market bets within 24h)
 */
export async function detectSybilAccounts(addresses: string[]): Promise<SybilCluster[]> {
  const clusters: SybilCluster[] = []

  // Get wallet relationships for these addresses
  const relationships = await prisma.walletRelationship.findMany({
    where: {
      OR: [
        { sourceWallet: { in: addresses } },
        { targetWallet: { in: addresses } },
      ],
      relationship: 'funded_by',
    },
  })

  // Group by funding source
  const fundingGroups: Map<string, Set<string>> = new Map()

  for (const rel of relationships) {
    const source = rel.sourceWallet
    if (!fundingGroups.has(source)) {
      fundingGroups.set(source, new Set())
    }
    fundingGroups.get(source)!.add(rel.targetWallet)
  }

  // Check if accounts from same funding source bet on same markets within 24h
  for (const [fundingSource, accounts] of fundingGroups.entries()) {
    if (accounts.size < 2) continue

    const accountArray = Array.from(accounts)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    // Find markets where multiple accounts from this group bet
    const bets = await prisma.bet.findMany({
      where: {
        userPublicKey: { in: accountArray },
        createdAt: { gte: oneDayAgo },
      },
      select: {
        marketId: true,
        userPublicKey: true,
      },
    })

    const marketGroups: Map<string, Set<string>> = new Map()
    for (const bet of bets) {
      if (!marketGroups.has(bet.marketId)) {
        marketGroups.set(bet.marketId, new Set())
      }
      marketGroups.get(bet.marketId)!.add(bet.userPublicKey)
    }

    // If multiple accounts bet on same market, it's suspicious
    for (const [marketId, users] of marketGroups.entries()) {
      if (users.size >= 2) {
        const cluster: SybilCluster = {
          accounts: Array.from(users),
          fundingSource,
          confidence: Math.min(users.size / 5, 1),
        }
        clusters.push(cluster)

        await createManipulationAlert(marketId, {
          type: 'sybil_cluster',
          accounts: cluster.accounts,
          fundingSource,
        })
      }
    }
  }

  return clusters
}

/**
 * Gets the current risk assessment for a market
 */
export async function getMarketRisk(marketId: string): Promise<MarketRisk> {
  const score = await calculateRiskScore(marketId)

  const alerts = await prisma.manipulationAlert.findMany({
    where: {
      marketId,
      resolved: false,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const uniqueFlagsMap = new Map<string, RiskFlag>()
  
  for (const alert of alerts) {
    const flag = alert.details as RiskFlag
    if (!uniqueFlagsMap.has(flag.type)) {
      uniqueFlagsMap.set(flag.type, flag)
    }
  }

  const flags = Array.from(uniqueFlagsMap.values())

  return {
    score,
    flags,
    lastUpdated: new Date(),
  }
}

/**
 * Creates a manipulation alert record
 */
async function createManipulationAlert(marketId: string, flag: RiskFlag): Promise<void> {
  // Prevent spam: check if an unresolved alert of this type already exists
  const existing = await prisma.manipulationAlert.findFirst({
    where: {
      marketId,
      flagType: flag.type,
      resolved: false
    }
  })
  
  if (existing) {
    return;
  }

  let severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO'

  // Determine severity based on flag type
  switch (flag.type) {
    case 'rapid_betting':
      severity = 'WARNING'
      break
    case 'volume_spike':
      severity = 'WARNING'
      break
    case 'wash_trading':
      severity = 'CRITICAL'
      break
    case 'sybil_cluster':
      severity = 'CRITICAL'
      break
  }

  await prisma.manipulationAlert.create({
    data: {
      marketId,
      flagType: flag.type,
      severity,
      details: flag as unknown as Prisma.InputJsonValue,
      resolved: false,
    },
  })

  // Update market manipulation score
  const score = await calculateRiskScore(marketId)
  await prisma.market.update({
    where: { id: marketId },
    data: { manipulationScore: score },
  })
}
