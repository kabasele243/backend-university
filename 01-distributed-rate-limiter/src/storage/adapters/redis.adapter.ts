/**
 * Redis Storage Adapter
 *
 * Production-ready Redis adapter with:
 * - Connection pooling via ioredis
 * - Lua script caching for performance
 * - Proper error handling and reconnection
 * - Health checks
 */

import Redis from 'ioredis';
import { IStorageAdapter } from '../../core/interfaces/rate-limiter.interface';
import { StorageError, ErrorCode } from '../../core/errors';
import { RedisConfig } from '../../config';

export class RedisStorageAdapter implements IStorageAdapter {
  private client: Redis;
  private keyPrefix: string;
  private isConnected: boolean = false;
  private scriptCache: Map<string, string> = new Map();

  constructor(config: RedisConfig) {
    this.keyPrefix = config.keyPrefix;

    this.client = new Redis({
      host: config.host,
      port: config.port,
      password: config.password,
      db: config.db,
      connectTimeout: config.connectTimeout,
      commandTimeout: config.commandTimeout,
      maxRetriesPerRequest: config.maxRetriesPerRequest,
      enableOfflineQueue: config.enableOfflineQueue,
      retryStrategy: (times: number) => {
        if (times > 10) {
          return null; // Stop retrying
        }
        return Math.min(times * 100, 3000); // Exponential backoff with max 3s
      },
      reconnectOnError: (err: Error) => {
        const targetErrors = ['READONLY', 'ECONNRESET', 'ECONNREFUSED'];
        return targetErrors.some((e) => err.message.includes(e));
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      this.isConnected = true;
    });

    this.client.on('ready', () => {
      this.isConnected = true;
    });

    this.client.on('error', (err: Error) => {
      this.isConnected = false;
      // Log error - will be handled by observability layer
      console.error('Redis error:', err.message);
    });

    this.client.on('close', () => {
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      this.isConnected = false;
    });
  }

  async executeScript<T>(
    script: string,
    keys: string[],
    args: (string | number)[]
  ): Promise<T> {
    try {
      // Apply key prefix
      const prefixedKeys = keys.map((k) => this.keyPrefix + k);

      // Use EVALSHA for performance (script caching)
      let sha = this.scriptCache.get(script);

      if (!sha) {
        sha = await this.client.script('LOAD', script) as string;
        this.scriptCache.set(script, sha);
      }

      try {
        const result = await this.client.evalsha(sha, prefixedKeys.length, ...prefixedKeys, ...args);
        return result as T;
      } catch (err) {
        // Script not in cache, reload it
        if ((err as Error).message.includes('NOSCRIPT')) {
          sha = await this.client.script('LOAD', script) as string;
          this.scriptCache.set(script, sha);
          const result = await this.client.evalsha(sha, prefixedKeys.length, ...prefixedKeys, ...args);
          return result as T;
        }
        throw err;
      }
    } catch (err) {
      throw new StorageError(
        `Failed to execute script: ${(err as Error).message}`,
        ErrorCode.STORAGE_OPERATION_FAILED,
        { keys, error: (err as Error).message }
      );
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(this.keyPrefix + key);
    } catch (err) {
      throw new StorageError(
        `Failed to get key: ${(err as Error).message}`,
        ErrorCode.STORAGE_OPERATION_FAILED,
        { key, error: (err as Error).message }
      );
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    try {
      if (ttlSeconds) {
        await this.client.setex(this.keyPrefix + key, ttlSeconds, value);
      } else {
        await this.client.set(this.keyPrefix + key, value);
      }
    } catch (err) {
      throw new StorageError(
        `Failed to set key: ${(err as Error).message}`,
        ErrorCode.STORAGE_OPERATION_FAILED,
        { key, error: (err as Error).message }
      );
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(this.keyPrefix + key);
    } catch (err) {
      throw new StorageError(
        `Failed to delete key: ${(err as Error).message}`,
        ErrorCode.STORAGE_OPERATION_FAILED,
        { key, error: (err as Error).message }
      );
    }
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isConnected) {
      return false;
    }

    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async getServerTime(): Promise<number> {
    try {
      const time = await this.client.time();
      // Redis TIME returns [seconds, microseconds]
      const seconds = parseInt(String(time[0]), 10);
      const microseconds = parseInt(String(time[1]), 10);
      return seconds * 1000 + Math.floor(microseconds / 1000);
    } catch (err) {
      throw new StorageError(
        `Failed to get server time: ${(err as Error).message}`,
        ErrorCode.STORAGE_OPERATION_FAILED,
        { error: (err as Error).message }
      );
    }
  }

  async close(): Promise<void> {
    await this.client.quit();
    this.isConnected = false;
    this.scriptCache.clear();
  }

  /**
   * Get the underlying Redis client (for advanced operations)
   */
  getClient(): Redis {
    return this.client;
  }
}
