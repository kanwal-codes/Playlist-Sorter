import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeCodeForTokens } from '@/lib/spotify/auth'
import { createOrUpdateUser } from '@/lib/db/queries'
import { SpotifyClient } from '@/lib/spotify/client'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    // Get base URL for redirects
    const baseUrl = new URL(request.url).origin

    if (error) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${baseUrl}/login?error=missing_params`
      )
    }

    // Verify state using server-side store AND cookie (for development reliability)
    const { verifyAndRemoveState } = await import('@/lib/auth/state-store')
    const cookieStore = cookies()
    const cookieState = cookieStore.get('oauth_state')?.value
    const cookieRedirect = cookieStore.get('oauth_redirect')?.value
    const envRedirect = process.env.SPOTIFY_REDIRECT_URI
    const redirectUri = cookieRedirect || envRedirect || `${baseUrl}/api/auth/callback`
    
    console.log(`🔄 OAuth callback received - state: ${state}, code: ${code ? 'present' : 'missing'}`)
    console.log(`🍪 Cookie state: ${cookieState || 'not found'}`)
    console.log(`🔗 Redirect URI in use: ${redirectUri}`)
    
    // Verify state from memory store first
    let stateValid = verifyAndRemoveState(state)
    
    // If memory store fails, check cookie (for development reliability)
    if (!stateValid && cookieState === state) {
      console.log(`✅ State verified from cookie (memory store was empty)`)
      stateValid = true
      // Clear the cookie
      cookieStore.delete('oauth_state')
    }
    
    if (!stateValid) {
      console.error(`❌ State verification failed for: ${state}`)
      console.error(`   Memory store check: ${verifyAndRemoveState(state)}`)
      console.error(`   Cookie check: ${cookieState === state}`)
      return NextResponse.redirect(
        `${baseUrl}/login?error=invalid_state`
      )
    }
    
    console.log(`✅ State verified successfully`)
    
    // Clear the cookie after successful verification
    cookieStore.delete('oauth_state')
    cookieStore.delete('oauth_redirect')

    // Exchange code for tokens (use redirectUri to match the auth request)
    const tokenData = await exchangeCodeForTokens(code, redirectUri)

    // Calculate token expiration
    const expiresAt = new Date()
    expiresAt.setSeconds(expiresAt.getSeconds() + tokenData.expires_in)

    // Get user info from Spotify
    const client = new SpotifyClient(
      tokenData.access_token,
      tokenData.refresh_token,
      expiresAt
    )
    const spotifyUser = await client.getCurrentUser()

    // Save user to database
    await createOrUpdateUser({
      spotifyUserId: spotifyUser.id,
      email: spotifyUser.email,
      displayName: spotifyUser.display_name,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: expiresAt,
    })

    // Create redirect response to home page
    const redirectUrl = `${baseUrl}/`
    
    const response = NextResponse.redirect(redirectUrl)
    
    // Set secure cookie server-side (httpOnly prevents XSS attacks)
    response.cookies.set('spotify_user_id', spotifyUser.id, {
      httpOnly: true, // SECURITY: Prevent XSS attacks by making cookie inaccessible to JavaScript
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })

    // Clear auth state cookie (if it exists)
    response.cookies.delete('spotify_auth_state')
    
    return response
  } catch (error) {
    const baseUrl = new URL(request.url).origin
    return NextResponse.redirect(
      `${baseUrl}/login?error=authentication_failed`
    )
  }
}


