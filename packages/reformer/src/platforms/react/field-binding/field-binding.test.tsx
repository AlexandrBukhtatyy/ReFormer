import { describe, it, expect, vi } from 'vitest';
import { forwardRef } from 'react';
import {
  bindFieldProps,
  getFieldAdapter,
  hasInlineLabel,
  type FieldAdapter,
} from './field-adapter';
import { resolveFieldHandle, type FieldHandle } from './field-handle';

const seam = (value: unknown = null) => ({
  value,
  onChange: vi.fn<(v: unknown) => void>(),
  onBlur: vi.fn<() => void>(),
});

describe('bindFieldProps', () => {
  it('без адаптера: value-based seam как есть, componentProps сохраняются', () => {
    const s = seam('hello');
    const props = bindFieldProps(undefined, s, { placeholder: 'X' });

    expect(props.value).toBe('hello');
    expect(props.placeholder).toBe('X');
    (props.onChange as (v: unknown) => void)('world');
    expect(s.onChange).toHaveBeenCalledWith('world');
    expect(props.onBlur).toBe(s.onBlur);
  });

  it('срезает strip адаптера', () => {
    const props = bindFieldProps({ strip: ['mask'] }, seam(), { mask: '99', placeholder: 'p' });

    expect('mask' in props).toBe(false);
    expect(props.placeholder).toBe('p');
  });

  // ReFormer-66d: подпись, описание и обязательность рисует обёртка поля. Нативный `required` на
  // `<input>` включал проверку браузера, и она блокировала отправку раньше валидации формы.
  it('срезает props обёртки: label, description, required, labelTooltip', () => {
    const wrapperProps = { label: 'Имя', description: 'd', required: true, labelTooltip: 'hint' };

    for (const adapter of [undefined, { valueProp: 'checked' }]) {
      const props = bindFieldProps(adapter, seam(), { ...wrapperProps, placeholder: 'p' });

      for (const key of Object.keys(wrapperProps)) expect(key in props).toBe(false);
      expect(props.placeholder).toBe('p');
    }
  });

  it('контрол с inline-подписью получает label и required, но не description и labelTooltip', () => {
    const InlineControl = Object.assign(() => null, { reformerLayout: 'inline-label' });
    const props = bindFieldProps(
      undefined,
      seam(),
      { label: 'Согласен', required: true, description: 'd', labelTooltip: 'hint' },
      InlineControl
    );

    expect(props.label).toBe('Согласен');
    expect(props.required).toBe(true);
    expect('description' in props).toBe(false);
    expect('labelTooltip' in props).toBe(false);
  });

  it('адаптер: valueProp/changeProp/fromEmit/toValue', () => {
    const adapter: FieldAdapter = {
      valueProp: 'checked',
      changeProp: 'onCheckedChange',
      fromEmit: (c) => c === true,
      toValue: (v) => v ?? false,
    };
    const s = seam(undefined);
    const props = bindFieldProps(adapter, s, {});

    expect(props.checked).toBe(false);
    expect('value' in props).toBe(false);
    expect('onChange' in props).toBe(false);
    (props.onCheckedChange as (c: unknown) => void)('indeterminate');
    expect(s.onChange).toHaveBeenCalledWith(false);
  });

  it('fromEmit получает прочие props контрола', () => {
    const fromEmit = vi.fn((v: unknown) => v);
    const props = bindFieldProps({ fromEmit }, seam(), { options: [1], labelTooltip: 'x' });
    (props.onChange as (v: unknown) => void)('a');
    expect(fromEmit).toHaveBeenCalledWith('a', { options: [1] });
  });

  it('bindBlur заменяет onBlur', () => {
    const s = seam();
    const props = bindFieldProps(
      { bindBlur: (onBlur) => ({ onOpenChange: (open: boolean) => !open && onBlur() }) },
      s,
      {}
    );
    expect('onBlur' in props).toBe(false);
    (props.onOpenChange as (o: boolean) => void)(false);
    expect(s.onBlur).toHaveBeenCalledTimes(1);
  });

  it('seam перекрывает одноимённые componentProps', () => {
    const props = bindFieldProps(undefined, seam('real'), { value: 'stale' });
    expect(props.value).toBe('real');
  });
});

describe('hasInlineLabel', () => {
  it('читает статику reformerLayout у функции и у forwardRef-объекта', () => {
    const fn = Object.assign(() => null, { reformerLayout: 'inline-label' });
    const ref = Object.assign(
      forwardRef(() => null),
      { reformerLayout: 'inline-label' }
    );

    expect(hasInlineLabel(fn)).toBe(true);
    expect(hasInlineLabel(ref)).toBe(true);
    expect(hasInlineLabel(() => null)).toBe(false);
    expect(hasInlineLabel('input')).toBe(false);
    expect(hasInlineLabel(undefined)).toBe(false);
  });
});

describe('getFieldAdapter', () => {
  it('читает статику reformerAdapter у функции и у forwardRef-объекта', () => {
    const adapter: FieldAdapter = { valueProp: 'checked' };
    const Fn = Object.assign(() => null, { reformerAdapter: adapter });
    const Fwd = Object.assign(
      forwardRef(() => null),
      { reformerAdapter: adapter }
    );

    expect(getFieldAdapter(Fn)).toBe(adapter);
    expect(getFieldAdapter(Fwd)).toBe(adapter);
    expect(getFieldAdapter(() => null)).toBeUndefined();
    expect(getFieldAdapter('input')).toBeUndefined();
    expect(getFieldAdapter(undefined)).toBeUndefined();
  });
});

describe('resolveFieldHandle', () => {
  it('DOM-узел → базовый FieldHandle, делегирующий на узел', () => {
    const el = { nodeType: 1, focus: vi.fn(), blur: vi.fn(), scrollIntoView: vi.fn() };
    const handle = resolveFieldHandle({ current: el }) as FieldHandle;

    handle.focus();
    handle.scrollIntoView({ block: 'center' });
    expect(el.focus).toHaveBeenCalledTimes(1);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
    expect(handle.getElement()).toBe(el);
  });

  it('handle композита → как есть', () => {
    const rich = { open: vi.fn() };
    expect(resolveFieldHandle({ current: rich })).toBe(rich);
  });

  it('пустой ref → null-safe базовый handle, подхватывающий узел позже', () => {
    const inner: { current: unknown } = { current: null };
    const handle = resolveFieldHandle(inner) as FieldHandle;

    expect(handle.getElement()).toBeNull();
    expect(() => handle.focus()).not.toThrow();
    const el = { nodeType: 1, focus: vi.fn() };
    inner.current = el;
    handle.focus();
    expect(el.focus).toHaveBeenCalledTimes(1);
  });
});
