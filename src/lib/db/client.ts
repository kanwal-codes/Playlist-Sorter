import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure Prisma for Vercel serverless functions
// In serverless environments, we need to be careful about connection pooling
const databaseUrl = process.env.DATABASE_URL || ''

// Check if connection pooling parameters are already in the URL
const hasPoolParams = databaseUrl.includes('connection_limit') || 
                     databaseUrl.includes('pool_timeout') ||
                     databaseUrl.includes('pgbouncer=true') ||
                     databaseUrl.includes('?sslmode=')

// For Vercel/serverless: use connection pooling if available
// Most managed databases (Supabase, Neon, etc.) provide connection poolers
// If using a direct connection, limit connections to prevent exhaustion
const isVercel = !!process.env.VERCEL
const connectionLimit = isVercel ? 1 : 5 // Vercel serverless: 1 connection per function instance

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  // Optimize for serverless: reduce connection timeout
  datasources: hasPoolParams
    ? undefined
    : {
        db: {
          url: databaseUrl.includes('?')
            ? `${databaseUrl}&connection_limit=${connectionLimit}&pool_timeout=10`
            : `${databaseUrl}?connection_limit=${connectionLimit}&pool_timeout=10`,
        },
      },
})

// In development, reuse the same Prisma instance to prevent too many connections
// In production (Vercel), each serverless function gets its own instance
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}


