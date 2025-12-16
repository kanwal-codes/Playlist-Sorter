/**
 * Security utilities for authorization, CSRF protection, and encryption
 */

import crypto from 'crypto'

// Simple encryption/decryption for tokens (SERVER-SIDE ONLY)
// In production, consider using a more robust solution
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
if (!ENCRYPTION_KEY || ENCRYPTION_KEY === 'default-key-change-in-production') {
  throw new Error(
    'ENCRYPTION_KEY environment variable is required and must be set to a secure value. ' +
    'Generate a secure key using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  )
}
// Type assertion: ENCRYPTION_KEY is guaranteed to be defined after the check above
const KEY = ENCRYPTION_KEY as string
const ALGORITHM = 'aes-256-cbc'

function getKey(): Buffer {
  return crypto.createHash('sha256').update(KEY).digest()
}

export function encrypt(text: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  
  return iv.toString('hex') + ':' + encrypted
}

export function decrypt(encryptedText: string): string {
  const key = getKey()
  const parts = encryptedText.split(':')
  const iv = Buffer.from(parts[0], 'hex')
  const encrypted = parts[1]
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  
  return decrypted
}

/**
 * Verifies playlist ownership via Spotify API
 */
export async function verifyPlaylistOwnership(
  playlist: { owner: { id: string } },
  userSpotifyId: string
): Promise<boolean> {
  // Check if user owns the playlist
  if (playlist.owner.id !== userSpotifyId) {
    return false
  }
  
  return true
}

/**
 * Validates Origin header for CSRF protection
 */
export function validateOrigin(request: Request, allowedOrigins: string[]): boolean {
  const origin = request.headers.get('origin')
  if (!origin) {
    // Same-origin requests don't have Origin header
    // In production, we should be more strict, but for API routes this is acceptable
    return true
  }
  
  // Check against allowed origins
  if (allowedOrigins.length > 0 && allowedOrigins.includes(origin)) {
    return true
  }
  
  // In production, be strict - only allow configured origins
  if (process.env.NODE_ENV === 'production') {
    return false
  }
  
  // In development, allow localhost variants
  return origin.includes('localhost') || origin.includes('127.0.0.1')
}

/**
 * Sanitizes error messages to prevent information leakage
 */
export function sanitizeError(error: unknown): string {
  if (error instanceof Error) {
    // Don't expose internal error details
    const message = error.message.toLowerCase()
    
    // Check for sensitive patterns
    if (message.includes('token') || 
        message.includes('password') || 
        message.includes('secret') ||
        message.includes('key') ||
        message.includes('database') ||
        message.includes('connection')) {
      return 'An internal error occurred. Please try again later.'
    }
    
    // Return generic error for production
    if (process.env.NODE_ENV === 'production') {
      return 'An error occurred. Please try again later.'
    }
    
    // In development, return the error message
    return error.message
  }
  
  return 'An unknown error occurred'
}

