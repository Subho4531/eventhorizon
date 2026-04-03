/**
 * app/api/markets/[id]/probability/route.ts
 *
 * API endpoint for market probability estimates.
 * GET /api/markets/[id]/probability - Returns current probability estimate
 */

import { NextRequest, NextResponse } from "next/server";
import { updateProbability, getProbabilityHistory } from "@/lib/intelligence/probability-model";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketId } = await context.params;

    // Check if history is requested
    const { searchParams } = new URL(request.url);
    const history = searchParams.get("history");
    const limit = parseInt(searchParams.get("limit") || "100", 10);

    if (history === "true") {
      // Return probability history
      const historyData = await getProbabilityHistory(marketId, limit);
      return NextResponse.json({
        marketId,
        history: historyData,
      });
    }

    // Return current probability estimate
    const estimate = await updateProbability(marketId);
    
    return NextResponse.json({
      marketId: estimate.marketId,
      probability: estimate.probability,
      confidence: estimate.confidence,
      sources: estimate.sources,
      timestamp: estimate.timestamp,
    });
  } catch (error) {
    console.error("[API] /api/markets/[id]/probability error:", error);
    
    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        { error: "Market not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch probability estimate" },
      { status: 500 }
    );
  }
}
