/**
 * Single shared Prisma client.
 * In development the instance is cached on globalThis so that hot reloading
 * does not open a new connection pool on every file change.
 */
import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.isProduction ? ['error'] : ['query', 'warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.prisma = prisma;
}
