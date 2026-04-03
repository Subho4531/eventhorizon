/**
 * Background job to update market quality scores
 * Runs every 3600 seconds (1 hour)
 */

import { prisma } from '@/lib/prisma'
import { calculateQualityScore } from '@/lib/intelligence/quality-scorer'

interface UpdaterConfig {
  interval: number // milliseconds
  batchSize: number
  enabled: boolean
}

class QualityUpdater {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning: boolean = false
  private lastUpdate: Date | null = null
  private config: UpdaterConfig
  private cycleCount: number = 0

  constructor(config: Partial<UpdaterConfig> = {}) {
    this.config = {
      interval: 3600000, // 3600 seconds = 1 hour
      batchSize: 100,
      enabled: true,
      ...config
    }
  }

  /**
   * Start the quality updater job
   */
  start(): void {
    if (this.intervalId) {
      console.log('[QualityUpdater] Already running')
      return
    }

    if (!this.config.enabled) {
      console.log('[QualityUpdater] Disabled by configuration')
      return
    }

    console.log(`[QualityUpdater] Starting with ${this.config.interval}ms interval`)
    
    // Run immediately on start
    this.run().catch(error => {
      console.error('[QualityUpdater] Initial run failed:', error)
    })

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.run().catch(error => {
        console.error('[QualityUpdater] Run failed:', error)
      })
    }, this.config.interval)
  }

  /**
   * Stop the quality updater job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[QualityUpdater] Stopped')
    }
  }

  /**
   * Execute one update cycle
   */
  private async run(): Promise<void> {
    if (this.isRunning) {
      console.log('[QualityUpdater] Skipping cycle - previous run still in progress')
      return
    }

    this.isRunning = true
    this.cycleCount++
    const startTime = Date.now()

    try {
      // Get all active markets
      const markets = await prisma.market.findMany({
        where: {
          status: 'ACTIVE'
        },
        select: {
          id: true
        }
      })

      if (markets.length === 0) {
        console.log('[QualityUpdater] No active markets to update')
        this.isRunning = false
        return
      }

      console.log(`[QualityUpdater] Updating quality scores for ${markets.length} markets`)

      // Process in batches
      await this.processBatches(markets.map(m => m.id))

      const duration = Date.now() - startTime
      this.lastUpdate = new Date()
      
      console.log(`[QualityUpdater] Cycle ${this.cycleCount} completed in ${duration}ms`)
    } catch (error) {
      console.error('[QualityUpdater] Error during update cycle:', error)
      
      // Exponential backoff on error
      await this.handleError(error)
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Process markets in batches
   */
  private async processBatches(marketIds: string[]): Promise<void> {
    const batches = this.createBatches(marketIds, this.config.batchSize)
    
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i]
      console.log(`[QualityUpdater] Processing batch ${i + 1}/${batches.length} (${batch.length} markets)`)
      
      await Promise.allSettled(
        batch.map(marketId => this.updateMarketQuality(marketId))
      )
    }
  }

  /**
   * Update quality score for a single market
   */
  private async updateMarketQuality(marketId: string): Promise<void> {
    try {
      const qualityScore = await calculateQualityScore(marketId)

      // Update market with new quality score
      await prisma.market.update({
        where: { id: marketId },
        data: {
          qualityScore
        }
      })
    } catch (error) {
      console.error(`[QualityUpdater] Failed to update market ${marketId}:`, error)
      // Continue with other markets
    }
  }

  /**
   * Create batches from array
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = []
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }
    return batches
  }

  /**
   * Handle errors with exponential backoff
   */
  private async handleError(error: any): Promise<void> {
    const backoffMs = Math.min(1000 * Math.pow(2, Math.min(this.cycleCount % 5, 4)), 30000)
    console.log(`[QualityUpdater] Backing off for ${backoffMs}ms`)
    await new Promise(resolve => setTimeout(resolve, backoffMs))
  }

  /**
   * Get updater status
   */
  getStatus() {
    return {
      running: this.intervalId !== null,
      isProcessing: this.isRunning,
      lastUpdate: this.lastUpdate,
      cycleCount: this.cycleCount,
      config: this.config
    }
  }
}

// Singleton instance
export const qualityUpdater = new QualityUpdater()
