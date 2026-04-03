import { NextRequest, NextResponse } from 'next/server'
import { finalizeDispute } from '@/lib/intelligence/dispute-resolution'

/**
 * POST /api/disputes/[id]/finalize
 * Finalize a dispute after voting period ends
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: disputeId } = await params
    
    const result = await finalizeDispute(disputeId)

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('Error finalizing dispute:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: error.message },
          { status: 404 }
        )
      }
      if (error.message.includes('already been finalized')) {
        return NextResponse.json(
          { error: error.message },
          { status: 409 }
        )
      }
      if (error.message.includes('has not ended')) {
        return NextResponse.json(
          { error: error.message },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Failed to finalize dispute' },
      { status: 500 }
    )
  }
}
