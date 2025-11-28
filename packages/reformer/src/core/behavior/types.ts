/**
 * Типы и интерфейсы для Behavior Schema API
 *
 * @group Behaviors
 * @category Behavior Types
 */

import { GroupNode } from '../nodes/group-node';
import type { FieldPath } from '../types/field-path';
import type { FormContext } from '../types/form-context';

/**
 * Тип функции behavior схемы
 * Принимает FieldPath и описывает поведение формы
 *
 * @group Behaviors
 * @category Behavior Types
 */
export type BehaviorSchemaFn<T> = (path: FieldPath<T>) => void;

/**
 * Контекст для behavior callback функций
 * Алиас для FormContext
 *
 * @group Behaviors
 * @category Behavior Types
 *
 * @example
 * ```typescript
 * watchField(path.country, async (country, ctx) => {
 *   // Прямой типизированный доступ к полям
 *   const cities = await fetchCities(country);
 *   ctx.form.city.updateComponentProps({ options: cities });
 *
 *   // Безопасная установка значения (без циклов)
 *   ctx.setFieldValue('city', null);
 * });
 * ```
 */
export type BehaviorContext<TForm> = FormContext<TForm>;

/**
 * Функция-handler для behavior
 *
 * Создает effect подписку для реактивного поведения формы.
 *
 * @group Behaviors
 * @category Behavior Types
 *
 * @template TForm - Тип формы
 * @param form - Корневой узел формы (GroupNode)
 * @param context - Контекст для работы с формой
 * @param withDebounce - Функция-обертка для debounce
 * @returns Функция cleanup для отписки от effect или null
 *
 * @example
 * ```typescript
 * const handler: BehaviorHandlerFn<MyForm> = (form, context, withDebounce) => {
 *   const sourceNode = form.getFieldByPath('email');
 *
 *   return effect(() => {
 *     const value = sourceNode.value.value;
 *     withDebounce(() => {
 *       // Логика behavior
 *     });
 *   });
 * };
 * ```
 */
export type BehaviorHandlerFn<TForm> = (
  form: GroupNode<TForm>,
  context: BehaviorContext<TForm>,
  withDebounce: (callback: () => void) => void
) => (() => void) | null;

/**
 * Общие опции для behavior
 *
 * @group Behaviors
 * @category Behavior Types
 */
export interface BehaviorOptions {
  /** Debounce в миллисекундах */
  debounce?: number;
}

/**
 * Опции для copyFrom
 *
 * @group Behaviors
 * @category Behavior Types
 */
export interface CopyFromOptions<TSource, TForm = unknown> {
  /** Условие копирования */
  when?: (form: TForm) => boolean;

  /** Какие поля копировать (для групп) */
  fields?: (keyof TSource)[] | 'all';

  /** Трансформация значения */
  transform?: (value: TSource) => unknown;

  /** Debounce в мс */
  debounce?: number;
}

/**
 * Опции для enableWhen/disableWhen
 *
 * @group Behaviors
 * @category Behavior Types
 */
export interface EnableWhenOptions {
  /** Сбросить значение при disable */
  resetOnDisable?: boolean;

  /** Debounce в мс */
  debounce?: number;
}

/**
 * Опции для computeFrom
 *
 * @group Behaviors
 * @category Behavior Types
 */
export interface ComputeFromOptions<TForm> {
  /** Когда вычислять */
  trigger?: 'change' | 'blur';

  /** Debounce в мс */
  debounce?: number;

  /** Условие применения */
  condition?: (form: TForm) => boolean;
}

/**
 * Опции для watchField
 *
 * @group Behaviors
 * @category Behavior Types
 */
export interface WatchFieldOptions {
  /** Debounce в мс */
  debounce?: number;

  /** Вызвать сразу при инициализации */
  immediate?: boolean;
}

/**
 * Опции для revalidateWhen
 *
 * @group Behaviors
 * @category Behavior Types
 */
export interface RevalidateWhenOptions {
  /** Debounce в мс */
  debounce?: number;
}

/**
 * Опции для syncFields
 *
 * @group Behaviors
 * @category Behavior Types
 */
export interface SyncFieldsOptions<T> {
  /** Трансформация значения */
  transform?: (value: T) => T;

  /** Debounce в мс */
  debounce?: number;
}
