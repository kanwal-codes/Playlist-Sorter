'use client'

import { Playlist } from '@/types/playlist'
import { PlaylistCard } from './PlaylistCard'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useState } from 'react'
import { SortAsc, CheckSquare, Square } from 'lucide-react'

interface PlaylistListProps {
  playlists: Playlist[]
}

export function PlaylistList({ playlists }: PlaylistListProps) {
  const [sorting, setSorting] = useState<string | null>(null)
  const [selectedPlaylists, setSelectedPlaylists] = useState<Set<string>>(new Set())
  const [selectionMode, setSelectionMode] = useState(false)

  const handleSort = async (playlistId: string) => {
    setSorting(playlistId)
    try {
      const response = await fetch(`/api/playlists/${playlistId}/sort`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        // Refresh playlists
        window.location.reload()
      } else {
        try {
          const error = await response.json()
          alert(`Failed to sort playlist: ${error.error || 'Unknown error'}`)
        } catch {
          alert('Failed to sort playlist')
        }
      }
    } catch (error) {
      console.error('Error sorting playlist:', error)
      alert('Failed to sort playlist')
    } finally {
      setSorting(null)
    }
  }

  const handleSelectionChange = (playlistId: string, selected: boolean) => {
    setSelectedPlaylists(prev => {
      const newSet = new Set(prev)
      if (selected) {
        newSet.add(playlistId)
      } else {
        newSet.delete(playlistId)
      }
      return newSet
    })
  }

  const handleSelectAll = () => {
    if (selectedPlaylists.size === playlists.length) {
      setSelectedPlaylists(new Set())
    } else {
      setSelectedPlaylists(new Set(playlists.map(p => p.spotifyId)))
    }
  }

  const handleSortSelected = async () => {
    if (selectedPlaylists.size === 0) {
      alert('Please select at least one playlist to sort')
      return
    }

    // CRITICAL: Only sort the selected playlists - no others will be affected
    const playlistIds = Array.from(selectedPlaylists)
    
    // Get playlist names for confirmation
    const selectedPlaylistNames = playlists
      .filter(p => playlistIds.includes(p.spotifyId))
      .map(p => p.name)
    
    // Confirm with user
    const confirmed = window.confirm(
      `You are about to sort ONLY these ${playlistIds.length} selected playlist(s):\n\n` +
      selectedPlaylistNames.slice(0, 5).join('\n') +
      (selectedPlaylistNames.length > 5 ? `\n...and ${selectedPlaylistNames.length - 5} more` : '') +
      '\n\nNo other playlists will be sorted. Continue?'
    )
    
    if (!confirmed) {
      return
    }

    setSorting('bulk')
    
    // CRITICAL SAFEGUARD: Store the exact list of playlists to sort BEFORE starting
    // This ensures we only sort what was selected, even if selection changes during sorting
    const playlistsToSort = [...playlistIds]
    const playlistNamesToSort = selectedPlaylistNames
    
    console.log('🎯 Starting bulk sort operation')
    console.log(`📋 Playlists to sort (${playlistsToSort.length}):`, playlistNamesToSort)
    console.log('🔒 Locked selection - no other playlists will be sorted')
    
    try {
      // CRITICAL: Only sort the playlists in playlistsToSort array - this is locked at start
      const results = []
      for (let i = 0; i < playlistsToSort.length; i++) {
        const playlistId = playlistsToSort[i]
        
        // Find playlist name for logging
        const playlistName = playlists.find(p => p.spotifyId === playlistId)?.name || playlistId
        
        console.log(`🔄 [${i + 1}/${playlistsToSort.length}] Sorting: ${playlistName} (${playlistId})`)
        
        try {
          // API endpoint only sorts ONE playlist at a time - the playlistId in the URL
          const response = await fetch(`/api/playlists/${playlistId}/sort`, {
            method: 'POST',
            credentials: 'include',
          })
          
          if (response.ok) {
            results.push({ playlistId, playlistName, success: true })
            console.log(`✅ [${i + 1}/${playlistsToSort.length}] Successfully sorted: ${playlistName}`)
          } else {
            const errorData = await response.json().catch(() => ({}))
            results.push({ playlistId, playlistName, success: false, error: errorData.error })
            console.error(`❌ [${i + 1}/${playlistsToSort.length}] Failed to sort: ${playlistName}`, errorData)
          }
        } catch (error) {
          console.error(`❌ [${i + 1}/${playlistsToSort.length}] Error sorting ${playlistName}:`, error)
          results.push({ playlistId, playlistName, success: false, error: 'Network error' })
        }
        
        // Small delay between requests to avoid rate limits
        if (i < playlistsToSort.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 200))
        }
      }
      
      console.log('✅ Bulk sort operation completed')
      console.log(`📊 Results: ${results.filter(r => r.success).length} succeeded, ${results.filter(r => !r.success).length} failed`)
      console.log('🔒 Only the selected playlists were sorted - no others affected')

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      const sortedPlaylistNames = results.filter(r => r.success).map(r => r.playlistName)
      const failedPlaylistNames = results.filter(r => !r.success).map(r => r.playlistName)
      
      // Clear selection after sorting
      setSelectedPlaylists(new Set())
      
      if (failCount === 0) {
        const message = `✅ Successfully sorted ${successCount} selected playlist(s)!\n\n` +
          `Sorted:\n${sortedPlaylistNames.join('\n')}\n\n` +
          `🔒 ONLY these playlists were sorted - no others were affected.`
        alert(message)
        window.location.reload()
      } else {
        const message = `⚠️ Sorted ${successCount} playlist(s), ${failCount} failed.\n\n` +
          `✅ Sorted:\n${sortedPlaylistNames.join('\n')}\n\n` +
          `❌ Failed:\n${failedPlaylistNames.join('\n')}\n\n` +
          `🔒 ONLY the selected playlists were sorted - no others were affected.`
        alert(message)
        window.location.reload()
      }
    } catch (error) {
      console.error('Error sorting selected playlists:', error)
      alert('Failed to sort selected playlists. Only selected playlists were attempted.')
      setSelectedPlaylists(new Set())
    } finally {
      setSorting(null)
    }
  }

  if (playlists.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No playlists found</p>
      </div>
    )
  }

  const allSelected = selectedPlaylists.size === playlists.length && playlists.length > 0
  const someSelected = selectedPlaylists.size > 0 && selectedPlaylists.size < playlists.length

  return (
    <div className="space-y-4">
      {/* Selection Controls */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectionMode(!selectionMode)}
          >
            {selectionMode ? 'Cancel Selection' : 'Select Playlists'}
          </Button>
          
          {selectionMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAll}
              >
                {allSelected ? (
                  <>
                    <Square className="h-4 w-4 mr-2" />
                    Deselect All
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Select All
                  </>
                )}
              </Button>
              
              {selectedPlaylists.size > 0 && (
                <Button
                  size="sm"
                  onClick={handleSortSelected}
                  disabled={sorting === 'bulk'}
                >
                  <SortAsc className="h-4 w-4 mr-2" />
                  {sorting === 'bulk' 
                    ? `Sorting ${selectedPlaylists.size}...` 
                    : `Sort Selected (${selectedPlaylists.size})`}
                </Button>
              )}
            </>
          )}
        </div>
        
        {selectionMode && (
          <p className="text-sm text-muted-foreground">
            {selectedPlaylists.size} of {playlists.length} selected
          </p>
        )}
      </div>

      {/* Playlist Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {playlists.map((playlist) => (
          <PlaylistCard
            key={playlist.id}
            playlist={playlist}
            onSort={handleSort}
            sorting={sorting === playlist.spotifyId}
            selected={selectedPlaylists.has(playlist.spotifyId)}
            onSelectionChange={handleSelectionChange}
            selectionMode={selectionMode}
          />
        ))}
      </div>
    </div>
  )
}


