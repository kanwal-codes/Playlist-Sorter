'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const userId = searchParams.get('userId')
    
    // Cookie is now set server-side in callback route (secure, httpOnly)
    // Just redirect to home page
    let timeoutId: NodeJS.Timeout | null = null
    
    if (userId) {
      // Small delay to ensure cookie is set, then redirect
      timeoutId = setTimeout(() => {
        window.location.href = '/'
      }, 500)
    } else {
      // No userId, redirect to login
      router.push('/login?error=missing_user_id')
    }
    
    // Cleanup: clear timeout if component unmounts
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [searchParams, router])

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  )
}

export default function AuthSuccessPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}

