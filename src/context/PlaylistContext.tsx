'use client'

import React, { createContext, useContext, useState, useCallback, useRef } from 'react'
import { Playlist } from '@/types/playlist'

interface PlaylistContextType {
  playlists: Playlist[]
  setPlaylists: (playlists: Playlist[]) => void
  refreshPlaylists: () => Promise<void>
  loading: boolean
}

const PlaylistContext = createContext<PlaylistContextType | undefined>(undefined)

export function PlaylistProvider({ children }: { children: React.ReactNode }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([])
  const [loading, setLoading] = useState(false)
  const fetchingRef = useRef(false) // Prevent duplicate requests

  const refreshPlaylists = useCallback(async () => {
    // Prevent multiple simultaneous requests
    if (fetchingRef.current) {
      console.log('⏸️ Playlist fetch already in progress, skipping...')
      return
    }

    fetchingRef.current = true
    setLoading(true)
    try {
      console.log('📋 Fetching playlists...')
      const response = await fetch('/api/playlists', {
        credentials: 'include', // Include cookies in request
      })
      if (response.ok) {
        try {
          const data = await response.json()
          setPlaylists(data.playlists || [])
          console.log(`✅ Loaded ${data.playlists?.length || 0} playlists`)
        } catch (error) {
          console.error('Failed to parse playlists data:', error)
        }
      }
    } catch (error) {
      console.error('Error fetching playlists:', error)
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }, []) // Empty dependency array - function never changes

  return (
    <PlaylistContext.Provider
      value={{
        playlists,
        setPlaylists,
        refreshPlaylists,
        loading,
      }}
    >
      {children}
    </PlaylistContext.Provider>
  )
}

export function usePlaylists() {
  const context = useContext(PlaylistContext)
  if (context === undefined) {
    throw new Error('usePlaylists must be used within a PlaylistProvider')
  }
  return context
}


