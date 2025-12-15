import { prisma } from './client'
import { encrypt, decrypt } from '../utils/security'

export async function getUserBySpotifyId(spotifyUserId: string, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const user = await prisma.user.findUnique({
        where: { spotifyUserId },
        include: { playlists: true },
      })

      if (user) {
        // Decrypt tokens
        user.accessToken = decrypt(user.accessToken)
        user.refreshToken = decrypt(user.refreshToken)
      }

      return user
    } catch (error: any) {
      // Handle Prisma connection pooling errors
      if (error?.message?.includes('prepared statement') && i < retries - 1) {
        console.warn(`⚠️ Prisma connection error (attempt ${i + 1}/${retries}), retrying...`)
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1))) // Exponential backoff
        continue
      }
      throw error
    }
  }
  return null
}

export async function createOrUpdateUser(data: {
  spotifyUserId: string
  email?: string
  displayName?: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date
}) {
  // Encrypt tokens before storing
  const encryptedAccessToken = encrypt(data.accessToken)
  const encryptedRefreshToken = encrypt(data.refreshToken)

  return prisma.user.upsert({
    where: { spotifyUserId: data.spotifyUserId },
    update: {
      email: data.email,
      displayName: data.displayName,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: data.tokenExpiresAt,
      updatedAt: new Date(),
    },
    create: {
      spotifyUserId: data.spotifyUserId,
      email: data.email,
      displayName: data.displayName,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt: data.tokenExpiresAt,
    },
  })
}

export async function updateUserTokens(
  spotifyUserId: string,
  accessToken: string,
  refreshToken: string,
  tokenExpiresAt: Date
) {
  return prisma.user.update({
    where: { spotifyUserId },
    data: {
      accessToken: encrypt(accessToken),
      refreshToken: encrypt(refreshToken),
      tokenExpiresAt,
      updatedAt: new Date(),
    },
  })
}

export async function getAllUsersWithAutoSort() {
  const users = await prisma.user.findMany({
    where: { autoSortEnabled: true },
    include: { playlists: true },
  })

  // Decrypt tokens for all users
  return users.map((user) => ({
    ...user,
    accessToken: decrypt(user.accessToken),
    refreshToken: decrypt(user.refreshToken),
  }))
}

export async function getPlaylistsByUserId(userId: string) {
  return prisma.playlist.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  })
}

export async function createOrUpdatePlaylist(data: {
  userId: string
  spotifyPlaylistId: string
  name: string
  autoSortEnabled?: boolean
}) {
  // Check if playlist exists first to preserve autoSortEnabled
  const existing = await prisma.playlist.findUnique({
    where: { spotifyPlaylistId: data.spotifyPlaylistId },
  })

  return prisma.playlist.upsert({
    where: { spotifyPlaylistId: data.spotifyPlaylistId },
    update: {
      name: data.name,
      // Only update autoSortEnabled if explicitly provided, otherwise preserve existing value
      ...(data.autoSortEnabled !== undefined 
        ? { autoSortEnabled: data.autoSortEnabled }
        : existing 
          ? { autoSortEnabled: existing.autoSortEnabled }
          : { autoSortEnabled: true }
      ),
      updatedAt: new Date(),
    },
    create: {
      userId: data.userId,
      spotifyPlaylistId: data.spotifyPlaylistId,
      name: data.name,
      autoSortEnabled: data.autoSortEnabled ?? true,
    },
  })
}

export async function updatePlaylistLastSorted(playlistId: string) {
  return prisma.playlist.update({
    where: { id: playlistId },
    data: { lastSortedAt: new Date() },
  })
}

export async function createSortLog(data: {
  userId: string
  playlistId?: string
  status: 'success' | 'failed' | 'partial'
  tracksSorted?: number
  errorMessage?: string
}) {
  return prisma.sortLog.create({
    data,
  })
}

export async function getSortLogsByUserId(userId: string, limit = 50) {
  return prisma.sortLog.findMany({
    where: { userId },
    include: { playlist: true },
    orderBy: { sortedAt: 'desc' },
    take: limit,
  })
}

export async function createOrUpdateRecommendation(
  playlistId: string,
  recommendations: any,
  expiresAt: Date
) {
  // Use transaction to ensure atomicity (delete + create)
  return prisma.$transaction(async (tx) => {
    // Delete old recommendations for this playlist
    await tx.recommendation.deleteMany({
      where: { playlistId },
    })

    return tx.recommendation.create({
      data: {
        playlistId,
        recommendations,
        expiresAt,
      },
    })
  })
}

export async function getRecommendation(playlistId: string) {
  const recommendation = await prisma.recommendation.findFirst({
    where: {
      playlistId,
      expiresAt: { gt: new Date() },
    },
    orderBy: { generatedAt: 'desc' },
  })

  return recommendation
}


