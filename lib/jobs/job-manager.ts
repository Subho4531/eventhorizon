/**
 * Job manager to coordinate all background jobs
 * Starts jobs on server startup and provides status monitoring
 */

import { probabilityUpdater } from './probability-updater'
import { liquidityAdjuster } from './liquidity-adjuster'
import { qualityUpdater } from './quality-updater'
import { manipulationMonitor } from './manipulation-monitor'
import { getJobConfig } from './config'

class JobManager {
  private started: boolean = false
  private config = getJobConfig()

  /**
   * Start all background jobs
   */
  startAll(): void {
    if (this.started) {
      console.log('[JobManager] Jobs already started')
      return
    }

    console.log('[JobManager] Starting all background jobs...')

    try {
      if (this.config.probabilityUpdater.enabled) {
        probabilityUpdater.start()
      }
      if (this.config.liquidityAdjuster.enabled) {
        liquidityAdjuster.start()
      }
      if (this.config.qualityUpdater.enabled) {
        qualityUpdater.start()
      }
      if (this.config.manipulationMonitor.enabled) {
        manipulationMonitor.start()
      }

      this.started = true
      console.log('[JobManager] All background jobs started successfully')
    } catch (error) {
      console.error('[JobManager] Failed to start jobs:', error)
      throw error
    }
  }

  /**
   * Stop all background jobs
   */
  stopAll(): void {
    if (!this.started) {
      console.log('[JobManager] Jobs not running')
      return
    }

    console.log('[JobManager] Stopping all background jobs...')

    try {
      probabilityUpdater.stop()
      liquidityAdjuster.stop()
      qualityUpdater.stop()
      manipulationMonitor.stop()

      this.started = false
      console.log('[JobManager] All background jobs stopped successfully')
    } catch (error) {
      console.error('[JobManager] Failed to stop jobs:', error)
      throw error
    }
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    return {
      started: this.started,
      jobs: {
        probabilityUpdater: probabilityUpdater.getStatus(),
        liquidityAdjuster: liquidityAdjuster.getStatus(),
        qualityUpdater: qualityUpdater.getStatus(),
        manipulationMonitor: manipulationMonitor.getStatus()
      }
    }
  }

  /**
   * Check if all jobs are healthy
   */
  isHealthy(): boolean {
    if (!this.started) {
      return false
    }

    const status = this.getStatus()
    return (
      status.jobs.probabilityUpdater.running &&
      status.jobs.liquidityAdjuster.running &&
      status.jobs.qualityUpdater.running &&
      status.jobs.manipulationMonitor.running
    )
  }
}

// Singleton instance
export const jobManager = new JobManager()
