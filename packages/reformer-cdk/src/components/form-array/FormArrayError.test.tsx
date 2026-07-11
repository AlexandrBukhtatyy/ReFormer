/**
 * Unit-тесты FormArray.Error — вывод валидации уровня массива в CDK (defect #42).
 *
 * Проверяет, что array-level ошибки (`minItems` / «At least one phone required») выводятся через
 * подкомпонент `FormArray.Error`, читающий `errors` из контекста FormArray — без обхода CDK через
 * `useFormControl(control)`. Паритет с FormField.Error: default / multi / render, и «ничего при 0».
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ArrayNode, ValidationError } from '@reformer/core';
import { FormArrayContext } from './FormArrayContext';
import { FormArrayError } from './FormArrayError';
import type { FormArrayContextValue } from './FormArrayContext';

const ERRORS: ValidationError[] = [
  { code: 'minItems', message: 'At least one phone required' },
  { code: 'maxItems', message: 'Too many items' },
];

function ctx(errors: ValidationError[]): FormArrayContextValue {
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
    errors,
    valid: errors.length === 0,
    invalid: errors.length > 0,
    control: {} as unknown as ArrayNode<Record<string, unknown>>,
  };
}

const render = (errors: ValidationError[], node: React.ReactElement) =>
  renderToStaticMarkup(
    <FormArrayContext.Provider value={ctx(errors)}>{node}</FormArrayContext.Provider>
  );

describe('FormArray.Error', () => {
  it('ничего не рендерит когда ошибок нет', () => {
    expect(render([], <FormArrayError />)).toBe('');
  });

  it('по умолчанию рендерит первую ошибку массива', () => {
    const html = render(ERRORS, <FormArrayError />);
    expect(html).toContain('At least one phone required');
    expect(html).not.toContain('Too many items');
    expect(html).toContain('role="alert"');
  });

  it('multi рендерит все ошибки массива', () => {
    const html = render(ERRORS, <FormArrayError multi />);
    expect(html).toContain('At least one phone required');
    expect(html).toContain('Too many items');
  });

  it('render-проп кастомно рендерит каждую ошибку', () => {
    const html = render(ERRORS, <FormArrayError render={(e) => <span>{e.code}</span>} />);
    expect(html).toContain('minItems');
    expect(html).toContain('maxItems');
  });
});
