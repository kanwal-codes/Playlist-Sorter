import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySpotifyId } from '@/lib/db/queries'
import { SpotifyClient } from '@/lib/spotify/client'
import { validateSpotifyPlaylistId } from '@/lib/utils/validation'
import { verifyPlaylistOwnership, sanitizeError } from '@/lib/utils/security'
import { checkRateLimit, getClientIdentifier } from '@/lib/utils/rate-limit'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(`playlist-tracks-${clientId}`, 100, 60000)
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

    // Input validation
    let playlistId: string
    try {
      playlistId = validateSpotifyPlaylistId(params.id)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Invalid playlist ID' },
        { status: 400 }
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
    const playlist = await client.getPlaylist(playlistId)
    if (!verifyPlaylistOwnership(playlist, user.spotifyUserId)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have access to this playlist' },
        { status: 403 }
      )
    }

    // Paginated fetch
    const response = await client.getPlaylistTracks(playlistId, limit, offset)
    const tracks = response.items

    // Filter out null tracks and map to formatted format
    const formattedTracks = tracks
      .filter((item) => item.track !== null) // Additional safety check
      .map((item) => {
        const track = item.track! // Non-null assertion after filter
        return {
          id: track.id,
          name: track.name,
          artists: track.artists.map((a) => a.name).join(', '),
          album: track.album.name,
          albumImage: track.album.images[0]?.url,
          duration: track.duration_ms,
          popularity: track.popularity,
          addedAt: item.added_at,
          releaseDate: track.album.release_date,
          spotifyUrl: track.external_urls.spotify,
        }
      })

    // Use Spotify pagination: next is present if more pages
    const hasMore = Boolean(response.next)
    const nextOffset = hasMore ? offset + limit : null

    return NextResponse.json({
      tracks: formattedTracks,
      total: response.total,
      nextOffset: hasMore ? nextOffset : null,
      hasMore,
    })
  } catch (error) {
    const errorMessage = sanitizeError(error)
    return NextResponse.json(
      { error: 'Failed to fetch tracks' },
      { status: 500 }
    )
  }
}


