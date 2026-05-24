/**
 * gRPC-based auth middleware for user-hub.
 *
 * Use case: requests that bypass Kong (service-to-service, background workers,
 * direct access in dev). This middleware calls auth-hub's gRPC ValidateToken
 * to verify the JWT signature, check expiry, and optionally enforce roles.
 *
 * For browser traffic going through Kong, this middleware is NOT needed —
 * Kong's JWT plugin + post-function already inject X-User-Id / X-User-Roles.
 *
 * Usage:
 *   import { requireGrpcAuth } from '../middleware/grpcAuth.middleware.js';
 *
 *   router.get('/internal/users', requireGrpcAuth(), handler);
 *   router.post('/internal/sync', requireGrpcAuth(['ADMIN']), handler);
 */

import type { Request, Response, NextFunction } from 'express';
import { validateToken } from '../adapters/grpc/authHub.client.js';
import { AppError } from '@brainwave-project/core';

/**
 * Returns middleware that validates the Bearer token via auth-hub gRPC.
 * On success, sets X-User-Id and X-User-Roles headers on the request.
 *
 * @param requiredRoles - optional role check (OR match: user needs at least one)
 */
export function requireGrpcAuth(requiredRoles: string[] = []) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    // If Kong already validated and injected headers, skip gRPC call
    if (req.headers['x-user-id'] && req.headers['x-user-roles']) {
      return next();
    }

    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return next(AppError.unauthorized('Missing Authorization header'));
    }

    const token = authHeader.replace(/^[Bb]earer\s+/, '');
    if (!token) {
      return next(AppError.unauthorized('Malformed Authorization header'));
    }

    try {
      const correlationId = req.headers['x-correlation-id'] as string | undefined;
      const result = await validateToken(token, requiredRoles, correlationId);

      if (!result.valid) {
        return next(
          AppError.unauthorized(result.error_message || 'Token validation failed'),
        );
      }

      // Inject headers so downstream handlers work identically to Kong-proxied requests
      req.headers['x-user-id'] = result.sub;
      if (result.roles.length > 0) {
        req.headers['x-user-roles'] = JSON.stringify(result.roles);
      }

      next();
    } catch (err) {
      return next(AppError.unauthorized('Token validation service unavailable'));
    }
  };
}
