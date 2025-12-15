import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySpotifyId } from '@/lib/db/queries'
import { SpotifyClient } from '@/lib/spotify/client'

export async function GET(request: Request) {
  try {
    // Try reading from cookies() first
    const cookieStore = cookies()
    let spotifyUserId = cookieStore.get('spotify_user_id')?.value
    
    // Fallback: read from request headers if cookies() doesn't work
    if (!spotifyUserId) {
      const cookieHeader = request.headers.get('cookie') || ''
      const cookieMap: Record<string, string> = {}
      cookieHeader.split(';').forEach(cookie => {
        const trimmed = cookie.trim()
        const equalIndex = trimmed.indexOf('=')
        if (equalIndex > 0) {
          const name = trimmed.substring(0, equalIndex).trim()
          const value = trimmed.substring(equalIndex + 1).trim()
          cookieMap[name] = value
        }
      })
      spotifyUserId = cookieMap['spotify_user_id']
    }

    if (!spotifyUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = await getUserBySpotifyId(spotifyUserId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get fresh user info from Spotify
    const client = new SpotifyClient(
      user.accessToken,
      user.refreshToken,
      user.tokenExpiresAt,
      user.spotifyUserId
    )

    const spotifyUser = await client.getCurrentUser()

    return NextResponse.json({
      id: user.id,
      spotifyUserId: user.spotifyUserId,
      email: spotifyUser.email,
      displayName: spotifyUser.display_name,
      image: spotifyUser.images[0]?.url,
      autoSortEnabled: user.autoSortEnabled,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch user' },
      { status: 500 }
    )
  }
}


