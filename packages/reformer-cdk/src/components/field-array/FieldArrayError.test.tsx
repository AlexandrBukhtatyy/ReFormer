/**
 * Unit-тесты FieldArray.Error — вывод валидации уровня массива в CDK (defect #42).
 *
 * Проверяет, что array-level ошибки (`minItems` / «At least one phone required») выводятся через
 * подкомпонент `FieldArray.Error`, читающий `errors` из контекста FieldArray — без обхода CDK через
 * `useFormControl(control)`. Паритет с FormField.Error: default / multi / render, и «ничего при 0».
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ModelArrayNode, ValidationError } from '@reformer/core';
import { FieldArrayContext } from './FieldArrayContext';
import { FieldArrayError } from './FieldArrayError';
import type { FieldArrayContextValue } from './FieldArrayContext';

const ERRORS: ValidationError[] = [
  { code: 'minItems', message: 'At least one phone required' },
  { code: 'maxItems', message: 'Too many items' },
];

function ctx(errors: ValidationError[]): FieldArrayContextValue {
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
    control: {} as unknown as ModelArrayNode<Record<string, unknown>>,
  };
}

const render = (errors: ValidationError[], node: React.ReactElement) =>
  renderToStaticMarkup(
    <FieldArrayContext.Provider value={ctx(errors)}>{node}</FieldArrayContext.Provider>
  );

describe('FieldArray.Error', () => {
  it('ничего не рендерит когда ошибок нет', () => {
    expect(render([], <FieldArrayError />)).toBe('');
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
