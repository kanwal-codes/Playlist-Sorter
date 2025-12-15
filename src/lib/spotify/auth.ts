import { SpotifyTokenResponse } from './types'
import { updateUserTokens } from '../db/queries'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REDIRECT_URI) {
  throw new Error(
    'Missing required Spotify environment variables: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, or SPOTIFY_REDIRECT_URI'
  )
}

// Type assertions after validation
const CLIENT_ID = SPOTIFY_CLIENT_ID as string
const CLIENT_SECRET = SPOTIFY_CLIENT_SECRET as string
const REDIRECT_URI = SPOTIFY_REDIRECT_URI as string

export function getSpotifyAuthUrl(state?: string, redirectUriOverride?: string): string {
  const scopes = [
    'playlist-read-private',
    'playlist-read-collaborative',
    'playlist-modify-public',
    'playlist-modify-private',
    'user-read-email',
    'user-read-private',
  ].join(' ')

  const redirectUri = redirectUriOverride ?? REDIRECT_URI

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: scopes,
    redirect_uri: redirectUri,
    ...(state && { state }),
  })

  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUriOverride?: string
): Promise<SpotifyTokenResponse> {
  try {
    const redirectUri = redirectUriOverride ?? REDIRECT_URI

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${CLIENT_ID}:${CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!response.ok) {
      const errorData = await response.text()
      
      // Provide more specific error messages
      if (response.status === 400) {
        throw new Error(
          'Invalid authorization code. The code may have expired or already been used.'
        )
      }
      
      throw new Error(`Failed to exchange code for tokens: ${response.status}`)
    }

    const tokenData = await response.json()
    
    // Validate that we received required fields
    if (!tokenData.access_token) {
      throw new Error('Invalid token response: missing access_token')
    }

    return tokenData
  } catch (error) {
    // Re-throw with more context if it's not already an Error
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Token exchange error: ${error}`)
  }
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<SpotifyTokenResponse> {
  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${CLIENT_ID}:${CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    if (!response.ok) {
      // If refresh token is invalid, user needs to re-authenticate
      if (response.status === 400) {
        throw new Error(
          'Refresh token is invalid or expired. Please re-authenticate with Spotify.'
        )
      }
      
      throw new Error(`Failed to refresh token: ${response.status}`)
    }

    return response.json()
  } catch (error) {
    // Re-throw with more context if it's not already an Error
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Token refresh error: ${error}`)
  }
}

export async function getValidAccessToken(
  accessToken: string,
  refreshToken: string,
  tokenExpiresAt: Date,
  spotifyUserId?: string
): Promise<string> {
  // Check if token is expired (with 5 minute buffer)
  const now = new Date()
  const expiresAt = new Date(tokenExpiresAt)
  expiresAt.setMinutes(expiresAt.getMinutes() - 5)

  if (now >= expiresAt) {
    // Token expired, refresh it with lock to prevent race conditions
    if (spotifyUserId) {
      const { withTokenRefreshLock } = await import('../utils/token-refresh')
      
      return withTokenRefreshLock(spotifyUserId, async () => {
        const tokenData = await refreshAccessToken(refreshToken)

        // Update in database
        const newExpiresAt = new Date()
        newExpiresAt.setSeconds(newExpiresAt.getSeconds() + tokenData.expires_in)

        await updateUserTokens(
          spotifyUserId,
          tokenData.access_token,
          tokenData.refresh_token || refreshToken, // Use new refresh token if provided
          newExpiresAt
        )

        return tokenData.access_token
      })
    } else {
      // No user ID, just refresh without lock (shouldn't happen in production)
      const tokenData = await refreshAccessToken(refreshToken)
      return tokenData.access_token
    }
  }

  return accessToken
}

