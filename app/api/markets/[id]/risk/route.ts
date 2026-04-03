import { NextRequest, NextResponse } from 'next/server'
import { getMarketRisk } from '@/lib/intelligence/manipulation-detector'
import { withRateLimit } from '@/lib/middleware/rate-limit'

export const GET = withRateLimit(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    const risk = await getMarketRisk(id)

    return NextResponse.json(risk)
  } catch (error) {
    console.error('Error fetching market risk:', error)
    return NextResponse.json(
      { error: 'Failed to fetch market risk' },
      { status: 500 }
    )
  }
})
