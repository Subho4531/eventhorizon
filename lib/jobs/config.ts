/**
 * Job configuration
 * Allows environment-specific job settings
 */

export interface JobConfig {
  probabilityUpdater: {
    enabled: boolean
    interval: number
    batchSize: number
  }
  liquidityAdjuster: {
    enabled: boolean
    interval: number
    batchSize: number
  }
  qualityUpdater: {
    enabled: boolean
    interval: number
    batchSize: number
  }
  manipulationMonitor: {
    enabled: boolean
    pollInterval: number
    maxLatency: number
  }
}

const isDevelopment = process.env.NODE_ENV === 'development'
const isTest = process.env.NODE_ENV === 'test'
const isVercel = process.env.VERCEL === '1' || !!process.env.VERCEL_URL

// Default configuration
// Disable background jobs in Vercel to avoid connection pool exhaustion
export const defaultJobConfig: JobConfig = {
  probabilityUpdater: {
    enabled: !isTest && !isVercel, // Disable in tests and Vercel
    interval: isDevelopment ? 60000 : 30000, // 60s in dev, 30s in prod
    batchSize: 20
  },
  liquidityAdjuster: {
    enabled: !isTest && !isVercel,
    interval: isDevelopment ? 600000 : 300000, // 10min in dev, 5min in prod
    batchSize: 50
  },
  qualityUpdater: {
    enabled: !isTest && !isVercel,
    interval: isDevelopment ? 7200000 : 3600000, // 2h in dev, 1h in prod
    batchSize: 100
  },
  manipulationMonitor: {
    enabled: !isTest && !isVercel,
    pollInterval: isDevelopment ? 10000 : 5000, // 10s in dev, 5s in prod
    maxLatency: 10000
  }
}

// Allow environment variable overrides
export function getJobConfig(): JobConfig {
  return {
    probabilityUpdater: {
      enabled: process.env.PROBABILITY_UPDATER_ENABLED !== 'false' && defaultJobConfig.probabilityUpdater.enabled,
      interval: parseInt(process.env.PROBABILITY_UPDATER_INTERVAL || '') || defaultJobConfig.probabilityUpdater.interval,
      batchSize: parseInt(process.env.PROBABILITY_UPDATER_BATCH_SIZE || '') || defaultJobConfig.probabilityUpdater.batchSize
    },
    liquidityAdjuster: {
      enabled: process.env.LIQUIDITY_ADJUSTER_ENABLED !== 'false' && defaultJobConfig.liquidityAdjuster.enabled,
      interval: parseInt(process.env.LIQUIDITY_ADJUSTER_INTERVAL || '') || defaultJobConfig.liquidityAdjuster.interval,
      batchSize: parseInt(process.env.LIQUIDITY_ADJUSTER_BATCH_SIZE || '') || defaultJobConfig.liquidityAdjuster.batchSize
    },
    qualityUpdater: {
      enabled: process.env.QUALITY_UPDATER_ENABLED !== 'false' && defaultJobConfig.qualityUpdater.enabled,
      interval: parseInt(process.env.QUALITY_UPDATER_INTERVAL || '') || defaultJobConfig.qualityUpdater.interval,
      batchSize: parseInt(process.env.QUALITY_UPDATER_BATCH_SIZE || '') || defaultJobConfig.qualityUpdater.batchSize
    },
    manipulationMonitor: {
      enabled: process.env.MANIPULATION_MONITOR_ENABLED !== 'false' && defaultJobConfig.manipulationMonitor.enabled,
      pollInterval: parseInt(process.env.MANIPULATION_MONITOR_POLL_INTERVAL || '') || defaultJobConfig.manipulationMonitor.pollInterval,
      maxLatency: parseInt(process.env.MANIPULATION_MONITOR_MAX_LATENCY || '') || defaultJobConfig.manipulationMonitor.maxLatency
    }
  }
}
