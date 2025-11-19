/**
 * Rate Limiter Factory
 *
 * Creates rate limiter instances based on configuration.
 * Implements the Factory pattern for flexible instantiation.
 */

import { IRateLimiter, IStorageAdapter } from '../../core/interfaces/rate-limiter.interface';
import { TokenBucketRateLimiter } from '../../algorithms/token-bucket';
import { SlidingWindowRateLimiter } from '../../algorithms/sliding-window';
import { ConfigurationError } from '../../core/errors';

export type AlgorithmType = 'token-bucket' | 'sliding-window';

/**
 * Factory for creating rate limiter instances
 */
export class RateLimiterFactory {
  /**
   * Create a rate limiter with the specified algorithm
   */
  static create(algorithm: AlgorithmType, storage: IStorageAdapter): IRateLimiter {
    switch (algorithm) {
      case 'token-bucket':
        return new TokenBucketRateLimiter(storage);

      case 'sliding-window':
        return new SlidingWindowRateLimiter(storage);

      default:
        throw new ConfigurationError(`Unknown rate limiting algorithm: ${algorithm}`, {
          algorithm,
          supportedAlgorithms: ['token-bucket', 'sliding-window'],
        });
    }
  }

  /**
   * Get all available algorithm types
   */
  static getAvailableAlgorithms(): AlgorithmType[] {
    return ['token-bucket', 'sliding-window'];
  }
}
