import { openai } from './openai'
import { SpotifyClient } from '../spotify/client'
import { SpotifyTrack, SpotifyAudioFeatures } from '../spotify/types'
import {
  getRecommendation,
  createOrUpdateRecommendation,
} from '../db/queries'
import { sanitizeForPrompt } from '../utils/sanitize'

interface TrackInfo {
  name: string
  artists: string
  album: string
  duration: number
  popularity: number
  audioFeatures?: SpotifyAudioFeatures
}

export async function generateRecommendations(
  playlistId: string,
  client: SpotifyClient,
  tracks: SpotifyTrack[]
): Promise<any[]> {
  // Check cache first
  const cached = await getRecommendation(playlistId)
  if (cached) {
    return cached.recommendations as any[]
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured')
  }

  // Get audio features for tracks (filter out null tracks first)
  const validTracks = tracks.filter((t) => t.track !== null)
  const trackIds = validTracks
    .map((t) => t.track!.id)
    .filter((id) => id !== null) as string[]

  let audioFeatures: SpotifyAudioFeatures[] = []
  if (trackIds.length > 0) {
    try {
      audioFeatures = await client.getAudioFeatures(trackIds)
    } catch (error) {
      console.error('Error fetching audio features:', error)
    }
  }

  // Prepare track information (only for valid tracks)
  // SECURITY: Sanitize all user-provided data before inserting into prompt
  const trackInfo: TrackInfo[] = validTracks.map((item, index) => {
    const track = item.track! // Non-null assertion after filter
    const features = audioFeatures[index]
    return {
      name: sanitizeForPrompt(track.name),
      artists: sanitizeForPrompt(track.artists.map((a) => a.name).join(', ')),
      album: sanitizeForPrompt(track.album.name),
      duration: track.duration_ms,
      popularity: track.popularity,
      audioFeatures: features,
    }
  })

  // Calculate average audio features
  const avgFeatures = audioFeatures.length > 0
    ? {
        danceability:
          audioFeatures.reduce((sum, f) => sum + f.danceability, 0) /
          audioFeatures.length,
        energy:
          audioFeatures.reduce((sum, f) => sum + f.energy, 0) /
          audioFeatures.length,
        valence:
          audioFeatures.reduce((sum, f) => sum + f.valence, 0) /
          audioFeatures.length,
        tempo:
          audioFeatures.reduce((sum, f) => sum + f.tempo, 0) /
          audioFeatures.length,
      }
    : null

  // Build prompt
  const prompt = `Analyze this Spotify playlist and provide 5 song recommendations that would fit well.

Playlist tracks:
${trackInfo
  .slice(0, 20)
  .map(
    (t) =>
      `- "${t.name}" by ${t.artists} (Album: ${t.album}, Popularity: ${t.popularity}/100${
        t.audioFeatures
          ? `, Energy: ${t.audioFeatures.energy.toFixed(2)}, Danceability: ${t.audioFeatures.danceability.toFixed(2)}`
          : ''
      })`
  )
  .join('\n')}

${
  avgFeatures
    ? `Average playlist characteristics:
- Energy: ${avgFeatures.energy.toFixed(2)}
- Danceability: ${avgFeatures.danceability.toFixed(2)}
- Valence (positivity): ${avgFeatures.valence.toFixed(2)}
- Tempo: ${avgFeatures.tempo.toFixed(0)} BPM
`
    : ''
}

Provide 5 song recommendations in JSON format:
{
  "recommendations": [
    {
      "song": "Song Name",
      "artist": "Artist Name",
      "reason": "Why this song fits the playlist"
    }
  ]
}

Focus on:
- Matching genre and mood
- Similar energy and tempo levels
- Complementary styles that enhance the playlist
- Popular songs that listeners would enjoy`

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content:
            'You are a music expert who provides thoughtful song recommendations for Spotify playlists. Always respond with valid JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    // Validate and parse OpenAI response
    const content = completion.choices[0]?.message?.content
    if (!content) {
      throw new Error('Empty response from OpenAI')
    }
    
    let response: any
    try {
      response = JSON.parse(content)
    } catch (error) {
      console.error('Failed to parse OpenAI JSON response:', error)
      throw new Error('Invalid JSON response from OpenAI')
    }
    
    // Validate response structure
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format from OpenAI')
    }
    
    if (!Array.isArray(response.recommendations)) {
      console.warn('OpenAI response missing recommendations array, using empty array')
      return []
    }

    const recommendations = response.recommendations

    // Cache recommendations (expires in 24 hours)
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    await createOrUpdateRecommendation(playlistId, recommendations, expiresAt)

    return recommendations
  } catch (error) {
    console.error('Error generating recommendations:', error)
    throw error
  }
}




