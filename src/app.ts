import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { correlationId, requestLogger, errorHandler } from '@brainwave-project/core';
import { logger } from './observability/logger.js';
import { createRouter } from './transport/http/router.js';
import { setupSwagger }  from './config/swagger.js';
import { livenessHandler }  from './health/liveness.js';
import { readinessHandler } from './health/readiness.js';

// Fallback for Swagger direct access (bypasses Kong) in any environment.
// Kong always sets X-User-Id via post-function for web traffic — this only
// fires when the header is absent (i.e. direct service access without Kong).
function injectUserId(req: Request, _res: Response, next: NextFunction) {
  if (req.headers['x-user-id']) return next();
  const auth = req.headers['authorization'];
  if (!auth) return next();
  const token = auth.replace(/^[Bb]earer\s+/, '');
  const parts = token.split('.');
  if (parts.length !== 3) return next();
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.sub) req.headers['x-user-id'] = payload.sub;
  } catch { /* ignore */ }
  next();
}

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(correlationId());
  app.use(requestLogger(logger));
  app.use(injectUserId);

  // Health probes — no auth, bypassed by Kong
  app.get('/health/live',  livenessHandler);
  app.get('/health/ready', (req, res) => readinessHandler(req, res));

  // API routes — JWT validated at Kong, X-User-Id header injected
  app.use('/api/users', createRouter());

  // Swagger UI at /api/docs
  setupSwagger(app);

  // Error handler must be last
  app.use(errorHandler(logger));

  return app;
}
