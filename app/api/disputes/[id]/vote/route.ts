import { NextRequest, NextResponse } from 'next/server'
import { submitVote, Vote } from '@/lib/intelligence/dispute-resolution'
import { withRateLimit } from '@/lib/middleware/rate-limit'

/**
 * POST /api/disputes/[id]/vote
 * Submit a vote on a dispute
 */
export const POST = withRateLimit(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id: disputeId } = await params
    const body = await request.json()

    const vote: Vote = {
      voterAddress: body.voterAddress,
      outcome: body.outcome,
      stake: body.stake
    }

    // Validate required fields
    if (!vote.voterAddress || !vote.outcome || vote.stake === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (!['YES', 'NO', 'ORIGINAL'].includes(vote.outcome)) {
      return NextResponse.json(
        { error: 'Outcome must be YES, NO, or ORIGINAL' },
        { status: 400 }
      )
    }

    await submitVote(disputeId, vote)

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    console.error('Error submitting vote:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('reputation score above 300')) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        )
      }
      if (error.message.includes('Minimum stake')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
      if (error.message.includes('already voted')) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        )
      }
      if (error.message.includes('ended') || error.message.includes('no longer accepting')) {
        return NextResponse.json(
          { error: error.message },
          { status: 410 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to submit vote' },
      { status: 500 }
    )
  }
})
