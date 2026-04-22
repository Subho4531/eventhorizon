import { NextRequest, NextResponse } from 'next/server'
import { getDisputeEvidence, flagEvidence } from '@/lib/intelligence/dispute-resolution'
import { withRateLimit } from '@/lib/middleware/rate-limit'

/**
 * GET /api/disputes/[id]/evidence
 * Get evidence for a dispute
 */
export const GET = withRateLimit(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: disputeId } = await params
    
    const evidence = await getDisputeEvidence(disputeId)

    return NextResponse.json(evidence, { status: 200 })
  } catch (error) {
    console.error('Error fetching evidence:', error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch evidence' },
      { status: 500 }
    )
  }
})

/**
 * POST /api/disputes/[id]/evidence
 * Flag evidence as misleading
 */
export const POST = withRateLimit(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: disputeId } = await params
    const body = await request.json()

    const { urlIndex, flaggerAddress } = body

    if (urlIndex === undefined || !flaggerAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    await flagEvidence(disputeId, urlIndex)

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('Error flagging evidence:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
      if (error.message.includes('Invalid URL index')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to flag evidence' },
      { status: 500 }
    )
  }
})
