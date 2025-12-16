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
    // Vercel automatically sets the Authorization header with CRON_SECRET
    const authHeader = headers().get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    // In production, require CRON_SECRET to be set
    if (process.env.NODE_ENV === 'production' && !cronSecret) {
      return NextResponse.json(
        { error: 'CRON_SECRET must be set in production' },
        { status: 500 }
      )
    }
    
    // Verify the authorization header matches CRON_SECRET
    // Format: "Bearer <CRON_SECRET>"
    const isVercelCron = cronSecret && authHeader === `Bearer ${cronSecret}`
    
    // In development, allow manual testing (but warn)
    if (process.env.NODE_ENV === 'development') {
      if (!isVercelCron) {
        console.warn('⚠️  Cron endpoint called without proper authorization (development mode)')
      }
    } else if (!isVercelCron) {
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


