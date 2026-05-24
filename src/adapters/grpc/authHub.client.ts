/**
 * gRPC client for AuthHub TokenValidation service.
 *
 * Allows user-hub to validate access tokens directly via auth-hub's gRPC
 * transport, bypassing Kong. Used for service-to-service calls that
 * don't go through the gateway (background jobs, internal RPCs, etc.).
 *
 * The raw gRPC callback client is wrapped in a typed Promise-based API.
 */

import type * as grpc from '@grpc/grpc-js';
import { createGrpcClient, buildMetadata } from '@brainwave-project/core';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { env } from '../../config/env.js';
import { logger } from '../../observability/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROTO_PATH = join(__dirname, '../../../proto/authhub.proto');

// ---------------------------------------------------------------------------
// Types matching authhub.proto messages
// ---------------------------------------------------------------------------

export interface ValidateTokenRequest {
  token:          string;
  required_roles: string[];
}

export interface ValidateTokenResponse {
  valid:         boolean;
  sub:           string;
  roles:         string[];
  exp:           number;
  iat:           number;
  realm:         string;
  error_code:    string;
  error_message: string;
}

interface RawAuthHubClient {
  ValidateToken(
    request:  ValidateTokenRequest,
    metadata: grpc.Metadata,
    callback: (err: grpc.ServiceError | null, response: ValidateTokenResponse) => void,
  ): void;
  ValidateToken(
    request:  ValidateTokenRequest,
    callback: (err: grpc.ServiceError | null, response: ValidateTokenResponse) => void,
  ): void;
}

// ---------------------------------------------------------------------------
// Singleton — lazily created on first call
// ---------------------------------------------------------------------------

let client: RawAuthHubClient | null = null;

function getClient(): RawAuthHubClient {
  if (!client) {
    client = createGrpcClient<RawAuthHubClient>({
      host:        env.AUTH_HUB_GRPC_HOST,
      port:        env.AUTH_HUB_GRPC_PORT,
      protoPath:   PROTO_PATH,
      packageName: 'authhub',
      serviceName: 'TokenValidation',
    });
    logger.info(
      { host: env.AUTH_HUB_GRPC_HOST, port: env.AUTH_HUB_GRPC_PORT },
      'AuthHub gRPC client created',
    );
  }
  return client;
}

// ---------------------------------------------------------------------------
// Public API — Promise-based
// ---------------------------------------------------------------------------

/**
 * Validates an access token via auth-hub's gRPC server.
 *
 * @param token         - JWT access token (without "Bearer " prefix)
 * @param requiredRoles - optional roles the token must contain (OR match)
 * @param correlationId - optional correlation ID for traceability
 * @returns ValidateTokenResponse with `valid: true/false`
 */
export async function validateToken(
  token: string,
  requiredRoles: string[] = [],
  correlationId?: string,
): Promise<ValidateTokenResponse> {
  const stub = getClient();
  const metadata = buildMetadata({ correlationId });

  return new Promise<ValidateTokenResponse>((resolve, reject) => {
    stub.ValidateToken(
      { token, required_roles: requiredRoles },
      metadata,
      (err: grpc.ServiceError | null, response: ValidateTokenResponse) => {
        if (err) {
          logger.error({ err, code: err.code }, 'AuthHub gRPC ValidateToken failed');
          return reject(err);
        }
        resolve(response);
      },
    );
  });
}
