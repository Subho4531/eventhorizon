import { NextRequest, NextResponse } from 'next/server'
import { getOracleMetrics } from '@/lib/intelligence/reputation-system'
import { withRateLimit } from '@/lib/middleware/rate-limit'

export const GET = withRateLimit(async (
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) => {
  try {
    const { address } = await params

    if (!address) {
      return NextResponse.json(
        { error: 'Oracle address is required' },
        { status: 400 }
      )
    }

    const metrics = await getOracleMetrics(address)

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching oracle reliability:', error)

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Oracle not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch oracle reliability' },
      { status: 500 }
    )
  }
})
