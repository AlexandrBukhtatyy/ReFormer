import type * as React from 'react';

import { withFormControl } from '@/fields/with-form-control';
import { pressedAdapter } from '@/fields/adapters';
import { Toggle } from './toggle-base';

/**
 * Value-based контракт field-версии Toggle. Значение — `boolean` (нажат/pressed); форма резолвит
 * `value`/`onChange`/`onBlur`/`disabled`, автор задаёт `variant`/`size`/`className` в `componentProps`,
 * а сам контент (иконка/текст) — через `children`. Служит типом для стража props-схемы
 * (base — Radix `pressed`/`onPressedChange`, не `value`).
 */
export interface ToggleFieldProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
  onBlur?: () => void;
  disabled?: boolean;
  /** Стиль cva: `default` (заливка при нажатии) | `outline` (граница). */
  variant?: 'default' | 'outline';
  /** Размер cva: `default` | `sm` | `lg`. */
  size?: 'default' | 'sm' | 'lg';
  className?: string;
  /** Контент внутри toggle (иконка/текст). Рендерится в кнопке; НЕ является подписью поля. */
  children?: React.ReactNode;
}

/**
 * Field-версия Toggle: pure shadcn Toggle + `pressedAdapter` (boolean value-based:
 * `pressed` + `onPressedChange`, `null`/`undefined` → `false`). Экспортируется как алиас `ToggleField`.
 *
 * ⚠️ В ОТЛИЧИЕ от Checkbox/Switch — Toggle НЕ inline-label: подпись поля рисует FormField СВЕРХУ
 * (`componentProps.label` → FormField.Label), а контент toggle (`children`) живёт ВНУТРИ кнопки.
 * Поэтому маркер `reformerLayout='inline-label'` НЕ ставится (иначе верхняя подпись пропала бы).
 */
export const ToggleBaseField = withFormControl(Toggle, pressedAdapter);
