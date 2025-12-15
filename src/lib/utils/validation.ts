/**
 * Validation utilities for security and input validation
 */

// Spotify ID format: 22 alphanumeric characters
const SPOTIFY_ID_REGEX = /^[a-zA-Z0-9]{22}$/

/**
 * Validates a Spotify playlist ID format
 */
export function isValidSpotifyId(id: string): boolean {
  return typeof id === 'string' && SPOTIFY_ID_REGEX.test(id)
}

/**
 * Validates and sanitizes a Spotify playlist ID
 * @throws Error if ID is invalid
 */
export function validateSpotifyPlaylistId(id: string): string {
  if (!id || typeof id !== 'string') {
    throw new Error('Invalid playlist ID: must be a non-empty string')
  }
  
  if (!isValidSpotifyId(id)) {
    throw new Error('Invalid playlist ID format: must be 22 alphanumeric characters')
  }
  
  return id.trim()
}

/**
 * Validates request body size (max 1MB)
 */
export function validateRequestBodySize(body: string | null, maxSizeBytes = 1024 * 1024): void {
  if (!body) return
  
  const sizeInBytes = new TextEncoder().encode(body).length
  if (sizeInBytes > maxSizeBytes) {
    throw new Error(`Request body too large: ${sizeInBytes} bytes exceeds maximum of ${maxSizeBytes} bytes`)
  }
}


