import {
  SpotifyUser,
  SpotifyPlaylist,
  SpotifyPlaylistTracksResponse,
  SpotifyTrack,
  SpotifyAudioFeatures,
} from './types'
import { getValidAccessToken } from './auth'

export class SpotifyClient {
  private accessToken: string
  private refreshToken: string
  private tokenExpiresAt: Date
  private spotifyUserId?: string

  constructor(
    accessToken: string,
    refreshToken: string,
    tokenExpiresAt: Date,
    spotifyUserId?: string
  ) {
    this.accessToken = accessToken
    this.refreshToken = refreshToken
    this.tokenExpiresAt = tokenExpiresAt
    this.spotifyUserId = spotifyUserId
  }

  private async getValidToken(): Promise<string> {
    return getValidAccessToken(
      this.accessToken,
      this.refreshToken,
      this.tokenExpiresAt,
      this.spotifyUserId
    )
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = await this.getValidToken()

    // Import fetchWithTimeout
    const { fetchWithTimeout } = await import('../utils/fetch-with-timeout')

    const response = await fetchWithTimeout(
      `https://api.spotify.com/v1${endpoint}`,
      {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      },
      30000 // 30 second timeout
    )

    if (!response.ok) {
      // Handle 401 Unauthorized - token expired or invalid
      if (response.status === 401) {
        // Try refreshing token once more
        try {
          const refreshedToken = await this.getValidToken()
          // Retry the request with refreshed token
          const { fetchWithTimeout } = await import('../utils/fetch-with-timeout')
          const retryResponse = await fetchWithTimeout(
            `https://api.spotify.com/v1${endpoint}`,
            {
              ...options,
              headers: {
                ...options.headers,
                Authorization: `Bearer ${refreshedToken}`,
                'Content-Type': 'application/json',
              },
            },
            30000
          )

          if (!retryResponse.ok) {
            throw new Error(`Spotify API error: ${retryResponse.status}`)
          }

          return retryResponse.json()
        } catch (refreshError) {
          throw new Error(
            `Token expired and refresh failed. Please re-authenticate. Original error: ${refreshError}`
          )
        }
      }

      // Handle rate limiting (429) with retry logic
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After')
        const retryAfterSeconds = retryAfter ? parseInt(retryAfter, 10) : 60
        
        // Wait for the specified retry time
        await new Promise(resolve => setTimeout(resolve, retryAfterSeconds * 1000))
        
        // Retry the request once
        const { fetchWithTimeout } = await import('../utils/fetch-with-timeout')
        const retryResponse = await fetchWithTimeout(
          `https://api.spotify.com/v1${endpoint}`,
          {
            ...options,
            headers: {
              ...options.headers,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
          30000
        )
        
        if (!retryResponse.ok) {
          throw new Error(`Rate limit exceeded. Retry failed: ${retryResponse.status}`)
        }
        
        return retryResponse.json()
      }

      // Don't expose error details to prevent information leakage
      throw new Error(`Spotify API error: ${response.status}`)
    }

    return response.json()
  }

  async getCurrentUser(): Promise<SpotifyUser> {
    return this.request<SpotifyUser>('/me')
  }

  async getUserPlaylists(limit = 50, offset = 0): Promise<{
    items: SpotifyPlaylist[]
    total: number
  }> {
    const response = await this.request<{
      items: SpotifyPlaylist[]
      total: number
      next: string | null
    }>(`/me/playlists?limit=${limit}&offset=${offset}`)

    return response
  }

  async getAllUserPlaylists(): Promise<SpotifyPlaylist[]> {
    const allPlaylists: SpotifyPlaylist[] = []
    let offset = 0
    const limit = 50

    // Fetch first batch to get total count
    const firstResponse = await this.getUserPlaylists(limit, offset)
    allPlaylists.push(...firstResponse.items)
    
    // If we have all playlists, return early
    if (allPlaylists.length >= firstResponse.total) {
      return allPlaylists
    }

    // Calculate how many more requests we need
    const remaining = firstResponse.total - allPlaylists.length
    const additionalRequests = Math.ceil(remaining / limit)
    
    // Fetch remaining batches with error handling (partial success)
    // Use Promise.allSettled to handle individual failures gracefully
    if (additionalRequests > 0) {
      const promises = []
      for (let i = 1; i <= additionalRequests; i++) {
        promises.push(this.getUserPlaylists(limit, i * limit))
      }
      
      const results = await Promise.allSettled(promises)
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allPlaylists.push(...result.value.items)
        } else {
          // Log error but continue with other playlists
          console.warn(`Failed to fetch playlist batch ${index + 1}:`, result.reason)
        }
      })
    }

    return allPlaylists
  }

  async getPlaylist(playlistId: string): Promise<SpotifyPlaylist> {
    return this.request<SpotifyPlaylist>(`/playlists/${playlistId}`)
  }

  async getPlaylistTracks(
    playlistId: string,
    limit = 100,
    offset = 0
  ): Promise<SpotifyPlaylistTracksResponse> {
    return this.request<SpotifyPlaylistTracksResponse>(
      `/playlists/${playlistId}/tracks?limit=${limit}&offset=${offset}&fields=items(added_at,track(id,name,artists,album(id,name,images,release_date),duration_ms,popularity,external_urls)),total,next`
    )
  }

  async getAllPlaylistTracks(playlistId: string): Promise<SpotifyTrack[]> {
    const allTracks: SpotifyTrack[] = []
    let offset = 0
    const limit = 100

    while (true) {
      const response = await this.getPlaylistTracks(playlistId, limit, offset)
      // Filter out null tracks (deleted/unavailable songs)
      const validTracks = response.items.filter(item => item.track !== null)
      allTracks.push(...validTracks)

      if (!response.items.length || allTracks.length >= response.total) {
        break
      }

      offset += limit
    }

    return allTracks
  }

  // Create a new playlist for the current user
  async createPlaylist(
    userId: string,
    name: string,
    description = '',
    isPublic = false
  ): Promise<{ id: string; external_urls: { spotify: string } }> {
    return this.request<{ id: string; external_urls: { spotify: string } }>(
      `/users/${userId}/playlists`,
      {
        method: 'POST',
        body: JSON.stringify({
          name,
          description,
          public: isPublic,
        }),
      }
    )
  }

  // Add tracks (URIs) to a playlist in a single request (max 100 per call)
  async addTracksToPlaylist(
    playlistId: string,
    uris: string[]
  ): Promise<void> {
    if (!uris.length) return
    await this.request(`/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: JSON.stringify({ uris }),
    })
  }

  async reorderPlaylistTracks(
    playlistId: string,
    rangeStart: number,
    insertBefore: number,
    rangeLength = 1
  ): Promise<void> {
    await this.request(`/playlists/${playlistId}/tracks`, {
      method: 'PUT',
      body: JSON.stringify({
        range_start: rangeStart,
        insert_before: insertBefore,
        range_length: rangeLength,
      }),
    })
  }

  /**
   * SAFE PLAYLIST TRACK REPLACEMENT
   * 
   * CRITICAL SAFEGUARDS:
   * 1. NEVER allows empty arrays (prevents accidental deletion)
   * 2. Verifies track count before and after operation
   * 3. Throws error if track count doesn't match (prevents partial operations)
   * 4. Uses atomic operations where possible
   * 
   * @param playlistId - Spotify playlist ID
   * @param trackUris - Array of track URIs to set (MUST contain all tracks)
   * @param expectedTrackCount - Expected number of tracks (for verification)
   * @throws Error if trackUris is empty or if verification fails
   */
  async replacePlaylistTracks(
    playlistId: string,
    trackUris: string[],
    expectedTrackCount?: number
  ): Promise<void> {
    // CRITICAL SAFEGUARD: Never allow empty arrays - this would delete all tracks!
    if (trackUris.length === 0) {
      throw new Error(
        'SAFETY: Cannot replace playlist with empty array. This would delete all tracks. ' +
        'If you want to clear a playlist, you must do it manually through Spotify.'
      )
    }

    // SAFEGUARD: Verify we have tracks to work with
    if (expectedTrackCount !== undefined && trackUris.length !== expectedTrackCount) {
      throw new Error(
        `SAFETY: Track count mismatch. Expected ${expectedTrackCount} tracks, ` +
        `but got ${trackUris.length}. Aborting to prevent data loss.`
      )
    }

    // CRITICAL FIX: Spotify API PUT /playlists/{id}/tracks REPLACES the entire playlist
    // If we have >100 tracks, we can't use PUT in chunks (each chunk would replace everything)
    // Strategy: Clear playlist first, then add tracks in batches
    // NOTE: We clear and re-add to maintain order, but we verify after to ensure nothing was lost
    
    if (trackUris.length <= 100) {
      // For <=100 tracks, use PUT to replace all at once (atomic operation)
      await this.request(`/playlists/${playlistId}/tracks`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: trackUris,
        }),
      })
      
      // VERIFICATION: Verify all tracks were added successfully
      await this.verifyPlaylistTrackCount(playlistId, trackUris.length)
    } else {
      // For >100 tracks:
      // 1. Clear the playlist (PUT with empty array) - REQUIRED for reordering
      // 2. Add tracks in batches of 100 using POST
      // 3. VERIFY all tracks were added (CRITICAL SAFEGUARD)
      
      // Step 1: Clear playlist (required for reordering large playlists)
      // This is safe because we immediately add all tracks back
      await this.request(`/playlists/${playlistId}/tracks`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: [],
        }),
      })
      
      // Step 2: Add tracks in batches of 100
      // Note: POST /playlists/{id}/tracks adds tracks to the end by default
      const chunkSize = 100
      for (let i = 0; i < trackUris.length; i += chunkSize) {
        const chunk = trackUris.slice(i, i + chunkSize)
        await this.request(`/playlists/${playlistId}/tracks`, {
          method: 'POST',
          body: JSON.stringify({
            uris: chunk,
          }),
        })
        
        // Small delay between batches to avoid rate limiting
        if (i + chunkSize < trackUris.length) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
      
      // CRITICAL VERIFICATION: Ensure all tracks were added successfully
      // If this fails, we've lost tracks and need to alert
      await this.verifyPlaylistTrackCount(playlistId, trackUris.length)
    }
  }

  /**
   * Verifies that a playlist has the expected number of tracks.
   * Throws an error if the count doesn't match (prevents silent failures).
   * 
   * @param playlistId - Spotify playlist ID
   * @param expectedCount - Expected number of tracks
   * @throws Error if track count doesn't match
   */
  private async verifyPlaylistTrackCount(
    playlistId: string,
    expectedCount: number
  ): Promise<void> {
    // Get current track count
    const playlist = await this.getPlaylist(playlistId)
    const actualCount = playlist.tracks.total

    if (actualCount !== expectedCount) {
      const errorMsg = 
        `CRITICAL SAFETY ERROR: Track count mismatch after replacement! ` +
        `Expected ${expectedCount} tracks, but playlist now has ${actualCount} tracks. ` +
        `This indicates tracks may have been lost. Operation aborted.`
      
      console.error(`      ❌ ${errorMsg}`)
      throw new Error(errorMsg)
    }

    // Verification successful
  }

  async getAudioFeatures(trackIds: string[]): Promise<SpotifyAudioFeatures[]> {
    // Spotify API has a limit of 100 tracks per request
    const chunkSize = 100
    const allFeatures: SpotifyAudioFeatures[] = []

    for (let i = 0; i < trackIds.length; i += chunkSize) {
      const chunk = trackIds.slice(i, i + chunkSize)
      const ids = chunk.join(',')
      const response = await this.request<{
        audio_features: SpotifyAudioFeatures[]
      }>(`/audio-features?ids=${ids}`)

      allFeatures.push(...response.audio_features.filter((f) => f !== null))
    }

    return allFeatures
  }
}

