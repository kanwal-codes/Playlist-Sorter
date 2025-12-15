/**
 * Token refresh mutex to prevent race conditions
 */

interface RefreshLock {
  promise: Promise<string>
  expiresAt: number
}

const refreshLocks = new Map<string, RefreshLock>()

const LOCK_TTL = 60 * 1000 // 1 minute lock

// Lazy cleanup: clean expired locks on access instead of using setInterval
// This prevents memory leaks in serverless environments
let lastCleanup = 0
const CLEANUP_INTERVAL = 5 * 60 * 1000 // 5 minutes

function cleanupExpiredLocks(): void {
  const now = Date.now()
  // Only cleanup if enough time has passed (throttle cleanup)
  if (now - lastCleanup < CLEANUP_INTERVAL) {
    return
  }
  lastCleanup = now
  
  for (const [key, lock] of refreshLocks.entries()) {
    if (lock.expiresAt < now) {
      refreshLocks.delete(key)
    }
  }
}

/**
 * Acquires a lock for token refresh to prevent race conditions
 * @param userId - User ID to lock
 * @param refreshFn - Function to refresh the token
 * @returns Promise resolving to the new access token
 */
export async function withTokenRefreshLock<T>(
  userId: string,
  refreshFn: () => Promise<T>
): Promise<T> {
  cleanupExpiredLocks() // Clean up before checking
  const existingLock = refreshLocks.get(userId)
  
  // If lock exists and is still valid, wait for it
  if (existingLock && existingLock.expiresAt > Date.now()) {
    await existingLock.promise
    // Retry after lock is released
    return refreshFn()
  }
  
  // Create new lock
  const lockPromise = refreshFn()
  const lock: RefreshLock = {
    promise: lockPromise as Promise<string>,
    expiresAt: Date.now() + LOCK_TTL,
  }
  
  refreshLocks.set(userId, lock)
  
  try {
    return await lockPromise
  } finally {
    // Remove lock after completion
    setTimeout(() => {
      refreshLocks.delete(userId)
    }, 1000)
  }
}

