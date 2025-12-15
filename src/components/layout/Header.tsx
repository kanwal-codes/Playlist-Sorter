'use client'

import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { LogOut, Settings, User } from 'lucide-react'
import Link from 'next/link'

export function Header() {
  const { user, logout } = useAuth()

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center space-x-2">
          <span className="font-bold text-xl">Playlist Sorter</span>
        </Link>

        <nav className="flex items-center space-x-4">
          {user ? (
            <>
              <Link href="/playlists">
                <Button variant="ghost">Playlists</Button>
              </Link>
              <Link href="/settings">
                <Button variant="ghost" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                {user.image && (
                  <img
                    src={user.image}
                    alt={user.displayName || 'User'}
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <span className="text-sm">{user.displayName}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={logout}>
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button>Login</Button>
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}






