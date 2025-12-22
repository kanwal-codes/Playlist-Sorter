import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SpeedInsights } from '@vercel/speed-insights/next'
import './globals.css'
import { AuthProvider } from '@/context/AuthContext'
import { PlaylistProvider } from '@/context/PlaylistContext'
import { Header } from '@/components/layout/Header'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Playlist Sorter - Auto-sort your Spotify playlists',
  description: 'Automatically sort your Spotify playlists by date added every night',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <PlaylistProvider>
            <div className="min-h-screen flex flex-col">
              <Header />
              <main className="flex-1 container py-8">{children}</main>
            </div>
          </PlaylistProvider>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  )
}






