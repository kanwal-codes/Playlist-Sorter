import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Configure Prisma to work with Supabase connection pooler
// The pgbouncer=true parameter in DATABASE_URL disables prepared statements
// Add connection pool limits to prevent resource exhaustion
const databaseUrl = process.env.DATABASE_URL || ''
const hasPoolParams = databaseUrl.includes('connection_limit') || databaseUrl.includes('pool_timeout')

// Add pool parameters if not already present
const poolConfig = hasPoolParams
  ? {}
  : {
      connection_limit: 10, // Max 10 connections per instance
      pool_timeout: 20, // 20 second timeout
    }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  datasources: hasPoolParams
    ? undefined
    : {
        db: {
          url: databaseUrl.includes('?')
            ? `${databaseUrl}&connection_limit=10&pool_timeout=20`
            : `${databaseUrl}?connection_limit=10&pool_timeout=20`,
        },
      },
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma


