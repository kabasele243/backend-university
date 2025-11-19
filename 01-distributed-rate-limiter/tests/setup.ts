/**
 * Jest Test Setup
 *
 * This file runs before all tests and configures the test environment.
 */

import 'reflect-metadata';

// Set test environment
process.env.NODE_ENV = 'test';

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global test utilities
beforeAll(() => {
  // Setup that runs once before all tests
});

afterAll(() => {
  // Cleanup that runs once after all tests
});
