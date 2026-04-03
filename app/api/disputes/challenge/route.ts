import { NextRequest, NextResponse } from 'next/server'
import { submitChallenge, ChallengeParams } from '@/lib/intelligence/dispute-resolution'
import { withRateLimit } from '@/lib/middleware/rate-limit'

/**
 * POST /api/disputes/challenge
 * Submit a challenge to a market resolution
 */
export const POST = withRateLimit(async (request: NextRequest) => {
  try {
    const body = await request.json()

    const params: ChallengeParams = {
      marketId: body.marketId,
      challengerAddress: body.challengerAddress,
      evidence: {
        description: body.evidence.description,
        urls: body.evidence.urls || []
      },
      proposedOutcome: body.proposedOutcome,
      bond: body.bond
    }

    // Validate required fields
    if (!params.marketId || !params.challengerAddress || !params.proposedOutcome) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    if (params.proposedOutcome !== 'YES' && params.proposedOutcome !== 'NO') {
      return NextResponse.json(
        { error: 'Proposed outcome must be YES or NO' },
        { status: 400 }
      )
    }

    const result = await submitChallenge(params)

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Error submitting challenge:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('already submitted')) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        )
      }
      if (error.message.includes('must be exactly')) {
        return NextResponse.json(
          { error: error.message },
          { status: 402 }
        )
      }
      if (error.message.includes('must not exceed') || error.message.includes('at most')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
      if (error.message.includes('must be resolved')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to submit challenge' },
      { status: 500 }
    )
  }
})
