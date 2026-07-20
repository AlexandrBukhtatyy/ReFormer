import { withFormControl, type FieldAdapter } from '@/fields/with-form-control';
import { SelectAsync } from './select-async';

/**
 * SelectAsync уже value-based (`value: string|null`, `onChange(string|null)`, `onBlur`) — адаптер
 * почти identity: маппинга DOM-события нет, HOC нужен лишь чтобы отбросить `control` (renderer-путь).
 */
const selectAsyncAdapter: FieldAdapter = {
  valueProp: 'value',
  changeProp: 'onChange',
  fromEmit: (v) => v ?? null, // SelectAsync сам эмитит null при очистке
  toValue: (v) => v ?? null, // SelectAsync принимает string|null (внутри приводит к '' для Radix)
};

/**
 * `exposesHandle: true` — SelectAsync сам реализует {@link SelectAsyncHandle} (useImperativeHandle),
 * поэтому HOC форвардит ref потребителя прямо в композит (passthrough), без своего baseline-handle.
 */
export const SelectAsyncField = withFormControl(SelectAsync, selectAsyncAdapter, {
  exposesHandle: true,
});
