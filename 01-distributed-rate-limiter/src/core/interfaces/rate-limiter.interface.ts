/**
 * Core Rate Limiter Interfaces
 *
 * These interfaces define the contracts for the rate limiting system.
 * All implementations must adhere to these contracts for interoperability.
 */

/**
 * Result of a rate limit check
 */
export interface RateLimitResult {
  /** Whether the request is allowed */
  allowed: boolean;
  /** Current number of remaining requests/tokens */
  remaining: number;
  /** Maximum limit for the window/bucket */
  limit: number;
  /** Unix timestamp (ms) when the limit resets */
  resetAt: number;
  /** Time to wait in milliseconds before retry (if rate limited) */
  retryAfter?: number;
}

/**
 * Configuration for rate limiting rules
 */
export interface RateLimitConfig {
  /** Maximum number of requests/tokens */
  limit: number;
  /** Window size in seconds (for sliding window) or refill interval */
  windowSizeSeconds: number;
  /** Refill rate per second (for token bucket) */
  refillRate?: number;
  /** Burst capacity (for token bucket, defaults to limit) */
  burstCapacity?: number;
}

/**
 * Context for identifying the rate limit subject
 */
export interface RateLimitContext {
  /** Unique identifier for the rate limit subject (IP, user ID, API key) */
  identifier: string;
  /** Optional namespace/prefix for the rate limit key */
  namespace?: string;
  /** Number of tokens/requests to consume (default: 1) */
  cost?: number;
}

/**
 * Core rate limiter interface - Strategy Pattern
 * All rate limiting algorithms must implement this interface
 */
export interface IRateLimiter {
  /**
   * Check if a request is allowed and consume tokens/increment counter
   */
  consume(context: RateLimitContext, config: RateLimitConfig): Promise<RateLimitResult>;

  /**
   * Check the current rate limit status without consuming
   */
  peek(context: RateLimitContext, config: RateLimitConfig): Promise<RateLimitResult>;

  /**
   * Reset the rate limit for a given context
   */
  reset(context: RateLimitContext): Promise<void>;

  /**
   * Get the algorithm name for identification
   */
  readonly algorithmName: string;
}

/**
 * Storage adapter interface - Repository Pattern
 * Abstracts the underlying storage mechanism (Redis, Memory, etc.)
 */
export interface IStorageAdapter {
  /**
   * Execute a Lua script atomically (for Redis)
   */
  executeScript<T>(script: string, keys: string[], args: (string | number)[]): Promise<T>;

  /**
   * Get a value from storage
   */
  get(key: string): Promise<string | null>;

  /**
   * Set a value in storage with optional TTL
   */
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;

  /**
   * Delete a key from storage
   */
  delete(key: string): Promise<void>;

  /**
   * Check if the storage is healthy/connected
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get the current server time (important for distributed systems)
   * @returns Unix timestamp in milliseconds
   */
  getServerTime(): Promise<number>;

  /**
   * Close the storage connection
   */
  close(): Promise<void>;
}

/**
 * Rate limiter factory interface
 */
export interface IRateLimiterFactory {
  create(algorithm: string, storage: IStorageAdapter): IRateLimiter;
}
