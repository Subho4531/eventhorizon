/**
 * API endpoint to manually trigger background jobs
 * Useful for Vercel Cron jobs or manual updates
 * POST /api/jobs/trigger
 */

import { NextRequest, NextResponse } from 'next/server'
import { probabilityUpdater } from '@/lib/jobs/probability-updater'
import { liquidityAdjuster } from '@/lib/jobs/liquidity-adjuster'
import { qualityUpdater } from '@/lib/jobs/quality-updater'
import { manipulationMonitor } from '@/lib/jobs/manipulation-monitor'

export async function POST(req: NextRequest) {
  // Simple auth check using AGENT_API_KEY if provided
  const authHeader = req.headers.get('authorization')
  if (process.env.AGENT_API_KEY && authHeader !== `Bearer ${process.env.AGENT_API_KEY}`) {
    // Also allow Vercel Cron secret if configured
    const cronSecret = req.headers.get('x-vercel-cron-auth')
    if (!cronSecret || cronSecret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const { searchParams } = new URL(req.url)
  const job = searchParams.get('job') || 'all'

  try {
    const results: Record<string, any> = {}

    if (job === 'all' || job === 'probability') {
      results.probability = await (probabilityUpdater as any).updateAll()
    }
    if (job === 'all' || job === 'liquidity') {
      results.liquidity = await (liquidityAdjuster as any).adjustAll()
    }
    if (job === 'all' || job === 'quality') {
      results.quality = await (qualityUpdater as any).updateAll()
    }
    if (job === 'all' || job === 'monitor') {
      results.monitor = await (manipulationMonitor as any).monitorAll()
    }

    return NextResponse.json({
      success: true,
      message: `Triggered job: ${job}`,
      results
    })
  } catch (error: any) {
    console.error(`[JobTrigger] Error triggering ${job}:`, error)
    return NextResponse.json(
      { error: error.message || 'Failed to trigger job' },
      { status: 500 }
    )
  }
}
