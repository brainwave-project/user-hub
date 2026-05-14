import { createLogger, type Logger } from '@brainwave-project/core';
import { env } from '../config/env.js';

export const logger: Logger = createLogger({
  serviceName: env.SERVICE_NAME,
  level:       env.LOG_LEVEL,
});

export type { Logger };
