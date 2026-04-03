import { NextRequest, NextResponse } from 'next/server'
import { getDisputeStatus } from '@/lib/intelligence/dispute-resolution'
import { withRateLimit } from '@/lib/middleware/rate-limit'

/**
 * GET /api/markets/[id]/disputes
 * Get all disputes for a market
 */
export const GET = withRateLimit(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: marketId } = await params
    
    const disputes = await getDisputeStatus(marketId)

    return NextResponse.json({ disputes }, { status: 200 })
  } catch (error) {
    console.error('Error fetching disputes:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch disputes' },
      { status: 500 }
    )
  }
})
