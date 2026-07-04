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
import type { Signal } from '@preact/signals-core';
import type { ValidatorFn, AsyncValidatorFn, AnyFunction } from './index';

// ============================================================================
// Базовые типы
// ============================================================================

/**
 * Конфигурация поля
 * @group Types
 * @category Configuration Types
 * @remarks
 * В схеме `createForm({ model, schema })` лист связывают через **`value: model.$.field`**: harvest
 * ловит узел по идентичности `Signal` (`node.value instanceof Signal` — см. `create-form.ts`) и
 * нормализует его в `valueSignal`. Писать `valueSignal:` **в самой схеме `createForm` нельзя** —
 * harvest его не подхватит (проверка идёт по `node.value`), и `component`/`componentProps` этого
 * узла молча отбросятся. `value`/`valueSignal` на прямом FieldNode-конфиге — это
 * post-normalization / legacy-слой, а не форма записи в схеме `createForm`.
 */
export interface FieldConfig<T> {
  /**
   * Начальное значение-литерал (legacy-путь). Под архитектурой M1 значение приходит из
   * {@link FieldConfig.valueSignal} (сигнал {@link FormModel}); тогда `value` не требуется.
   */
  value?: T | null;
  /**
   * Сигнал значения из {@link FormModel} (M1). Если задан — служит источником истины значения
   * поля (нода не владеет значением, а ссылается на этот сигнал). Имеет приоритет над `value`.
   */
  valueSignal?: Signal<T>;
  /**
   * UI-компонент поля. Опционален: core-часть можно использовать без ссылки на компонент
   * (значение/валидация работают без UI; компонент нужен только для рендеринга).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component?: ComponentType<any>;
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
// `T extends object` (не `FormFields`): interface-модели не имеют неявной index-signature и
// не assignable к Record<string, FormValue> — иначе ArrayConfig<SomeInterface> даёт ложную ошибку.
export interface ArrayConfig<T extends object> {
  itemSchema: FormSchema<T>;
  initial?: Partial<T>[];
}

// ============================================================================
// Deep Schema - автоматическое определение типов
// ============================================================================

/**
 * **Data-shaped** конфиг формы: ключи повторяют структуру данных `T`, значения — {@link FieldConfig}
 * (или вложенный `FormSchema`). Форма конфига, из которой строится {@link GroupNode}.
 * - `T[] -> [FormSchema<T>]` (массив с одним элементом)
 * - `object -> FormSchema<T>` (группа)
 * - `primitive -> FieldConfig<T>` (поле)
 *
 * Использует NonNullable для корректной обработки опциональных полей.
 *
 * ⚠️ Не путать с {@link FormSchemaNode} — тот описывает **узел дерева** M1-схемы (лист/массив/
 * контейнер), передаваемой в `createForm({ model, schema })`. `FormSchema` — это data-shaped конфиг
 * (ключи = поля данных), а не узел дерева.
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
