import { NextResponse } from 'next/server'
import { sortAllPlaylists } from '@/lib/cron/sortPlaylists'
import { headers } from 'next/headers'

export async function GET(request: Request) {
  const cronStartTime = Date.now()

  try {
    // CRITICAL: CRON_SECRET is required
    if (!process.env.CRON_SECRET) {
      return NextResponse.json(
        { error: 'CRON_SECRET environment variable is required' },
        { status: 500 }
      )
    }

    // Verify this is a Vercel Cron request
    const authHeader = headers().get('authorization')
    const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`
    
    if (!isVercelCron) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = await sortAllPlaylists()

    const duration = Date.now() - cronStartTime

    return NextResponse.json({
      success: true,
      message: 'Playlist sorting completed',
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      results: {
        usersProcessed: results.usersProcessed,
        playlistsSorted: results.playlistsSorted,
        playlistsSkipped: results.playlistsSkipped,
        errorCount: results.errors.length,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'An error occurred during playlist sorting',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}


