import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getSpotifyAuthUrl } from '@/lib/spotify/auth'
import { storeState } from '@/lib/auth/state-store'
import { getRedirectUri } from '@/lib/utils/url'

export async function GET(request: Request) {
  try {
    // Use environment variable if set (for explicit configuration)
    // Otherwise, auto-detect from request (works for both local and Vercel)
    const redirectUri = process.env.SPOTIFY_REDIRECT_URI || getRedirectUri(request)

    // Generate a state token for CSRF protection
    const state = crypto.randomUUID()
    
    // Store state in both memory AND cookie for reliability
    // Cookie ensures state persists across redirects in development
    storeState(state, 10) // 10 minutes TTL
    
    const authUrl = getSpotifyAuthUrl(state, redirectUri)
    
    console.log('✅ Storing auth state:', state)
    console.log('🔄 Redirecting to Spotify...')

    const response = NextResponse.redirect(authUrl)
    
    // Also store in cookie as backup (for development reliability)
    response.cookies.set('oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    })
    // Store redirect URI in cookie to ensure callback uses the same value
    response.cookies.set('oauth_redirect', redirectUri, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
      path: '/',
    })

    return response
  } catch (error) {
    console.error('Error initiating Spotify auth:', error)
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    )
  }
}
