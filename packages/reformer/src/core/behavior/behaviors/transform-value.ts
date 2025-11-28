/**
 * Трансформация значений полей
 *
 * @group Behaviors
 * @category Behavior Rules
 * @module behaviors/transformValue
 */

import type { FieldPathNode, FormFields, FormValue } from '../../types';
import { watchField } from './watch-field';

/**
 * Опции для transformValue
 *
 * @group Behaviors
 * @category Behavior Types
 */
export interface TransformValueOptions {
  /** Трансформировать только при изменении пользователем (не программно) */
  onUserChangeOnly?: boolean;
  /** Триггерить событие изменения после трансформации */
  emitEvent?: boolean;
}

/**
 * Трансформация значения поля при изменении
 * Позволяет автоматически форматировать или преобразовывать значения
 *
 * @group Behaviors
 * @category Behavior Rules
 *
 * @param field - Поле для трансформации
 * @param transformer - Функция трансформации
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Автоматически переводить текст в верхний регистр
 *   transformValue(path.code, (value) => value?.toUpperCase());
 *
 *   // Форматировать номер телефона
 *   transformValue(path.phone, (value) => {
 *     if (!value) return value;
 *     const digits = value.replace(/\D/g, '');
 *     if (digits.length === 11) {
 *       return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
 *     }
 *     return value;
 *   });
 *
 *   // Удалять пробелы из email
 *   transformValue(path.email, (value) => value?.trim().toLowerCase());
 *
 *   // Округлять числа
 *   transformValue(path.amount, (value) => {
 *     return typeof value === 'number' ? Math.round(value) : value;
 *   });
 * };
 * ```
 */
export function transformValue<TForm extends FormFields, TValue extends FormValue = FormValue>(
  field: FieldPathNode<TForm, TValue>,
  transformer: (value: TValue) => TValue,
  options?: TransformValueOptions & { debounce?: number }
): void {
  const { onUserChangeOnly = false, emitEvent = true, debounce } = options || {};

  watchField(
    field,
    (currentValue, ctx) => {
      const targetNode = ctx.form.getFieldByPath(field.__path);
      if (!targetNode) return;

      // Если нужно трансформировать только при изменении пользователем
      if (onUserChangeOnly && !targetNode.touched.value) {
        return;
      }

      const transformedValue = transformer(currentValue);

      // Применяем трансформацию только если значение изменилось
      if (transformedValue !== currentValue) {
        targetNode.setValue(transformedValue, { emitEvent });
      }
    },
    { debounce }
  );
}

/**
 * Хелпер для создания переиспользуемых трансформаций
 *
 * @group Behaviors
 * @category Behavior Rules
 *
 * @example
 * ```typescript
 * // Создаем переиспользуемые трансформеры
 * const toUpperCase = createTransformer<string>((value) => value?.toUpperCase());
 * const toLowerCase = createTransformer<string>((value) => value?.toLowerCase());
 * const trim = createTransformer<string>((value) => value?.trim());
 *
 * // Используем в форме
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   toUpperCase(path.code);
 *   toLowerCase(path.email);
 *   trim(path.username);
 * };
 * ```
 */
export function createTransformer<TValue extends FormValue = FormValue>(
  transformer: (value: TValue) => TValue,
  defaultOptions?: TransformValueOptions
) {
  return <TForm extends FormFields>(
    field: FieldPathNode<TForm, TValue>,
    options?: TransformValueOptions & { debounce?: number }
  ) => {
    transformValue(field, transformer, { ...defaultOptions, ...options });
  };
}

/**
 * Готовые трансформеры для частых случаев
 *
 * @group Behaviors
 * @category Behavior Rules
 */
export const transformers = {
  /** Перевести в верхний регистр */
  toUpperCase: createTransformer<string>((value) => value?.toUpperCase()),

  /** Перевести в нижний регистр */
  toLowerCase: createTransformer<string>((value) => value?.toLowerCase()),

  /** Удалить пробелы с краев */
  trim: createTransformer<string>((value) => value?.trim()),

  /** Удалить все пробелы */
  removeSpaces: createTransformer<string>((value) => value?.replace(/\s/g, '')),

  /** Оставить только цифры */
  digitsOnly: createTransformer<string>((value) => value?.replace(/\D/g, '')),

  /** Округлить число */
  round: createTransformer<number>((value) =>
    typeof value === 'number' ? Math.round(value) : value
  ),

  /** Округлить до 2 знаков после запятой */
  roundTo2: createTransformer<number>((value) =>
    typeof value === 'number' ? Math.round(value * 100) / 100 : value
  ),
};
