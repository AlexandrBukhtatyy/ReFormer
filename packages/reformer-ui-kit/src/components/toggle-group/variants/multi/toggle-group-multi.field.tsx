import type { VariantProps } from 'class-variance-authority';

import { withFormControl } from '@/fields/with-form-control';
import { multiValueAdapter } from '@/fields/adapters';
import type { toggleVariants } from '@/components/toggle';
import { ToggleGroupMulti } from './toggle-group-multi';
import type { ToggleGroupOption } from '../base/toggle-group-base.field';

/**
 * Value-based контракт field-версии ToggleGroupMulti. Значение — `string[] | null`; форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт `options`/`maxItems`/`variant`/`className`
 * в `componentProps`. Служит типом для стража props-схемы.
 */
export interface ToggleGroupMultiFieldProps {
  value?: string[] | null;
  onChange?: (value: string[] | null) => void;
  onBlur?: () => void;
  disabled?: boolean;
  options?: ToggleGroupOption[];
  maxItems?: number;
  variant?: VariantProps<typeof toggleVariants>['variant'];
  className?: string;
}

/**
 * Field-версия ToggleGroupMulti: множественный выбор со значением `string[] | null`.
 * Привязка через {@link multiValueAdapter} — общий для всех мультивыборов кита.
 * НЕ inline-label: подпись группы рисует FormField сверху.
 */
export const ToggleGroupMultiField = withFormControl(ToggleGroupMulti, multiValueAdapter);
