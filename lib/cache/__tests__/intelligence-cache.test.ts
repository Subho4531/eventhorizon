/**
 * Tests for intelligence cache
 */

import { intelligenceCache, invalidateCache } from '../intelligence-cache'

describe('IntelligenceCache', () => {
  beforeEach(() => {
    intelligenceCache.clear()
  })

  describe('basic operations', () => {
    it('should set and get values', () => {
      intelligenceCache.set('probability:market1', 0.75)
      const value = intelligenceCache.get<number>('probability:market1')
      
      expect(value).toBe(0.75)
    })

    it('should return null for missing keys', () => {
      const value = intelligenceCache.get('probability:nonexistent')
      expect(value).toBeNull()
    })

    it('should delete specific keys', () => {
      intelligenceCache.set('probability:market1', 0.75)
      intelligenceCache.delete('probability:market1')
      
      const value = intelligenceCache.get('probability:market1')
      expect(value).toBeNull()
    })

    it('should clear all entries', () => {
      intelligenceCache.set('probability:market1', 0.75)
      intelligenceCache.set('quality:market1', 85)
      
      intelligenceCache.clear()
      
      expect(intelligenceCache.get('probability:market1')).toBeNull()
      expect(intelligenceCache.get('quality:market1')).toBeNull()
    })
  })

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      intelligenceCache.set('probability:market1', 0.75, 100) // 100ms TTL
      
      expect(intelligenceCache.get('probability:market1')).toBe(0.75)
      
      await new Promise(resolve => setTimeout(resolve, 150))
      
      expect(intelligenceCache.get('probability:market1')).toBeNull()
    })

    it('should use default TTL when not specified', () => {
      intelligenceCache.set('probability:market1', 0.75)
      
      // Should still be valid immediately
      expect(intelligenceCache.get('probability:market1')).toBe(0.75)
    })
  })

  describe('pattern invalidation', () => {
    it('should invalidate all keys matching pattern', () => {
      intelligenceCache.set('probability:market1', 0.75)
      intelligenceCache.set('probability:market2', 0.80)
      intelligenceCache.set('quality:market1', 85)
      
      intelligenceCache.invalidatePattern('probability:')
      
      expect(intelligenceCache.get('probability:market1')).toBeNull()
      expect(intelligenceCache.get('probability:market2')).toBeNull()
      expect(intelligenceCache.get('quality:market1')).toBe(85)
    })
  })

  describe('cache statistics', () => {
    it('should track cache statistics', () => {
      intelligenceCache.set('probability:market1', 0.75)
      intelligenceCache.set('quality:market1', 85)
      
      const stats = intelligenceCache.getStats()
      
      expect(stats.total).toBe(2)
      expect(stats.valid).toBe(2)
      expect(stats.expired).toBe(0)
    })

    it('should count expired entries', async () => {
      intelligenceCache.set('probability:market1', 0.75, 50)
      intelligenceCache.set('quality:market1', 85, 1000)
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      const stats = intelligenceCache.getStats()
      
      expect(stats.total).toBe(2)
      expect(stats.valid).toBe(1)
      expect(stats.expired).toBe(1)
    })
  })

  describe('invalidation helpers', () => {
    it('should invalidate on market resolution', () => {
      intelligenceCache.set('probability:market1', 0.75)
      intelligenceCache.set('quality:market1', 85)
      intelligenceCache.set('risk:market1', 30)
      intelligenceCache.set('liquidity:market1', 1000)
      
      invalidateCache.onMarketResolution('market1')
      
      expect(intelligenceCache.get('probability:market1')).toBeNull()
      expect(intelligenceCache.get('quality:market1')).toBeNull()
      expect(intelligenceCache.get('risk:market1')).toBeNull()
      expect(intelligenceCache.get('liquidity:market1')).toBeNull()
    })

    it('should invalidate on bet placement', () => {
      intelligenceCache.set('probability:market1', 0.75)
      intelligenceCache.set('risk:market1', 30)
      intelligenceCache.set('liquidity:market1', 1000)
      intelligenceCache.set('reputation:user1', 500)
      
      invalidateCache.onBetPlacement('market1', 'user1')
      
      expect(intelligenceCache.get('probability:market1')).toBeNull()
      expect(intelligenceCache.get('risk:market1')).toBeNull()
      expect(intelligenceCache.get('liquidity:market1')).toBeNull()
      expect(intelligenceCache.get('reputation:user1')).toBeNull()
    })

    it('should invalidate on reputation update', () => {
      intelligenceCache.set('reputation:user1', 500)
      intelligenceCache.set('quality:market1', 85)
      intelligenceCache.set('quality:market2', 90)
      
      invalidateCache.onReputationUpdate('user1')
      
      expect(intelligenceCache.get('reputation:user1')).toBeNull()
      expect(intelligenceCache.get('quality:market1')).toBeNull()
      expect(intelligenceCache.get('quality:market2')).toBeNull()
    })

    it('should invalidate on dispute resolution', () => {
      intelligenceCache.set('oracle:oracle1', 0.95)
      intelligenceCache.set('quality:market1', 85)
      intelligenceCache.set('reputation:user1', 500)
      intelligenceCache.set('reputation:user2', 600)
      
      invalidateCache.onDisputeResolution('market1', 'oracle1')
      
      expect(intelligenceCache.get('oracle:oracle1')).toBeNull()
      expect(intelligenceCache.get('quality:market1')).toBeNull()
      expect(intelligenceCache.get('reputation:user1')).toBeNull()
      expect(intelligenceCache.get('reputation:user2')).toBeNull()
    })
  })
})
