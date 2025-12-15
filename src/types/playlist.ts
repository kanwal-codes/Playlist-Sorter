export interface Playlist {
  id: string
  spotifyId: string
  name: string
  description?: string
  image?: string
  trackCount: number
  owner: string
  public: boolean
  autoSortEnabled: boolean
  lastSortedAt?: string
}






