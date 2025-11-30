// TODO: Database connection for Cloud Functions
// TODO: Prisma client initialization
// TODO: Connection pooling
// TODO: Error handling

import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient | null = null

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    })
  }

  return prisma
}

// TODO: Close database connection
export async function closeDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}

