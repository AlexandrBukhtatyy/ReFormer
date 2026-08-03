import { describe, it, expect, vi } from 'vitest';
import type { FieldAdapter } from './types';
import { buildAdaptedFieldProps } from './field-adapter';

describe('buildAdaptedFieldProps', () => {
  it('default (пустой адаптер): value-based seam как есть', () => {
    const onChange = vi.fn();
    const onBlur = vi.fn();
    const props = buildAdaptedFieldProps({}, 'hello', onChange, onBlur, { label: 'X' });

    expect(props.value).toBe('hello');
    expect(props.label).toBe('X');
    // changeProp по умолчанию 'onChange', fromEmit — identity
    (props.onChange as (v: unknown) => void)('world');
    expect(onChange).toHaveBeenCalledWith('world');
    // blur пробрасывается как onBlur
    (props.onBlur as () => void)();
    expect(onBlur).toHaveBeenCalledTimes(1);
    // control сырому контролу не пробрасывается
    expect('control' in props).toBe(false);
  });

  it('checked-адаптер (Checkbox): значение в `checked`, emit — DOM-событие', () => {
    const onChange = vi.fn();
    const adapter: FieldAdapter = {
      valueProp: 'checked',
      fromEmit: (e) => (e as { target: { checked: boolean } }).target.checked,
      toValue: (v) => v ?? false,
    };
    const props = buildAdaptedFieldProps(adapter, true, onChange, vi.fn(), {});

    expect(props.checked).toBe(true);
    expect('value' in props).toBe(false);
    // emit события чекбокса → в поле уходит boolean
    (props.onChange as (e: unknown) => void)({ target: { checked: false } });
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('checked-адаптер: toValue коэрсит undefined → false', () => {
    const props = buildAdaptedFieldProps(
      { valueProp: 'checked', toValue: (v) => v ?? false },
      undefined,
      vi.fn(),
      vi.fn(),
      {}
    );
    expect(props.checked).toBe(false);
  });

  it('select-адаптер: второй аргумент (option) отбрасывается', () => {
    const onChange = vi.fn();
    const adapter: FieldAdapter = { fromEmit: (v) => v, toValue: (v) => v ?? undefined };
    const props = buildAdaptedFieldProps(adapter, 'a', onChange, vi.fn(), {});

    expect(props.value).toBe('a');
    // контрол зовёт onChange(value, option) — handler ловит только первый аргумент
    (props.onChange as (v: unknown, opt?: unknown) => void)('b', { label: 'B' });
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('strip: перечисленные ключи не попадают в контрол', () => {
    const adapter: FieldAdapter = { strip: ['options'] };
    const props = buildAdaptedFieldProps(adapter, '', vi.fn(), vi.fn(), {
      options: [1, 2, 3],
      label: 'keep',
    });
    expect('options' in props).toBe(false);
    expect(props.label).toBe('keep');
  });

  it('bindBlur: blur уходит нестандартным каналом', () => {
    const onBlur = vi.fn();
    const adapter: FieldAdapter = { bindBlur: (b) => ({ onDropdownClose: b }) };
    const props = buildAdaptedFieldProps(adapter, '', vi.fn(), onBlur, {});

    expect('onBlur' in props).toBe(false);
    (props.onDropdownClose as () => void)();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('seam перекрывает одноимённый ключ из componentProps', () => {
    const onChange = vi.fn();
    // в componentProps ошибочно лежит value — реальное значение поля должно победить
    const props = buildAdaptedFieldProps({}, 'field-value', onChange, vi.fn(), {
      value: 'stale',
    });
    expect(props.value).toBe('field-value');
  });
});
