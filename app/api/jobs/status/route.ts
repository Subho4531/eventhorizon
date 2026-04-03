/**
 * API endpoint to check background job status
 * GET /api/jobs/status
 */

import { NextResponse } from 'next/server'
import { jobManager } from '@/lib/jobs/job-manager'

export async function GET() {
  try {
    const status = jobManager.getStatus()
    const isHealthy = jobManager.isHealthy()

    return NextResponse.json({
      healthy: isHealthy,
      ...status
    })
  } catch (error) {
    console.error('[JobStatus] Error fetching status:', error)
    return NextResponse.json(
      { error: 'Failed to fetch job status' },
      { status: 500 }
    )
  }
}
