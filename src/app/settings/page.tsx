'use client'

import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export default function SettingsPage() {
  const { user, refreshUser } = useAuth()
  const [updating, setUpdating] = useState(false)

  const toggleAutoSort = async () => {
    if (!user) return

    setUpdating(true)
    try {
      const response = await fetch('/api/user/settings', {
        method: 'PATCH',
        credentials: 'include', // Include cookies in request
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          autoSortEnabled: !user.autoSortEnabled,
        }),
      })

      if (response.ok) {
        // Refresh user data to get updated settings
        await refreshUser()
      } else {
        try {
          const error = await response.json()
          alert(`Failed to update settings: ${error.error || 'Unknown error'}`)
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError)
          alert('Failed to update settings. Please try again.')
        }
      }
    } catch (error) {
      console.error('Error updating settings:', error)
      alert('Failed to update settings. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  if (!user) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Please login to view settings</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your account and playlist preferences
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Auto-Sort Settings</CardTitle>
          <CardDescription>
            Control automatic playlist sorting behavior
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Auto-Sort</p>
              <p className="text-sm text-muted-foreground">
                Automatically sort playlists at midnight every night
              </p>
            </div>
            <Button
              variant={user.autoSortEnabled ? 'default' : 'outline'}
              onClick={toggleAutoSort}
              disabled={updating}
            >
              {user.autoSortEnabled ? 'Enabled' : 'Disabled'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Display Name</p>
            <p className="font-medium">{user.displayName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Email</p>
            <p className="font-medium">{user.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Spotify User ID</p>
            <p className="font-medium font-mono text-sm">{user.spotifyUserId}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

