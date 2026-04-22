/**
 * lib/intelligence/probability-model.ts
 *
 * AI-based probability modeling service for prediction markets.
 * Generates and updates probability estimates using historical data,
 * external signals, and trading volume with privacy-preserving analytics.
 */

import { prisma } from "@/lib/db";
import { intelligenceCache } from "@/lib/cache/intelligence-cache";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

export type DataSource = "historical" | "external" | "volume" | "fallback";

export interface ProbabilityEstimate {
  marketId: string;
  probability: number; // 0.00 to 1.00
  timestamp: Date;
  sources: DataSource[];
  confidence: number;
}

export interface AccuracyMetrics {
  marketId: string;
  predictedProbability: number;
  actualOutcome: "YES" | "NO";
  accuracy: number;
  closingProbability: number;
}

// ──────────────────────────────────────────────────────────────────────────────
// Cache Helpers (using centralized intelligence cache)
// ──────────────────────────────────────────────────────────────────────────────

function getCachedEstimate(marketId: string): ProbabilityEstimate | null {
  return intelligenceCache.get<ProbabilityEstimate>(`probability:${marketId}`);
}

function setCachedEstimate(marketId: string, estimate: ProbabilityEstimate): void {
  intelligenceCache.set(`probability:${marketId}`, estimate);
}

// ──────────────────────────────────────────────────────────────────────────────
// Core Probability Calculation
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Calculate volume-weighted probability based on pool sizes.
 * This is the fallback method when external data is unavailable.
 */
function calculateVolumeWeightedProbability(
  yesPool: number,
  noPool: number
): number {
  const total = yesPool + noPool;
  if (total === 0) return 0.5; // Neutral probability for empty markets
  
  const prob = yesPool / total;
  
  // Clamp to [0.00, 1.00] and round to 2 decimal places
  return Math.max(0.0, Math.min(1.0, Math.round(prob * 100) / 100));
}

/**
 * Calculate exponential decay weight for historical data.
 * Weight = 0.95^days_ago
 */
function calculateDecayWeight(resolvedAt: Date): number {
  // Validate date is not NaN
  if (!resolvedAt || isNaN(resolvedAt.getTime())) {
    return 0;
  }
  
  const daysAgo = (Date.now() - resolvedAt.getTime()) / (1000 * 60 * 60 * 24);
  
  // Handle negative or invalid days
  if (daysAgo < 0 || !Number.isFinite(daysAgo)) {
    return 0;
  }
  
  return Math.pow(0.95, daysAgo);
}

/**
 * Analyze similar historical markets and compute weighted probability.
 */
async function analyzeHistoricalMarkets(
  marketTitle: string
): Promise<{ probability: number; confidence: number } | null> {
  try {
    // Find similar resolved markets (simple keyword matching for MVP)
    const keywords = marketTitle
      .toLowerCase()
      .split(" ")
      .filter((w) => w.length > 3);
    
    if (keywords.length === 0) return null;

    // Query resolved markets with similar titles
    const historicalMarkets = await prisma.market.findMany({
      where: {
        status: "RESOLVED",
        outcome: { not: null },
        OR: keywords.map((keyword) => ({
          title: { contains: keyword, mode: "insensitive" as const },
        })),
      },
      select: {
        id: true,
        outcome: true,
        yesPool: true,
        noPool: true,
        updatedAt: true,
      },
      take: 20,
    });

    if (historicalMarkets.length === 0) return null;

    // Calculate weighted probability using exponential decay
    let weightedSum = 0;
    let totalWeight = 0;

    for (const market of historicalMarkets) {
      // Validate updatedAt is a valid date
      if (!market.updatedAt || isNaN(market.updatedAt.getTime())) {
        continue; // Skip invalid dates
      }
      
      const weight = calculateDecayWeight(market.updatedAt);
      
      // Skip if weight is 0 or invalid
      if (weight === 0 || !Number.isFinite(weight)) {
        continue;
      }
      
      const outcomeValue = market.outcome === "YES" ? 1.0 : 0.0;
      
      weightedSum += outcomeValue * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return null;

    const probability = weightedSum / totalWeight;
    const confidence = Math.min(historicalMarkets.length / 10, 1.0); // More data = higher confidence

    return {
      probability: Math.round(probability * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
    };
  } catch (error) {
    console.error("[probability-model] Historical analysis failed:", error);
    return null;
  }
}

import { getAIMarketScore } from "./ollama-service";

/**
 * AI-driven probability signal using Ollama.
 */
async function fetchExternalSignals(
  marketTitle: string,
  marketDescription: string
): Promise<{ probability: number; confidence: number } | null> {
  const aiResult = await getAIMarketScore(marketTitle, marketDescription);
  if (!aiResult) return null;

  return {
    probability: aiResult.score / 100,
    confidence: aiResult.confidence,
  };
}

// ──────────────────────────────────────────────────────────────────────────────
// Public API
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate initial probability estimate for a new market.
 * Combines historical data, external signals, and volume-weighted calculation.
 */
export async function generateInitialProbability(
  marketId: string
): Promise<ProbabilityEstimate> {
  try {
    // Fetch market data
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: {
        id: true,
        title: true,
        description: true,
        yesPool: true,
        noPool: true,
      },
    });

    if (!market) {
      throw new Error(`Market ${marketId} not found`);
    }

    const sources: DataSource[] = [];
    let probability = 0.5;
    let confidence = 0.5;

    // Try historical analysis first
    const historical = await analyzeHistoricalMarkets(
      market.title
    );
    
    if (historical) {
      probability = historical.probability;
      confidence = historical.confidence;
      sources.push("historical");
    }

    // Try AI signals via Ollama
    const external = await fetchExternalSignals(market.title, market.description || "");
    if (external) {
      // Blend with historical if available
      if (sources.includes("historical")) {
        probability = (probability + external.probability) / 2;
        confidence = Math.max(confidence, external.confidence);
      } else {
        probability = external.probability;
        confidence = external.confidence;
      }
      sources.push("external");
    }

    // Fallback to volume-weighted if no other sources
    if (sources.length === 0) {
      probability = calculateVolumeWeightedProbability(
        market.yesPool,
        market.noPool
      );
      sources.push("fallback");
      confidence = 0.3; // Low confidence for fallback
    } else {
      // Blend with current volume data
      const volumeProb = calculateVolumeWeightedProbability(
        market.yesPool,
        market.noPool
      );
      probability = probability * 0.7 + volumeProb * 0.3; // 70% model, 30% volume
      sources.push("volume");
    }

    // Ensure bounds and precision
    probability = Math.max(0.0, Math.min(1.0, Math.round(probability * 100) / 100));
    confidence = Math.round(confidence * 100) / 100;

    const estimate: ProbabilityEstimate = {
      marketId: market.id,
      probability,
      timestamp: new Date(),
      sources,
      confidence,
    };

    // Store in database
    await prisma.probabilityHistory.create({
      data: {
        marketId: market.id,
        probability,
        confidence,
        sources: sources,
      },
    });

    // Cache the result
    setCachedEstimate(marketId, estimate);

    return estimate;
  } catch (error) {
    console.error("[probability-model] generateInitialProbability failed:", error);
    throw error;
  }
}

