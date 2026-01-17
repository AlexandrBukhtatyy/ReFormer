import type { ValidationError } from '@reformer/core';
import type { ZodError } from 'zod';

/**
 * Options for Zod schema adapter
 */
export interface SchemaAdapterOptions {
  /**
   * Custom error mapper function
   * Use this to customize how Zod errors are converted to ValidationError
   */
  errorMapper?: (error: ZodError) => ValidationError;

  /**
   * Override the error code (defaults to Zod issue code)
   */
  code?: string;

  /**
   * Override the error message (defaults to Zod issue message)
   */
  message?: string;

  /**
   * Additional params to include in the ValidationError
   */
  params?: Record<string, unknown>;
}

/**
 * Options for async Zod schema adapter
 */
export interface AsyncSchemaAdapterOptions extends SchemaAdapterOptions {
  /**
   * Debounce delay in milliseconds for async validation
   */
  debounce?: number;
}
