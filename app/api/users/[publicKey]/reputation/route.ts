import { NextRequest, NextResponse } from 'next/server'
import { getUserReputation } from '@/lib/intelligence/reputation-system'
import { withRateLimit } from '@/lib/middleware/rate-limit'

export const GET = withRateLimit(async (
  request: NextRequest,
  { params }: { params: Promise<{ publicKey: string }> }
) => {
  try {
    const { publicKey } = await params

    if (!publicKey) {
      return NextResponse.json(
        { error: 'Public key is required' },
        { status: 400 }
      )
    }

    const reputation = await getUserReputation(publicKey)

    return NextResponse.json(reputation)
  } catch (error) {
    console.error('Error fetching user reputation:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch user reputation' },
      { status: 500 }
    )
  }
})