/**
 * Update probability estimate for an existing market.
 * Uses cached value if available and not expired.
 */
export async function updateProbability(
  marketId: string
): Promise<ProbabilityEstimate> {
  // Check cache first
  const cached = getCachedEstimate(marketId);
  if (cached) {
    return cached;
  }

  // Generate new estimate (same logic as initial)
  return generateInitialProbability(marketId);
}

/**
 * Get probability history for a market.
 * Returns up to `limit` most recent estimates.
 */
export async function getProbabilityHistory(
  marketId: string,
  limit: number = 100
): Promise<ProbabilityEstimate[]> {
  try {
    const history = await prisma.probabilityHistory.findMany({
      where: { marketId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return history.map((record) => ({
      marketId: record.marketId,
      probability: record.probability,
      timestamp: record.createdAt,
      sources: record.sources as DataSource[],
      confidence: record.confidence,
    }));
  } catch (error) {
    console.error("[probability-model] getProbabilityHistory failed:", error);
    return [];
  }
}

/**
 * Calculate prediction accuracy for a resolved market.
 * Compares final probability estimate to actual outcome.
 */
export async function calculateAccuracy(
  marketId: string
): Promise<number> {
  try {
    const market = await prisma.market.findUnique({
      where: { id: marketId },
      select: {
        outcome: true,
        status: true,
      },
    });

    if (!market || market.status !== "RESOLVED" || !market.outcome) {
      throw new Error(`Market ${marketId} is not resolved`);
    }

    // Get the last probability estimate before resolution
    const lastEstimate = await prisma.probabilityHistory.findFirst({
      where: { marketId },
      orderBy: { createdAt: "desc" },
    });

    if (!lastEstimate) {
      return 0;
    }

    // Calculate accuracy: 1 - |predicted - actual|
    const actualValue = market.outcome === "YES" ? 1.0 : 0.0;
    const predicted = lastEstimate.probability;
    const accuracy = 1.0 - Math.abs(predicted - actualValue);

    return Math.round(accuracy * 100) / 100;
  } catch (error) {
    console.error("[probability-model] calculateAccuracy failed:", error);
    return 0;
  }
}

/**
 * Get aggregate accuracy metrics across all resolved markets.
 */
export async function getAggregateAccuracy(): Promise<{
  averageAccuracy: number;
  totalMarkets: number;
  accuracyByCategory: Record<string, number>;
}> {
  try {
    const resolvedMarkets = await prisma.market.findMany({
      where: {
        status: "RESOLVED",
        outcome: { not: null },
      },
      select: {
        id: true,
        title: true,
      },
    });

    if (resolvedMarkets.length === 0) {
      return {
        averageAccuracy: 0,
        totalMarkets: 0,
        accuracyByCategory: {},
      };
    }

    // Calculate accuracy for each market
    const accuracies = await Promise.all(
      resolvedMarkets.map((m) => calculateAccuracy(m.id))
    );

    const validAccuracies = accuracies.filter((a) => a > 0);
    const averageAccuracy =
      validAccuracies.length > 0
        ? validAccuracies.reduce((sum, a) => sum + a, 0) / validAccuracies.length
        : 0;

    return {
      averageAccuracy: Math.round(averageAccuracy * 100) / 100,
      totalMarkets: resolvedMarkets.length,
      accuracyByCategory: {}, // TODO: Implement category-based accuracy
    };
  } catch (error) {
    console.error("[probability-model] getAggregateAccuracy failed:", error);
    return {
      averageAccuracy: 0,
      totalMarkets: 0,
      accuracyByCategory: {},
    };
  }
}

/**
 * Clear cache for a specific market (used on market resolution or bet placement).
 */
export function invalidateCache(marketId: string): void {
  intelligenceCache.delete(`probability:${marketId}`);
}

/**
 * Clear all cached probability estimates.
 */
export function clearCache(): void {
  intelligenceCache.invalidatePattern('probability:');
}
