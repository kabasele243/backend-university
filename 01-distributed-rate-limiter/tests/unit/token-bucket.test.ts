import { TokenBucketRateLimiter } from '../../src/algorithms/token-bucket';
import { MemoryStorageAdapter } from '../../src/storage/adapters/memory.adapter';
import { RateLimitConfig, RateLimitContext } from '../../src/core/interfaces/rate-limiter.interface';

describe('TokenBucketRateLimiter', () => {
  let storage: MemoryStorageAdapter;
  let rateLimiter: TokenBucketRateLimiter;

  const defaultConfig: RateLimitConfig = {
    limit: 10,
    windowSizeSeconds: 60,
    refillRate: 10 / 60, // 10 tokens per minute
  };

  const defaultContext: RateLimitContext = {
    identifier: 'test-user-123',
    namespace: 'api',
  };

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    rateLimiter = new TokenBucketRateLimiter(storage);
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('consume', () => {
    it('should allow requests when bucket has tokens', async () => {
      const result = await rateLimiter.consume(defaultContext, defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.limit).toBe(10);
    });

    it('should decrement tokens on each request', async () => {
      // Consume 5 tokens
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume(defaultContext, defaultConfig);
      }

      const result = await rateLimiter.consume(defaultContext, defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should deny requests when bucket is empty', async () => {
      // Exhaust all 10 tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume(defaultContext, defaultConfig);
      }

      const result = await rateLimiter.consume(defaultContext, defaultConfig);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should support custom cost per request', async () => {
      const context: RateLimitContext = {
        ...defaultContext,
        cost: 5,
      };

      const result1 = await rateLimiter.consume(context, defaultConfig);
      expect(result1.allowed).toBe(true);
      expect(result1.remaining).toBe(5);

      const result2 = await rateLimiter.consume(context, defaultConfig);
      expect(result2.allowed).toBe(true);
      expect(result2.remaining).toBe(0);

      const result3 = await rateLimiter.consume(context, defaultConfig);
      expect(result3.allowed).toBe(false);
    });

    it('should isolate different identifiers', async () => {
      const user1: RateLimitContext = { identifier: 'user-1' };
      const user2: RateLimitContext = { identifier: 'user-2' };

      // Exhaust user1's tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume(user1, defaultConfig);
      }

      // User2 should still have tokens
      const result = await rateLimiter.consume(user2, defaultConfig);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should isolate different namespaces', async () => {
      const apiContext: RateLimitContext = { identifier: 'user-1', namespace: 'api' };
      const webhookContext: RateLimitContext = { identifier: 'user-1', namespace: 'webhook' };

      // Exhaust API tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume(apiContext, defaultConfig);
      }

      // Webhook should still have tokens
      const result = await rateLimiter.consume(webhookContext, defaultConfig);
      expect(result.allowed).toBe(true);
    });

    it('should use burstCapacity when provided', async () => {
      const config: RateLimitConfig = {
        ...defaultConfig,
        burstCapacity: 20,
      };

      // Should allow up to 20 requests
      for (let i = 0; i < 20; i++) {
        const result = await rateLimiter.consume(defaultContext, config);
        expect(result.allowed).toBe(true);
      }

      const result = await rateLimiter.consume(defaultContext, config);
      expect(result.allowed).toBe(false);
    });
  });

  describe('peek', () => {
    it('should return current state without consuming', async () => {
      // Consume some tokens
      await rateLimiter.consume(defaultContext, defaultConfig);
      await rateLimiter.consume(defaultContext, defaultConfig);

      // Peek should not change remaining
      const peek1 = await rateLimiter.peek(defaultContext, defaultConfig);
      const peek2 = await rateLimiter.peek(defaultContext, defaultConfig);

      expect(peek1.remaining).toBe(8);
      expect(peek2.remaining).toBe(8);
    });
  });

  describe('reset', () => {
    it('should reset the bucket to full capacity', async () => {
      // Exhaust tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume(defaultContext, defaultConfig);
      }

      // Reset
      await rateLimiter.reset(defaultContext);

      // Should be back to full
      const result = await rateLimiter.consume(defaultContext, defaultConfig);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });
  });

  describe('algorithmName', () => {
    it('should return correct algorithm name', () => {
      expect(rateLimiter.algorithmName).toBe('token-bucket');
    });
  });

  describe('retryAfter', () => {
    it('should calculate correct retry time when rate limited', async () => {
      const config: RateLimitConfig = {
        limit: 10,
        windowSizeSeconds: 10,
        refillRate: 1, // 1 token per second
      };

      // Exhaust all tokens
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume(defaultContext, config);
      }

      const result = await rateLimiter.consume(defaultContext, config);

      expect(result.allowed).toBe(false);
      // Should need ~1 second to get 1 token
      expect(result.retryAfter).toBeGreaterThanOrEqual(900);
      expect(result.retryAfter).toBeLessThanOrEqual(1100);
    });
  });
});
