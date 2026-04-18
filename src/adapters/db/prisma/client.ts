import { PrismaClient } from '@prisma/client';

/**
 * Prisma client singleton.
 * One connection pool per process — do not instantiate PrismaClient elsewhere.
 */
const prisma = new PrismaClient({
  log: process.env['NODE_ENV'] === 'development'
    ? ['query', 'warn', 'error']
    : ['warn', 'error'],
});

export default prisma;
