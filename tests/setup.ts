/**
 * Vitest setup file
 * Runs before all tests
 */

Object.defineProperty(process.env, 'NODE_ENV', { value: 'test' })

// Mock console methods to reduce noise in test output
global.console = {
  ...console,
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  // Keep error for debugging
  error: console.error,
}

// Setup global test utilities
import { vi } from 'vitest'

// Make vi globally available
(globalThis as typeof globalThis & { vi: typeof vi }).vi = vi;
