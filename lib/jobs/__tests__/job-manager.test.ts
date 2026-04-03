/**
 * Tests for job manager
 */

import { jobManager } from '../job-manager'

describe('JobManager', () => {
  afterEach(() => {
    // Clean up after each test
    jobManager.stopAll()
  })

  it('should start all jobs', () => {
    jobManager.startAll()
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

  it('should report healthy when all jobs running', () => {
    jobManager.startAll()
    expect(jobManager.isHealthy()).toBe(true)
  })

  it('should report unhealthy when jobs not started', () => {
    expect(jobManager.isHealthy()).toBe(false)
  })

  it('should not start jobs twice', () => {
    jobManager.startAll()
    const consoleSpy = jest.spyOn(console, 'log')
    
    jobManager.startAll()
    
    expect(consoleSpy).toHaveBeenCalledWith('[JobManager] Jobs already started')
    consoleSpy.mockRestore()
  })
})
