import type { ValidationError } from '@reformer/core';
import type { ValidationError as YupValidationError } from 'yup';

/**
 * Options for Yup schema adapter
 */
export interface SchemaAdapterOptions {
  /**
   * Custom error mapper function
   * Use this to customize how Yup errors are converted to ValidationError
   */
  errorMapper?: (error: YupValidationError) => ValidationError;

  /**
   * Override the error code (defaults to Yup error type)
   */
  code?: string;

  /**
   * Override the error message (defaults to Yup error message)
   */
  message?: string;

  /**
   * Additional params to include in the ValidationError
   */
  params?: Record<string, unknown>;
}

/**
 * Options for async Yup schema adapter
 */
export interface AsyncSchemaAdapterOptions extends SchemaAdapterOptions {
  /**
   * Debounce delay in milliseconds for async validation
   */
  debounce?: number;
}
