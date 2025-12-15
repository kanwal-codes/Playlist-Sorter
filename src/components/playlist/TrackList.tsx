'use client'

import { Track } from '@/types/track'
import { formatDistanceToNow, format } from 'date-fns'

interface TrackListProps {
  tracks: Track[]
}

export function TrackList({ tracks }: TrackListProps) {
  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const formatReleaseDate = (releaseDate?: string): string => {
    if (!releaseDate) {
      return 'Unknown'
    }
    
    // Parse release date (handles YYYY, YYYY-MM, YYYY-MM-DD)
    const parts = releaseDate.split('-')
    if (parts.length === 1) {
      // Just year
      return releaseDate
    } else if (parts.length === 2) {
      // Year and month
      try {
        const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
        return format(date, 'MMM yyyy')
      } catch {
        return releaseDate
      }
    } else {
      // Full date
      try {
        const date = new Date(releaseDate)
        return format(date, 'MMM d, yyyy')
      } catch {
        return releaseDate
      }
    }
  }

  return (
    <div className="space-y-2">
      {tracks.map((track, index) => (
        <div
          key={track.id}
          className="flex items-center space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-colors"
        >
          <span className="text-sm text-muted-foreground w-8">{index + 1}</span>
          {track.albumImage && (
            <img
              src={track.albumImage}
              alt={track.album}
              className="w-12 h-12 rounded object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{track.name}</p>
            <p className="text-sm text-muted-foreground truncate">
              {track.artists} • {track.album}
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {track.releaseDate ? (
              <span title={`Released: ${formatReleaseDate(track.releaseDate)}`}>
                {formatReleaseDate(track.releaseDate)}
              </span>
            ) : (
              <span className="text-muted-foreground/50">Unknown</span>
            )}
          </div>
          <div className="text-sm text-muted-foreground w-16 text-right">
            {formatDuration(track.duration)}
          </div>
        </div>
      ))}
    </div>
  )
}


