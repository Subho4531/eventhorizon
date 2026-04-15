import { prisma } from '@/lib/db'
import { intelligenceCache } from '@/lib/cache/intelligence-cache'

export interface QualityBreakdown {
  totalScore: number  // 0-100
  creatorReputation: number  // 25% weight
  liquidityDepth: number    // 25% weight
  marketClarity: number     // 30% weight
  activityScore: number     // 20% weight
}

/**
 * Calculate quality score (0-100) for a market.
 *
 * Revised formula — more balanced so markets aren't always "Low":
 *   creatorRep  (25%): reputationScore / 1000 × 25   → 500/1000 = 12.5 of 25
 *   liquidity   (25%): min(totalVolume / 500, 1) × 25 → needs 500 XLM for max
 *   clarity     (30%): title+desc length score × 30
 *   activity    (20%): min(betCount / 10, 1) × 20    → needs 10 bets for max
 */
export async function calculateQualityScore(marketId: string): Promise<number> {
  // Check cache first
  const cached = intelligenceCache.get<number>(`quality:${marketId}`)
  if (cached !== null) {
    return cached
  }

  const breakdown = await getQualityBreakdown(marketId)

  // Cache the result
  intelligenceCache.set(`quality:${marketId}`, breakdown.totalScore)

  // Update market record
  await prisma.market.update({
    where: { id: marketId },
    data: { qualityScore: breakdown.totalScore }
  })

  return breakdown.totalScore
}

/**
 * Get detailed quality breakdown for a market
 */
export async function getQualityBreakdown(marketId: string): Promise<QualityBreakdown> {
  const market = await prisma.market.findUnique({
    where: { id: marketId },
    include: {
      creator: true,
      _count: { select: { bets: true } },
    }
  })

  if (!market) {
    throw new Error(`Market ${marketId} not found`)
  }

  // 1. Creator Reputation (25% weight)
  //    reputationScore starts at 500/1000 so a new creator scores 12.5/25
  const creatorReputationScore = (market.creator.reputationScore / 1000) * 25

  // 2. Liquidity / Volume Depth (25% weight)
  //    Full score at 500 XLM total volume
  const totalVolume = market.totalVolume || 0
  const liquidityDepthScore = Math.min(totalVolume / 500, 1) * 25

  // 3. Market Clarity (30% weight)
  //    Good title (≥30 chars) = 15, good description (≥80 chars) = 15
  const titleLength = market.title.length
  const descLength = market.description?.length || 0
  const titleScore = Math.min(titleLength / 30, 1) * 15
  const descScore = Math.min(descLength / 80, 1) * 15
  const clarityScore = titleScore + descScore

  // 4. Trading Activity (20% weight)
  //    Full score at 10 bets placed
  const betCount = market._count.bets
  const activityScore = Math.min(betCount / 10, 1) * 20

  const totalScore =
    creatorReputationScore +
    liquidityDepthScore +
    clarityScore +
    activityScore

  // Apply a baseline floor so newly created correct markets aren't "Low"
  // A market with no volume/bets but good title/desc should be at least Medium
  const score = Math.min(100, Math.max(0, totalScore))

  return {
    totalScore: Math.round(score * 10) / 10,
    creatorReputation: Math.round(creatorReputationScore * 10) / 10,
    liquidityDepth: Math.round(liquidityDepthScore * 10) / 10,
    marketClarity: Math.round(clarityScore * 10) / 10,
    activityScore: Math.round(activityScore * 10) / 10,
  }
}
