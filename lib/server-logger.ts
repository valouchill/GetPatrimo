/**
 * Server-side logger for Next.js API routes.
 * Wraps the Winston logger from lib/logger.js.
 *
 * Usage:
 *   import { logger } from '@/lib/server-logger';
 *   logger.info('message', { key: 'value' });
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { logger: winstonLogger } = require('@/lib/logger');

interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

export const logger: Logger = winstonLogger;
