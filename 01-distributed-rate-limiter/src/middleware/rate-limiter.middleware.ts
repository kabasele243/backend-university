/**
 * Express Rate Limiter Middleware
 *
 * Applies rate limiting to incoming requests with:
 * - Configurable identifier extraction (IP, user ID, API key)
 * - Standard rate limit headers
 * - 429 Too Many Requests response
 */

import { Request, Response, NextFunction } from 'express';
import {
  IRateLimiter,
  RateLimitConfig,
  RateLimitContext,
  RateLimitResult,
} from '../core/interfaces/rate-limiter.interface';

/**
 * Options for the rate limiter middleware
 */
export interface RateLimiterMiddlewareOptions {
  /** Rate limiter instance to use */
  rateLimiter: IRateLimiter;
  /** Rate limit configuration */
  config: RateLimitConfig;
  /** Function to extract identifier from request */
  keyGenerator?: (req: Request) => string;
  /** Namespace for this rate limit (e.g., 'api', 'auth') */
  namespace?: string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Custom handler when rate limit is exceeded */
  onRateLimited?: (req: Request, res: Response, result: RateLimitResult) => void;
  /** Whether to add rate limit headers to response */
  headers?: boolean;
  /** Cost per request (default: 1) */
  cost?: number | ((req: Request) => number);
}

/**
 * Default key generator - uses IP address
 */
function defaultKeyGenerator(req: Request): string {
  // Support for proxies (X-Forwarded-For)
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return ips.trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

/**
 * Add rate limit headers to response
 */
function setRateLimitHeaders(res: Response, result: RateLimitResult): void {
  res.setHeader('X-RateLimit-Limit', result.limit);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining));
  res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000)); // Unix timestamp in seconds

  if (!result.allowed && result.retryAfter) {
    res.setHeader('Retry-After', Math.ceil(result.retryAfter / 1000)); // Seconds
  }
}

/**
 * Default handler when rate limit is exceeded
 */
function defaultOnRateLimited(req: Request, res: Response, result: RateLimitResult): void {
  res.status(429).json({
    error: 'Too Many Requests',
    message: 'Rate limit exceeded. Please try again later.',
    retryAfter: result.retryAfter ? Math.ceil(result.retryAfter / 1000) : undefined,
  });
}

/**
 * Create rate limiter middleware
 */
export function createRateLimiterMiddleware(
  options: RateLimiterMiddlewareOptions
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const {
    rateLimiter,
    config,
    keyGenerator = defaultKeyGenerator,
    namespace,
    skip,
    onRateLimited = defaultOnRateLimited,
    headers = true,
    cost = 1,
  } = options;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if we should skip rate limiting
      if (skip && skip(req)) {
        next();
        return;
      }

      // Build context
      const context: RateLimitContext = {
        identifier: keyGenerator(req),
        namespace,
        cost: typeof cost === 'function' ? cost(req) : cost,
      };

      // Check rate limit
      const result = await rateLimiter.consume(context, config);

      // Add headers
      if (headers) {
        setRateLimitHeaders(res, result);
      }

      // Store result on request for potential use in route handlers
      (req as Request & { rateLimit?: RateLimitResult }).rateLimit = result;

      if (result.allowed) {
        next();
      } else {
        onRateLimited(req, res, result);
      }
    } catch (error) {
      // On error, fail open (allow request) but log error
      // In production, you might want different behavior
      console.error('Rate limiter error:', error);
      next();
    }
  };
}

/**
 * Create middleware with common presets
 */
export const rateLimiterPresets = {
  /**
   * Standard API rate limit
   */
  api: (rateLimiter: IRateLimiter, limit = 100, windowSeconds = 60) =>
    createRateLimiterMiddleware({
      rateLimiter,
      config: { limit, windowSizeSeconds: windowSeconds },
      namespace: 'api',
    }),

  /**
   * Strict rate limit for authentication endpoints
   */
  auth: (rateLimiter: IRateLimiter, limit = 5, windowSeconds = 60) =>
    createRateLimiterMiddleware({
      rateLimiter,
      config: { limit, windowSizeSeconds: windowSeconds },
      namespace: 'auth',
    }),

  /**
   * Higher limit for premium/authenticated users
   */
  premium: (rateLimiter: IRateLimiter, limit = 1000, windowSeconds = 60) =>
    createRateLimiterMiddleware({
      rateLimiter,
      config: { limit, windowSizeSeconds: windowSeconds },
      namespace: 'premium',
      keyGenerator: (req) => {
        // Use user ID if available, otherwise IP
        const userId = (req as Request & { user?: { id: string } }).user?.id;
        return userId || defaultKeyGenerator(req);
      },
    }),

  /**
   * Rate limit by API key
   */
  apiKey: (rateLimiter: IRateLimiter, limit = 100, windowSeconds = 60) =>
    createRateLimiterMiddleware({
      rateLimiter,
      config: { limit, windowSizeSeconds: windowSeconds },
      namespace: 'apikey',
      keyGenerator: (req) => {
        const apiKey = req.headers['x-api-key'] as string;
        return apiKey || defaultKeyGenerator(req);
      },
    }),
};
