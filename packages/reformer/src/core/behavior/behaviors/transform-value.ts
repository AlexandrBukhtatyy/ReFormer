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
 * @param transformer - Функция трансформации (ОБЯЗАТЕЛЬНО идемпотентная: f(f(x)) === f(x))
 * @param options - Опции (`onUserChangeOnly`, `emitEvent`, `debounce`)
 *
 * @example Базовая нормализация — uppercase + trim email
 * ```typescript
 * import { transformValue, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface RegistrationForm {
 *   promoCode: string;
 *   email: string;
 * }
 *
 * export const registrationBehavior: BehaviorSchemaFn<RegistrationForm> = (path) => {
 *   // Идемпотентно: toUpperCase(toUpperCase(x)) === toUpperCase(x) ✓
 *   transformValue(path.promoCode, (value) => (value ?? '').toUpperCase());
 *   transformValue(path.email, (value) => (value ?? '').trim().toLowerCase());
 * };
 * ```
 *
 * @example `onUserChangeOnly` + idempotent guard для не-тривиальных форматов
 * ```typescript
 * import { transformValue, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface ProfileForm {
 *   inn: string; // ИНН — только цифры
 *   prefixedCode: string; // должен иметь префикс "ID-"
 * }
 *
 * export const profileBehavior: BehaviorSchemaFn<ProfileForm> = (path) => {
 *   // Цифры из ИНН: трансформер идемпотентный естественно
 *   transformValue(path.inn, (v) => (v ?? '').replace(/\D/g, ''));
 *
 *   // Префикс — ВАЖНО guard «уже преобразовано», иначе бесконечный цикл
 *   // f("ID-123") должно === "ID-123", а не "ID-ID-123"
 *   transformValue(
 *     path.prefixedCode,
 *     (v) => (v?.startsWith('ID-') ? v : `ID-${v ?? ''}`),
 *     {
 *       onUserChangeOnly: true, // не трогаем значение из patchValue/preload
 *       debounce: 200,
 *     },
 *   );
 * };
 * ```
 *
 * @see [docs/llms/26-transform-value.md](../../../../docs/llms/26-transform-value.md)
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
 * @param transformer - Идемпотентная функция преобразования значения
 * @param defaultOptions - Опции, применяемые ко всем вызовам созданного трансформера
 *
 * @example Доменно-специфичные трансформеры (банковский счёт, СНИЛС)
 * ```typescript
 * import { createTransformer, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * // Сохраняем только цифры и форматируем СНИЛС: 000-000-000 00
 * const formatSnils = createTransformer<string>((v) => {
 *   const d = (v ?? '').replace(/\D/g, '').slice(0, 11);
 *   if (d.length < 9) return d;
 *   return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6, 9)}${d.length > 9 ? ' ' + d.slice(9) : ''}`;
 * });
 *
 * interface ProfileForm { snils: string }
 *
 * export const profileBehavior: BehaviorSchemaFn<ProfileForm> = (path) => {
 *   formatSnils(path.snils, { debounce: 100 });
 * };
 * ```
 *
 * @example С `defaultOptions` — единые настройки на серию полей
 * ```typescript
 * import { createTransformer, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * // Все коды должны быть uppercase, но только после правки пользователем
 * const upperOnUserEdit = createTransformer<string>(
 *   (v) => (v ?? '').toUpperCase(),
 *   { onUserChangeOnly: true, debounce: 100 },
 * );
 *
 * interface PromoForm { promoCode: string; partnerCode: string }
 *
 * export const promoBehavior: BehaviorSchemaFn<PromoForm> = (path) => {
 *   upperOnUserEdit(path.promoCode);
 *   upperOnUserEdit(path.partnerCode);
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
 * Готовые трансформеры для частых случаев. Все идемпотентны и безопасны для повторного применения.
 *
 * @group Behaviors
 * @category Behavior Rules
 *
 * @example Готовые трансформеры в схеме формы
 * ```typescript
 * import { transformers, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * interface RegistrationForm {
 *   username: string;
 *   email: string;
 *   promoCode: string;
 *   inn: string;
 *   amount: number;
 * }
 *
 * export const behavior: BehaviorSchemaFn<RegistrationForm> = (path) => {
 *   transformers.trim(path.username);
 *   transformers.toLowerCase(path.email);
 *   transformers.toUpperCase(path.promoCode);
 *   transformers.digitsOnly(path.inn);
 *   transformers.roundTo2(path.amount);
 * };
 * ```
 *
 * @example Композиция готовых трансформеров через createTransformer
 * ```typescript
 * import { createTransformer, type BehaviorSchemaFn } from '@reformer/core/behaviors';
 *
 * // trim + lowercase в одном трансформере (применяется как одна операция)
 * const normalizeEmail = createTransformer<string>(
 *   (v) => (v ?? '').trim().toLowerCase(),
 * );
 *
 * interface ContactForm { email: string }
 *
 * export const contactBehavior: BehaviorSchemaFn<ContactForm> = (path) => {
 *   normalizeEmail(path.email);
 * };
 * ```
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
