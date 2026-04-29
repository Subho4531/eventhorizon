/**
 * Server initialization
 * Starts background jobs and performs startup checks
 */

import { jobManager } from './jobs/job-manager'

const globalForServer = globalThis as unknown as {
  initialized: boolean | undefined;
};

export function initializeServer() {
  if (globalForServer.initialized) {
    console.log('[ServerInit] Already initialized');
    return;
  }

  console.log('[ServerInit] Initializing server...')

  try {
    // Start background jobs
    jobManager.startAll()

    globalForServer.initialized = true
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
