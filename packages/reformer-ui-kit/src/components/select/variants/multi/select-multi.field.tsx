import { withFormControl } from '@/fields/with-form-control';
import { multiValueAdapter } from '@/fields/adapters';
import { SelectMulti } from './select-multi';
import type { SelectMultiOption } from './select-multi';
import type { ResourceConfig } from '../async/select-resource';

/**
 * Value-based контракт field-версии SelectMulti. Значение — `string[] | null`; форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт остальное в `componentProps`
 * (кроме `resource` — он требует функцию и передаётся через реестр компонентов).
 * Служит типом для стража props-схемы.
 */
export interface SelectMultiFieldProps {
  value?: string[] | null;
  onChange?: (value: string[] | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  options?: SelectMultiOption[];
  selectedOptions?: SelectMultiOption[];
  resource?: ResourceConfig<unknown>;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  clearable?: boolean;
  maxItems?: number;
  summaryThreshold?: number;
  className?: string;
}

/**
 * `exposesHandle: true` — SelectMulti сам реализует {@link SelectMultiHandle}
 * (`useImperativeHandle`), поэтому HOC форвардит ref потребителя прямо в композит (passthrough).
 * Привязка — общий для кита {@link multiValueAdapter}.
 */
export const SelectMultiField = withFormControl(SelectMulti, multiValueAdapter, {
  exposesHandle: true,
});
