/**
 * Декларативные функции для описания поведения форм
 *
 * Используются внутри BehaviorSchemaFn для описания реактивного поведения
 */

import type { FieldPathNode } from '../types';
import { getCurrentBehaviorRegistry } from '../utils/registry-helpers';
import type {
  BehaviorContext,
  CopyFromOptions,
  EnableWhenOptions,
  ComputeFromOptions,
  WatchFieldOptions,
  RevalidateWhenOptions,
  SyncFieldsOptions,
} from './types';
import {
  createCopyBehavior,
  createEnableBehavior,
  createShowBehavior,
  createComputeBehavior,
  createWatchBehavior,
  createRevalidateBehavior,
  createSyncBehavior,
} from './behavior-factories';

// ============================================================================
// copyFrom - Копирование значений между полями
// ============================================================================

/**
 * Копирует значения из одного поля/группы в другое при выполнении условия
 *
 * @param target - Куда копировать
 * @param source - Откуда копировать
 * @param options - Опции копирования
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Копировать адрес регистрации в адрес проживания
 *   copyFrom(path.residenceAddress, path.registrationAddress, {
 *     when: (form) => form.sameAsRegistration === true,
 *     fields: 'all'
 *   });
 * };
 * ```
 */
export function copyFrom<TForm extends Record<string, any>, TSource, TTarget>(
  target: FieldPathNode<TForm, TTarget>,
  source: FieldPathNode<TForm, TSource>,
  options?: CopyFromOptions<TForm, TSource>
): void {
  const { debounce } = options || {};

  const handler = createCopyBehavior(target, source, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}

// ============================================================================
// enableWhen / disableWhen - Условное включение/выключение полей
// ============================================================================

/**
 * Условное включение поля на основе значений других полей
 *
 * @param field - Поле для включения/выключения
 * @param condition - Функция условия (true = enable, false = disable)
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Включить поле только для ипотеки
 *   enableWhen(path.propertyValue, (form) => form.loanType === 'mortgage', {
 *     resetOnDisable: true
 *   });
 * };
 * ```
 */
export function enableWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: EnableWhenOptions
): void {
  const { debounce } = options || {};

  const handler = createEnableBehavior(field, condition, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}

/**
 * Условное выключение поля (инверсия enableWhen)
 *
 * @param field - Поле для выключения
 * @param condition - Функция условия (true = disable, false = enable)
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Выключить поле для потребительского кредита
 *   disableWhen(path.propertyValue, (form) => form.loanType === 'consumer');
 * };
 * ```
 */
export function disableWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean,
  options?: EnableWhenOptions
): void {
  // Инвертируем условие
  enableWhen(field, (form) => !condition(form), options);
}

// ============================================================================
// showWhen / hideWhen - Условное отображение/скрытие полей
// ============================================================================

/**
 * Условное отображение поля (устанавливает hidden флаг)
 *
 * @param field - Поле для отображения/скрытия
 * @param condition - Функция условия (true = show, false = hide)
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   showWhen(path.propertyValue, (form) => form.loanType === 'mortgage');
 * };
 *
 * // В JSX
 * {!form.propertyValue.componentProps.value.hidden && (
 *   <FormField control={form.propertyValue} />
 * )}
 * ```
 */
export function showWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean
): void {
  const handler = createShowBehavior(field, condition);
  getCurrentBehaviorRegistry().register(handler);
}

/**
 * Условное скрытие поля (инверсия showWhen)
 *
 * @param field - Поле для скрытия
 * @param condition - Функция условия (true = hide, false = show)
 */
export function hideWhen<TForm extends Record<string, any>>(
  field: FieldPathNode<TForm, any>,
  condition: (form: TForm) => boolean
): void {
  // Инвертируем условие
  showWhen(field, (form) => !condition(form));
}

// ============================================================================
// computeFrom - Вычисляемые поля
// ============================================================================

