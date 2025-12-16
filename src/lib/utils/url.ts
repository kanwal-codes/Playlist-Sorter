/**
 * URL utilities for determining base URLs in different environments
 * Optimized for Vercel deployment
 */

/**
 * Gets the base URL for the application
 * Works in both local development and Vercel production
 */
export function getBaseUrl(request?: Request): string {
  // In production on Vercel, use VERCEL_URL (automatically set by Vercel)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  // If NEXT_PUBLIC_APP_URL is set (recommended for production)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }

  // If we have a request, use its origin
  if (request) {
    return new URL(request.url).origin
  }

  // Fallback for local development
  if (process.env.NODE_ENV === 'development') {
    return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  }

  // Last resort fallback
  return 'http://localhost:3000'
}

/**
 * Gets the redirect URI for OAuth callbacks
 * Automatically handles localhost vs production
 */
export function getRedirectUri(request?: Request): string {
  const baseUrl = getBaseUrl(request)
  return `${baseUrl}/api/auth/callback`
}

/**
 * Gets allowed origins for CORS/CSRF validation
 */
export function getAllowedOrigins(): string[] {
  const origins: string[] = []

  // Add production URL if set
  if (process.env.NEXT_PUBLIC_APP_URL) {
    origins.push(process.env.NEXT_PUBLIC_APP_URL)
  }

  // Add Vercel URL if available (handle both with and without protocol)
  if (process.env.VERCEL_URL) {
    const vercelUrl = process.env.VERCEL_URL.startsWith('http')
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`
    origins.push(vercelUrl)
  }

  // Add Vercel production URL pattern (common Vercel deployment URLs)
  if (process.env.VERCEL) {
    // Vercel sets VERCEL_URL automatically, but also check for custom domain
    const vercelUrl = process.env.VERCEL_URL
    if (vercelUrl && !vercelUrl.startsWith('http')) {
      origins.push(`https://${vercelUrl}`)
    }
  }

  // In development, add localhost variants
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000', 'http://127.0.0.1:3000')
  }

  return origins
}

