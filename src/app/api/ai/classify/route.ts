import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getUserBySpotifyId } from '@/lib/db/queries'
import { SpotifyClient } from '@/lib/spotify/client'
import { prisma } from '@/lib/db/client'
import { sanitizeError, validateOrigin } from '@/lib/utils/security'
import { checkRateLimit, getClientIdentifier } from '@/lib/utils/rate-limit'
import { getAllowedOrigins } from '@/lib/utils/url'
import OpenAI from 'openai'

// Controlled vocabularies
const SITUATIONS = ['gym','party','chill','study','sad','happy','roadtrip','focus','romantic','family','driving']
const MOODS = ['happy','sad','energetic','calm','melancholic']

export async function POST(request: Request) {
  try {
    // CSRF / Origin check (allow localhost)
    if (!validateOrigin(request, getAllowedOrigins())) {
      return NextResponse.json({ error: 'Invalid origin' }, { status: 403 })
    }

    // Rate limit
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(`ai-classify-${clientId}`, 5, 60000)
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

    // Auth
    const spotifyUserId = cookies().get('spotify_user_id')?.value
    if (!spotifyUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    const user = await getUserBySpotifyId(spotifyUserId)
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Body
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const playlistId: string | undefined = body?.playlistId
    if (!playlistId) {
      return NextResponse.json({ error: 'playlistId is required' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const client = new SpotifyClient(
      user.accessToken,
      user.refreshToken,
      user.tokenExpiresAt,
      user.spotifyUserId
    )

    // Fetch tracks and audio features
    const tracks = await client.getAllPlaylistTracks(playlistId)
    const validTracks = tracks.filter(t => t.track !== null)
    const trackIds = validTracks.map(t => t.track!.id).filter(Boolean)
    const features = trackIds.length ? await client.getAudioFeatures(trackIds) : []
    const featureMap = new Map(features.map(f => [f.id, f]))

    // Prepare payload for OpenAI (keep small)
    const items = validTracks.slice(0, 100).map((item) => {
      const track = item.track!
      const f = featureMap.get(track.id)
      return {
        track_id: track.id,
        title: track.name,
        artists: track.artists.map(a => a.name).join(', '),
        album: track.album.name,
        popularity: track.popularity,
        energy: f?.energy,
        valence: f?.valence,
        tempo: f?.tempo,
        danceability: f?.danceability,
      }
    })

    const prompt = `
You are a music classifier. For each track, return JSON with:
- track_id
- language (guess)
- situations: pick 1-3 from ${JSON.stringify(SITUATIONS)}
- moods: pick 1-2 from ${JSON.stringify(MOODS)}

Input: ${JSON.stringify(items)}

Output format:
{ "tracks": [ { "track_id": "...", "language": "...", "situations": ["..."], "moods": ["..."] } ] }
Only return JSON, no extra text.`

    const openai = new OpenAI()
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
    })

    let parsed: any = {}
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || '{}')
    } catch (err) {
      console.error('Failed to parse OpenAI response', err)
      return NextResponse.json({ error: 'Failed to parse OpenAI response' }, { status: 500 })
    }

    const tracksOut: any[] = parsed?.tracks || []

    // Upsert into track_tags
    const operations = tracksOut.map((t) =>
      prisma.trackTag.upsert({
        where: { trackId: t.track_id },
        update: {
          situations: Array.isArray(t.situations) ? t.situations : [],
          moods: Array.isArray(t.moods) ? t.moods : [],
          language: t.language || null,
        },
        create: {
          trackId: t.track_id,
          situations: Array.isArray(t.situations) ? t.situations : [],
          moods: Array.isArray(t.moods) ? t.moods : [],
          language: t.language || null,
        },
      })
    )

    await prisma.$transaction(operations)

    return NextResponse.json({
      message: 'Classification completed',
      classified: tracksOut.length,
    })
  } catch (error) {
    console.error('Classification error:', error)
    const errorMessage = sanitizeError(error)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}


