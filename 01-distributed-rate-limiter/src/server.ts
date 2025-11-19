/**
 * Demo Express Server
 *
 * Demonstrates rate limiting with different configurations
 * for various endpoints.
 */

import 'reflect-metadata';
import express, { Request, Response } from 'express';
import { getConfig } from './config';
import { MemoryStorageAdapter } from './storage/adapters/memory.adapter';
import { RedisStorageAdapter } from './storage/adapters/redis.adapter';
import { RateLimiterFactory, AlgorithmType } from './infrastructure/factories/rate-limiter.factory';
import {
  createRateLimiterMiddleware,
  rateLimiterPresets,
} from './middleware/rate-limiter.middleware';
import { IStorageAdapter } from './core/interfaces/rate-limiter.interface';

async function bootstrap() {
  const config = getConfig();
  const app = express();

  app.use(express.json());

  // Trust proxy for proper IP detection behind load balancers
  if (config.server.trustProxy) {
    app.set('trust proxy', true);
  }

  // Initialize storage adapter
  let storage: IStorageAdapter;

  if (config.env === 'production' || process.env.USE_REDIS === 'true') {
    console.log('Using Redis storage adapter');
    storage = new RedisStorageAdapter(config.redis);
  } else {
    console.log('Using in-memory storage adapter (development mode)');
    storage = new MemoryStorageAdapter();
  }

  // Create rate limiters
  const algorithm = config.rateLimitDefaults.algorithm as AlgorithmType;
  const rateLimiter = RateLimiterFactory.create(algorithm, storage);

  console.log(`Rate limiter initialized with ${algorithm} algorithm`);

  // ============================================
  // Demo Endpoints with Different Rate Limits
  // ============================================

  /**
   * Public API - Low rate limit (10 requests/minute)
   */
  app.get(
    '/api/public',
    createRateLimiterMiddleware({
      rateLimiter,
      config: { limit: 10, windowSizeSeconds: 60 },
      namespace: 'public',
    }),
    (req: Request, res: Response) => {
      res.json({
        message: 'Public API response',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Authenticated API - Higher rate limit (100 requests/minute)
   */
  app.get(
    '/api/data',
    rateLimiterPresets.api(rateLimiter, 100, 60),
    (req: Request, res: Response) => {
      res.json({
        message: 'Data API response',
        data: { id: 1, name: 'Sample Data' },
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Write endpoint - Stricter limit (20 requests/minute)
   */
  app.post(
    '/api/data',
    createRateLimiterMiddleware({
      rateLimiter,
      config: { limit: 20, windowSizeSeconds: 60 },
      namespace: 'write',
      cost: 2, // Each write costs 2 tokens
    }),
    (req: Request, res: Response) => {
      res.status(201).json({
        message: 'Data created successfully',
        data: req.body,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Authentication endpoint - Very strict (5 requests/minute)
   */
  app.post(
    '/api/auth/login',
    rateLimiterPresets.auth(rateLimiter, 5, 60),
    (req: Request, res: Response) => {
      res.json({
        message: 'Login successful',
        token: 'demo-token-12345',
      });
    }
  );

  /**
   * Premium endpoint - High rate limit (1000 requests/minute)
   */
  app.get(
    '/api/premium',
    rateLimiterPresets.premium(rateLimiter, 1000, 60),
    (req: Request, res: Response) => {
      res.json({
        message: 'Premium API response',
        tier: 'premium',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Endpoint with custom key generator (by API key)
   */
  app.get(
    '/api/external',
    createRateLimiterMiddleware({
      rateLimiter,
      config: { limit: 50, windowSizeSeconds: 60 },
      namespace: 'external',
      keyGenerator: (req) => {
        return (req.headers['x-api-key'] as string) || req.ip || 'anonymous';
      },
    }),
    (req: Request, res: Response) => {
      res.json({
        message: 'External API response',
        apiKey: req.headers['x-api-key'] || 'none',
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * Burst-friendly endpoint (using token bucket)
   * Allows bursts up to 50, refills at 10/second
   */
  app.get(
    '/api/burst',
    createRateLimiterMiddleware({
      rateLimiter,
      config: {
        limit: 100,
        windowSizeSeconds: 10,
        burstCapacity: 50,
        refillRate: 10,
      },
      namespace: 'burst',
    }),
    (req: Request, res: Response) => {
      res.json({
        message: 'Burst-friendly endpoint',
        timestamp: new Date().toISOString(),
      });
    }
  );

  // ============================================
  // Health & Info Endpoints
  // ============================================

  /**
   * Health check - No rate limiting
   */
  app.get('/health', async (req: Request, res: Response) => {
    const storageHealthy = await storage.isHealthy();

    res.status(storageHealthy ? 200 : 503).json({
      status: storageHealthy ? 'healthy' : 'degraded',
      storage: storageHealthy ? 'connected' : 'disconnected',
      algorithm,
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * Info endpoint - Shows rate limit configuration
   */
  app.get('/info', (req: Request, res: Response) => {
    res.json({
      name: 'Distributed Rate Limiter Demo',
      version: '1.0.0',
      algorithm,
      endpoints: [
        { path: '/api/public', limit: '10/min', description: 'Public API' },
        { path: '/api/data', limit: '100/min', description: 'Data API' },
        { path: 'POST /api/data', limit: '20/min', description: 'Create data (2x cost)' },
        { path: '/api/auth/login', limit: '5/min', description: 'Authentication' },
        { path: '/api/premium', limit: '1000/min', description: 'Premium tier' },
        { path: '/api/external', limit: '50/min', description: 'External (by API key)' },
        { path: '/api/burst', limit: '100/10s', description: 'Burst-friendly' },
      ],
    });
  });

  // ============================================
  // Start Server
  // ============================================

  const server = app.listen(config.server.port, config.server.host, () => {
    console.log(`Server running at http://${config.server.host}:${config.server.port}`);
    console.log(`Health check: http://localhost:${config.server.port}/health`);
    console.log(`API info: http://localhost:${config.server.port}/info`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(async () => {
      await storage.close();
      process.exit(0);
    });
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(async () => {
      await storage.close();
      process.exit(0);
    });
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
