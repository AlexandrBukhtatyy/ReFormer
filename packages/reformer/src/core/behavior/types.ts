/**
 * Типы и интерфейсы для Behavior Schema API
 */

import type { FormNode } from '../nodes/form-node';
import { GroupNode } from '../nodes/group-node';
import type { ValidationError } from '../types';
import type { FieldPath, FieldPathNode } from '../types/field-path';
import type { GroupNodeWithControls } from '../types/group-node-proxy';

/**
 * Тип функции behavior схемы
 * Принимает FieldPath и описывает поведение формы
 */
export type BehaviorSchemaFn<T> = (path: FieldPath<T>) => void;

/**
 * Контекст для behavior callback функций
 * Предоставляет методы для работы с формой
 */
export interface BehaviorContext<TForm extends Record<string, any>> {
  /**
   * Получить значение поля по строковому пути
   * @param path - Путь к полю (например, "address.city")
   */
  getField<_K extends keyof TForm>(path: string): any;

  /**
   * Установить значение поля по строковому пути
   * @param path - Путь к полю
   * @param value - Новое значение
   */
  setField<_K extends keyof TForm>(path: string, value: any): void;

  /**
   * Обновить componentProps поля
   * @param field - FieldPathNode поля
   * @param props - Частичные пропсы для обновления
   */
  updateComponentProps(field: FieldPathNode<TForm, any>, props: Record<string, any>): void;

  /**
   * Перевалидировать поле
   * @param field - FieldPathNode поля
   */
  validateField(field: FieldPathNode<TForm, any>): Promise<boolean>;

  /**
   * Установить ошибки поля
   * @param field - FieldPathNode поля
   * @param errors - Массив ошибок валидации
   */
  setErrors(field: FieldPathNode<TForm, any>, errors: ValidationError[]): void;

  /**
   * Очистить ошибки поля
   * @param field - FieldPathNode поля
   */
  clearErrors(field: FieldPathNode<TForm, any>): void;

  /**
   * Получить всю форму целиком
   */
  getForm(): TForm;

  /**
   * Получить узел формы (FormNode) по строковому пути
   * @param path - Путь к полю (например, "properties", "address.city")
   * @returns FormNode или undefined если путь не найден
   */
  getFieldNode(path: string): FormNode<any> | undefined;

  /**
   * Получить корневой узел формы с доступом к полям через точку
   * @returns GroupNode с проксированными полями (GroupNodeWithControls)
   *
   * @example
   * ```typescript
   * watchField(path.hasProperty, (hasProperty, ctx) => {
   *   if (!hasProperty) {
   *     ctx.formNode.properties.clear(); // Прямой доступ к ArrayNode!
   *   }
   * });
   * ```
   */
  readonly formNode: GroupNodeWithControls<TForm>;
}

/**
 * Функция-handler для behavior
 *
 * Создает effect подписку для реактивного поведения формы.
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
export type BehaviorHandlerFn<TForm extends Record<string, any> = any> = (
  form: GroupNode<TForm>,
  context: BehaviorContext<TForm>,
  withDebounce: (callback: () => void) => void
) => (() => void) | null;

/**
 * Общие опции для behavior
 */
export interface BehaviorOptions {
  /** Debounce в миллисекундах */
  debounce?: number;
}

/**
 * Опции для copyFrom
 */
export interface CopyFromOptions<TForm, TSource> {
  /** Условие копирования */
  when?: (form: TForm) => boolean;

  /** Какие поля копировать (для групп) */
  fields?: (keyof TSource)[] | 'all';

  /** Трансформация значения */
  transform?: (value: TSource) => any;

  /** Debounce в мс */
  debounce?: number;
}

/**
 * Опции для enableWhen/disableWhen
 */
export interface EnableWhenOptions {
  /** Сбросить значение при disable */
  resetOnDisable?: boolean;

  /** Debounce в мс */
  debounce?: number;
}

/**
 * Опции для computeFrom
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
 */
export interface WatchFieldOptions {
  /** Debounce в мс */
  debounce?: number;

  /** Вызвать сразу при инициализации */
  immediate?: boolean;
}

/**
 * Опции для revalidateWhen
 */
export interface RevalidateWhenOptions {
  /** Debounce в мс */
  debounce?: number;
}

/**
 * Опции для syncFields
 */
export interface SyncFieldsOptions<T> {
  /** Трансформация значения */
  transform?: (value: T) => T;

  /** Debounce в мс */
  debounce?: number;
}
