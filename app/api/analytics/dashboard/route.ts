import { NextResponse } from 'next/server'
import { getDashboardMetrics } from '@/lib/intelligence/analytics-dashboard'
import { withRateLimit } from '@/lib/middleware/rate-limit'

export const GET = withRateLimit(async () => {
  try {
    const metrics = await getDashboardMetrics()

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error)
    
    return NextResponse.json(
      { error: 'Failed to fetch dashboard metrics' },
      { status: 500 }
    )
  }
})
