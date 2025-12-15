import {
  getAllUsersWithAutoSort,
  updatePlaylistLastSorted,
  createSortLog,
  getPlaylistsByUserId,
} from '../db/queries'
import { SpotifyClient } from '../spotify/client'

// Helper function to parse release date (handles YYYY, YYYY-MM, YYYY-MM-DD formats)
function parseReleaseDate(releaseDate: string): Date {
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

// Compare tracks to group albums together while keeping newest release date first
const compareTracks = (a: SpotifyPlaylistTrack, b: SpotifyPlaylistTrack) => {
  const trackA = a.track!
  const trackB = b.track!

  // 1) Release date (newest first)
  const dateA = parseReleaseDate(trackA.album.release_date).getTime()
  const dateB = parseReleaseDate(trackB.album.release_date).getTime()
  if (dateB !== dateA) return dateB - dateA

  // 2) Album name (group same album together)
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

export async function sortAllPlaylists() {
  const results = {
    usersProcessed: 0,
    playlistsSorted: 0,
    playlistsSkipped: 0,
    errors: [] as string[],
  }

  const startTime = Date.now()

  try {
    // Get all users with auto-sort enabled
    const users = await getAllUsersWithAutoSort()

    for (const user of users) {
      try {
        results.usersProcessed++

        const client = new SpotifyClient(
          user.accessToken,
          user.refreshToken,
          user.tokenExpiresAt,
          user.spotifyUserId
        )

        // Get user's playlists from database
        const dbPlaylists = await getPlaylistsByUserId(user.id)

        // Filter to only auto-sort enabled playlists
        const playlistsToSort = dbPlaylists.filter(
          (p) => p.autoSortEnabled
        )
        const playlistsSkipped = dbPlaylists.length - playlistsToSort.length
        
        results.playlistsSkipped += playlistsSkipped

        // Process playlists ONE AT A TIME (sequential processing)
        // This ensures we don't overwhelm Spotify API and can track progress
        for (let i = 0; i < playlistsToSort.length; i++) {
          const playlist = playlistsToSort[i]
          
          try {
            // Get all tracks with release date
            const tracks = await client.getAllPlaylistTracks(
              playlist.spotifyPlaylistId
            )

            if (tracks.length === 0) {
              continue
            }
            
            // Filter out null tracks (deleted/unavailable songs)
            const validTracks = tracks.filter((item) => item.track !== null)

            if (validTracks.length === 0) {
              continue
            }

            // Sort by release date (newest first), grouping same album together
            const sortedTracks = [...validTracks].sort(compareTracks)

            // Check if already sorted
            let needsSorting = false
            for (let i = 0; i < validTracks.length; i++) {
              if (validTracks[i].track!.id !== sortedTracks[i].track!.id) {
                needsSorting = true
                break
              }
            }

            if (!needsSorting) {
              // Already sorted, just update timestamp
              await updatePlaylistLastSorted(playlist.id)
              await createSortLog({
                userId: user.id,
                playlistId: playlist.id,
                status: 'success',
                tracksSorted: validTracks.length,
              })
              results.playlistsSorted++
              continue
            }

            // Reorder playlist - ONE AT A TIME
            // Spotify API requires us to replace all tracks
            const trackUris = sortedTracks
              .map((item) => {
                if (!item.track?.id) {
                  return null
                }
                return `spotify:track:${item.track.id}`
              })
              .filter((uri): uri is string => uri !== null) // Remove nulls

            // Safety check: Ensure we have the same number of tracks
            if (trackUris.length !== validTracks.length) {
              const errorMsg = `Track count mismatch: Expected ${validTracks.length}, got ${trackUris.length} URIs`
              throw new Error(errorMsg)
            }

            if (trackUris.length === 0) {
              continue
            }

            // CRITICAL SAFEGUARD: Pass expected track count for verification
            await client.replacePlaylistTracks(
              playlist.spotifyPlaylistId,
              trackUris,
              validTracks.length // Expected count for verification
            )

            // Update database atomically using transaction
            const { prisma } = await import('../db/client')
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

            results.playlistsSorted++
            
            // Small delay between playlists to avoid rate limiting
            // (Spotify allows 100 requests per second, but being conservative)
            if (i < playlistsToSort.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 100)) // 100ms delay
            }
          } catch (error) {
            // Don't expose detailed error messages
            results.errors.push(
              `Playlist ${playlist.name}: Operation failed`
            )

            await createSortLog({
              userId: user.id,
              playlistId: playlist.id,
              status: 'failed',
              errorMessage: 'Operation failed', // Don't expose detailed error messages
            })
          }
        }
      } catch (error) {
        // Don't expose user IDs or detailed errors
        results.errors.push(`User processing failed`)
      }
    }

  } catch (error) {
    // Don't expose detailed error messages
    results.errors.push(`Global error: Operation failed`)
  }

  return results
}

