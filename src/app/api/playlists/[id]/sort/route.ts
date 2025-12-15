import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySpotifyId, updatePlaylistLastSorted, createSortLog } from '@/lib/db/queries'
import { SpotifyClient } from '@/lib/spotify/client'
import { prisma } from '@/lib/db/client'
import { validateSpotifyPlaylistId, validateRequestBodySize } from '@/lib/utils/validation'
import { verifyPlaylistOwnership, sanitizeError, validateOrigin } from '@/lib/utils/security'
import { checkRateLimit, getClientIdentifier } from '@/lib/utils/rate-limit'

export async function POST(
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
    const rateLimit = checkRateLimit(`playlist-sort-${clientId}`, 10, 60000) // 10 requests per minute
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
    const body = await request.text()
    try {
      validateRequestBodySize(body, 1024) // Max 1KB for POST body
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

    const client = new SpotifyClient(
      user.accessToken,
      user.refreshToken,
      user.tokenExpiresAt,
      user.spotifyUserId
    )

    // CRITICAL: Verify playlist ownership via Spotify API first
    const spotifyPlaylist = await client.getPlaylist(playlistId)
    if (!verifyPlaylistOwnership(spotifyPlaylist, user.spotifyUserId)) {
      return NextResponse.json(
        { error: 'Unauthorized: You do not have permission to sort this playlist' },
        { status: 403 }
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

    // Get all tracks with release date
    const tracks = await client.getAllPlaylistTracks(playlistId)

    // Filter out null tracks (deleted/unavailable songs)
    const validTracks = tracks.filter((item) => item.track !== null)

    if (validTracks.length === 0) {
      return NextResponse.json({ message: 'Playlist is empty or has no valid tracks' })
    }

    // Helper function to parse release date (handles YYYY, YYYY-MM, YYYY-MM-DD formats)
    const parseReleaseDate = (releaseDate: string): Date => {
      if (!releaseDate) {
        // If no release date, treat as very old (put at bottom)
        return new Date(0)
      }
      
      const parts = releaseDate.split('-')
      if (parts.length === 1) {
        // Just year (YYYY)
        return new Date(parseInt(parts[0]), 0, 1)
      } else if (parts.length === 2) {
        // Year and month (YYYY-MM)
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
      } else {
        // Full date (YYYY-MM-DD)
        return new Date(releaseDate)
      }
    }

    // Helper to group same album together while sorting by newest release date
    const compareTracks = (a: typeof validTracks[number], b: typeof validTracks[number]) => {
      const trackA = a.track!
      const trackB = b.track!

      // 1) Release date (newest first)
      const dateA = parseReleaseDate(trackA.album.release_date).getTime()
      const dateB = parseReleaseDate(trackB.album.release_date).getTime()
      if (dateB !== dateA) return dateB - dateA

      // 2) Album name
      const albumCmp = trackA.album.name.localeCompare(trackB.album.name)
      if (albumCmp !== 0) return albumCmp

      // 3) Disc number
      const discCmp = (trackA.disc_number ?? 0) - (trackB.disc_number ?? 0)
      if (discCmp !== 0) return discCmp

      // 4) Track number
      const trackNumCmp = (trackA.track_number ?? 0) - (trackB.track_number ?? 0)
      if (trackNumCmp !== 0) return trackNumCmp

      // 5) Fallback: track name
      return trackA.name.localeCompare(trackB.name)
    }

    // Sort by release date with album grouping
    const sortedTracks = [...validTracks].sort(compareTracks)

    // Reorder playlist
    const trackUris = sortedTracks
      .map((item) => {
        if (!item.track?.id) {
          console.warn(`Skipping track without ID: ${item.track?.name || 'Unknown'}`)
          return null
        }
        return `spotify:track:${item.track.id}`
      })
      .filter((uri): uri is string => uri !== null) // Remove nulls

    // Safety check: Ensure we have the same number of tracks
    if (trackUris.length !== validTracks.length) {
      throw new Error(`Track count mismatch: Expected ${validTracks.length}, got ${trackUris.length} URIs`)
    }

    // CRITICAL SAFEGUARD: Never allow empty track arrays
    if (trackUris.length === 0) {
      return NextResponse.json(
        { error: 'No valid tracks to sort. Cannot proceed as this would clear the playlist.' },
        { status: 400 }
      )
    }

    // CRITICAL SAFEGUARD: Pass expected track count for verification
    await client.replacePlaylistTracks(
      params.id,
      trackUris,
      validTracks.length // Expected count for verification
    )

    // Update database atomically using transaction
    await prisma.$transaction(async (tx) => {
      await tx.playlist.update({
        where: { id: playlist.id },
        data: { lastSortedAt: new Date() },
      })
      await tx.sortLog.create({
        data: {
          userId: user.id,
          playlistId: playlist.id,
          status: 'success',
          tracksSorted: validTracks.length,
        },
      })
    })

    return NextResponse.json({
      message: 'Playlist sorted successfully',
      tracksSorted: validTracks.length,
    })
  } catch (error) {
    const errorMessage = sanitizeError(error)
    return NextResponse.json(
      { error: 'Failed to sort playlist' },
      { status: 500 }
    )
  }
}


