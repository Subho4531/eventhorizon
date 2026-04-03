import { NextRequest, NextResponse } from 'next/server'
import { calculateQualityScore, getQualityBreakdown } from '@/lib/intelligence/quality-scorer'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const score = await calculateQualityScore(id)
    const breakdown = await getQualityBreakdown(id)

    return NextResponse.json({
      score,
      breakdown
    })
  } catch (error) {
    console.error('Error fetching quality score:', error)
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Market not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to calculate quality score' },
      { status: 500 }
    )
  }
}
