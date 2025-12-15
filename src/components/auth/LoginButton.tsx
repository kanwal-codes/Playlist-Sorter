'use client'

import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/AuthContext'

export function LoginButton() {
  const { login } = useAuth()

  return (
    <Button onClick={login} size="lg" className="bg-[#1DB954] hover:bg-[#1ed760] text-white">
      Login with Spotify
    </Button>
  )
}






