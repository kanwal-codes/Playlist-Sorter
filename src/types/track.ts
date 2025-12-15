export interface Track {
  id: string
  name: string
  artists: string
  album: string
  albumImage?: string
  duration: number
  popularity: number
  addedAt: string
  releaseDate?: string // Release date of the track
  spotifyUrl: string
}


