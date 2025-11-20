/**
 * Prometheus Metrics for Rate Limiter
 *
 * Tracks:
 * - Total requests by endpoint
 * - Rate limit exceeded count
 * - Latency histograms
 * - Redis operation metrics
 */

import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Create a custom registry
export const metricsRegistry = new Registry();

// Collect default Node.js metrics (CPU, memory, etc.)
collectDefaultMetrics({ register: metricsRegistry });

/**
 * Total rate limit requests
 */
export const rateLimitRequestsTotal = new Counter({
  name: 'rate_limit_requests_total',
  help: 'Total number of rate limit checks',
  labelNames: ['namespace', 'allowed'],
  registers: [metricsRegistry],
});

/**
 * Rate limit exceeded counter
 */
export const rateLimitExceededTotal = new Counter({
  name: 'rate_limit_exceeded_total',
  help: 'Total number of requests that exceeded rate limit',
  labelNames: ['namespace'],
  registers: [metricsRegistry],
});

/**
 * Rate limit check latency
 */
export const rateLimitLatency = new Histogram({
  name: 'rate_limit_latency_seconds',
  help: 'Latency of rate limit checks in seconds',
  labelNames: ['namespace', 'algorithm'],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

/**
 * Redis operation counter
 */
export const redisOperationsTotal = new Counter({
  name: 'redis_operations_total',
  help: 'Total number of Redis operations',
  labelNames: ['operation', 'status'],
  registers: [metricsRegistry],
});

/**
 * Redis connection status
 */
export const redisConnectionStatus = new Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1 = connected, 0 = disconnected)',
  registers: [metricsRegistry],
});

/**
 * Circuit breaker state
 */
export const circuitBreakerState = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0 = closed, 1 = open, 2 = half-open)',
  labelNames: ['name'],
  registers: [metricsRegistry],
});

/**
 * Current tokens remaining (for monitoring)
 */
export const tokensRemaining = new Gauge({
  name: 'rate_limit_tokens_remaining',
  help: 'Current tokens remaining in bucket',
  labelNames: ['namespace', 'identifier'],
  registers: [metricsRegistry],
});

/**
 * Helper to record rate limit check
 */
export function recordRateLimitCheck(
  namespace: string,
  allowed: boolean,
  latencyMs: number,
  algorithm: string
): void {
  rateLimitRequestsTotal.inc({ namespace, allowed: String(allowed) });

  if (!allowed) {
    rateLimitExceededTotal.inc({ namespace });
  }

  rateLimitLatency.observe(
    { namespace, algorithm },
    latencyMs / 1000 // Convert to seconds
  );
}

/**
 * Helper to record Redis operation
 */
export function recordRedisOperation(operation: string, success: boolean): void {
  redisOperationsTotal.inc({ operation, status: success ? 'success' : 'error' });
}

/**
 * Get metrics endpoint handler for Express
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Get content type for metrics
 */
export function getMetricsContentType(): string {
  return metricsRegistry.contentType;
}
