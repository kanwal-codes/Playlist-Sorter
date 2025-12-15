'use client'

import { useAuth } from '@/context/AuthContext'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Track } from '@/types/track'
import { TrackList } from '@/components/playlist/TrackList'
import { SortControls } from '@/components/playlist/SortControls'
import { RecommendationsPanel } from '@/components/ai/RecommendationsPanel'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'

export default function PlaylistDetailPage() {
  const { user } = useAuth()
  const params = useParams()
  const playlistId = params.id as string

  const [playlist, setPlaylist] = useState<any>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [nextOffset, setNextOffset] = useState<number | null>(0)
  const [autoSortEnabled, setAutoSortEnabled] = useState(true)
  const [updatingAutoSort, setUpdatingAutoSort] = useState(false)
  const observerRef = useRef<HTMLDivElement | null>(null)
  const isFetchingRef = useRef(false)

  // Sync autoSortEnabled with playlist when it loads/changes
  useEffect(() => {
    if (playlist?.autoSortEnabled !== undefined) {
      setAutoSortEnabled(playlist.autoSortEnabled)
    }
  }, [playlist?.autoSortEnabled])

  const fetchTracks = useCallback(
    async (offset = 0, append = false) => {
      if (!user || !playlistId) return
      if (isFetchingRef.current) return
      isFetchingRef.current = true
      if (!append) setLoading(true)
      try {
        const [playlistRes, tracksRes] = await Promise.all([
          !append && !playlist ? fetch(`/api/playlists/${playlistId}`, { credentials: 'include' }) : Promise.resolve(null),
          fetch(`/api/playlists/${playlistId}/tracks?limit=100&offset=${offset}`, { credentials: 'include' }),
        ])

        if (playlistRes && playlistRes.ok) {
          try {
            const playlistData = await playlistRes.json()
            setPlaylist(playlistData)
            setAutoSortEnabled(playlistData.autoSortEnabled ?? true)
          } catch (error) {
            console.error('Failed to parse playlist data:', error)
          }
        }

        if (tracksRes.ok) {
          try {
            const tracksData = await tracksRes.json()
            if (append) {
              setTracks((prev) => [...prev, ...(tracksData.tracks || [])])
            } else {
              setTracks(tracksData.tracks || [])
            }
            setHasMore(!!tracksData.hasMore)
            setNextOffset(tracksData.nextOffset)
          } catch (error) {
            console.error('Failed to parse tracks data:', error)
          }
        }
      } catch (error) {
        console.error('Error fetching playlist data:', error)
      } finally {
        if (!append) setLoading(false)
        setLoadingMore(false)
        isFetchingRef.current = false
      }
    },
    [user, playlistId, playlist]
  )

  useEffect(() => {
    if (!user || !playlistId) return
    fetchTracks(0, false)
  }, [user, playlistId, fetchTracks])

  const loadMore = useCallback(() => {
    if (!hasMore || nextOffset === null) return
    setLoadingMore(true)
    fetchTracks(nextOffset, true)
  }, [hasMore, nextOffset, fetchTracks])

  // Infinite scroll using IntersectionObserver
  useEffect(() => {
    if (!hasMore || loadingMore) return
    const sentinel = observerRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0]
      if (entry.isIntersecting && hasMore && nextOffset !== null) {
        loadMore()
      }
    }, { rootMargin: '200px' })

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, nextOffset, loadMore, loadingMore])

  const handleSorted = () => {
    // Refresh tracks after sorting
    fetchTracks(0, false)
  }

  const handleToggleAutoSort = async (checked: boolean) => {
    setUpdatingAutoSort(true)
    try {
      const response = await fetch(`/api/playlists/${playlistId}/settings`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ autoSortEnabled: checked }),
      })

      if (response.ok) {
        setAutoSortEnabled(checked)
        // Update playlist state
        setPlaylist({ ...playlist, autoSortEnabled: checked })
      } else {
        try {
          const error = await response.json()
          console.error('Failed to update auto-sort:', error)
          alert(`Failed to update auto-sort: ${error.error || 'Unknown error'}`)
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          alert('Failed to update auto-sort. Please try again.')
        }
        setAutoSortEnabled(!checked)
      }
    } catch (error) {
      console.error('Error updating auto-sort:', error)
      alert('Failed to update auto-sort. Please try again.')
      setAutoSortEnabled(!checked)
    } finally {
      setUpdatingAutoSort(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Please login to view playlists</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!playlist) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Playlist not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          {playlist.image && (
            <img
              src={playlist.image}
              alt={playlist.name}
              className="w-32 h-32 rounded-lg object-cover"
            />
          )}
          <div>
            <h1 className="text-3xl font-bold">{playlist.name}</h1>
            {playlist.description && (
              <p className="text-muted-foreground mt-2">{playlist.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {playlist.trackCount} tracks • {playlist.owner}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch
              checked={autoSortEnabled}
              onCheckedChange={handleToggleAutoSort}
              disabled={updatingAutoSort}
            />
            <span className="text-sm text-muted-foreground">
              Auto-sort
            </span>
          </div>
          <SortControls playlistId={playlistId} onSorted={handleSorted} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold mb-4">Tracks</h2>
              {tracks.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No tracks found
                </p>
              ) : (
                <>
                  <TrackList tracks={tracks} />
                  <div ref={observerRef} className="py-4 text-center text-sm text-muted-foreground">
                    {hasMore ? (
                      <>
                        {loadingMore ? 'Loading more tracks…' : 'Scroll to load more'}
                        <div className="mt-2">
                          <button
                            className="text-primary hover:underline disabled:opacity-50"
                            onClick={loadMore}
                            disabled={loadingMore}
                          >
                            {loadingMore ? 'Loading…' : 'Load next 100'}
                          </button>
                        </div>
                      </>
                    ) : (
                      'All tracks loaded'
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <RecommendationsPanel playlistId={playlistId} />
        </div>
      </div>
    </div>
  )
}


