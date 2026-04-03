import { NextRequest, NextResponse } from 'next/server'
import { getRecentAlerts } from '@/lib/intelligence/alert-system'
import { withRateLimit } from '@/lib/middleware/rate-limit'

export const GET = withRateLimit(async (request: NextRequest) => {
  try {
    const searchParams = request.nextUrl.searchParams
    const hours = parseInt(searchParams.get('hours') || '24', 10)

    const alerts = await getRecentAlerts(hours)

    return NextResponse.json({ alerts })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
})
