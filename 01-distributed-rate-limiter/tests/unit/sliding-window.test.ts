import { SlidingWindowRateLimiter } from '../../src/algorithms/sliding-window';
import { MemoryStorageAdapter } from '../../src/storage/adapters/memory.adapter';
import { RateLimitConfig, RateLimitContext } from '../../src/core/interfaces/rate-limiter.interface';

describe('SlidingWindowRateLimiter', () => {
  let storage: MemoryStorageAdapter;
  let rateLimiter: SlidingWindowRateLimiter;

  const defaultConfig: RateLimitConfig = {
    limit: 10,
    windowSizeSeconds: 60,
  };

  const defaultContext: RateLimitContext = {
    identifier: 'test-user-123',
    namespace: 'api',
  };

  beforeEach(() => {
    storage = new MemoryStorageAdapter();
    rateLimiter = new SlidingWindowRateLimiter(storage);
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('consume', () => {
    it('should allow requests when under limit', async () => {
      const result = await rateLimiter.consume(defaultContext, defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
      expect(result.limit).toBe(10);
    });

    it('should decrement remaining on each request', async () => {
      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        await rateLimiter.consume(defaultContext, defaultConfig);
      }

      const result = await rateLimiter.consume(defaultContext, defaultConfig);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(4);
    });

    it('should deny requests when limit is reached', async () => {
      // Exhaust all 10 requests
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume(defaultContext, defaultConfig);
      }

      const result = await rateLimiter.consume(defaultContext, defaultConfig);

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBeDefined();
    });

    it('should isolate different identifiers', async () => {
      const user1: RateLimitContext = { identifier: 'user-1' };
      const user2: RateLimitContext = { identifier: 'user-2' };

      // Exhaust user1's limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume(user1, defaultConfig);
      }

      // User2 should still be allowed
      const result = await rateLimiter.consume(user2, defaultConfig);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(9);
    });

    it('should isolate different namespaces', async () => {
      const apiContext: RateLimitContext = { identifier: 'user-1', namespace: 'api' };
      const webhookContext: RateLimitContext = { identifier: 'user-1', namespace: 'webhook' };

      // Exhaust API limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume(apiContext, defaultConfig);
      }

      // Webhook should still be allowed
      const result = await rateLimiter.consume(webhookContext, defaultConfig);
      expect(result.allowed).toBe(true);
    });

    it('should handle different window sizes', async () => {
      const config: RateLimitConfig = {
        limit: 5,
        windowSizeSeconds: 10,
      };

      // Make 5 requests
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.consume(defaultContext, config);
        expect(result.allowed).toBe(true);
      }

      // 6th should be denied
      const result = await rateLimiter.consume(defaultContext, config);
      expect(result.allowed).toBe(false);
    });
  });

  describe('peek', () => {
    it('should return current state without consuming', async () => {
      // Make some requests
      await rateLimiter.consume(defaultContext, defaultConfig);
      await rateLimiter.consume(defaultContext, defaultConfig);

      // Peek should not change remaining
      const peek1 = await rateLimiter.peek(defaultContext, defaultConfig);
      const peek2 = await rateLimiter.peek(defaultContext, defaultConfig);

      expect(peek1.remaining).toBe(8);
      expect(peek2.remaining).toBe(8);
    });

    it('should show correct state when at limit', async () => {
      // Exhaust limit
      for (let i = 0; i < 10; i++) {
        await rateLimiter.consume(defaultContext, defaultConfig);
      }

      const peek = await rateLimiter.peek(defaultContext, defaultConfig);
      expect(peek.allowed).toBe(false);
      expect(peek.remaining).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset to full capacity', async () => {
      // Exhaust limit
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
      expect(rateLimiter.algorithmName).toBe('sliding-window');
    });
  });

  describe('comparison with token bucket', () => {
    it('should not allow bursting (unlike token bucket)', async () => {
      const config: RateLimitConfig = {
        limit: 5,
        windowSizeSeconds: 60,
      };

      // Sliding window: 5 requests allowed, no bursting
      for (let i = 0; i < 5; i++) {
        const result = await rateLimiter.consume(defaultContext, config);
        expect(result.allowed).toBe(true);
      }

      // 6th request should be denied immediately
      const result = await rateLimiter.consume(defaultContext, config);
      expect(result.allowed).toBe(false);
    });
  });
});
