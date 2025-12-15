'use client'

import { useAuth } from '@/context/AuthContext'
import { usePlaylists } from '@/context/PlaylistContext'
import { useEffect } from 'react'
import { PlaylistList } from '@/components/playlist/PlaylistList'
import { Card, CardContent } from '@/components/ui/card'

export default function PlaylistsPage() {
  const { user, loading: authLoading } = useAuth()
  const { playlists, refreshPlaylists, loading } = usePlaylists()

  useEffect(() => {
    if (user && playlists.length === 0 && !loading) {
      // Only fetch if user is logged in and we don't have playlists yet
      refreshPlaylists()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]) // Only depend on user, not refreshPlaylists (it's memoized)

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Please login to view your playlists</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Your Playlists</h1>
        <p className="text-muted-foreground mt-2">
          Manage and sort your Spotify playlists
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading playlists...</p>
        </div>
      ) : (
        <PlaylistList playlists={playlists} />
      )}
    </div>
  )
}


