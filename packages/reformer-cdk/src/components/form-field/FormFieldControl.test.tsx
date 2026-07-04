/**
 * Unit-тесты FormField.Control — режим asChild/children.
 *
 * Регрессия (defect #48): ветка asChild/children прокидывала в Slot только accessibleProps
 * (id + aria-*), но НЕ value/onChange/onBlur/disabled — кастомный input рендерился
 * подключённым к ARIA, но отсоединённым от FieldNode (ввод не обновлял поле, disabled
 * игнорировался). Тест проверяет, что теперь все привязки поля мержатся в дочерний элемент.
 */
import { describe, it, expect, vi } from 'vitest';
import { forwardRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { FieldNode, FormValue } from '@reformer/core';
import { FormFieldContext } from './FormFieldContext';
import { FormFieldControl } from './FormFieldControl';
import type { FormFieldContextValue } from './types';

function makeCtx(overrides: Partial<FormFieldContextValue> = {}): {
  ctx: FormFieldContextValue;
  setValue: ReturnType<typeof vi.fn>;
  markAsTouched: ReturnType<typeof vi.fn>;
} {
  const setValue = vi.fn();
  const markAsTouched = vi.fn();
  const control = {
    setValue,
    markAsTouched,
    component: () => null,
    value: 'hello',
  } as unknown as FieldNode<FormValue>;

  const ctx: FormFieldContextValue = {
    value: 'hello',
    errors: [],
    pending: false,
    disabled: true,
    valid: true,
    invalid: false,
    touched: false,
    shouldShowError: false,
    error: undefined,
    label: undefined,
    required: true,
    componentProps: {},
    control,
    ids: {
      controlId: 'control-x',
      labelId: 'label-x',
      descriptionId: 'desc-x',
      errorId: 'error-x',
    },
    hasDescription: false,
    ...overrides,
  };
  return { ctx, setValue, markAsTouched };
}

/** Ловит пропсы, с которыми Slot вызвал дочерний компонент. */
function renderCapturingChild(ctx: FormFieldContextValue): Record<string, unknown> {
  const box: { props: Record<string, unknown> } = { props: {} };
  const Spy = forwardRef<HTMLInputElement, Record<string, unknown>>(function Spy(props, ref) {
    // eslint-disable-next-line react-hooks/immutability -- тест-шпион намеренно захватывает пропсы
    box.props = props;
    return <input ref={ref} />;
  });

  renderToStaticMarkup(
    <FormFieldContext.Provider value={ctx}>
      <FormFieldControl asChild>
        <Spy />
      </FormFieldControl>
    </FormFieldContext.Provider>
  );
  return box.props;
}

describe('FormField.Control — asChild wiring (#48)', () => {
  it('мержит value и disabled в дочерний элемент', () => {
    const { ctx } = makeCtx();
    const captured = renderCapturingChild(ctx);
    expect(captured.value).toBe('hello');
    expect(captured.disabled).toBe(true);
  });

  it('прокидывает value-based onChange, вызывающий control.setValue', () => {
    const { ctx, setValue } = makeCtx();
    const captured = renderCapturingChild(ctx);
    expect(typeof captured.onChange).toBe('function');
    (captured.onChange as (v: unknown) => void)('typed value');
    expect(setValue).toHaveBeenCalledWith('typed value');
  });

  it('прокидывает onBlur, вызывающий control.markAsTouched', () => {
    const { ctx, markAsTouched } = makeCtx();
    const captured = renderCapturingChild(ctx);
    expect(typeof captured.onBlur).toBe('function');
    (captured.onBlur as () => void)();
    expect(markAsTouched).toHaveBeenCalledTimes(1);
  });

  it('по-прежнему прокидывает accessibleProps (id + aria-*)', () => {
    const { ctx } = makeCtx({ required: true, shouldShowError: false });
    const captured = renderCapturingChild(ctx);
    expect(captured.id).toBe('control-x');
    expect(captured['aria-labelledby']).toBe('label-x');
    expect(captured['aria-required']).toBe(true);
  });
});
