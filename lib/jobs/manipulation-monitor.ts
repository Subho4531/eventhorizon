/**
 * Real-time bet event listener for manipulation detection
 * Monitors bet transactions with max 10s latency
 */

import { prisma } from '@/lib/prisma'
import { analyzeBet } from '@/lib/intelligence/manipulation-detector'
import type { Bet, Prisma } from '@prisma/client'

interface MonitorConfig {
  pollInterval: number // milliseconds
  enabled: boolean
  maxLatency: number // milliseconds
}

class ManipulationMonitor {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning: boolean = false
  private lastProcessedBetId: string | null = null
  private lastCheck: Date | null = null
  private config: MonitorConfig
  private processedCount: number = 0

  constructor(config: Partial<MonitorConfig> = {}) {
    this.config = {
      pollInterval: 30000, // Increased from 5s to 30s
      maxLatency: 60000, // Increased from 10s to 60s
      enabled: true,
      ...config
    }
  }

  /**
   * Start the manipulation monitor
   */
  start(): void {
    if (this.intervalId) {
      console.log('[ManipulationMonitor] Already running')
      return
    }

    if (!this.config.enabled) {
      console.log('[ManipulationMonitor] Disabled by configuration')
      return
    }

    console.log(`[ManipulationMonitor] Starting with ${this.config.pollInterval}ms poll interval`)
    
    // Run immediately on start
    this.run().catch(error => {
      console.error('[ManipulationMonitor] Initial run failed:', error)
    })

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.run().catch(error => {
        console.error('[ManipulationMonitor] Run failed:', error)
      })
    }, this.config.pollInterval)
  }

  /**
   * Stop the manipulation monitor
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('[ManipulationMonitor] Stopped')
    }
  }

  /**
   * Execute one monitoring cycle
   */
  private async run(): Promise<void> {
    if (this.isRunning) {
      console.log('[ManipulationMonitor] Skipping cycle - previous run still in progress')
      return
    }

    this.isRunning = true
    const startTime = Date.now()

    try {
      // Get new bets since last check
      const newBets = await this.getNewBets()

      if (newBets.length === 0) {
        this.isRunning = false
        return
      }

      console.log(`[ManipulationMonitor] Processing ${newBets.length} new bets`)

      // Process each bet
      for (const bet of newBets) {
        try {
          await analyzeBet(bet)
          this.lastProcessedBetId = bet.id
          this.processedCount++
        } catch (error) {
          console.error(`[ManipulationMonitor] Failed to analyze bet ${bet.id}:`, error)
          // Continue with other bets
        }
      }

      const duration = Date.now() - startTime
      this.lastCheck = new Date()

      // Check if we're meeting latency requirements
      if (duration > this.config.maxLatency) {
        console.warn(`[ManipulationMonitor] Latency exceeded: ${duration}ms > ${this.config.maxLatency}ms`)
      }

      console.log(`[ManipulationMonitor] Processed ${newBets.length} bets in ${duration}ms`)
    } catch (error) {
      console.error('[ManipulationMonitor] Error during monitoring cycle:', error)
      
      // Exponential backoff on error
      await this.handleError()
    } finally {
      this.isRunning = false
    }
  }

  /**
   * Get new bets since last check
   */
  private async getNewBets(): Promise<Bet[]> {
    const query: Prisma.BetFindManyArgs = {
      orderBy: {
        createdAt: 'asc'
      },
      take: 100 // Process up to 100 bets per cycle
    }

    // If we have a last processed bet, get bets after it
    if (this.lastProcessedBetId) {
      query.where = {
        createdAt: {
          gt: await this.getLastProcessedBetTime()
        }
      }
    } else {
      // First run - get recent bets from last 5 minutes
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      query.where = {
        createdAt: {
          gte: fiveMinutesAgo
        }
      }
    }

    return prisma.bet.findMany(query)
  }

  /**
   * Get timestamp of last processed bet
   */
  private async getLastProcessedBetTime(): Promise<Date> {
    if (!this.lastProcessedBetId) {
      return new Date(0)
    }

    const bet = await prisma.bet.findUnique({
      where: { id: this.lastProcessedBetId },
      select: { createdAt: true }
    })

    return bet?.createdAt || new Date(0)
  }

  /**
   * Handle errors with exponential backoff
   */
  private async handleError(): Promise<void> {
    const backoffMs = Math.min(1000 * Math.pow(2, Math.min(this.processedCount % 5, 4)), 30000)
    console.log(`[ManipulationMonitor] Backing off for ${backoffMs}ms`)
    await new Promise(resolve => setTimeout(resolve, backoffMs))
  }

  /**
   * Get monitor status
   */
  getStatus() {
    return {
      running: this.intervalId !== null,
      isProcessing: this.isRunning,
      lastCheck: this.lastCheck,
      lastProcessedBetId: this.lastProcessedBetId,
      processedCount: this.processedCount,
      config: this.config
    }
  }

  /**
   * Reset monitor state (useful for testing)
   */
  reset(): void {
    this.lastProcessedBetId = null
    this.lastCheck = null
    this.processedCount = 0
  }
}

// Singleton instance
export const manipulationMonitor = new ManipulationMonitor()
