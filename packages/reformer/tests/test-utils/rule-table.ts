/**
 * Табличные кейсы правил валидации: значение → ожидаемый код (или `null`) и, при желании, параметры.
 *
 * @example
 * ```ts
 * describeRule('min(10)', min(10), [
 *   { value: 10, code: null },
 *   { value: 9, code: 'min', params: { min: 10, actual: 9 } },
 * ]);
 * ```
 *
 * @module test-utils/rule-table
 */

import { describe, expect, it } from 'vitest';
import type { ValidationIssue } from '../../src/form/types/contracts';

/** Кейс правила. */
export interface RuleCase {
  /** Проверяемое значение. */
  readonly value: unknown;
  /** Ожидаемый код замечания; `null` — значение проходит. */
  readonly code: string | null;
  /** Ожидаемые параметры замечания (сравнение `toEqual`). */
  readonly params?: Readonly<Record<string, unknown>>;
  /** Подпись кейса; по умолчанию — значение в JSON. */
  readonly label?: string;
}

type AnyRule = (value: never) => ValidationIssue | null;

const labelOf = (value: unknown): string => {
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString();
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  if (Object.is(value, -0)) return '-0';
  if (typeof value === 'string') return JSON.stringify(value);
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

/** Проверить одно правило на наборе значений. */
export function checkRule(rule: AnyRule, cases: readonly RuleCase[]): void {
  it.each(cases.map((c) => [c.label ?? labelOf(c.value), c] as const))('%s', (_label, c) => {
    const issue = (rule as (value: unknown) => ValidationIssue | null)(c.value);
    if (c.code === null) {
      expect(issue).toBeNull();
      return;
    }
    expect(issue?.code).toBe(c.code);
    if (c.params) expect(issue?.params).toEqual(c.params);
  });
}

/** То же, обёрнутое в `describe` с названием правила. */
export function describeRule(name: string, rule: AnyRule, cases: readonly RuleCase[]): void {
  describe(name, () => checkRule(rule, cases));
}
