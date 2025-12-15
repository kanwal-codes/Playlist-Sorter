'use client'

import { useEffect, Suspense } from 'react'
import { useAuth } from '@/context/AuthContext'
import { LoginButton } from '@/components/auth/LoginButton'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle } from 'lucide-react'

function LoginContent() {
  const { user, loading } = useAuth()
  const searchParams = useSearchParams()
  const error = searchParams.get('error')

  useEffect(() => {
    if (user) {
      window.location.href = '/'
    }
  }, [user])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Login to Playlist Sorter</CardTitle>
          <CardDescription>
            Connect your Spotify account to start auto-sorting your playlists
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center space-x-2 p-3 bg-destructive/10 text-destructive rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                {error === 'missing_params'
                  ? 'Missing authentication parameters'
                  : error === 'invalid_state'
                  ? 'Invalid authentication state'
                  : 'Authentication failed. Please try again.'}
              </span>
            </div>
          )}
          <div className="flex justify-center">
            <LoginButton />
          </div>
          <p className="text-xs text-center text-muted-foreground">
            By logging in, you grant permission to read and modify your Spotify playlists.
            Your data is stored securely and encrypted.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}


