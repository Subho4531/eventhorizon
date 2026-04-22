/**
 * Background job to update market probability estimates
 * Updates markets closing within 24h every 30s, others every 60s
 */

import { prisma } from '@/lib/prisma'
import { updateProbability } from '@/lib/intelligence/probability-model'

interface UpdaterConfig {
  interval: number // milliseconds
  batchSize: number
  enabled: boolean
}

class ProbabilityUpdater {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning: boolean = false
  private lastUpdate: Date | null = null
  private config: UpdaterConfig
  private cycleCount: number = 0

  constructor(config: Partial<UpdaterConfig> = {}) {
    this.config = {
      interval: 30000, // 30 seconds
      batchSize: 20,
      enabled: true,
      ...config
    }
  }

  /**
   * Start the probability updater job
   */
  start(): void {
    if (this.intervalId) {
      console.log('[ProbabilityUpdater] Already running')
      return
    }

    if (!this.config.enabled) {
      console.log('[ProbabilityUpdater] Disabled by configuration')
      return
    }

    console.log(`[ProbabilityUpdater] Starting with ${this.config.interval}ms interval`)
    
    // Run immediately on start
    this.run().catch(error => {
      console.error('[ProbabilityUpdater] Initial run failed:', error)
    })

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.run().catch(error => {
        console.error('[ProbabilityUpdater] Run failed:', error)
      })
    }, this.config.interval)
  }

  /**
   * Stop the probability updater job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[ProbabilityUpdater] Stopped')
    }
  }

  /**
   * Execute one update cycle
   */
  private async run(): Promise<void> {
    if (this.isRunning) {
      console.log('[ProbabilityUpdater] Skipping cycle - previous run still in progress')
      return
    }

    this.isRunning = true
    this.cycleCount++
    const startTime = Date.now()

    try {
      // Get active markets (OPEN status)
      const markets = await prisma.market.findMany({
        where: {
          status: 'OPEN'
        },
        select: {
          id: true,
          closeDate: true
        }
      })

      if (markets.length === 0) {
        console.log('[ProbabilityUpdater] No active markets to update')
        this.isRunning = false
        return
      }

      const now = new Date()
      const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      // Separate markets by urgency
      const urgentMarkets = markets.filter(m => 
        new Date(m.closeDate) <= twentyFourHoursFromNow
      )
      const normalMarkets = markets.filter(m => 
        new Date(m.closeDate) > twentyFourHoursFromNow
      )

      // Update urgent markets every cycle
      // Update normal markets every other cycle (effectively 60s interval)
      const marketsToUpdate = [
        ...urgentMarkets,
        ...(this.cycleCount % 2 === 0 ? normalMarkets : [])
      ]

      console.log(`[ProbabilityUpdater] Updating ${marketsToUpdate.length} markets (${urgentMarkets.length} urgent, ${this.cycleCount % 2 === 0 ? normalMarkets.length : 0} normal)`)

      // Process in batches
      await this.processBatches(marketsToUpdate.map(m => m.id))

      const duration = Date.now() - startTime
      this.lastUpdate = new Date()
      
      console.log(`[ProbabilityUpdater] Cycle ${this.cycleCount} completed in ${duration}ms`)
    } catch (error) {
      console.error('[ProbabilityUpdater] Error during update cycle:', error)
      
      // Exponential backoff on error
      await this.handleError()
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
      console.log(`[ProbabilityUpdater] Processing batch ${i + 1}/${batches.length} (${batch.length} markets)`)
      
      await Promise.allSettled(
        batch.map(marketId => this.updateMarketProbability(marketId))
      )
    }
  }

  /**
   * Update probability for a single market
   */
  private async updateMarketProbability(marketId: string): Promise<void> {
    try {
      await updateProbability(marketId)
    } catch (error) {
      console.error(`[ProbabilityUpdater] Failed to update market ${marketId}:`, error)
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
  private async handleError(): Promise<void> {
    const backoffMs = Math.min(1000 * Math.pow(2, Math.min(this.cycleCount % 5, 4)), 30000)
    console.log(`[ProbabilityUpdater] Backing off for ${backoffMs}ms`)
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
export const probabilityUpdater = new ProbabilityUpdater()
