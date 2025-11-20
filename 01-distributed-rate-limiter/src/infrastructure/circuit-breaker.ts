/**
 * Circuit Breaker Pattern
 *
 * Prevents cascading failures when Redis is down.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing, reject requests immediately
 * - HALF_OPEN: Testing if service recovered
 */

import { CircuitOpenError } from '../core/errors';
import { circuitBreakerState } from '../observability/metrics/prometheus';

export enum CircuitState {
  CLOSED = 0,
  OPEN = 1,
  HALF_OPEN = 2,
}

export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  /** Time to wait before trying again (ms) */
  resetTimeoutMs: number;
  /** Number of successful calls in half-open to close circuit */
  halfOpenSuccessThreshold: number;
  /** Name for metrics/logging */
  name: string;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold ?? 5,
      resetTimeoutMs: options.resetTimeoutMs ?? 30000,
      halfOpenSuccessThreshold: options.halfOpenSuccessThreshold ?? 3,
      name: options.name ?? 'default',
    };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        const retryAfter = this.options.resetTimeoutMs - (Date.now() - this.lastFailureTime);
        throw new CircuitOpenError(retryAfter, {
          circuitName: this.options.name,
          state: 'OPEN',
        });
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful call
   */
  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.halfOpenSuccessThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  /**
   * Record a failed call
   */
  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open goes back to open
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failureCount >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Check if we should try to reset the circuit
   */
  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs;
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: CircuitState): void {
    this.state = newState;

    // Update metrics
    circuitBreakerState.set({ name: this.options.name }, newState);

    // Reset counters on state change
    if (newState === CircuitState.CLOSED) {
      this.failureCount = 0;
      this.successCount = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successCount = 0;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get state as string
   */
  getStateString(): string {
    switch (this.state) {
      case CircuitState.CLOSED:
        return 'CLOSED';
      case CircuitState.OPEN:
        return 'OPEN';
      case CircuitState.HALF_OPEN:
        return 'HALF_OPEN';
    }
  }

  /**
   * Manually reset the circuit (for admin purposes)
   */
  reset(): void {
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Get circuit breaker stats
   */
  getStats() {
    return {
      name: this.options.name,
      state: this.getStateString(),
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
    };
  }
}
