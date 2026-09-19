import { describe, it, expect, vi } from 'vitest';
import { forwardRef } from 'react';
import { bindFieldProps, getFieldAdapter, type FieldAdapter } from './field-adapter';
import { resolveFieldHandle, type FieldHandle } from './field-handle';

const seam = (value: unknown = null) => ({
  value,
  onChange: vi.fn<(v: unknown) => void>(),
  onBlur: vi.fn<() => void>(),
});

describe('bindFieldProps', () => {
  it('без адаптера: value-based seam как есть, componentProps сохраняются', () => {
    const s = seam('hello');
    const props = bindFieldProps(undefined, s, { label: 'X' });

    expect(props.value).toBe('hello');
    expect(props.label).toBe('X');
    (props.onChange as (v: unknown) => void)('world');
    expect(s.onChange).toHaveBeenCalledWith('world');
    expect(props.onBlur).toBe(s.onBlur);
  });

  it('срезает props обёртки (labelTooltip) и strip адаптера', () => {
    const props = bindFieldProps({ strip: ['label'] }, seam(), {
      labelTooltip: 'hint',
      label: 'X',
      placeholder: 'p',
    });

    expect('labelTooltip' in props).toBe(false);
    expect('label' in props).toBe(false);
    expect(props.placeholder).toBe('p');
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
