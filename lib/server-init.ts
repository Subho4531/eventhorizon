/**
 * Server initialization
 * Starts background jobs and performs startup checks
 */

import { jobManager } from './jobs/job-manager'

let initialized = false

export function initializeServer() {
  if (initialized) {
    console.log('[ServerInit] Already initialized')
    return
  }

  console.log('[ServerInit] Initializing server...')

  try {
    // Start background jobs
    jobManager.startAll()

    initialized = true
    console.log('[ServerInit] Server initialized successfully')
  } catch (error) {
    console.error('[ServerInit] Failed to initialize server:', error)
    throw error
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[ServerInit] SIGTERM received, shutting down gracefully...')
  jobManager.stopAll()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('[ServerInit] SIGINT received, shutting down gracefully...')
  jobManager.stopAll()
  process.exit(0)
})
