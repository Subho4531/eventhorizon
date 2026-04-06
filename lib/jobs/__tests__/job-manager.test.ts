/**
 * Tests for job manager
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { jobManager } from '../job-manager'
import { prisma } from '@/lib/prisma'

describe('JobManager', () => {
  beforeEach(() => {
    // Mock Prisma queries that jobs will make on startup
    vi.mocked(prisma.market.findMany).mockResolvedValue([])
    vi.mocked(prisma.market.aggregate).mockResolvedValue({
      _sum: { yesPool: 5000, noPool: 5000 }
    } as any)
  })

  afterEach(() => {
    // Clean up after each test
    jobManager.stopAll()
    vi.clearAllMocks()
  })

  it('should start all jobs', async () => {
    jobManager.startAll()
    
    // Wait for async initialization - jobs set intervals immediately but run async
    await new Promise(resolve => setTimeout(resolve, 200))
    
    const status = jobManager.getStatus()
    
    expect(status.started).toBe(true)
    expect(status.jobs.probabilityUpdater.running).toBe(true)
    expect(status.jobs.liquidityAdjuster.running).toBe(true)
    expect(status.jobs.qualityUpdater.running).toBe(true)
    expect(status.jobs.manipulationMonitor.running).toBe(true)
  })

  it('should stop all jobs', () => {
    jobManager.startAll()
    jobManager.stopAll()
    const status = jobManager.getStatus()
    
    expect(status.started).toBe(false)
    expect(status.jobs.probabilityUpdater.running).toBe(false)
    expect(status.jobs.liquidityAdjuster.running).toBe(false)
    expect(status.jobs.qualityUpdater.running).toBe(false)
    expect(status.jobs.manipulationMonitor.running).toBe(false)
  })

  it('should report healthy when all jobs running', async () => {
    jobManager.startAll()
    
    // Wait for async initialization - jobs set intervals immediately but run async
    await new Promise(resolve => setTimeout(resolve, 200))
    
    expect(jobManager.isHealthy()).toBe(true)
  })

  it('should report unhealthy when jobs not started', () => {
    expect(jobManager.isHealthy()).toBe(false)
  })

  it('should not start jobs twice', () => {
    jobManager.startAll()
    const consoleSpy = vi.spyOn(console, 'log')
    
    jobManager.startAll()
    
    expect(consoleSpy).toHaveBeenCalledWith('[JobManager] Jobs already started')
    consoleSpy.mockRestore()
  })
})
