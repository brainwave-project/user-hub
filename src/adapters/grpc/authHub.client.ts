import { createGrpcClient } from '@brainwave-project/core';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { env } from '../../config/env.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Path to the proto file — copy authhub.proto into this repo under proto/
const PROTO_PATH = join(__dirname, '../../../proto/authhub.proto');

/**
 * Lazy-initialised gRPC client for AuthHub's TokenValidation service.
 * Used by UserHub for internal token checks that bypass Kong.
 *
 * TODO: copy authhub.proto from auth-hub repo into user-hub/proto/authhub.proto
 */
export function createAuthHubClient() {
  return createGrpcClient({
    host:        env.AUTH_HUB_GRPC_HOST,
    port:        env.AUTH_HUB_GRPC_PORT,
    protoPath:   PROTO_PATH,
    packageName: 'authhub',
    serviceName: 'TokenValidation',
  });
}
