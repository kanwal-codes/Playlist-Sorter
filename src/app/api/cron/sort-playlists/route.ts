import { NextResponse } from 'next/server'
import { sortAllPlaylists } from '@/lib/cron/sortPlaylists'
import { headers } from 'next/headers'

export async function GET(request: Request) {
  const cronStartTime = Date.now()
  const headersList = headers()

  try {
    // Log request for debugging
    console.log('🔔 Cron job triggered at', new Date().toISOString())
    console.log('Environment:', process.env.NODE_ENV)
    console.log('VERCEL:', !!process.env.VERCEL)

    // Verify this is a Vercel Cron request
    // Vercel sends the Authorization header with CRON_SECRET
    const authHeader = headersList.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const vercelCronHeader = headersList.get('x-vercel-cron') // Vercel also sends this header
    
    console.log('Auth header present:', !!authHeader)
    console.log('CRON_SECRET set:', !!cronSecret)
    console.log('Vercel cron header:', vercelCronHeader)

    // In production, require CRON_SECRET to be set
    if (process.env.NODE_ENV === 'production' && !cronSecret) {
      console.error('❌ CRON_SECRET not set in production')
      return NextResponse.json(
        { error: 'CRON_SECRET must be set in production' },
        { status: 500 }
      )
    }
    
    // Verify the authorization header matches CRON_SECRET
    // Format: "Bearer <CRON_SECRET>" or just check if it's from Vercel
    // Vercel cron jobs can be identified by:
    // 1. Authorization header with Bearer token matching CRON_SECRET
    // 2. x-vercel-cron header (if present)
    const isVercelCron = 
      (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
      vercelCronHeader === '1' ||
      (process.env.VERCEL && authHeader?.startsWith('Bearer '))
    
    console.log('Is Vercel cron:', isVercelCron)
    
    // In development, allow manual testing (but warn)
    if (process.env.NODE_ENV === 'development') {
      if (!isVercelCron) {
        console.warn('⚠️  Cron endpoint called without proper authorization (development mode)')
      }
    } else if (!isVercelCron) {
      console.error('❌ Unauthorized cron request')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('🚀 Starting playlist sorting...')
    const results = await sortAllPlaylists()

    const duration = Date.now() - cronStartTime

    console.log('✅ Playlist sorting completed:', {
      usersProcessed: results.usersProcessed,
      playlistsSorted: results.playlistsSorted,
      playlistsSkipped: results.playlistsSkipped,
      errorCount: results.errors.length,
      duration: `${duration}ms`,
    })

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


