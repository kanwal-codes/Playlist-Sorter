export interface SpotifyTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  refresh_token: string
  scope: string
}

export interface SpotifyUser {
  id: string
  display_name: string
  email: string
  images: Array<{ url: string }>
}

export interface SpotifyPlaylist {
  id: string
  name: string
  description: string
  images: Array<{ url: string }>
  owner: {
    display_name: string
    id: string
  }
  tracks: {
    href: string
    total: number
  }
  public: boolean
  collaborative: boolean
}

export interface SpotifyTrack {
  added_at: string
  track: {
    id: string
    name: string
    artists: Array<{ name: string; id: string }>
    album: {
      id: string
      name: string
      images: Array<{ url: string }>
      release_date: string
    }
    duration_ms: number
    popularity: number
    external_urls: {
      spotify: string
    }
  } | null // Track can be null if song was deleted/unavailable
}

export interface SpotifyPlaylistTracksResponse {
  items: SpotifyTrack[]
  total: number
  next: string | null
}

export interface SpotifyAudioFeatures {
  // Spotify returns the track ID alongside the audio features
  id?: string
  danceability: number
  energy: number
  key: number
  loudness: number
  mode: number
  speechiness: number
  acousticness: number
  instrumentalness: number
  liveness: number
  valence: number
  tempo: number
  duration_ms: number
  time_signature: number
}




