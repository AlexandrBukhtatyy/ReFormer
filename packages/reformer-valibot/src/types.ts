import type { ValidationError } from '@reformer/core';
import type { BaseIssue } from 'valibot';

/**
 * Options for Valibot schema adapter
 */
export interface SchemaAdapterOptions {
  /**
   * Custom error mapper function
   * Use this to customize how Valibot issues are converted to ValidationError
   */
  errorMapper?: (issues: BaseIssue<unknown>[]) => ValidationError;

  /**
   * Override the error code (defaults to Valibot issue kind)
   */
  code?: string;

  /**
   * Override the error message (defaults to Valibot issue message)
   */
  message?: string;

  /**
   * Additional params to include in the ValidationError
   */
  params?: Record<string, unknown>;
}

/**
 * Options for async Valibot schema adapter
 */
export interface AsyncSchemaAdapterOptions extends SchemaAdapterOptions {
  /**
   * Debounce delay in milliseconds for async validation
   */
  debounce?: number;
}
