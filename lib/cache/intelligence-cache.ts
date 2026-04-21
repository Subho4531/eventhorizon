/**
 * In-memory cache with TTL for intelligence data
 * Provides fast access to frequently queried intelligence metrics
 */

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

type CacheKey = 
  | `probability:${string}`
  | `quality:${string}`
  | `risk:${string}`
  | `reputation:${string}`
  | `oracle:${string}`
  | `liquidity:${string}`

class IntelligenceCache {
  private cache: Map<CacheKey, CacheEntry<unknown>>
  private defaultTTL: number

  constructor(defaultTTL: number = 60000) { // 60 seconds default
    this.cache = new Map()
    this.defaultTTL = defaultTTL
    
    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000)
  }

  /**
   * Get value from cache
   */
  get<T>(key: CacheKey): T | null {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return null
    }
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }
    
    return entry.value as T
  }

  /**
   * Set value in cache with optional custom TTL
   */
  set<T>(key: CacheKey, value: T, ttl?: number): void {
    const expiresAt = Date.now() + (ttl ?? this.defaultTTL)
    this.cache.set(key, { value, expiresAt })
  }

  /**
   * Delete specific key from cache
   */
  delete(key: CacheKey): void {
    this.cache.delete(key)
  }

  /**
   * Invalidate all cache entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const keys = Array.from(this.cache.keys())
    for (const key of keys) {
      if (key.includes(pattern)) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear()
  }

  /**
   * Remove expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    const keys = Array.from(this.cache.keys())
    
    for (const key of keys) {
      const entry = this.cache.get(key)
      if (entry && now > entry.expiresAt) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const now = Date.now()
    let expired = 0
    let valid = 0
    
    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++
      } else {
        valid++
      }
    }
    
    return {
      total: this.cache.size,
      valid,
      expired
    }
  }
}

// Singleton instance
export const intelligenceCache = new IntelligenceCache()

/**
 * Cache invalidation helpers
 */
export const invalidateCache = {
  /**
   * Invalidate cache on market resolution
   */
  onMarketResolution(marketId: string): void {
    intelligenceCache.delete(`probability:${marketId}`)
    intelligenceCache.delete(`quality:${marketId}`)
    intelligenceCache.delete(`risk:${marketId}`)
    intelligenceCache.delete(`liquidity:${marketId}`)
  },

  /**
   * Invalidate cache on bet placement
   */
  onBetPlacement(marketId: string, userId: string): void {
    intelligenceCache.delete(`probability:${marketId}`)
    intelligenceCache.delete(`risk:${marketId}`)
    intelligenceCache.delete(`liquidity:${marketId}`)
    intelligenceCache.delete(`reputation:${userId}`)
  },

  /**
   * Invalidate cache on reputation update
   */
  onReputationUpdate(userId: string): void {
    intelligenceCache.delete(`reputation:${userId}`)
    intelligenceCache.invalidatePattern(`quality:`) // Quality depends on creator reputation
  },

  /**
   * Invalidate cache on dispute resolution
   */
  onDisputeResolution(marketId: string, oracleAddress: string): void {
    intelligenceCache.delete(`oracle:${oracleAddress}`)
    intelligenceCache.delete(`quality:${marketId}`)
    intelligenceCache.invalidatePattern(`reputation:`) // May affect multiple users
  }
}
