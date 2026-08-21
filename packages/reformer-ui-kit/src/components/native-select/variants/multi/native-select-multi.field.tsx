import { withFormControl } from '@/fields/with-form-control';
import { multiValueAdapter } from '@/fields/adapters';
import { NativeSelectMulti } from './native-select-multi';
import type { NativeSelectOptionItem } from '../base/native-select-base.field';

/**
 * Value-based контракт field-версии NativeSelectMulti. Значение — `string[] | null`; форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт `options`/`rows`/`maxItems`/`className`.
 * Служит типом для стража props-схемы.
 */
export interface NativeSelectMultiFieldProps {
  value?: string[] | null;
  onChange?: (value: string[] | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  options?: NativeSelectOptionItem[];
  rows?: number;
  maxItems?: number;
  className?: string;
}

/**
 * Field-версия NativeSelectMulti: нативный множественный выбор со значением `string[] | null`.
 * Привязка через {@link multiValueAdapter} — общий для всех мультивыборов кита.
 * Штатный `nativeInputAdapter` тут непригоден: он читает `e.target.value`, что у `<select multiple>`
 * даёт только первое выбранное значение.
 */
export const NativeSelectMultiField = withFormControl(NativeSelectMulti, multiValueAdapter);
