'use client'

import { useAuth } from '@/context/AuthContext'
import { usePlaylists } from '@/context/PlaylistContext'
import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PlaylistList } from '@/components/playlist/PlaylistList'
import { LoginButton } from '@/components/auth/LoginButton'
import { Music, Clock, Sparkles } from 'lucide-react'

export default function Home() {
  const { user, loading } = useAuth()
  const { playlists, refreshPlaylists, loading: playlistsLoading } = usePlaylists()

  useEffect(() => {
    if (user && playlists.length === 0 && !playlistsLoading) {
      // Only fetch if user is logged in and we don't have playlists yet
      refreshPlaylists()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]) // Only depend on user, not refreshPlaylists (it's memoized)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-6 max-w-md">
          <h1 className="text-4xl font-bold">Welcome to Playlist Sorter</h1>
          <p className="text-lg text-muted-foreground">
            Automatically sort your Spotify playlists by date added every night at midnight.
            Get AI-powered recommendations to enhance your playlists.
          </p>
          <LoginButton />
        </div>
      </div>
    )
  }

  const sortedPlaylists = playlists.filter((p) => p.lastSortedAt).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Welcome back, {user.displayName || user.email}!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Playlists</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playlists.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sorted Playlists</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sortedPlaylists}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Last sorted playlists
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Auto-Sort</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.autoSortEnabled ? 'Enabled' : 'Disabled'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Runs at midnight
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-2xl font-semibold mb-4">Your Playlists</h2>
        {playlistsLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading playlists...</p>
          </div>
        ) : (
          <PlaylistList playlists={playlists} />
        )}
      </div>
    </div>
  )
}


