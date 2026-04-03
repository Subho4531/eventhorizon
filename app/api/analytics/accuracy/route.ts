/**
 * app/api/analytics/accuracy/route.ts
 *
 * API endpoint for probability model accuracy metrics.
 * GET /api/analytics/accuracy - Returns aggregate accuracy statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { getAggregateAccuracy, calculateAccuracy } from "@/lib/intelligence/probability-model";
import { withRateLimit } from "@/lib/middleware/rate-limit";

export const GET = withRateLimit(async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get("marketId");

    if (marketId) {
      // Return accuracy for specific market
      const accuracy = await calculateAccuracy(marketId);
      
      return NextResponse.json({
        marketId,
        accuracy,
      });
    }

    // Return aggregate accuracy metrics
    const metrics = await getAggregateAccuracy();
    
    return NextResponse.json({
      averageAccuracy: metrics.averageAccuracy,
      totalMarkets: metrics.totalMarkets,
      accuracyByCategory: metrics.accuracyByCategory,
    });
  } catch (error) {
    console.error("[API] /api/analytics/accuracy error:", error);
    
    if (error instanceof Error && error.message.includes("not resolved")) {
      return NextResponse.json(
        { error: "Market is not resolved" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch accuracy metrics" },
      { status: 500 }
    );
  }
})
