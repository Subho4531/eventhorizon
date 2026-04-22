/**
 * Rate Limiting Middleware
 * 
 * Implements sliding window rate limiting with 100 requests per minute per user.
 * Uses in-memory storage for MVP (consider Redis for production).
 */

import { NextRequest, NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit tracking
const rateLimitStore = new Map<string, RateLimitEntry>();

// Configuration
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Clean up expired entries periodically to prevent memory leaks
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}

// Run cleanup every 5 minutes
setInterval(cleanupExpiredEntries, 5 * 60 * 1000);

/**
 * Extract user identifier from request
 * Uses wallet public key from header or query parameter
 */
function getUserIdentifier(request: NextRequest): string | null {
  // Try to get from Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try to get from query parameter
  const url = new URL(request.url);
  const publicKey = url.searchParams.get('publicKey') || url.searchParams.get('userPublicKey');
  if (publicKey) {
    return publicKey;
  }

  // Try to get from path parameter (for routes like /api/users/[publicKey])
  const pathMatch = request.nextUrl.pathname.match(/\/users\/([^\/]+)/);
  if (pathMatch) {
    return pathMatch[1];
  }

  // Fallback to IP address for anonymous requests
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown';
  return `ip:${ip}`;
}

/**
 * Check if request should be rate limited
 * Returns null if allowed, or NextResponse with 429 status if rate limited
 */
export function checkRateLimit(request: NextRequest): NextResponse | null {
  const identifier = getUserIdentifier(request);
  if (!identifier) {
    // If we can't identify the user, allow the request but log warning
    console.warn('Rate limit: Unable to identify user for request', request.url);
    return null;
  }

  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    // First request or window expired - create new entry
    rateLimitStore.set(identifier, {
      count: 1,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    });
    return null;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        retryAfter
      },
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'X-RateLimit-Limit': RATE_LIMIT_MAX_REQUESTS.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': entry.resetTime.toString()
        }
      }
    );
  }

  // Increment counter
  entry.count++;
  rateLimitStore.set(identifier, entry);

  return null;
}

/**
 * Middleware wrapper for API routes
 * Usage: export const GET = withRateLimit(async (request) => { ... });
 */
export function withRateLimit(
  handler: (request: NextRequest, context?: unknown) => Promise<NextResponse>
) {
  return async (request: NextRequest, context?: unknown): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitResponse = checkRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Add rate limit headers to successful responses
    const identifier = getUserIdentifier(request);
    const entry = identifier ? rateLimitStore.get(identifier) : null;
    
    const response = await handler(request, context);
    
    if (entry) {
      const remaining = Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count);
      response.headers.set('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', entry.resetTime.toString());
    }

    return response;
  };
}

/**
 * Get current rate limit status for a user
 * Useful for debugging and monitoring
 */
export function getRateLimitStatus(identifier: string): {
  limit: number;
  remaining: number;
  resetTime: number;
} {
  const entry = rateLimitStore.get(identifier);
  const now = Date.now();

  if (!entry || entry.resetTime < now) {
    return {
      limit: RATE_LIMIT_MAX_REQUESTS,
      remaining: RATE_LIMIT_MAX_REQUESTS,
      resetTime: now + RATE_LIMIT_WINDOW_MS
    };
  }

  return {
    limit: RATE_LIMIT_MAX_REQUESTS,
    remaining: Math.max(0, RATE_LIMIT_MAX_REQUESTS - entry.count),
    resetTime: entry.resetTime
  };
}
