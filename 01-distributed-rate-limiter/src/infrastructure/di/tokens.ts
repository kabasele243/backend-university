/**
 * Dependency Injection Tokens
 *
 * These tokens are used to identify dependencies in the DI container.
 * Using symbols ensures type safety and prevents naming collisions.
 */

export const TOKENS = {
  // Storage
  StorageAdapter: Symbol.for('StorageAdapter'),
  RedisClient: Symbol.for('RedisClient'),

  // Rate Limiters
  RateLimiter: Symbol.for('RateLimiter'),
  RateLimiterFactory: Symbol.for('RateLimiterFactory'),

  // Services
  RateLimiterService: Symbol.for('RateLimiterService'),

  // Configuration
  AppConfig: Symbol.for('AppConfig'),
  RateLimitConfig: Symbol.for('RateLimitConfig'),

  // Observability
  Logger: Symbol.for('Logger'),
  MetricsCollector: Symbol.for('MetricsCollector'),

  // Circuit Breaker
  CircuitBreaker: Symbol.for('CircuitBreaker'),
} as const;
