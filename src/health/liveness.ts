import type { Request, Response } from 'express';

/** GET /health/live — process is alive (no dependency checks) */
export function livenessHandler(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', service: 'user-hub' });
}
