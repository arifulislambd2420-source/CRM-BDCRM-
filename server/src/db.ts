import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton.
 *
 * All DB access flows through this. Swapping the local MySQL for Hostinger's
 * managed MySQL is DATABASE_URL only — this file, the schema, and every
 * route file stay untouched.
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'],
});

export async function isEmpty(): Promise<boolean> {
  return (await prisma.user.count()) === 0;
}
