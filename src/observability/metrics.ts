import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import type { Request, Response } from 'express';

export const register = new Registry();

// Prefix all default metrics with service name (no label conflicts in shared Prometheus)
collectDefaultMetrics({ register, prefix: 'userhub_' });

// ── RED Counters ──────────────────────────────────────────────────────────────

export const httpRequestsTotal = new Counter({
  name:       'userhub_http_requests_total',
  help:       'Total HTTP requests handled by user-hub',
  labelNames: ['method', 'path', 'status'] as const,
  registers:  [register],
});

export const httpRequestDurationSeconds = new Histogram({
  name:       'userhub_http_request_duration_seconds',
  help:       'HTTP request duration (seconds)',
  labelNames: ['method', 'path', 'status'] as const,
  buckets:    [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers:  [register],
});

// ── Business metrics ──────────────────────────────────────────────────────────

export const userStateTransitionsTotal = new Counter({
  name:       'userhub_user_state_transitions_total',
  help:       'Number of user account state transitions',
  labelNames: ['from_state', 'to_state'] as const,
  registers:  [register],
});

export const activeUsersGauge = new Gauge({
  name:      'userhub_active_users_total',
  help:      'Current count of users with ACTIVE status',
  registers: [register],
});

export const grpcRequestsTotal = new Counter({
  name:       'userhub_grpc_requests_total',
  help:       'Total gRPC calls served by user-hub',
  labelNames: ['method', 'status'] as const,
  registers:  [register],
});

// ── Express middleware ────────────────────────────────────────────────────────

export function metricsMiddleware(req: Request, res: Response, next: () => void): void {
  const start  = performance.now();
  const method = req.method;

  res.on('finish', () => {
    // Use matched route pattern (if available) — avoids high cardinality from path params
    const path     = req.route?.path ?? req.path;
    const status   = res.statusCode.toString();
    const duration = (performance.now() - start) / 1000;

    httpRequestsTotal.inc({ method, path, status });
    httpRequestDurationSeconds.observe({ method, path, status }, duration);
  });

  next();
}

export async function getMetrics(): Promise<string> {
  return register.metrics();
}
