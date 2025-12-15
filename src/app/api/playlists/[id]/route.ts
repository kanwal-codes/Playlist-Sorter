import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySpotifyId } from '@/lib/db/queries'
import { SpotifyClient } from '@/lib/spotify/client'
import { prisma } from '@/lib/db/client'
import { validateSpotifyPlaylistId } from '@/lib/utils/validation'
import { verifyPlaylistOwnership } from '@/lib/utils/security'
import { sanitizeError } from '@/lib/utils/security'
import { checkRateLimit, getClientIdentifier } from '@/lib/utils/rate-limit'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(`playlist-get-${clientId}`, 100, 60000)
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

    const playlist = await client.getPlaylist(playlistId)

    // CRITICAL: Verify playlist ownership
    if (!verifyPlaylistOwnership(playlist, user.spotifyUserId)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have access to this playlist' },
        { status: 403 }
      )
    }

    // Get playlist from database to get auto-sort setting
    const dbPlaylist = await prisma.playlist.findFirst({
      where: {
        spotifyPlaylistId: playlistId,
        userId: user.id,
      },
    })

    return NextResponse.json({
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      image: playlist.images[0]?.url,
      trackCount: playlist.tracks.total,
      owner: playlist.owner.display_name,
      public: playlist.public,
      autoSortEnabled: dbPlaylist?.autoSortEnabled ?? true,
      lastSortedAt: dbPlaylist?.lastSortedAt,
    })
  } catch (error) {
    const errorMessage = sanitizeError(error)
    return NextResponse.json(
      { error: 'Failed to fetch playlist' },
      { status: 500 }
    )
  }
}


