import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/client'
import { validateRequestBodySize } from '@/lib/utils/validation'
import { sanitizeError, validateOrigin } from '@/lib/utils/security'
import { checkRateLimit, getClientIdentifier } from '@/lib/utils/rate-limit'
import { getAllowedOrigins } from '@/lib/utils/url'

export async function PATCH(request: Request) {
  try {
    // CSRF protection
    if (!validateOrigin(request, getAllowedOrigins())) {
      return NextResponse.json(
        { error: 'Invalid origin' },
        { status: 403 }
      )
    }

    // Rate limiting
    const clientId = getClientIdentifier(request)
    const rateLimit = checkRateLimit(`user-settings-${clientId}`, 20, 60000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimit.resetTime - Date.now()) / 1000)),
          },
        }
      )
    }

    // Request size validation
    const bodyText = await request.text()
    try {
      validateRequestBodySize(bodyText, 1024) // Max 1KB
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Request too large' },
        { status: 413 }
      )
    }

    const spotifyUserId = cookies().get('spotify_user_id')?.value

    if (!spotifyUserId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    let body
    try {
      body = JSON.parse(bodyText)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }
    
    const { autoSortEnabled } = body

    if (typeof autoSortEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'autoSortEnabled must be a boolean' },
        { status: 400 }
      )
    }

    const user = await prisma.user.update({
      where: { spotifyUserId },
      data: { autoSortEnabled },
    })

    return NextResponse.json({
      success: true,
      autoSortEnabled: user.autoSortEnabled,
    })
  } catch (error) {
    const errorMessage = sanitizeError(error)
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    )
  }
}


