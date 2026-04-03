import prisma from '@/lib/db'
import { calculateOracleReliability } from './reputation-system'
import { intelligenceCache } from '@/lib/cache/intelligence-cache'

export interface QualityBreakdown {
  totalScore: number  // 0-100
  creatorReputation: number  // 30% weight
  oracleReliability: number  // 30% weight
  liquidityDepth: number  // 20% weight
  marketClarity: number  // 20% weight
}

/**
 * Calculate quality score (0-100) for a market
 * Formula: (creatorReputation/1000 × 30) + (oracleReliability × 30) + (min(liquidityPool/1000, 1) × 20) + (clarityScore × 20)
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
      creator: true
    }
  })

  if (!market) {
    throw new Error(`Market ${marketId} not found`)
  }

  // 1. Creator Reputation (30% weight)
  const creatorReputationScore = (market.creator.reputationScore / 1000) * 30

  // 2. Oracle Reliability (30% weight)
  let oracleReliabilityScore = 0
  if (market.oracleAddress) {
    try {
      const reliability = await calculateOracleReliability(market.oracleAddress)
      oracleReliabilityScore = reliability * 30
    } catch (error) {
      // If oracle not found or no resolutions yet, use 0
      oracleReliabilityScore = 0
    }
  }

  // 3. Liquidity Depth (20% weight)
  const totalPool = market.yesPool + market.noPool
  const liquidityDepthScore = Math.min(totalPool / 1000, 1) * 20

  // 4. Market Clarity (20% weight)
  const titleLength = market.title.length
  const descLength = market.description?.length || 0
  const clarityScore = Math.min((titleLength + descLength) / 200, 1) * 20

  const totalScore = 
    creatorReputationScore + 
    oracleReliabilityScore + 
    liquidityDepthScore + 
    clarityScore

  return {
    totalScore: Math.round(totalScore * 100) / 100, // Round to 2 decimals
    creatorReputation: Math.round(creatorReputationScore * 100) / 100,
    oracleReliability: Math.round(oracleReliabilityScore * 100) / 100,
    liquidityDepth: Math.round(liquidityDepthScore * 100) / 100,
    marketClarity: Math.round(clarityScore * 100) / 100
  }
}
