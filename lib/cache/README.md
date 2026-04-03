# Intelligence Cache System

Centralized in-memory cache with TTL for intelligence data.

## Overview

The intelligence cache provides fast access to frequently queried metrics with automatic expiration and invalidation.

## Features

- **TTL-based expiration**: Default 60-second TTL
- **Automatic cleanup**: Expired entries removed every minute
- **Pattern-based invalidation**: Invalidate multiple keys by pattern
- **Type-safe**: Generic type support for cached values
- **Statistics**: Track cache hit/miss rates

## Cache Keys

Cache keys follow a structured format:

```typescript
type CacheKey = 
  | `probability:${marketId}`
  | `quality:${marketId}`
  | `risk:${marketId}`
  | `reputation:${userId}`
  | `oracle:${oracleAddress}`
  | `liquidity:${marketId}`
```

## Usage

### Basic Operations

```typescript
import { intelligenceCache } from '@/lib/cache/intelligence-cache'

// Set value with default TTL (60s)
intelligenceCache.set('probability:market123', 0.75)

// Set value with custom TTL (120s)
intelligenceCache.set('quality:market123', 85, 120000)

// Get value
const probability = intelligenceCache.get<number>('probability:market123')

// Delete specific key
intelligenceCache.delete('probability:market123')

// Invalidate by pattern
intelligenceCache.invalidatePattern('probability:')

// Clear all
intelligenceCache.clear()
```

### Cache Statistics

```typescript
const stats = intelligenceCache.getStats()
// {
//   total: 150,
//   valid: 142,
//   expired: 8
// }
```

## Cache Invalidation

The system provides automatic invalidation helpers for common events:

```typescript
import { invalidateCache } from '@/lib/cache/intelligence-cache'

// On market resolution
invalidateCache.onMarketResolution(marketId)

// On bet placement
invalidateCache.onBetPlacement(marketId, userId)

// On reputation update
invalidateCache.onReputationUpdate(userId)

// On dispute resolution
invalidateCache.onDisputeResolution(marketId, oracleAddress)
```

## Integration with Services

Services should check cache before expensive operations:

```typescript
export async function calculateQualityScore(marketId: string): Promise<number> {
  // Check cache first
  const cached = intelligenceCache.get<number>(`quality:${marketId}`)
  if (cached !== null) {
    return cached
  }

  // Calculate if not cached
  const score = await expensiveCalculation(marketId)
  
  // Cache the result
  intelligenceCache.set(`quality:${marketId}`, score)
  
  return score
}
```

## Performance

- **O(1) lookups**: Map-based storage for fast access
- **Minimal overhead**: Simple timestamp comparison for expiration
- **Memory efficient**: Automatic cleanup of expired entries

## Best Practices

1. **Use appropriate TTLs**: Longer for stable data, shorter for volatile data
2. **Invalidate on updates**: Always invalidate when underlying data changes
3. **Handle null returns**: Cache returns `null` for missing/expired entries
4. **Use type parameters**: Specify types for type-safe cache access

## Monitoring

Cache statistics available for monitoring:

```typescript
setInterval(() => {
  const stats = intelligenceCache.getStats()
  console.log(`Cache: ${stats.valid} valid, ${stats.expired} expired`)
}, 60000)
```
