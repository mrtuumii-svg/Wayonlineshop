import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './generated/prisma/client.js'

export type { PrismaClient }

/** Prisma 7 нь driver adapter-аар холбогдоно — `pg` pool-ыг adapter өөрөө удирдана. */
export function createPrisma(databaseUrl: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) })
}
