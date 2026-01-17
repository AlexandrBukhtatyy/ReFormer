import type { ValidationError, FormFields } from '@reformer/core';
import type { ZodError, ZodIssue, ZodIssueCode } from 'zod';
import type { SchemaAdapterOptions } from './types';

/**
 * Map Zod issue code to ReFormer error code
 */
function mapZodIssueCode(code: ZodIssueCode): string {
  const codeMap: Record<ZodIssueCode, string> = {
    invalid_type: 'invalid_type',
    invalid_literal: 'invalid_literal',
    custom: 'custom',
    invalid_union: 'invalid_union',
    invalid_union_discriminator: 'invalid_union_discriminator',
    invalid_enum_value: 'invalid_enum',
    unrecognized_keys: 'unrecognized_keys',
    invalid_arguments: 'invalid_arguments',
    invalid_return_type: 'invalid_return_type',
    invalid_date: 'invalid_date',
    invalid_string: 'invalid_string',
    too_small: 'too_small',
    too_big: 'too_big',
    invalid_intersection_types: 'invalid_intersection',
    not_multiple_of: 'not_multiple_of',
    not_finite: 'not_finite',
  };

  return codeMap[code] || code;
}

/**
 * Extract useful params from Zod issue
 */
function extractParams(issue: ZodIssue): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // Type-safe property access using 'in' operator
  if ('minimum' in issue && issue.minimum !== undefined) {
    params.min = issue.minimum;
  }
  if ('maximum' in issue && issue.maximum !== undefined) {
    params.max = issue.maximum;
  }
  if ('expected' in issue && issue.expected !== undefined) {
    params.expected = issue.expected;
  }
  if ('received' in issue && issue.received !== undefined) {
    params.received = issue.received;
  }
  if ('validation' in issue && issue.validation !== undefined) {
    params.validation = issue.validation;
  }
  if ('inclusive' in issue && issue.inclusive !== undefined) {
    params.inclusive = issue.inclusive;
  }
  if ('exact' in issue && issue.exact !== undefined) {
    params.exact = issue.exact;
  }
  if ('type' in issue && issue.type !== undefined) {
    params.type = issue.type;
  }

  return params;
}

/**
 * Map ZodError to ReFormer ValidationError
 *
 * Takes the first issue from the ZodError and converts it to a ValidationError.
 * For field-level validation, only the first error is typically needed.
 */
export function mapZodError(error: ZodError, options?: SchemaAdapterOptions): ValidationError {
  const firstIssue = error.issues[0];

  // Custom error mapper has priority
  if (options?.errorMapper) {
    return options.errorMapper(error);
  }

  return {
    code: options?.code || mapZodIssueCode(firstIssue.code),
    message: options?.message || firstIssue.message,
    params: {
      ...extractParams(firstIssue),
      ...options?.params,
    } as FormFields,
  };
}
