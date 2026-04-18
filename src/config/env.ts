import { z } from 'zod';
import { config } from 'dotenv';

config();

const envSchema = z.object({
  PORT:         z.coerce.number().default(3001),
  NODE_ENV:     z.enum(['development', 'staging', 'production']).default('development'),
  SERVICE_NAME: z.string().default('user-hub'),
  LOG_LEVEL:    z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // PostgreSQL
  DATABASE_URL: z.string().url(),

  // AuthHub gRPC
  AUTH_HUB_GRPC_HOST: z.string().default('localhost'),
  AUTH_HUB_GRPC_PORT: z.coerce.number().default(50051),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function loadConfig(): EnvConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error('Invalid environment configuration:', result.error.format());
    process.exit(1);
  }
  return result.data;
}

// Singleton — loaded once at process startup
export const env = loadConfig();
