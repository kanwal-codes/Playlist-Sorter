'use client'

import { Button } from '@/components/ui/button'
import { SortAsc, Loader2 } from 'lucide-react'
import { useState } from 'react'

interface SortControlsProps {
  playlistId: string
  onSorted?: () => void
}

export function SortControls({ playlistId, onSorted }: SortControlsProps) {
  const [sorting, setSorting] = useState(false)

  const handleSort = async () => {
    setSorting(true)
    try {
      const response = await fetch(`/api/playlists/${playlistId}/sort`, {
        method: 'POST',
        credentials: 'include', // Include cookies in request
      })

      if (response.ok) {
        if (onSorted) {
          onSorted()
        } else {
          window.location.reload()
        }
      } else {
        alert('Failed to sort playlist')
      }
    } catch (error) {
      console.error('Error sorting playlist:', error)
      alert('Failed to sort playlist')
    } finally {
      setSorting(false)
    }
  }

  return (
    <Button onClick={handleSort} disabled={sorting} size="lg">
      {sorting ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          Sorting...
        </>
      ) : (
        <>
          <SortAsc className="h-4 w-4 mr-2" />
          Sort by Release Date
        </>
      )}
    </Button>
  )
}


