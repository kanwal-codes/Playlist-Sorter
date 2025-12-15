import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST() {
  const response = NextResponse.json({ success: true })
  
  // Clear cookie server-side (secure)
  response.cookies.delete('spotify_user_id')
  
  return response
}


