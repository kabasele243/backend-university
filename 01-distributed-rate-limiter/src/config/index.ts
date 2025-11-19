/**
 * Configuration Management
 *
 * Uses Zod for runtime validation of configuration.
 * All config is loaded from environment variables with sensible defaults.
 */

import { z } from 'zod';
import { ConfigurationError } from '../core/errors';

/**
 * Redis configuration schema
 */
const redisConfigSchema = z.object({
  host: z.string().default('localhost'),
  port: z.number().int().positive().default(6379),
  password: z.string().optional(),
  db: z.number().int().min(0).max(15).default(0),
  keyPrefix: z.string().default('ratelimit:'),
  connectTimeout: z.number().int().positive().default(5000),
  commandTimeout: z.number().int().positive().default(1000),
  maxRetriesPerRequest: z.number().int().min(0).default(3),
  enableOfflineQueue: z.boolean().default(true),
});

/**
 * Rate limit defaults schema
 */
const rateLimitDefaultsSchema = z.object({
  algorithm: z.enum(['token-bucket', 'sliding-window']).default('token-bucket'),
  limit: z.number().int().positive().default(100),
  windowSizeSeconds: z.number().int().positive().default(60),
  burstCapacity: z.number().int().positive().optional(),
});

/**
 * Server configuration schema
 */
const serverConfigSchema = z.object({
  port: z.number().int().positive().default(3000),
  host: z.string().default('0.0.0.0'),
  trustProxy: z.boolean().default(false),
});

/**
 * Circuit breaker configuration schema
 */
const circuitBreakerConfigSchema = z.object({
  enabled: z.boolean().default(true),
  failureThreshold: z.number().int().positive().default(5),
  resetTimeoutMs: z.number().int().positive().default(30000),
  halfOpenRequests: z.number().int().positive().default(3),
});

/**
 * Observability configuration schema
 */
const observabilityConfigSchema = z.object({
  metricsEnabled: z.boolean().default(true),
  metricsPath: z.string().default('/metrics'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

/**
 * Complete application configuration schema
 */
const appConfigSchema = z.object({
  env: z.enum(['development', 'test', 'production']).default('development'),
  redis: redisConfigSchema,
  rateLimitDefaults: rateLimitDefaultsSchema,
  server: serverConfigSchema,
  circuitBreaker: circuitBreakerConfigSchema,
  observability: observabilityConfigSchema,
});

export type RedisConfig = z.infer<typeof redisConfigSchema>;
export type RateLimitDefaults = z.infer<typeof rateLimitDefaultsSchema>;
export type ServerConfig = z.infer<typeof serverConfigSchema>;
export type CircuitBreakerConfig = z.infer<typeof circuitBreakerConfigSchema>;
export type ObservabilityConfig = z.infer<typeof observabilityConfigSchema>;
export type AppConfig = z.infer<typeof appConfigSchema>;

/**
 * Load and validate configuration from environment variables
 */
export function loadConfig(): AppConfig {
  const rawConfig = {
    env: process.env.NODE_ENV,
    redis: {
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : undefined,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB ? parseInt(process.env.REDIS_DB, 10) : undefined,
      keyPrefix: process.env.REDIS_KEY_PREFIX,
      connectTimeout: process.env.REDIS_CONNECT_TIMEOUT
        ? parseInt(process.env.REDIS_CONNECT_TIMEOUT, 10)
        : undefined,
      commandTimeout: process.env.REDIS_COMMAND_TIMEOUT
        ? parseInt(process.env.REDIS_COMMAND_TIMEOUT, 10)
        : undefined,
    },
    rateLimitDefaults: {
      algorithm: process.env.RATE_LIMIT_ALGORITHM,
      limit: process.env.RATE_LIMIT_DEFAULT
        ? parseInt(process.env.RATE_LIMIT_DEFAULT, 10)
        : undefined,
      windowSizeSeconds: process.env.RATE_LIMIT_WINDOW
        ? parseInt(process.env.RATE_LIMIT_WINDOW, 10)
        : undefined,
    },
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT, 10) : undefined,
      host: process.env.HOST,
      trustProxy: process.env.TRUST_PROXY === 'true',
    },
    circuitBreaker: {
      enabled: process.env.CIRCUIT_BREAKER_ENABLED !== 'false',
      failureThreshold: process.env.CIRCUIT_BREAKER_THRESHOLD
        ? parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD, 10)
        : undefined,
      resetTimeoutMs: process.env.CIRCUIT_BREAKER_RESET_MS
        ? parseInt(process.env.CIRCUIT_BREAKER_RESET_MS, 10)
        : undefined,
    },
    observability: {
      metricsEnabled: process.env.METRICS_ENABLED !== 'false',
      metricsPath: process.env.METRICS_PATH,
      logLevel: process.env.LOG_LEVEL,
    },
  };

  const result = appConfigSchema.safeParse(rawConfig);

  if (!result.success) {
    const zodErrors = result.error.issues;
    const errors = zodErrors.map((e) => `${e.path.join('.')}: ${e.message}`);
    throw new ConfigurationError(`Invalid configuration: ${errors.join(', ')}`, {
      validationErrors: zodErrors,
    });
  }

  return result.data;
}

// Singleton config instance
let configInstance: AppConfig | null = null;

/**
 * Get the application configuration (singleton)
 */
export function getConfig(): AppConfig {
  if (!configInstance) {
    configInstance = loadConfig();
  }
  return configInstance;
}

/**
 * Reset config (for testing)
 */
export function resetConfig(): void {
  configInstance = null;
}
