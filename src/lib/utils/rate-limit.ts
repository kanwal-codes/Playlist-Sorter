/**
 * Simple in-memory rate limiting
 * For production, consider using Redis or Vercel Edge Config
 */

interface RateLimitEntry {
  count: number
  resetTime: number
}

const rateLimitStore = new Map<string, RateLimitEntry>()

// Lazy cleanup: clean expired entries on access instead of using setInterval
// This prevents memory leaks in serverless environments
let lastCleanup = 0
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes

function cleanupExpiredEntries(): void {
  const now = Date.now()
  // Only cleanup if enough time has passed (throttle cleanup)
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return
  }
  lastCleanup = now
  
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Simple rate limiter
 * @param identifier - Unique identifier (e.g., IP address or user ID)
 * @param maxRequests - Maximum requests allowed
 * @param windowMs - Time window in milliseconds
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowMs: number = 60 * 1000 // 1 minute default
): { allowed: boolean; remaining: number; resetTime: number } {
  cleanupExpiredEntries() // Clean up before checking
  const now = Date.now()
  const entry = rateLimitStore.get(identifier)
  
  if (!entry || entry.resetTime < now) {
    // Create new entry
    const newEntry: RateLimitEntry = {
      count: 1,
      resetTime: now + windowMs,
    }
    rateLimitStore.set(identifier, newEntry)
    return {
      allowed: true,
      remaining: maxRequests - 1,
      resetTime: newEntry.resetTime,
    }
  }
  
  // Increment count
  entry.count++
  
  if (entry.count > maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: entry.resetTime,
    }
  }
  
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetTime: entry.resetTime,
  }
}

/**
 * Gets client identifier from request (IP address)
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from headers (Vercel, Cloudflare, etc.)
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim()
  }
  
  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp
  }
  
  // Fallback to a default identifier
  return 'unknown'
}

