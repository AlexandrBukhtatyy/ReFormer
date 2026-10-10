/**
 * Unit-тесты FieldArray.Error — вывод валидации уровня массива в CDK (defect #42).
 *
 * Проверяет, что array-level ошибки (`minItems` / «At least one phone required») выводятся через
 * подкомпонент `FieldArray.Error`, читающий `issues` из контекста FieldArray — без обхода CDK через
 * `useFormControl(control)`. Паритет с FormField.Error: default / multi / render, и «ничего при 0».
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FormArray, ValidationIssue } from '@reformer/core';
import { defineIssueMessages } from '@reformer/core/i18n';
import { ValidationMessagesProvider } from '../../validation/error-resolver';
import { FieldArrayContext } from './FieldArrayContext';
import { FieldArrayError } from './FieldArrayError';
import type { FieldArrayContextValue } from './FieldArrayContext';

const ERRORS: ValidationIssue[] = [{ code: 'minItems' }, { code: 'maxItems' }];

/** Тексты замечаний — словарь формы: у самих замечаний текста нет. */
const MESSAGES = defineIssueMessages({
  minItems: 'At least one phone required',
  maxItems: 'Too many items',
});

/** Контекст массива: `ownIssues` — правила массива, `issues` — они же плюс замечания строк. */
function ctx(
  ownIssues: ValidationIssue[],
  rowIssues: ValidationIssue[] = []
): FieldArrayContextValue {
  const issues = [...ownIssues, ...rowIssues];
  return {
    items: [],
    length: 0,
    isEmpty: true,
    add: () => {},
    clear: () => {},
    insert: () => {},
    removeAt: () => {},
    move: () => {},
    swap: () => {},
    at: () => undefined,
    issues,
    ownIssues,
    valid: issues.length === 0,
    invalid: issues.length > 0,
    control: {} as unknown as FormArray<Record<string, unknown>>,
  };
}

const render = (
  issues: ValidationIssue[],
  node: React.ReactElement,
  rowIssues: ValidationIssue[] = []
) =>
  renderToStaticMarkup(
    <ValidationMessagesProvider messages={MESSAGES}>
      <FieldArrayContext.Provider value={ctx(issues, rowIssues)}>{node}</FieldArrayContext.Provider>
    </ValidationMessagesProvider>
  );

describe('FieldArray.Error', () => {
  it('ничего не рендерит когда ошибок нет', () => {
    expect(render([], <FieldArrayError />)).toBe('');
  });

  it('замечания полей строк не показывает — только правила массива', () => {
    expect(render([], <FieldArrayError multi />, [{ code: 'required' }])).toBe('');

    const html = render([{ code: 'minItems' }], <FieldArrayError multi />, [{ code: 'required' }]);
    expect(html).toContain('At least one phone required');
    expect(html.match(/role="alert"/g)).toHaveLength(1);
  });

  it('по умолчанию рендерит первую ошибку массива', () => {
    const html = render(ERRORS, <FieldArrayError />);
    expect(html).toContain('At least one phone required');
    expect(html).not.toContain('Too many items');
    expect(html).toContain('role="alert"');
  });

  it('multi рендерит все ошибки массива', () => {
    const html = render(ERRORS, <FieldArrayError multi />);
    expect(html).toContain('At least one phone required');
    expect(html).toContain('Too many items');
  });

  it('render-проп кастомно рендерит каждую ошибку', () => {
    const html = render(ERRORS, <FieldArrayError render={(e) => <span>{e.code}</span>} />);
    expect(html).toContain('minItems');
    expect(html).toContain('maxItems');
  });
});
