'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@/types/user'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: () => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUser = async () => {
    try {
      const response = await fetch('/api/user', {
        credentials: 'include', // Include cookies in request
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      if (response.ok) {
        try {
          const userData = await response.json()
          setUser(userData)
        } catch (error) {
          console.error('Failed to parse user data:', error)
          setUser(null)
        }
      } else {
        setUser(null)
      }
    } catch (error) {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUser()
  }, [])

  const login = () => {
    window.location.href = '/api/auth/spotify'
  }

  const logout = async () => {
    try {
      // Clear cookie server-side (secure)
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      setUser(null)
      window.location.href = '/login'
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


