/**
 * In-Memory Storage Adapter
 *
 * Used for:
 * - Local development without Redis
 * - Unit testing
 * - Fallback when Redis is unavailable
 *
 * Note: This does NOT work in distributed environments as each
 * instance has its own memory. Use only for single-instance scenarios.
 */

import { IStorageAdapter } from '../../core/interfaces/rate-limiter.interface';

interface StoredValue {
  value: string;
  expiresAt?: number;
}

export class MemoryStorageAdapter implements IStorageAdapter {
  private store: Map<string, StoredValue> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Periodically clean up expired keys
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
  }

  async executeScript<T>(
    script: string,
    keys: string[],
    args: (string | number)[]
  ): Promise<T> {
    // For in-memory, we simulate Lua script execution
    // This is a simplified version - real Lua scripts run atomically on Redis

    // Parse the script to determine what operation to perform
    // This is a basic implementation for testing purposes

    if (script.includes('HMGET') && script.includes('tokens')) {
      // Token bucket consume script simulation
      return this.simulateTokenBucketScript(keys, args) as T;
    }

    if (script.includes('ZREMRANGEBYSCORE')) {
      // Sliding window script simulation
      return this.simulateSlidingWindowScript(keys, args) as T;
    }

    if (script.includes('ZREM')) {
      // ZREM for peek cleanup
      return this.simulateZremScript(keys, args) as T;
    }

    throw new Error('Unknown script pattern for in-memory simulation');
  }

  private simulateTokenBucketScript(keys: string[], args: (string | number)[]): [number, number, number] {
    const key = keys[0];
    const tokensRequested = Number(args[0]);
    const capacity = Number(args[1]);
    const refillRate = Number(args[2]);
    const now = Number(args[3]);

    const stored = this.store.get(key);
    let tokens = capacity;
    let lastRefill = now;

    if (stored) {
      const data = JSON.parse(stored.value);
      tokens = data.tokens ?? capacity;
      lastRefill = data.lastRefill ?? now;
    }

    // Calculate refill
    const timePassed = (now - lastRefill) / 1000; // Convert to seconds
    const tokensToAdd = timePassed * refillRate;
    tokens = Math.min(capacity, tokens + tokensToAdd);

    // Calculate reset time
    const tokensNeeded = capacity - tokens;
    let msToFull = 0;
    if (tokensNeeded > 0 && refillRate > 0) {
      msToFull = (tokensNeeded / refillRate) * 1000;
    }
    const resetAt = now + msToFull;

    // Try to consume
    let allowed = 0;
    if (tokens >= tokensRequested) {
      tokens -= tokensRequested;
      allowed = 1;
    }

    this.store.set(key, {
      value: JSON.stringify({ tokens, lastRefill: now }),
      expiresAt: Date.now() + 3600000, // 1 hour TTL
    });

    return [allowed, Math.floor(tokens), Math.floor(resetAt)];
  }

  private simulateSlidingWindowScript(keys: string[], args: (string | number)[]): [number, number, number] {
    const key = keys[0];
    const windowSize = Number(args[0]) * 1000; // Convert to ms
    const maxRequests = Number(args[1]);
    const now = Number(args[2]);
    const requestId = String(args[3]);

    const windowStart = now - windowSize;

    // Get or initialize the sorted set simulation
    let entries: Array<{ score: number; member: string }> = [];
    const stored = this.store.get(key);

    if (stored) {
      entries = JSON.parse(stored.value);
    }

    // Remove old entries
    entries = entries.filter((e) => e.score > windowStart);

    // Get oldest timestamp for reset calculation
    const oldestTimestamp = entries.length > 0 ? entries[0].score : now;
    const resetAt = oldestTimestamp + windowSize;

    // Check count
    let allowed = 0;
    if (entries.length < maxRequests) {
      entries.push({ score: now, member: requestId });
      allowed = 1;
    }

    this.store.set(key, {
      value: JSON.stringify(entries),
      expiresAt: now + windowSize + 10000,
    });

    const remaining = maxRequests - entries.length;
    return [allowed, remaining, Math.floor(resetAt)];
  }

  private simulateZremScript(keys: string[], args: (string | number)[]): number {
    const key = keys[0];
    const member = String(args[0]);

    const stored = this.store.get(key);
    if (!stored) return 0;

    let entries: Array<{ score: number; member: string }> = JSON.parse(stored.value);
    const initialLength = entries.length;
    entries = entries.filter((e) => e.member !== member);

    this.store.set(key, {
      value: JSON.stringify(entries),
      expiresAt: stored.expiresAt,
    });

    return initialLength - entries.length;
  }

  async get(key: string): Promise<string | null> {
    const stored = this.store.get(key);

    if (!stored) {
      return null;
    }

    if (stored.expiresAt && Date.now() > stored.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return stored.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async getServerTime(): Promise<number> {
    return Date.now();
  }

  async close(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, stored] of this.store.entries()) {
      if (stored.expiresAt && now > stored.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get the current size of the store (for testing/debugging)
   */
  getSize(): number {
    return this.store.size;
  }
}
