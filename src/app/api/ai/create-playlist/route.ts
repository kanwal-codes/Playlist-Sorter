import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySpotifyId } from '@/lib/db/queries'
import { SpotifyClient } from '@/lib/spotify/client'
import { prisma } from '@/lib/db/client'
import { sanitizeError, validateOrigin } from '@/lib/utils/security'
import { checkRateLimit, getClientIdentifier } from '@/lib/utils/rate-limit'

type CreatePayload = {
  sourcePlaylistId: string
  name: string
  description?: string
  artist?: string
  situation?: string
  mood?: string
  language?: string
}

export async function POST(request: Request) {
  try {
    if (!validateOrigin(request, [process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'])) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
    }

    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(`ai-create-${clientId}`, 5, 60000)
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

    let body: CreatePayload
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.sourcePlaylistId || !body.name) {
      return NextResponse.json({ error: 'sourcePlaylistId and name are required' }, { status: 400 })
    }

    const client = new SpotifyClient(
      user.accessToken,
      user.refreshToken,
      user.tokenExpiresAt,
      user.spotifyUserId
    )

    // Fetch source playlist tracks
    const tracks = await client.getAllPlaylistTracks(body.sourcePlaylistId)
    const validTracks = tracks.filter(t => t.track !== null)
    const trackIdSet = new Set(validTracks.map(t => t.track!.id))
    const tags = await prisma.trackTag.findMany({
      where: { trackId: { in: Array.from(trackIdSet) } },
    })
    const tagMap = new Map(tags.map(t => [t.trackId, t]))

    const artistFilter = body.artist?.toLowerCase().trim()
    const situationFilter = body.situation?.toLowerCase().trim()
    const moodFilter = body.mood?.toLowerCase().trim()
    const languageFilter = body.language?.toLowerCase().trim()

    const filtered = validTracks.filter((item) => {
      const track = item.track!
      const t = tagMap.get(track.id)

      if (artistFilter) {
        const match = track.artists.some(a => a.name.toLowerCase().includes(artistFilter))
        if (!match) return false
      }

      if (situationFilter) {
        if (!t || !(t.situations || []).some(s => s.toLowerCase() === situationFilter)) return false
      }

      if (moodFilter) {
        if (!t || !(t.moods || []).some(m => m.toLowerCase() === moodFilter)) return false
      }

      if (languageFilter) {
        if (!t || (t.language || '').toLowerCase() !== languageFilter) return false
      }

      return true
    })

    if (filtered.length === 0) {
      return NextResponse.json({ error: 'No tracks matched the filters' }, { status: 400 })
    }

    // Create playlist using client helper (avoids private request access)
    const createRes = await client.createPlaylist(
      user.spotifyUserId,
      body.name,
      body.description || 'Created by AI from core playlist',
      false
    )

    const newPlaylistId = createRes.id

    // Add tracks in batches of 100
    const uris = filtered.map(f => `spotify:track:${f.track!.id}`)
    for (let i = 0; i < uris.length; i += 100) {
      const chunk = uris.slice(i, i + 100)
      await client.addTracksToPlaylist(newPlaylistId, chunk)
    }

    return NextResponse.json({
      message: 'Playlist created',
      playlistId: newPlaylistId,
      spotifyUrl: createRes.external_urls?.spotify,
      tracksAdded: uris.length,
    })
  } catch (error) {
    console.error('AI create playlist error:', error)
    const errorMessage = sanitizeError(error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


