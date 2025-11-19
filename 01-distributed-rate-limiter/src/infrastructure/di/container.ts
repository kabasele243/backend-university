/**
 * Dependency Injection Container Setup
 *
 * Uses tsyringe for lightweight DI. This file configures
 * all dependencies and their lifecycle (singleton vs transient).
 */

import 'reflect-metadata';
import { container, Lifecycle } from 'tsyringe';
import { TOKENS } from './tokens';

/**
 * Initialize the DI container with all dependencies.
 * Call this once at application startup.
 */
export function initializeContainer(): void {
  // Container is configured in individual modules
  // This function serves as the entry point for initialization
}

/**
 * Get the configured container instance
 */
export function getContainer() {
  return container;
}

/**
 * Register a singleton dependency
 */
export function registerSingleton<T>(
  token: symbol,
  implementation: new (...args: unknown[]) => T
): void {
  container.register(token, { useClass: implementation }, { lifecycle: Lifecycle.Singleton });
}

/**
 * Register a transient dependency (new instance each time)
 */
export function registerTransient<T>(
  token: symbol,
  implementation: new (...args: unknown[]) => T
): void {
  container.register(token, { useClass: implementation }, { lifecycle: Lifecycle.Transient });
}

/**
 * Register a factory function
 */
export function registerFactory<T>(
  token: symbol,
  factory: () => T
): void {
  container.register(token, { useFactory: factory });
}

/**
 * Register a value/instance directly
 */
export function registerValue<T>(token: symbol, value: T): void {
  container.register(token, { useValue: value });
}

/**
 * Resolve a dependency from the container
 */
export function resolve<T>(token: symbol): T {
  return container.resolve<T>(token);
}

export { container, TOKENS };
