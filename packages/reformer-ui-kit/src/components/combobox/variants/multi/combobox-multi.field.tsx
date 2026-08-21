import { withFormControl } from '@/fields/with-form-control';
import { multiValueAdapter } from '@/fields/adapters';
import { ComboboxMulti } from './combobox-multi';
import type { ComboboxOption } from '../base/combobox-base';

/**
 * Value-based контракт field-версии ComboboxMulti. Значение — `string[] | null`; форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт остальное в `componentProps`.
 * Служит типом для стража props-схемы.
 */
export interface ComboboxMultiFieldProps {
  value?: string[] | null;
  onChange?: (value: string[] | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  options?: ComboboxOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
  creatable?: boolean;
  maxItems?: number;
  summaryThreshold?: number;
  className?: string;
}

/**
 * `exposesHandle: true` — ComboboxMulti сам реализует {@link ComboboxMultiHandle}
 * (`useImperativeHandle`), поэтому HOC форвардит ref потребителя прямо в композит (passthrough),
 * без своего baseline-handle. Привязка — общий для кита {@link multiValueAdapter}.
 */
export const ComboboxMultiField = withFormControl(ComboboxMulti, multiValueAdapter, {
  exposesHandle: true,
});
