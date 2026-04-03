import { NextRequest, NextResponse } from 'next/server'
import { getLiquidityParams } from '@/lib/intelligence/liquidity-manager'
import { withRateLimit } from '@/lib/middleware/rate-limit'

export const GET = withRateLimit(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) => {
  try {
    const { id } = await params

    const liquidityParams = await getLiquidityParams(id)

    return NextResponse.json(liquidityParams)
  } catch (error) {
    console.error('Error fetching liquidity params:', error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch liquidity parameters' },
      { status: 500 }
    )
  }
})
