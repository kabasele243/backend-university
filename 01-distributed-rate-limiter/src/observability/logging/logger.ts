/**
 * Structured Logging with Pino
 *
 * High-performance, JSON-formatted logging for:
 * - Easy parsing by log aggregators (ELK, Datadog)
 * - Correlation IDs for request tracing
 * - Consistent log format across services
 */

import pino from 'pino';
import { getConfig } from '../../config';

const config = getConfig();

/**
 * Create the base logger instance
 */
export const logger = pino({
  level: config.observability.logLevel,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: 'rate-limiter',
    env: config.env,
  },
});

/**
 * Create a child logger with additional context
 */
export function createLogger(context: Record<string, unknown>) {
  return logger.child(context);
}

/**
 * Log rate limit events
 */
export const rateLimitLogger = logger.child({ component: 'rate-limiter' });

/**
 * Log Redis events
 */
export const redisLogger = logger.child({ component: 'redis' });

/**
 * Log HTTP request events
 */
export const httpLogger = logger.child({ component: 'http' });

/**
 * Helper for structured rate limit logging
 */
export function logRateLimitEvent(
  event: 'check' | 'exceeded' | 'reset',
  data: {
    identifier: string;
    namespace?: string;
    allowed?: boolean;
    remaining?: number;
    limit?: number;
    latencyMs?: number;
  }
): void {
  const logData = {
    event,
    ...data,
  };

  if (event === 'exceeded') {
    rateLimitLogger.warn(logData, 'Rate limit exceeded');
  } else {
    rateLimitLogger.debug(logData, `Rate limit ${event}`);
  }
}

/**
 * Helper for Redis operation logging
 */
export function logRedisEvent(
  event: 'connect' | 'disconnect' | 'error' | 'operation',
  data: Record<string, unknown> = {}
): void {
  const logData = { event, ...data };

  if (event === 'error') {
    redisLogger.error(logData, 'Redis error');
  } else if (event === 'disconnect') {
    redisLogger.warn(logData, 'Redis disconnected');
  } else {
    redisLogger.info(logData, `Redis ${event}`);
  }
}
