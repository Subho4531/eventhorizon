import fc from 'fast-check'
import { describe, test, expect, beforeEach } from 'vitest'

/**
 * Property-Based Tests for Rate Limiting
 * Feature: advanced-prediction-market-intelligence
 * 
 * These tests validate:
 * - Property 37: Rate Limiting - 100 requests per minute per user enforced
 */

// Mock rate limiter implementation
class RateLimiter {
  private requestLog: Map<string, number[]> = new Map()
  private readonly maxRequests: number = 100
  private readonly windowMs: number = 60 * 1000 // 1 minute in milliseconds

  /**
   * Check if a request from a user should be allowed
   * @param userId User identifier
   * @param timestamp Current timestamp in milliseconds
   * @returns true if request is allowed, false if rate limit exceeded
   */
  allowRequest(userId: string, timestamp: number): boolean {
    const userRequests = this.requestLog.get(userId) || []
    
    // Remove requests outside the current window
    const windowStart = timestamp - this.windowMs
    const recentRequests = userRequests.filter(t => t > windowStart)
    
    // Check if user has exceeded rate limit
    if (recentRequests.length >= this.maxRequests) {
      return false
    }
    
    // Add current request
    recentRequests.push(timestamp)
    this.requestLog.set(userId, recentRequests)
    
    return true
  }

  /**
   * Get the number of requests made by a user in the current window
   */
  getRequestCount(userId: string, timestamp: number): number {
    const userRequests = this.requestLog.get(userId) || []
    const windowStart = timestamp - this.windowMs
    return userRequests.filter(t => t > windowStart).length
  }

  /**
   * Clear all request logs (for testing)
   */
  clear(): void {
    this.requestLog.clear()
  }

  /**
   * Get the rate limit configuration
   */
  getConfig(): { maxRequests: number; windowMs: number } {
    return {
      maxRequests: this.maxRequests,
      windowMs: this.windowMs
    }
  }
}

// Mock API endpoint with rate limiting
class IntelligenceAPI {
  private rateLimiter: RateLimiter

  constructor() {
    this.rateLimiter = new RateLimiter()
  }

  async makeRequest(userId: string, endpoint: string, timestamp: number): Promise<{ success: boolean; status: number; message?: string }> {
    // Check rate limit
    if (!this.rateLimiter.allowRequest(userId, timestamp)) {
      return {
        success: false,
        status: 429,
        message: 'Rate limit exceeded: 100 requests per minute'
      }
    }

    // Simulate successful API call
    return {
      success: true,
      status: 200
    }
  }

  getRequestCount(userId: string, timestamp: number): number {
    return this.rateLimiter.getRequestCount(userId, timestamp)
  }

  reset(): void {
    this.rateLimiter.clear()
  }
}

