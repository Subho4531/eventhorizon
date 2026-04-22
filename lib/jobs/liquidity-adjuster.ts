/**
 * Background job to recalculate liquidity parameters
 * Runs every 300 seconds (5 minutes)
 */

import { prisma } from '@/lib/prisma'
import { 
  calculateMinBetSize, 
  getIncentiveMultiplier, 
  adjustBondRequirement 
} from '@/lib/intelligence/liquidity-manager'

interface AdjusterConfig {
  interval: number // milliseconds
  batchSize: number
  enabled: boolean
}

class LiquidityAdjuster {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning: boolean = false
  private lastUpdate: Date | null = null
  private config: AdjusterConfig
  private cycleCount: number = 0

  constructor(config: Partial<AdjusterConfig> = {}) {
    this.config = {
      interval: 300000, // 300 seconds = 5 minutes
      batchSize: 50,
      enabled: true,
      ...config
    }
  }

  /**
   * Start the liquidity adjuster job
   */
  start(): void {
    if (this.intervalId) {
      console.log('[LiquidityAdjuster] Already running')
      return
    }

    if (!this.config.enabled) {
      console.log('[LiquidityAdjuster] Disabled by configuration')
      return
    }

    console.log(`[LiquidityAdjuster] Starting with ${this.config.interval}ms interval`)
    
    // Run immediately on start
    this.run().catch(error => {
      console.error('[LiquidityAdjuster] Initial run failed:', error)
    })

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.run().catch(error => {
        console.error('[LiquidityAdjuster] Run failed:', error)
      })
    }, this.config.interval)
  }

  /**
   * Stop the liquidity adjuster job
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[LiquidityAdjuster] Stopped')
    }
  }

  /**
   * Execute one adjustment cycle
   */
  private async run(): Promise<void> {
    if (this.isRunning) {
      console.log('[LiquidityAdjuster] Skipping cycle - previous run still in progress')
      return
    }

    this.isRunning = true
    this.cycleCount++
    const startTime = Date.now()

    try {
      // Get all active markets (OPEN status)
      const markets = await prisma.market.findMany({
        where: {
          status: 'OPEN'
        },
        select: {
          id: true
        }
      })

      if (markets.length === 0) {
        console.log('[LiquidityAdjuster] No active markets to adjust')
        this.isRunning = false
        return
      }

      console.log(`[LiquidityAdjuster] Adjusting liquidity for ${markets.length} markets`)

      // Process in batches
      await this.processBatches(markets.map(m => m.id))

      const duration = Date.now() - startTime
      this.lastUpdate = new Date()
      
      console.log(`[LiquidityAdjuster] Cycle ${this.cycleCount} completed in ${duration}ms`)
    } catch (error: unknown) {
      console.error('[LiquidityAdjuster] Error during adjustment cycle:', error)
      
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
      console.log(`[LiquidityAdjuster] Processing batch ${i + 1}/${batches.length} (${batch.length} markets)`)
      
      await Promise.allSettled(
        batch.map(marketId => this.adjustMarketLiquidity(marketId))
      )
    }
  }

  /**
   * Adjust liquidity parameters for a single market
   */
  private async adjustMarketLiquidity(marketId: string): Promise<void> {
    try {
      // Calculate new parameters
      const minBetSize = await calculateMinBetSize(marketId)
      const incentiveMultiplier = await getIncentiveMultiplier(marketId)
      await adjustBondRequirement(marketId)

      // Update market with new parameters
      await prisma.market.update({
        where: { id: marketId },
        data: {
          minBetSize,
          incentiveMultiplier,
          // Note: bondRequirement affects new markets, not stored per market
        }
      })
    } catch (error: unknown) {
      console.error(`[LiquidityAdjuster] Failed to adjust market ${marketId}:`, error)
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
  private async handleError(_error: unknown): Promise<void> {
    const backoffMs = Math.min(1000 * Math.pow(2, Math.min(this.cycleCount % 5, 4)), 30000)
    console.log(`[LiquidityAdjuster] Backing off for ${backoffMs}ms`)
    await new Promise(resolve => setTimeout(resolve, backoffMs))
  }

  /**
   * Get adjuster status
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
export const liquidityAdjuster = new LiquidityAdjuster()
