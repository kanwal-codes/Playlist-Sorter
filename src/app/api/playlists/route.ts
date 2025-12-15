import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySpotifyId, createOrUpdatePlaylist } from '@/lib/db/queries'
import { SpotifyClient } from '@/lib/spotify/client'
import { sanitizeError } from '@/lib/utils/security'
import { checkRateLimit, getClientIdentifier } from '@/lib/utils/rate-limit'

// Background sync function (non-blocking)
// IMPORTANT: This preserves existing autoSortEnabled settings
async function syncPlaylistsToDatabase(userId: string, spotifyPlaylists: any[], existingPlaylists: Map<string, any>) {
  const batchSize = 20
  for (let i = 0; i < spotifyPlaylists.length; i += batchSize) {
    const batch = spotifyPlaylists.slice(i, i + batchSize)
    // Use Promise.allSettled for partial success handling
    const results = await Promise.allSettled(
      batch.map((playlist) => {
        const existing = existingPlaylists.get(playlist.id)
        return createOrUpdatePlaylist({
          userId,
          spotifyPlaylistId: playlist.id,
          name: playlist.name,
          // Preserve existing autoSortEnabled setting if playlist already exists
          autoSortEnabled: existing?.autoSortEnabled ?? true,
        })
      })
    )
    
    // Log failures but continue processing
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Failed to sync playlist ${batch[index]?.id}:`, result.reason)
      }
    })
    
    // Small delay between batches to avoid overwhelming database
    if (i + batchSize < spotifyPlaylists.length) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
}

export async function GET(request: Request) {
  try {
    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(`playlists-list-${clientId}`, 50, 60000)
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

    // Fetch playlists from Spotify (already optimized with parallel calls)
    const spotifyPlaylists = await client.getAllUserPlaylists()
    
    // Create playlist map for quick lookup
    const dbPlaylistMap = new Map(
      user.playlists.map((p) => [p.spotifyPlaylistId, p])
    )

    // Return MINIMAL data immediately - just what's needed to display the list
    // Full details (description, owner, etc.) will be loaded when user clicks on a playlist
    const playlists = spotifyPlaylists.map((spotifyPlaylist) => {
      const dbPlaylist = dbPlaylistMap.get(spotifyPlaylist.id)

      return {
        id: dbPlaylist?.id || spotifyPlaylist.id,
        spotifyId: spotifyPlaylist.id,
        name: spotifyPlaylist.name,
        // Minimal data - load full details on click
        image: spotifyPlaylist.images[0]?.url || null,
        trackCount: spotifyPlaylist.tracks.total,
        autoSortEnabled: dbPlaylist?.autoSortEnabled ?? true,
        lastSortedAt: dbPlaylist?.lastSortedAt,
      }
    })

    // Sync database in background (non-blocking)
    // Pass existing playlists map to preserve autoSortEnabled settings
    syncPlaylistsToDatabase(user.id, spotifyPlaylists, dbPlaylistMap).catch(() => {
      // Silently fail background sync - don't expose errors or affect user experience
      // Errors are logged server-side for monitoring
    })
    
    return NextResponse.json({ playlists })
  } catch (error) {
    const errorMessage = sanitizeError(error)
    return NextResponse.json(
      { error: 'Failed to fetch playlists' },
      { status: 500 }
    )
  }
}
