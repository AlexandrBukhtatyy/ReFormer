/**
 * Типы для схемы формы (Deep Schema)
 *
 * Автоматическое определение типов схемы на основе структуры данных:
 * - `[{...}]` → массив форм
 * - `{...}` → вложенная группа
 * - `{value, component}` → конфигурация поля
 *
 * @group Types
 */

import type { ComponentType } from 'react';
import type { ValidatorFn, AsyncValidatorFn, FormFields, AnyFunction } from './index';

// ============================================================================
// Базовые типы
// ============================================================================

/**
 * Конфигурация поля
 * @group Types
 * @category Configuration Types
 */
export interface FieldConfig<T> {
  value: T | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  componentProps?: any;
  validators?: ValidatorFn<T>[];
  asyncValidators?: AsyncValidatorFn<T>[];
  disabled?: boolean;
  updateOn?: 'change' | 'blur' | 'submit';
  /** Задержка (в мс) перед запуском асинхронной валидации */
  debounce?: number;
}

/**
 * Конфигурация массива
 * @group Types
 * @category Configuration Types
 */
export interface ArrayConfig<T extends FormFields> {
  itemSchema: FormSchema<T>;
  initial?: Partial<T>[];
}

// ============================================================================
// Deep Schema - автоматическое определение типов
// ============================================================================

/**
 * Автоматически определяет тип схемы на основе TypeScript типа:
 * - `T[] -> [FormSchema<T>]` (массив с одним элементом)
 * - `object -> FormSchema<T>` (группа)
 * - `primitive -> FieldConfig<T>` (поле)
 *
 * Использует NonNullable для корректной обработки опциональных полей
 *
 * @group Types
 * @category Configuration Types
 *
 * @example
 * ```typescript
 * interface Form {
 *   name: string;                    // → FieldConfig<string>
 *   address: {                       // → FormSchema<Address>
 *     city: string;
 *     street: string;
 *   };
 *   items?: Array<{                  // → [FormSchema<Item>] (опциональный)
 *     title: string;
 *     price: number;
 *   }>;
 * }
 *
 * const schema: FormSchema<Form> = {
 *   name: { value: '', component: Input },
 *   address: {
 *     city: { value: '', component: Input },
 *     street: { value: '', component: Input },
 *   },
 *   items: [{
 *     title: { value: '', component: Input },
 *     price: { value: 0, component: Input },
 *   }],
 * };
 * ```
 */
export type FormSchema<T> = {
  [K in keyof T]: NonNullable<T[K]> extends string | number | boolean
    ? FieldConfig<T[K]>
    : NonNullable<T[K]> extends Array<infer U>
      ? U extends string | number | boolean
        ? FieldConfig<T[K]>
        : U extends Date | File | Blob | AnyFunction
          ? FieldConfig<T[K]>
          : [FormSchema<U>]
      : NonNullable<T[K]> extends Date | File | Blob | AnyFunction
        ? FieldConfig<T[K]>
        : FormSchema<NonNullable<T[K]>>;
};
