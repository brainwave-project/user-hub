import express from 'express';
import { correlationId, requestLogger, errorHandler } from '@brainwave-project/core';
import { logger } from './observability/logger.js';
import { createRouter } from './transport/http/router.js';
import { setupSwagger }  from './config/swagger.js';
import { livenessHandler }  from './health/liveness.js';
import { readinessHandler } from './health/readiness.js';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(correlationId());
  app.use(requestLogger(logger));

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
