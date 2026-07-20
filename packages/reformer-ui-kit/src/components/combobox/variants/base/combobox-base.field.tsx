import { withFormControl, type FieldAdapter } from '@/fields/with-form-control';
import { Combobox } from './combobox-base';

/**
 * Combobox уже value-based (`value: string|null`, `onChange(string|null)`, `onBlur`) — адаптер
 * почти identity (как у SelectAsync): маппинга DOM-события нет, HOC нужен лишь чтобы отбросить
 * `control` (renderer-путь) и привести null/undefined. Штатный `valueChangeAdapter` тут не подходит:
 * он ждёт Radix-shape `onValueChange(string)`, а Combobox эмитит value-based `onChange(string|null)`.
 */
const comboboxAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (v) => v ?? null, // Combobox сам эмитит null при очистке
  toValue: (v) => v ?? null, // Combobox принимает string|null
};

/**
 * `exposesHandle: true` — Combobox сам реализует {@link ComboboxHandle} (useImperativeHandle),
 * поэтому HOC форвардит ref потребителя прямо в композит (passthrough), без своего baseline-handle.
 */
export const ComboboxBaseField = withFormControl(Combobox, comboboxAdapter, {
  exposesHandle: true,
});
