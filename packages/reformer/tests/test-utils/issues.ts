/**
 * Коды замечаний — компактная форма для утверждений: `expect(issueCodes(node)).toEqual(['required'])`.
 *
 * @module test-utils/issues
 */

import type { ValidationIssue } from '../../src/form/types/contracts';
import type { ValidationResult } from '../../src/form/validation/types';

/** Коды замечаний ноды (сигнал `issues` или `ownIssues`). */
export const issueCodes = (node: {
  readonly issues: { readonly value: readonly ValidationIssue[] };
}): string[] => node.issues.value.map((issue) => issue.code);

/** Коды замечаний поля в результате прогона — по ручке `model.$.<поле>`. */
export const resultCodes = (result: ValidationResult, handle: unknown): string[] =>
  (result.issues.get(handle as never) ?? []).map((issue) => issue.code);
