import type { ValidationError, FormFields } from '@reformer/core';
import type { ValidationError as YupValidationError } from 'yup';
import type { SchemaAdapterOptions } from './types';

/**
 * Type guard for Yup ValidationError
 */
export function isYupValidationError(error: unknown): error is YupValidationError {
  return (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    (error as { name: string }).name === 'ValidationError'
  );
}

/**
 * Map YupValidationError to ReFormer ValidationError
 *
 * Takes the first error from Yup and converts it to a ValidationError.
 * For field-level validation, only the first error is typically needed.
 */
export function mapYupError(
  error: YupValidationError,
  options?: SchemaAdapterOptions
): ValidationError {
  // Custom error mapper has priority
  if (options?.errorMapper) {
    return options.errorMapper(error);
  }

  return {
    code: options?.code || error.type || 'validation',
    message: options?.message || error.message,
    params: {
      path: error.path,
      value: error.value,
      // Yup stores additional params in the params object
      ...(error.params as Record<string, unknown> | undefined),
      ...options?.params,
    } as FormFields,
  };
}
