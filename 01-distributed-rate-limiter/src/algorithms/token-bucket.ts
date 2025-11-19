/**
 * Token Bucket Rate Limiter
 *
 * How it works:
 * - Bucket starts full with 'capacity' tokens
 * - Each request consumes tokens (default: 1)
 * - Tokens refill at 'refillRate' per second
 * - Allows bursting up to bucket capacity
 *
 * Good for:
 * - APIs with variable load
 * - Allowing occasional traffic spikes
 * - Smooth rate limiting over time
 */

import {
  IRateLimiter,
  IStorageAdapter,
  RateLimitConfig,
  RateLimitContext,
  RateLimitResult,
} from '../core/interfaces/rate-limiter.interface';

// Lua script for atomic token bucket operations
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local cost = tonumber(ARGV[1])
local capacity = tonumber(ARGV[2])
local refill_rate = tonumber(ARGV[3])
local now = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])

local bucket = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(bucket[1])
local last_refill = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  last_refill = now
end

local elapsed_ms = now - last_refill
local elapsed_seconds = elapsed_ms / 1000
local tokens_to_add = elapsed_seconds * refill_rate

tokens = math.min(capacity, tokens + tokens_to_add)

local tokens_needed = capacity - tokens
local ms_to_full = 0
if tokens_needed > 0 and refill_rate > 0 then
  ms_to_full = (tokens_needed / refill_rate) * 1000
end
local reset_at = now + ms_to_full

local allowed = 0
if tokens >= cost then
  tokens = tokens - cost
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
redis.call('EXPIRE', key, ttl)

return {allowed, math.floor(tokens), math.floor(reset_at)}
`;

export class TokenBucketRateLimiter implements IRateLimiter {
  readonly algorithmName = 'token-bucket';

  constructor(private readonly storage: IStorageAdapter) {}

  async consume(context: RateLimitContext, config: RateLimitConfig): Promise<RateLimitResult> {
    const key = this.buildKey(context);
    const cost = context.cost ?? 1;
    const capacity = config.burstCapacity ?? config.limit;
    const refillRate = config.refillRate ?? config.limit / config.windowSizeSeconds;
    const now = await this.storage.getServerTime();
    const ttl = Math.max(config.windowSizeSeconds * 2, 3600); // At least 1 hour

    const result = await this.storage.executeScript<[number, number, number]>(
      TOKEN_BUCKET_SCRIPT,
      [key],
      [cost, capacity, refillRate, now, ttl]
    );

    const [allowed, remaining, resetAt] = result;

    return {
      allowed: allowed === 1,
      remaining,
      limit: capacity,
      resetAt,
      retryAfter: allowed === 0 ? this.calculateRetryAfter(cost, remaining, refillRate) : undefined,
    };
  }

  async peek(context: RateLimitContext, config: RateLimitConfig): Promise<RateLimitResult> {
    // Peek with 0 cost to check without consuming
    return this.consume({ ...context, cost: 0 }, config);
  }

  async reset(context: RateLimitContext): Promise<void> {
    const key = this.buildKey(context);
    await this.storage.delete(key);
  }

  private buildKey(context: RateLimitContext): string {
    const namespace = context.namespace ?? 'default';
    return `tb:${namespace}:${context.identifier}`;
  }

  private calculateRetryAfter(cost: number, remaining: number, refillRate: number): number {
    if (refillRate <= 0) return 0;
    const tokensNeeded = cost - remaining;
    return Math.ceil((tokensNeeded / refillRate) * 1000); // milliseconds
  }
}
