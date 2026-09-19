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
      hintId: 'hint-x',
    },
    hasDescription: false,
    hasHint: false,
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

describe('FormField.Control — aria-describedby', () => {
  const error = { code: 'required', message: 'Обязательное поле' };

  it('без описания, подсказки и ошибки атрибут не выставляется', () => {
    const { ctx } = makeCtx();
    expect(renderCapturingChild(ctx)['aria-describedby']).toBeUndefined();
  });

  it('hasHint добавляет ids.hintId', () => {
    const { ctx } = makeCtx({ hasHint: true });
    expect(renderCapturingChild(ctx)['aria-describedby']).toBe('hint-x');
  });

  it('порядок id — подсказка, описание, ошибка', () => {
    const { ctx } = makeCtx({
      hasHint: true,
      hasDescription: true,
      shouldShowError: true,
      errors: [error],
    });
    expect(renderCapturingChild(ctx)['aria-describedby']).toBe('hint-x desc-x error-x');
  });

  it('авто-рендер control.component получает тот же aria-describedby', () => {
    const box: { props: Record<string, unknown> } = { props: {} };
    const Auto = (props: Record<string, unknown>) => {
      box.props = props;
      return null;
    };
    const { ctx } = makeCtx({ hasHint: true, hasDescription: true });
    const control = { ...ctx.control, component: Auto } as unknown as FieldNode<FormValue>;
    renderToStaticMarkup(
      <FormFieldContext.Provider value={{ ...ctx, control }}>
        <FormFieldControl />
      </FormFieldContext.Provider>
    );
    expect(box.props['aria-describedby']).toBe('hint-x desc-x');
  });
});

describe('FormField.Control — адаптер контрола (статика reformerAdapter)', () => {
  const checkedAdapter = {
    valueProp: 'checked',
    changeProp: 'onCheckedChange',
    fromEmit: (c: unknown) => c === true,
    toValue: (v: unknown) => v ?? false,
  };

  function renderAuto(
    component: unknown,
    ctxOverrides: Partial<FormFieldContextValue> = {}
  ): { props: Record<string, unknown>; setValue: ReturnType<typeof vi.fn> } {
    const { ctx, setValue } = makeCtx(ctxOverrides);
    const control = { ...ctx.control, component } as unknown as FieldNode<FormValue>;
    renderToStaticMarkup(
      <FormFieldContext.Provider value={{ ...ctx, control }}>
        <FormFieldControl />
      </FormFieldContext.Provider>
    );
    return { props: box.props, setValue };
  }
  const box: { props: Record<string, unknown> } = { props: {} };
  const capture = (props: Record<string, unknown>) => {
    box.props = props;
    return null;
  };

  it('авто-рендер переводит seam в диалект контрола', () => {
    const Checkbox = Object.assign((p: Record<string, unknown>) => capture(p), {
      reformerAdapter: checkedAdapter,
    });
    const { props, setValue } = renderAuto(Checkbox, { value: true });

    expect(props.checked).toBe(true);
    expect('value' in props).toBe(false);
    expect('onChange' in props).toBe(false);
    (props.onCheckedChange as (c: unknown) => void)('indeterminate');
    expect(setValue).toHaveBeenCalledWith(false);
  });

  it('без адаптера — value-based seam; labelTooltip в контрол не уходит', () => {
    const { props } = renderAuto((p: Record<string, unknown>) => capture(p), {
      componentProps: { labelTooltip: 'hint', placeholder: 'p', testId: 'x' },
    });

    expect(props.value).toBe('hello');
    expect(props.placeholder).toBe('p');
    expect('labelTooltip' in props).toBe(false);
    expect('testId' in props).toBe(false);
  });

  it('asChild: уже привязанный ребёнок не привязывается второй раз', () => {
    const { ctx } = makeCtx();
    const Spy = Object.assign((p: Record<string, unknown>) => capture(p), {
      reformerAdapter: checkedAdapter,
    });
    const upstreamChange = vi.fn();
    renderToStaticMarkup(
      <FormFieldContext.Provider value={ctx}>
        <FormFieldControl asChild>
          <Spy checked={false} onCheckedChange={upstreamChange} onBlur={() => {}} />
        </FormFieldControl>
      </FormFieldContext.Provider>
    );

    // Нет value-based onChange/value поверх диалекта контрола, onCheckedChange не склеен.
    expect('onChange' in box.props).toBe(false);
    expect('value' in box.props).toBe(false);
    expect(box.props.onCheckedChange).toBe(upstreamChange);
    expect(box.props.id).toBe('control-x');
  });

  it('asChild: непривязанный ребёнок с адаптером получает привязки в своём диалекте', () => {
    const { ctx, setValue } = makeCtx({ value: true });
    const Spy = Object.assign((p: Record<string, unknown>) => capture(p), {
      reformerAdapter: checkedAdapter,
    });
    renderToStaticMarkup(
      <FormFieldContext.Provider value={ctx}>
        <FormFieldControl asChild>
          <Spy />
        </FormFieldControl>
      </FormFieldContext.Provider>
    );

    expect(box.props.checked).toBe(true);
    (box.props.onCheckedChange as (c: unknown) => void)(false);
    expect(setValue).toHaveBeenCalledWith(false);
  });
});
