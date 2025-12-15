// In-memory state store for OAuth state verification
// In production, consider using Redis or database

const stateStore = new Map<string, { state: string; expiresAt: number }>()

// Lazy cleanup: clean expired states on access instead of using setInterval
// This prevents memory leaks in serverless environments
function cleanupExpiredStates(): void {
  const now = Date.now()
  for (const [key, value] of stateStore.entries()) {
    if (value.expiresAt < now) {
      stateStore.delete(key)
    }
  }
}

export function storeState(state: string, ttlMinutes = 10): void {
  cleanupExpiredStates() // Clean up before storing
  const expiresAt = Date.now() + ttlMinutes * 60 * 1000
  stateStore.set(state, { state, expiresAt })
  console.log(`✅ Stored OAuth state: ${state} (expires in ${ttlMinutes} minutes)`)
  console.log(`📊 Total states in store: ${stateStore.size}`)
}

export function verifyAndRemoveState(state: string): boolean {
  cleanupExpiredStates() // Clean up before verification
  console.log(`🔍 Verifying OAuth state: ${state}`)
  console.log(`📊 Total states in store: ${stateStore.size}`)
  console.log(`📋 Available states:`, Array.from(stateStore.keys()))
  
  const stored = stateStore.get(state)
  if (!stored) {
    console.error(`❌ State not found in store: ${state}`)
    return false
  }
  
  if (stored.expiresAt < Date.now()) {
    console.error(`❌ State expired: ${state} (expired at ${new Date(stored.expiresAt).toISOString()})`)
    stateStore.delete(state)
    return false
  }
  
  // Remove after verification (one-time use)
  stateStore.delete(state)
  console.log(`✅ State verified and removed: ${state}`)
  return true
}

export function clearState(state: string): void {
  stateStore.delete(state)
}




