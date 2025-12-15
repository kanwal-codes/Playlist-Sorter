import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySpotifyId } from '@/lib/db/queries'
import { SpotifyClient } from '@/lib/spotify/client'
import { prisma } from '@/lib/db/client'
import { sanitizeError, validateOrigin } from '@/lib/utils/security'
import { checkRateLimit, getClientIdentifier } from '@/lib/utils/rate-limit'

type FilterInput = {
  sourcePlaylistId: string
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
    const rateLimit = checkRateLimit(`ai-filter-${clientId}`, 10, 60000)
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

    let body: FilterInput
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.sourcePlaylistId) {
      return NextResponse.json({ error: 'sourcePlaylistId is required' }, { status: 400 })
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
      where: {
        trackId: { in: Array.from(trackIdSet) },
      },
    })
    const tagMap = new Map(tags.map(t => [t.trackId, t]))

    const artistFilter = body.artist?.toLowerCase().trim()
    const situationFilter = body.situation?.toLowerCase().trim()
    const moodFilter = body.mood?.toLowerCase().trim()
    const languageFilter = body.language?.toLowerCase().trim()

    const filtered = validTracks.filter((item) => {
      const track = item.track!
      const t = tagMap.get(track.id)

      // Artist filter
      if (artistFilter) {
        const match = track.artists.some(a => a.name.toLowerCase().includes(artistFilter))
        if (!match) return false
      }

      // Situation filter
      if (situationFilter) {
        if (!t || !(t.situations || []).some(s => s.toLowerCase() === situationFilter)) return false
      }

      // Mood filter
      if (moodFilter) {
        if (!t || !(t.moods || []).some(m => m.toLowerCase() === moodFilter)) return false
      }

      // Language filter
      if (languageFilter) {
        if (!t || (t.language || '').toLowerCase() !== languageFilter) return false
      }

      return true
    })

    const formatted = filtered.map((item) => {
      const track = item.track!
      const t = tagMap.get(track.id)
      return {
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        albumImage: track.album.images[0]?.url,
        duration: track.duration_ms,
        popularity: track.popularity,
        releaseDate: track.album.release_date,
        spotifyUrl: track.external_urls.spotify,
        tags: {
          situations: t?.situations || [],
          moods: t?.moods || [],
          language: t?.language || null,
        },
      }
    })

    return NextResponse.json({
      total: formatted.length,
      tracks: formatted,
    })
  } catch (error) {
    console.error('AI filter error:', error)
    const errorMessage = sanitizeError(error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


