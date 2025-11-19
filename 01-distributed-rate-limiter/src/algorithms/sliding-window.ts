/**
 * Sliding Window Rate Limiter
 *
 * How it works:
 * - Tracks each request timestamp in a rolling window
 * - Counts requests in the last N seconds
 * - No bursting allowed - strict enforcement
 *
 * Good for:
 * - Strict rate enforcement
 * - When you need precise counting
 * - APIs where bursting is not acceptable
 *
 * Trade-off:
 * - More memory intensive (stores each request)
 * - More precise than token bucket
 */

import { randomUUID } from 'crypto';
import {
  IRateLimiter,
  IStorageAdapter,
  RateLimitConfig,
  RateLimitContext,
  RateLimitResult,
} from '../core/interfaces/rate-limiter.interface';

// Lua script for atomic sliding window operations
const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local window_size_ms = tonumber(ARGV[1]) * 1000
local max_requests = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local request_id = ARGV[4]
local ttl = tonumber(ARGV[5])

local window_start = now - window_size_ms

redis.call('ZREMRANGEBYSCORE', key, 0, window_start)

local current_count = redis.call('ZCARD', key)

local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local oldest_timestamp = now
if oldest[2] then
  oldest_timestamp = tonumber(oldest[2])
end

local reset_at = oldest_timestamp + window_size_ms

local allowed = 0
if current_count < max_requests then
  redis.call('ZADD', key, now, request_id)
  current_count = current_count + 1
  allowed = 1
end

redis.call('EXPIRE', key, ttl)

local remaining = max_requests - current_count
return {allowed, remaining, math.floor(reset_at)}
`;

export class SlidingWindowRateLimiter implements IRateLimiter {
  readonly algorithmName = 'sliding-window';

  constructor(private readonly storage: IStorageAdapter) {}

  async consume(context: RateLimitContext, config: RateLimitConfig): Promise<RateLimitResult> {
    const key = this.buildKey(context);
    const cost = context.cost ?? 1;
    const now = await this.storage.getServerTime();
    const ttl = config.windowSizeSeconds + 10; // Window + buffer
    const requestId = randomUUID();

    // For cost > 1, we need to make multiple requests
    // This is a simplification - in production you might want a different approach
    let lastResult: RateLimitResult | null = null;

    for (let i = 0; i < cost; i++) {
      const result = await this.storage.executeScript<[number, number, number]>(
        SLIDING_WINDOW_SCRIPT,
        [key],
        [config.windowSizeSeconds, config.limit, now, `${requestId}-${i}`, ttl]
      );

      const [allowed, remaining, resetAt] = result;

      lastResult = {
        allowed: allowed === 1,
        remaining,
        limit: config.limit,
        resetAt,
        retryAfter: allowed === 0 ? resetAt - now : undefined,
      };

      // If any request fails, stop and return
      if (!lastResult.allowed) {
        break;
      }
    }

    return lastResult!;
  }

  async peek(context: RateLimitContext, config: RateLimitConfig): Promise<RateLimitResult> {
    const key = this.buildKey(context);
    const now = await this.storage.getServerTime();
    const ttl = config.windowSizeSeconds + 10;

    // Use a special "peek" request ID that we immediately remove
    const peekId = `peek-${randomUUID()}`;

    const result = await this.storage.executeScript<[number, number, number]>(
      SLIDING_WINDOW_SCRIPT,
      [key],
      [config.windowSizeSeconds, config.limit, now, peekId, ttl]
    );

    const [allowed, remaining, resetAt] = result;

    // Remove the peek entry we just added
    if (allowed === 1) {
      await this.storage.executeScript<number>(
        `redis.call('ZREM', KEYS[1], ARGV[1]); return 1`,
        [key],
        [peekId]
      );
    }

    return {
      allowed: allowed === 1,
      remaining: allowed === 1 ? remaining + 1 : remaining, // Adjust since we removed the peek
      limit: config.limit,
      resetAt,
    };
  }

  async reset(context: RateLimitContext): Promise<void> {
    const key = this.buildKey(context);
    await this.storage.delete(key);
  }

  private buildKey(context: RateLimitContext): string {
    const namespace = context.namespace ?? 'default';
    return `sw:${namespace}:${context.identifier}`;
  }
}