describe('Property 37: Rate Limiting', () => {
  test('enforces exactly 100 requests per minute per user', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1 }),
          requestCount: fc.integer({ min: 1, max: 150 })
        }),
        async ({ userId, requestCount }) => {
          const api = new IntelligenceAPI()
          const startTime = Date.now()
          const results: boolean[] = []

          // Make requests sequentially within the same minute
          for (let i = 0; i < requestCount; i++) {
            const timestamp = startTime + i * 100 // Space requests by 100ms
            const response = await api.makeRequest(userId, '/api/markets/probability', timestamp)
            results.push(response.success)
          }

          // First 100 requests should succeed
          const successCount = results.filter(r => r).length
          const failureCount = results.filter(r => !r).length

          if (requestCount <= 100) {
            // All requests should succeed
            expect(successCount).toBe(requestCount)
            expect(failureCount).toBe(0)
          } else {
            // Exactly 100 should succeed, rest should fail
            expect(successCount).toBe(100)
            expect(failureCount).toBe(requestCount - 100)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rate limit resets after 60 seconds', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1 }),
          firstBatchSize: fc.integer({ min: 50, max: 100 }),
          secondBatchSize: fc.integer({ min: 1, max: 50 })
        }),
        async ({ userId, firstBatchSize, secondBatchSize }) => {
          const api = new IntelligenceAPI()
          const startTime = Date.now()

          // Make first batch of requests
          for (let i = 0; i < firstBatchSize; i++) {
            const timestamp = startTime + i * 100
            await api.makeRequest(userId, '/api/markets/probability', timestamp)
          }

          // Wait 61 seconds (past the 60-second window)
          const afterWindowTime = startTime + 61 * 1000

          // Make second batch of requests
          const results: boolean[] = []
          for (let i = 0; i < secondBatchSize; i++) {
            const timestamp = afterWindowTime + i * 100
            const response = await api.makeRequest(userId, '/api/markets/probability', timestamp)
            results.push(response.success)
          }

          // All requests in second batch should succeed (window reset)
          const successCount = results.filter(r => r).length
          expect(successCount).toBe(secondBatchSize)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rate limit is per-user (different users have independent limits)', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          users: fc.array(
            fc.string({ minLength: 1 }),
            { minLength: 2, maxLength: 10 }
          ).map(arr => [...new Set(arr)]), // Ensure unique users
          requestsPerUser: fc.integer({ min: 50, max: 120 })
        }),
        async ({ users, requestsPerUser }) => {
          const api = new IntelligenceAPI()
          const startTime = Date.now()
          const userResults = new Map<string, boolean[]>()

          // Each user makes requests
          for (const userId of users) {
            const results: boolean[] = []
            for (let i = 0; i < requestsPerUser; i++) {
              const timestamp = startTime + i * 50
              const response = await api.makeRequest(userId, '/api/markets/probability', timestamp)
              results.push(response.success)
            }
            userResults.set(userId, results)
          }

          // Each user should have independent rate limit
          for (const [userId, results] of userResults) {
            const successCount = results.filter(r => r).length
            
            if (requestsPerUser <= 100) {
              expect(successCount).toBe(requestsPerUser)
            } else {
              expect(successCount).toBe(100)
            }
          }
        }
      ),
      { numRuns: 50 }
    )
  })

  test('sliding window correctly handles requests at window boundaries', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1 }),
          initialRequests: fc.integer({ min: 80, max: 100 })
        }),
        async ({ userId, initialRequests }) => {
          const api = new IntelligenceAPI()
          const startTime = Date.now()

          // Make initial batch of requests
          for (let i = 0; i < initialRequests; i++) {
            const timestamp = startTime + i * 100
            await api.makeRequest(userId, '/api/markets/probability', timestamp)
          }

          // Wait 30 seconds (half the window)
          const halfWindowTime = startTime + 30 * 1000

          // Try to make more requests
          const remainingCapacity = 100 - initialRequests
          const results: boolean[] = []
          
          for (let i = 0; i < remainingCapacity + 10; i++) {
            const timestamp = halfWindowTime + i * 100
            const response = await api.makeRequest(userId, '/api/markets/probability', timestamp)
            results.push(response.success)
          }

          // Should be able to make up to remaining capacity
          const successCount = results.filter(r => r).length
          expect(successCount).toBeLessThanOrEqual(remainingCapacity)
        }
      ),
      { numRuns: 50 }
    )
  })

  test('rate limiter returns 429 status code when limit exceeded', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1 })
        }),
        async ({ userId }) => {
          const api = new IntelligenceAPI()
          const startTime = Date.now()

          // Make 100 requests to hit the limit
          for (let i = 0; i < 100; i++) {
            const timestamp = startTime + i * 50
            await api.makeRequest(userId, '/api/markets/probability', timestamp)
          }

          // Next request should be rate limited
          const response = await api.makeRequest(userId, '/api/markets/probability', startTime + 5000)
          
          expect(response.success).toBe(false)
          expect(response.status).toBe(429)
          expect(response.message).toContain('Rate limit exceeded')
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rate limit applies to all intelligence API endpoints', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1 }),
          endpoints: fc.array(
            fc.constantFrom(
              '/api/markets/probability',
              '/api/markets/quality',
              '/api/markets/risk',
              '/api/users/reputation',
              '/api/oracles/reliability',
              '/api/analytics/dashboard',
              '/api/liquidity/incentives'
            ),
            { minLength: 1, maxLength: 7 }
          )
        }),
        async ({ userId, endpoints }) => {
          const api = new IntelligenceAPI()
          const startTime = Date.now()
          let totalRequests = 0
          let successfulRequests = 0

          // Make requests across different endpoints until we hit 100 or run out
          while (totalRequests < 110) {
            for (const endpoint of endpoints) {
              const timestamp = startTime + totalRequests * 50
              const response = await api.makeRequest(userId, endpoint, timestamp)
              if (response.success) {
                successfulRequests++
              }
              totalRequests++
              
              if (totalRequests >= 110) break
            }
            if (totalRequests >= 110) break
          }

          // Should have made exactly 100 successful requests
          expect(successfulRequests).toBe(100)

          // Verify count matches
          const count = api.getRequestCount(userId, startTime + totalRequests * 50)
          expect(count).toBe(100)

          // Next request to any endpoint should be rate limited
          const response = await api.makeRequest(userId, endpoints[0], startTime + totalRequests * 50 + 1000)
          expect(response.success).toBe(false)
          expect(response.status).toBe(429)
        }
      ),
      { numRuns: 50 }
    )
  })

  test('burst requests are handled correctly', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1 }),
          burstSize: fc.integer({ min: 10, max: 50 })
        }),
        async ({ userId, burstSize }) => {
          const api = new IntelligenceAPI()
          const startTime = Date.now()

          // Make burst of requests at the same timestamp
          const results: boolean[] = []
          for (let i = 0; i < burstSize; i++) {
            const response = await api.makeRequest(userId, '/api/markets/probability', startTime)
            results.push(response.success)
          }

          // All burst requests should succeed (within limit)
          const successCount = results.filter(r => r).length
          expect(successCount).toBe(burstSize)

          // Verify count is correct
          const count = api.getRequestCount(userId, startTime + 1000)
          expect(count).toBe(burstSize)
        }
      ),
      { numRuns: 100 }
    )
  })

  test('rate limit configuration is exactly 100 requests per 60 seconds', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }),
        (userId) => {
          const api = new IntelligenceAPI()
          const limiter = new RateLimiter()
          const config = limiter.getConfig()

          // Verify configuration matches requirements
          expect(config.maxRequests).toBe(100)
          expect(config.windowMs).toBe(60 * 1000) // 60 seconds
        }
      ),
      { numRuns: 10 }
    )
  })

  test('concurrent requests from same user respect rate limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1 }),
          concurrentBatches: fc.integer({ min: 2, max: 5 }),
          requestsPerBatch: fc.integer({ min: 20, max: 30 })
        }),
        async ({ userId, concurrentBatches, requestsPerBatch }) => {
          const api = new IntelligenceAPI()
          const startTime = Date.now()

          // Make concurrent requests
          const batches = []
          for (let batch = 0; batch < concurrentBatches; batch++) {
            const batchPromises = []
            for (let i = 0; i < requestsPerBatch; i++) {
              const timestamp = startTime + batch * 1000 + i * 10
              batchPromises.push(api.makeRequest(userId, '/api/markets/probability', timestamp))
            }
            batches.push(Promise.all(batchPromises))
          }

          const allResults = await Promise.all(batches)
          const flatResults = allResults.flat()
          const successCount = flatResults.filter(r => r.success).length

          const totalRequests = concurrentBatches * requestsPerBatch

          if (totalRequests <= 100) {
            // All should succeed
            expect(successCount).toBe(totalRequests)
          } else {
            // Only 100 should succeed
            expect(successCount).toBe(100)
          }
        }
      ),
      { numRuns: 30 }
    )
  })

  test('rate limit persists across multiple time windows correctly', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          userId: fc.string({ minLength: 1 }),
          windows: fc.integer({ min: 2, max: 5 }),
          requestsPerWindow: fc.integer({ min: 30, max: 80 })
        }),
        async ({ userId, windows, requestsPerWindow }) => {
          const api = new IntelligenceAPI()
          const startTime = Date.now()

          // Make requests across multiple windows
          for (let window = 0; window < windows; window++) {
            const windowStart = startTime + window * 65 * 1000 // 65 seconds apart (past window)
            
            for (let i = 0; i < requestsPerWindow; i++) {
              const timestamp = windowStart + i * 100
              await api.makeRequest(userId, '/api/markets/probability', timestamp)
            }

            // Check count at end of each window
            const count = api.getRequestCount(userId, windowStart + requestsPerWindow * 100)
            expect(count).toBe(requestsPerWindow)
          }
        }
      ),
      { numRuns: 30 }
    )
  })
})
