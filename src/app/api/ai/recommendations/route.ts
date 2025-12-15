import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySpotifyId } from '@/lib/db/queries'
import { SpotifyClient } from '@/lib/spotify/client'
import { generateRecommendations } from '@/lib/ai/recommendations'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const playlistId = searchParams.get('playlistId')

    if (!playlistId) {
      return NextResponse.json(
        { error: 'playlistId is required' },
        { status: 400 }
      )
    }

    // Input validation
    const { validateSpotifyPlaylistId } = await import('@/lib/utils/validation')
    const { verifyPlaylistOwnership, sanitizeError } = await import('@/lib/utils/security')
    const { checkRateLimit, getClientIdentifier } = await import('@/lib/utils/rate-limit')

    let validatedPlaylistId: string
    try {
      validatedPlaylistId = validateSpotifyPlaylistId(playlistId)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid playlist ID' },
        { status: 400 }
      )
    }

    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(`ai-recommendations-${clientId}`, 20, 60000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
          },
        }
      )
    }

    const spotifyUserId = cookies().get('spotify_user_id')?.value

    if (!spotifyUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const user = await getUserBySpotifyId(spotifyUserId)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const client = new SpotifyClient(
      user.accessToken,
      user.refreshToken,
      user.tokenExpiresAt,
      user.spotifyUserId
    )

    // CRITICAL: Verify playlist ownership
    const playlist = await client.getPlaylist(validatedPlaylistId)
    if (!verifyPlaylistOwnership(playlist, user.spotifyUserId)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have access to this playlist' },
        { status: 403 }
      )
    }

    // Get playlist tracks
    const tracks = await client.getAllPlaylistTracks(validatedPlaylistId)

    if (tracks.length === 0) {
      return NextResponse.json({
        recommendations: [],
        message: 'Playlist is empty',
      })
    }

    // Generate recommendations
    const recommendations = await generateRecommendations(
      validatedPlaylistId,
      client,
      tracks
    )

    return NextResponse.json({ recommendations })
  } catch (error) {
    const errorMessage = sanitizeError(error)
    return NextResponse.json(
      {
        error: 'Failed to generate recommendations',
      },
      { status: 500 }
    )
  }
}


