'use client'

import { Playlist } from '@/types/playlist'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Clock, Music, SortAsc } from 'lucide-react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { useState, useEffect } from 'react'
import { usePlaylists } from '@/context/PlaylistContext'
import { cn } from '@/lib/utils'

interface PlaylistCardProps {
  playlist: Playlist
  onSort?: (playlistId: string) => void
  sorting?: boolean
  selected?: boolean
  onSelectionChange?: (playlistId: string, selected: boolean) => void
  selectionMode?: boolean
}

export function PlaylistCard({ 
  playlist, 
  onSort, 
  sorting,
  selected = false,
  onSelectionChange,
  selectionMode = false
}: PlaylistCardProps) {
  const [autoSortEnabled, setAutoSortEnabled] = useState(playlist.autoSortEnabled)
  const [updating, setUpdating] = useState(false)
  const { refreshPlaylists, playlists, setPlaylists } = usePlaylists()

  // Sync state with playlist prop when it changes (e.g., after refresh)
  useEffect(() => {
    setAutoSortEnabled(playlist.autoSortEnabled)
  }, [playlist.autoSortEnabled])

  const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    return `${minutes} min`
  }

  const handleToggleAutoSort = async (checked: boolean) => {
    setUpdating(true)
    try {
      const response = await fetch(`/api/playlists/${playlist.spotifyId}/settings`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ autoSortEnabled: checked }),
      })

      if (response.ok) {
        setAutoSortEnabled(checked)
        // Update the playlist in context immediately (optimistic update)
        const updatedPlaylists = playlists.map((p) =>
          p.spotifyId === playlist.spotifyId
            ? { ...p, autoSortEnabled: checked }
            : p
        )
        setPlaylists(updatedPlaylists)
        // Also refresh from server to ensure consistency
        await refreshPlaylists()
      } else {
        try {
          const error = await response.json()
          console.error('Failed to update auto-sort:', error)
          alert(`Failed to update auto-sort: ${error.error || 'Unknown error'}`)
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          alert('Failed to update auto-sort. Please try again.')
        }
        // Revert on error
        setAutoSortEnabled(!checked)
      }
    } catch (error) {
      console.error('Error updating auto-sort:', error)
      alert('Failed to update auto-sort. Please try again.')
      // Revert on error
      setAutoSortEnabled(!checked)
    } finally {
      setUpdating(false)
    }
  }

  return (
    <Card className={cn(
      "hover:shadow-lg transition-shadow",
      selected && "ring-2 ring-primary"
    )}>
      <CardHeader>
        <div className="flex items-start space-x-4">
          {selectionMode && (
            <div className="pt-1" onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selected}
                onCheckedChange={(checked) => onSelectionChange?.(playlist.spotifyId, checked)}
              />
            </div>
          )}
          <Link href={`/playlists/${playlist.spotifyId}`} className="flex-1">
            <div className="flex items-start space-x-4">
              {playlist.image ? (
                <img
                  src={playlist.image}
                  alt={playlist.name}
                  className="w-24 h-24 rounded object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded bg-muted flex items-center justify-center">
                  <Music className="h-12 w-12 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-lg truncate">{playlist.name}</h3>
                <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                  <span className="flex items-center">
                    <Music className="h-4 w-4 mr-1" />
                    {playlist.trackCount || 0} tracks
                  </span>
                  {playlist.lastSortedAt && (
                    <span className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatDistanceToNow(new Date(playlist.lastSortedAt), {
                        addSuffix: true,
                      })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>
        </div>
      </CardHeader>
      <CardFooter className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Switch
            checked={autoSortEnabled}
            onCheckedChange={handleToggleAutoSort}
            disabled={updating}
          />
          <span className="text-xs text-muted-foreground">
            Auto-sort
          </span>
        </div>
        {onSort && !selectionMode && (
          <Button
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              // Only sort this specific playlist - no others affected
              onSort(playlist.spotifyId)
            }}
            disabled={sorting}
          >
            <SortAsc className="h-4 w-4 mr-2" />
            {sorting ? 'Sorting...' : 'Sort Now'}
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}


