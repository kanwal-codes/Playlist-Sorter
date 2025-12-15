import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySpotifyId } from '@/lib/db/queries'
import { prisma } from '@/lib/db/client'
import { SpotifyClient } from '@/lib/spotify/client'
import { validateSpotifyPlaylistId, validateRequestBodySize } from '@/lib/utils/validation'
import { verifyPlaylistOwnership, sanitizeError, validateOrigin } from '@/lib/utils/security'
import { checkRateLimit, getClientIdentifier } from '@/lib/utils/rate-limit'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // CSRF protection
    if (!validateOrigin(request, [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'])) {
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      )
    }

    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(`playlist-settings-${clientId}`, 20, 60000)
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

    // Request size validation
    const bodyText = await request.text()
    try {
      validateRequestBodySize(bodyText, 1024) // Max 1KB
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Request too large' },
        { status: 413 }
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

    // CRITICAL: Verify playlist ownership via Spotify API
    const client = new SpotifyClient(
      user.accessToken,
      user.refreshToken,
      user.tokenExpiresAt,
      user.spotifyUserId
    )
    const spotifyPlaylist = await client.getPlaylist(playlistId)
    if (!verifyPlaylistOwnership(spotifyPlaylist, user.spotifyUserId)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to modify this playlist' },
        { status: 403 }
      )
    }

    const body = JSON.parse(bodyText)
    const { autoSortEnabled } = body

    if (typeof autoSortEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'autoSortEnabled must be a boolean' },
        { status: 400 }
      )
    }

    // Find playlist in database
    const playlist = await prisma.playlist.findFirst({
      where: {
        spotifyPlaylistId: playlistId,
        userId: user.id,
      },
    })

    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      )
    }

    // Update playlist auto-sort setting
    const updatedPlaylist = await prisma.playlist.update({
      where: { id: playlist.id },
      data: { 
        autoSortEnabled,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      autoSortEnabled: updatedPlaylist.autoSortEnabled,
    })
  } catch (error) {
    const errorMessage = sanitizeError(error)
    return NextResponse.json(
      { error: 'Failed to update playlist settings' },
      { status: 500 }
    )
  }
}

