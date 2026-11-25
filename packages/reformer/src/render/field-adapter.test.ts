import { describe, expect, it, vi } from 'vitest';
import { signal } from '@preact/signals-core';
import * as renderEntry from '../render';
import {
  FIELD_WRAPPER_ONLY_PROPS,
  bindControlledFieldProps,
  getFieldAdapter,
  hasInlineLabel,
  type FieldAdapter,
} from './field-adapter';

const seam = (value: unknown = null) => ({
  value,
  onChange: vi.fn<(v: unknown) => void>(),
  onBlur: vi.fn<() => void>(),
});

describe('bindControlledFieldProps — управляемая привязка без слоя представления', () => {
  it('без адаптера: seam проходит как есть, прочие props сохраняются', () => {
    const s = seam('hello');
    const props = bindControlledFieldProps(undefined, s, { placeholder: 'X' });

    expect(props).toEqual({
      placeholder: 'X',
      value: 'hello',
      onChange: s.onChange,
      onBlur: s.onBlur,
    });
  });

  it('без componentProps отдаёт только seam', () => {
    const s = seam(1);

    expect(Object.keys(bindControlledFieldProps(undefined, s)).sort()).toEqual([
      'onBlur',
      'onChange',
      'value',
    ]);
  });

  it('диалект Vue: значение в modelValue, эмит — в onUpdate:modelValue', () => {
    const adapter: FieldAdapter = { valueProp: 'modelValue', changeProp: 'onUpdate:modelValue' };
    const s = seam('a');
    const props = bindControlledFieldProps(adapter, s, { placeholder: 'p' });

    expect(props.modelValue).toBe('a');
    expect('value' in props).toBe(false);
    expect('onChange' in props).toBe(false);
    (props['onUpdate:modelValue'] as (v: unknown) => void)('b');
    expect(s.onChange).toHaveBeenCalledWith('b');
    expect(props.onBlur).toBe(s.onBlur);
  });

  it('toValue приводит значение поля, fromEmit — эмит контрола; fromEmit видит прочие props', () => {
    const adapter: FieldAdapter = {
      valueProp: 'checked',
      changeProp: 'onCheckedChange',
      toValue: (value) => value ?? false,
      fromEmit: (emitted, rest) => (emitted === true ? rest.onValue : rest.offValue),
    };
    const s = seam(undefined);
    const props = bindControlledFieldProps(adapter, s, { onValue: 'yes', offValue: 'no' });

    expect(props.checked).toBe(false);
    (props.onCheckedChange as (v: unknown) => void)(true);
    (props.onCheckedChange as (v: unknown) => void)(false);
    expect(s.onChange.mock.calls).toEqual([['yes'], ['no']]);
  });

  it('bindBlur отдаёт blur своим каналом — onBlur тогда не ставится', () => {
    const s = seam();
    const props = bindControlledFieldProps({ bindBlur: (onBlur) => ({ onFocusout: onBlur }) }, s);

    expect(props.onFocusout).toBe(s.onBlur);
    expect('onBlur' in props).toBe(false);
  });

  it('срезает props обёртки поля и strip адаптера', () => {
    const props = bindControlledFieldProps({ strip: ['mask'] }, seam(), {
      label: 'Имя',
      description: 'd',
      required: true,
      labelTooltip: 'hint',
      mask: '99',
      placeholder: 'p',
    });

    for (const key of [...FIELD_WRAPPER_ONLY_PROPS, 'mask']) expect(key in props).toBe(false);
    expect(props.placeholder).toBe('p');
  });

  it('контрол с inline-подписью получает label и required, остальное обёрточное срезается', () => {
    const Inline = { reformerLayout: 'inline-label' };
    const props = bindControlledFieldProps(
      undefined,
      seam(),
      { label: 'Согласен', required: true, description: 'd', labelTooltip: 'hint' },
      Inline
    );

    expect(props.label).toBe('Согласен');
    expect(props.required).toBe(true);
    expect('description' in props).toBe(false);
    expect('labelTooltip' in props).toBe(false);
  });

  it('seam перекрывает одноимённые componentProps', () => {
    const s = seam('из поля');
    const props = bindControlledFieldProps(undefined, s, { value: 'из схемы', onBlur: 'чужой' });

    expect(props.value).toBe('из поля');
    expect(props.onBlur).toBe(s.onBlur);
  });

  it('ключ uncontrolled не учитывается: значение идёт пропом, ref не появляется', () => {
    const adapter: FieldAdapter = { uncontrolled: true };
    const s = { ...seam('x'), control: { value: signal<unknown>('x') } };
    const props = bindControlledFieldProps(adapter, s);

    expect(props.value).toBe('x');
    expect('ref' in props).toBe(false);
    expect('defaultValue' in props).toBe(false);
  });
});

describe('getFieldAdapter / hasInlineLabel', () => {
  it('читают статику и с функции, и с объекта-описания компонента', () => {
    const adapter: FieldAdapter = { valueProp: 'modelValue' };
    const asFunction = Object.assign(() => null, {
      reformerAdapter: adapter,
      reformerLayout: 'inline-label',
    });
    // Компонент Vue (`defineComponent`) и класс компонента Angular — объект и функция со статикой.
    const asObject = { reformerAdapter: adapter, reformerLayout: 'inline-label' };

    expect(getFieldAdapter(asFunction)).toBe(adapter);
    expect(getFieldAdapter(asObject)).toBe(adapter);
    expect(hasInlineLabel(asFunction)).toBe(true);
    expect(hasInlineLabel(asObject)).toBe(true);
  });

  it.each([undefined, null, 'input', 42, true])(
    'не компонент (%s) — нет адаптера и подписи',
    (c) => {
      expect(getFieldAdapter(c)).toBeUndefined();
      expect(hasInlineLabel(c)).toBe(false);
    }
  );

  it('компонент без статики — нет адаптера и подписи', () => {
    expect(getFieldAdapter(() => null)).toBeUndefined();
    expect(hasInlineLabel({ reformerLayout: 'stacked' })).toBe(false);
  });
});

describe('вход render', () => {
  it('отдаёт привязку поля тем же значением, что и модуль', () => {
    // Полный состав входа держит снимок публичного API; здесь — что привязка поля не скопирована.
    expect(Object.keys(renderEntry)).toEqual(
      expect.arrayContaining([
        'FIELD_WRAPPER_ONLY_PROPS',
        'bindControlledFieldProps',
        'getFieldAdapter',
        'hasInlineLabel',
      ])
    );
    expect(renderEntry.FIELD_WRAPPER_ONLY_PROPS).toBe(FIELD_WRAPPER_ONLY_PROPS);
    expect(renderEntry.bindControlledFieldProps).toBe(bindControlledFieldProps);
    expect(renderEntry.getFieldAdapter).toBe(getFieldAdapter);
    expect(renderEntry.hasInlineLabel).toBe(hasInlineLabel);
  });
});
