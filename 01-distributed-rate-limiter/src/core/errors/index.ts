/**
 * Custom Error Types for Rate Limiter
 *
 * Enterprise-grade error handling with proper error codes,
 * metadata, and serialization for observability.
 */

export enum ErrorCode {
  // Storage errors
  STORAGE_CONNECTION_FAILED = 'STORAGE_CONNECTION_FAILED',
  STORAGE_OPERATION_FAILED = 'STORAGE_OPERATION_FAILED',
  STORAGE_TIMEOUT = 'STORAGE_TIMEOUT',

  // Rate limiter errors
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  INVALID_CONFIGURATION = 'INVALID_CONFIGURATION',
  ALGORITHM_NOT_FOUND = 'ALGORITHM_NOT_FOUND',

  // Circuit breaker
  CIRCUIT_OPEN = 'CIRCUIT_OPEN',

  // General
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

interface ErrorMetadata {
  [key: string]: unknown;
}

/**
 * Base error class for all rate limiter errors
 */
export class RateLimiterError extends Error {
  public readonly code: ErrorCode;
  public readonly metadata: ErrorMetadata;
  public readonly timestamp: Date;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    metadata: ErrorMetadata = {},
    isOperational = true
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.metadata = metadata;
    this.timestamp = new Date();
    this.isOperational = isOperational;

    // Maintains proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      metadata: this.metadata,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }
}

/**
 * Storage-related errors (Redis connection, timeouts, etc.)
 */
export class StorageError extends RateLimiterError {
  constructor(message: string, code: ErrorCode, metadata: ErrorMetadata = {}) {
    super(message, code, metadata, true);
  }
}

/**
 * Configuration validation errors
 */
export class ConfigurationError extends RateLimiterError {
  constructor(message: string, metadata: ErrorMetadata = {}) {
    super(message, ErrorCode.INVALID_CONFIGURATION, metadata, true);
  }
}

/**
 * Circuit breaker open error
 */
export class CircuitOpenError extends RateLimiterError {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number, metadata: ErrorMetadata = {}) {
    super('Circuit breaker is open', ErrorCode.CIRCUIT_OPEN, metadata, true);
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Rate limit exceeded error (for strict mode)
 */
export class RateLimitExceededError extends RateLimiterError {
  public readonly retryAfterMs: number;
  public readonly limit: number;

  constructor(retryAfterMs: number, limit: number, metadata: ErrorMetadata = {}) {
    super('Rate limit exceeded', ErrorCode.RATE_LIMIT_EXCEEDED, {
      ...metadata,
      retryAfterMs,
      limit,
    });
    this.retryAfterMs = retryAfterMs;
    this.limit = limit;
  }
}