/**
 * Автоматически вычисляет значение поля на основе других полей
 *
 * @param target - Поле для записи результата
 * @param sources - Массив полей-зависимостей
 * @param computeFn - Функция вычисления (принимает параметры напрямую)
 * @param options - Опции
 *
 * ✅ ОБНОВЛЕНО: computeFn теперь принимает параметры напрямую (type-safe)
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Автоматический расчет минимального взноса
 *   computeFrom(
 *     path.initialPayment,
 *     [path.propertyValue],
 *     (propertyValue) => propertyValue ? propertyValue * 0.2 : null, // ← Параметр напрямую
 *     { debounce: 300 }
 *   );
 *
 *   // Общая стоимость = цена * количество
 *   computeFrom(
 *     path.total,
 *     [path.price, path.quantity],
 *     (price, quantity) => price * quantity // ← Параметры напрямую
 *   );
 * };
 * ```
 */
export function computeFrom<TForm extends Record<string, any>, TTarget>(
  target: FieldPathNode<TForm, TTarget>,
  sources: FieldPathNode<TForm, any>[],
  computeFn: (...values: any[]) => TTarget,
  options?: ComputeFromOptions<TForm>
): void {
  const { debounce } = options || {};

  // ✅ Передаем computeFn напрямую без обертки
  const handler = createComputeBehavior(target, sources, computeFn, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}

// ============================================================================
// watchField - Подписка на изменения
// ============================================================================

/**
 * Выполняет callback при изменении поля
 *
 * @param field - Поле для отслеживания
 * @param callback - Функция обратного вызова
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Динамическая загрузка городов при изменении страны
 *   watchField(path.registrationAddress.country, async (country, ctx) => {
 *     if (country) {
 *       const cities = await fetchCities(country);
 *       ctx.updateComponentProps(path.registrationAddress.city, {
 *         options: cities
 *       });
 *     }
 *   });
 * };
 * ```
 */
export function watchField<TForm extends Record<string, any>, TField>(
  field: FieldPathNode<TForm, TField>,
  callback: (value: TField, ctx: BehaviorContext<TForm>) => void | Promise<void>,
  options?: WatchFieldOptions
): void {
  const { debounce } = options || {};

  const handler = createWatchBehavior(field, callback, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}

// ============================================================================
// revalidateWhen - Перевалидация при изменении других полей
// ============================================================================

/**
 * Перевалидирует поле при изменении других полей
 *
 * @param target - Поле для перевалидации
 * @param triggers - Поля-триггеры
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Перевалидировать initialPayment при изменении propertyValue
 *   revalidateWhen(path.initialPayment, [path.propertyValue], {
 *     debounce: 300
 *   });
 * };
 * ```
 */
export function revalidateWhen<TForm extends Record<string, any>>(
  target: FieldPathNode<TForm, any>,
  triggers: FieldPathNode<TForm, any>[],
  options?: RevalidateWhenOptions
): void {
  const { debounce } = options || {};

  const handler = createRevalidateBehavior(target, triggers, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}

// ============================================================================
// syncFields - Двусторонняя синхронизация
// ============================================================================

/**
 * Двусторонняя синхронизация двух полей
 *
 * @param field1 - Первое поле
 * @param field2 - Второе поле
 * @param options - Опции
 *
 * @example
 * ```typescript
 * const schema: BehaviorSchemaFn<MyForm> = (path) => {
 *   // Синхронизировать два поля
 *   syncFields(path.email, path.emailCopy);
 * };
 * ```
 */
export function syncFields<TForm extends Record<string, any>, T>(
  field1: FieldPathNode<TForm, T>,
  field2: FieldPathNode<TForm, T>,
  options?: SyncFieldsOptions<T>
): void {
  const { debounce } = options || {};

  const handler = createSyncBehavior(field1, field2, options);
  getCurrentBehaviorRegistry().register(handler, { debounce });
}
