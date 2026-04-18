import type { Request, Response } from 'express';
import prisma from '../adapters/db/prisma/client.js';

/**
 * GET /health/ready — service is ready to accept traffic.
 * Fails if the PostgreSQL connection is not established.
 */
export async function readinessHandler(_req: Request, res: Response): Promise<void> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: 'ok', checks: { postgres: 'ok' } });
  } catch (err) {
    res.status(503).json({
      status: 'degraded',
      checks: { postgres: 'unavailable' },
      error:  String(err),
    });
  }
}
