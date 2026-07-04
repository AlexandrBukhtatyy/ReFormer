/**
 * Unit-тесты FormField.Error — режимы multi / render / asChild.
 *
 * Регрессия (defect #54):
 *  - `<FormField.Error asChild multi/>` не отрисовывал НИЧЕГО: в multi-ветке дочерний
 *    элемент Slot — сырая строка резолвера, а Slot возвращает null для не-элемента.
 *  - forwardRef ref прикреплялся только в ветке одиночной ошибки, теряясь в multi/render.
 *    (ref нельзя наблюдать через renderToStaticMarkup без DOM, поэтому здесь проверяем
 *    отрисовку; привязка ref к первому элементу закреплена в коде.)
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FieldNode, FormValue, ValidationError } from '@reformer/core';
import { FormFieldContext } from './FormFieldContext';
import { FormFieldError } from './FormFieldError';
import type { FormFieldContextValue } from './types';

const ERRORS: ValidationError[] = [
  { code: 'required', message: 'Required' },
  { code: 'minLength', message: 'Too short' },
];

function ctxWithErrors(errors: ValidationError[]): FormFieldContextValue {
  return {
    value: '' as FormValue,
    errors,
    pending: false,
    disabled: false,
    valid: false,
    invalid: true,
    touched: true,
    shouldShowError: true,
    error: errors[0]?.message,
    label: undefined,
    required: true,
    componentProps: {},
    control: {} as unknown as FieldNode<FormValue>,
    ids: {
      controlId: 'control-x',
      labelId: 'label-x',
      descriptionId: 'desc-x',
      errorId: 'error-x',
    },
    hasDescription: false,
  };
}

function render(node: React.ReactNode, errors: ValidationError[] = ERRORS): string {
  return renderToStaticMarkup(
    <FormFieldContext.Provider value={ctxWithErrors(errors)}>{node}</FormFieldContext.Provider>
  );
}

describe('FormField.Error — asChild + multi (#54)', () => {
  it('раньше рендерил пусто; теперь отрисовывает все сообщения об ошибках', () => {
    const html = render(<FormFieldError asChild multi />);
    expect(html.length).toBeGreaterThan(0);
    expect(html).toContain('Required');
    expect(html).toContain('Too short');
    // role="alert" сохранён на каждой ошибке
    expect(html).toContain('role="alert"');
  });
});

describe('FormField.Error — multi (non-asChild)', () => {
  it('отрисовывает каждую ошибку, первая несёт id=errorId', () => {
    const html = render(<FormFieldError multi />);
    expect(html).toContain('Required');
    expect(html).toContain('Too short');
    expect(html).toContain('id="error-x"');
    // ровно один элемент получает errorId (первый)
    expect(html.match(/id="error-x"/g)?.length).toBe(1);
  });
});

describe('FormField.Error — render prop', () => {
  it('отрисовывает каждую ошибку кастомным рендером', () => {
    const html = render(<FormFieldError render={(err) => <em>{err.code}</em>} />);
    expect(html).toContain('<em>required</em>');
    expect(html).toContain('<em>minLength</em>');
    expect(html).toContain('id="error-x"');
  });
});

describe('FormField.Error — single (регрессии нет)', () => {
  it('отрисовывает первую ошибку в <p role="alert" id=errorId>', () => {
    const html = render(<FormFieldError />);
    expect(html).toContain('<p');
    expect(html).toContain('role="alert"');
    expect(html).toContain('id="error-x"');
    expect(html).toContain('Required');
    expect(html).not.toContain('Too short');
  });

  it('возвращает null, когда shouldShowError=false', () => {
    const html = renderToStaticMarkup(
      <FormFieldContext.Provider value={{ ...ctxWithErrors(ERRORS), shouldShowError: false }}>
        <FormFieldError multi />
      </FormFieldContext.Provider>
    );
    expect(html).toBe('');
  });
});
