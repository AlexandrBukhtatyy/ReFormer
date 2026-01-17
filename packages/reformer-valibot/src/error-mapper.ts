import type { ValidationError, FormFields } from '@reformer/core';
import type { BaseIssue } from 'valibot';
import type { SchemaAdapterOptions } from './types';

/**
 * Extract useful params from Valibot issue
 */
function extractParams(issue: BaseIssue<unknown>): Record<string, unknown> {
  const params: Record<string, unknown> = {};

  // Input contains the original value
  if ('input' in issue) {
    params.received = issue.input;
  }

  // Expected contains the expected type/value
  if ('expected' in issue && issue.expected !== undefined) {
    params.expected = issue.expected;
  }

  // Requirement contains validation constraints (min, max, pattern, etc.)
  if ('requirement' in issue && issue.requirement !== undefined) {
    const requirement = issue.requirement;
    if (typeof requirement === 'number') {
      params.limit = requirement;
    } else if (requirement instanceof RegExp) {
      params.pattern = requirement.source;
    } else {
      params.requirement = requirement;
    }
  }

  // Path contains the field path for nested objects
  if ('path' in issue && issue.path !== undefined) {
    params.path = issue.path;
  }

  return params;
}

/**
 * Map Valibot issue kind to ReFormer error code
 */
function mapValibotKind(issue: BaseIssue<unknown>): string {
  // Valibot uses 'kind' for issue type in v1.x
  const kind = (issue as { kind?: string }).kind;

  if (!kind) {
    // Fallback to type if kind is not available
    return (issue as { type?: string }).type || 'validation';
  }

  const codeMap: Record<string, string> = {
    // Type validations
    string: 'invalid_type',
    number: 'invalid_type',
    boolean: 'invalid_type',
    bigint: 'invalid_type',
    symbol: 'invalid_type',
    undefined: 'invalid_type',
    null: 'invalid_type',
    object: 'invalid_type',
    array: 'invalid_type',
    tuple: 'invalid_type',
    date: 'invalid_type',

    // String validations
    email: 'invalid_email',
    url: 'invalid_url',
    uuid: 'invalid_uuid',
    regex: 'invalid_pattern',
    emoji: 'invalid_emoji',
    ipv4: 'invalid_ipv4',
    ipv6: 'invalid_ipv6',

    // Size validations
    min_length: 'too_short',
    max_length: 'too_long',
    length: 'invalid_length',
    min_value: 'too_small',
    max_value: 'too_big',
    value: 'invalid_value',

    // Other validations
    custom: 'custom',
    non_empty: 'required',
    optional: 'optional',
    nullable: 'nullable',
  };

  return codeMap[kind] || kind;
}

/**
 * Map Valibot issues to ReFormer ValidationError
 *
 * Takes the first issue from Valibot and converts it to a ValidationError.
 * For field-level validation, only the first error is typically needed.
 */
export function mapValibotError(
  issues: BaseIssue<unknown>[],
  options?: SchemaAdapterOptions
): ValidationError {
  const firstIssue = issues[0];

  // Custom error mapper has priority
  if (options?.errorMapper) {
    return options.errorMapper(issues);
  }

  return {
    code: options?.code || mapValibotKind(firstIssue),
    message: options?.message || firstIssue.message,
    params: {
      ...extractParams(firstIssue),
      ...options?.params,
    } as FormFields,
  };
}
