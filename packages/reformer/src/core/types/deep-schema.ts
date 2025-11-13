/**
 * Типы для Variant 5: Proxy-based Deep Access
 *
 * Автоматическое определение типов схемы на основе структуры:
 * - [{...}] → массив форм (ArrayProxy)
 * - {...} → вложенная форма (GroupProxy)
 * - {value, component} → поле (FieldNode)
 */

import type { ComponentType } from 'react';
import type { ReadonlySignal } from '@preact/signals-react';
import type { ValidatorFn, AsyncValidatorFn, ValidationError } from './index';
import type { FieldNode } from '../nodes/field-node';

// ============================================================================
// Базовые типы
// ============================================================================

/**
 * Конфигурация поля
 */
export interface FieldConfig<T = any> {
  value: T | null;
  component: ComponentType<any>;
  componentProps?: Record<string, any>;
  validators?: ValidatorFn<T>[];
  asyncValidators?: AsyncValidatorFn<T>[];
  disabled?: boolean;
  updateOn?: 'change' | 'blur' | 'submit';
  /** Задержка (в мс) перед запуском асинхронной валидации */
  debounce?: number;
}

/**
 * Конфигурация массива (внутренняя)
 */
export interface ArrayConfig<T extends Record<string, any>> {
  itemSchema: FormSchema<T>;
  initial?: Partial<T>[];
}

// ============================================================================
// Deep Schema - автоматическое определение типов
// ============================================================================

/**
 * Автоматически определяет тип схемы на основе TypeScript типа:
 * - T[] -> [FormSchema<T>] (массив с одним элементом)
 * - object -> FormSchema<T> (группа)
 * - primitive -> FieldConfig<T> (поле)
 *
 * Использует NonNullable для корректной обработки опциональных полей
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
  [K in keyof T]: NonNullable<T[K]> extends Array<infer U>
    ? U extends Record<string, any>
      ? [FormSchema<U>] // Массив объектов
      : FieldConfig<T[K]> // Массив примитивов (как обычное поле)
    : NonNullable<T[K]> extends Record<string, any>
      ? NonNullable<T[K]> extends Date | File | Blob
        ? FieldConfig<T[K]> // Специальные объекты
        : FormSchema<NonNullable<T[K]>> | FieldConfig<T[K]> // Группа или поле с объектным типом
      : FieldConfig<T[K]>; // Примитивное поле
};

// ============================================================================
// Deep Controls - типы для Proxy доступа
// ============================================================================

/**
 * Типы контроллеров с учетом вложенности
 *
 * Предоставляет типобезопасный доступ к полям формы через Proxy:
 * - Поля → FieldNode
 * - Группы → DeepControls + GroupControlProxy
 * - Массивы → ArrayControlProxy
 *
 * Использует NonNullable для корректной обработки опциональных полей
 *
 * @example
 * ```typescript
 * const form = new FormStore(schema);
 *
 * // Доступ к полю
 * form.controls.name.value;
 *
 * // Доступ к вложенной группе
 * form.controls.address.city.value;
 *
 * // Доступ к опциональному массиву
 * form.controls.items?.[0].title.value;
 * form.controls.items?.length;
 * form.controls.items?.push();
 * ```
 */
export type DeepControls<T> = {
  [K in keyof T]: NonNullable<T[K]> extends Array<infer U>
    ? U extends Record<string, any>
      ? ArrayControlProxy<U>
      : FieldNode<T[K]>
    : NonNullable<T[K]> extends Record<string, any>
      ? NonNullable<T[K]> extends Date | File | Blob
        ? FieldNode<T[K]>
        : DeepControls<NonNullable<T[K]>> & GroupControlProxy<NonNullable<T[K]>>
      : FieldNode<T[K]>;
};

/**
 * Интерфейс для GroupProxy (вложенные формы)
 *
 * Предоставляет методы для работы с группой полей как с единой формой
 */
export interface GroupControlProxy<T extends Record<string, any>> {
  /** Все поля группы валидны */
  valid: boolean;

  /** Хотя бы одно поле группы невалидно */
  invalid: boolean;

  /** Все ошибки валидации в группе */
  errors: ValidationError[];

  /** Хотя бы одно поле группы было touched */
  touched: boolean;

  /** Хотя бы одно поле группы было изменено */
  dirty: boolean;

  /**
   * Получить значения всех полей группы
   */
  getValue(): T;

  /**
   * Установить значения полей группы
   */
  setValue(value: Partial<T>): void;

  /**
   * Валидировать все поля группы
   */
  validate(): Promise<boolean>;

  /**
   * Пометить все поля группы как touched
   */
  markAsTouched(): void;

  /**
   * Сбросить все поля группы к начальным значениям
   */
  reset(): void;
}

/**
 * Интерфейс для ArrayProxy (массивы форм)
 *
 * Предоставляет массивоподобный API с дополнительными возможностями
 * для управления динамическим списком форм
 *
 * @example
 * ```typescript
 * // Добавить элемент
 * form.controls.items.push({ title: 'New item' });
 *
 * // Удалить элемент
 * form.controls.items.remove(0);
 *
 * // Вставить элемент
 * form.controls.items.insert(1, { title: 'Inserted' });
 *
 * // Доступ по индексу
 * form.controls.items[0].title.value = 'Updated';
 *
 * // Итерация
 * form.controls.items.forEach((item, i) => {
 *   console.log(item.title.value);
 * });
 *
 * // Маппинг
 * const titles = form.controls.items.map(item => item.title.value);
 * ```
 */
export interface ArrayControlProxy<T extends Record<string, any>> {
  // ============================================================================
  // Доступ по индексу
  // ============================================================================

  /**
   * Доступ к элементу массива по индексу
   * Возвращает Proxy с доступом к полям элемента
   */
  [index: number]: DeepControls<T> & GroupControlProxy<T>;

  // ============================================================================
  // Свойства
  // ============================================================================

  /**
   * Количество элементов в массиве (реактивное)
   */
  length: ReadonlySignal<number>;

  /**
   * Массив всех элементов (реактивный)
   */
  items: ReadonlySignal<Array<DeepControls<T> & GroupControlProxy<T>>>;

  /**
   * Все элементы массива валидны
   */
  valid: boolean;

  /**
   * Хотя бы один элемент массива невалиден
   */
  invalid: boolean;

  /**
   * Все ошибки валидации в массиве
   */
  errors: ValidationError[];

  // ============================================================================
  // Методы управления
  // ============================================================================

  /**
   * Добавить элемент в конец массива
   * @param value - Начальные значения для нового элемента
   */
  push(value?: Partial<T>): void;

  /**
   * Удалить элемент по индексу
   * Автоматически переиндексирует оставшиеся элементы
   * @param index - Индекс элемента для удаления
   */
  remove(index: number): void;

  /**
   * Вставить элемент в массив
   * Автоматически сдвигает индексы последующих элементов
   * @param index - Индекс для вставки
   * @param value - Начальные значения для нового элемента
   */
  insert(index: number, value?: Partial<T>): void;

  /**
   * Удалить все элементы массива
   */
  clear(): void;

  /**
   * Получить элемент по индексу (безопасный доступ)
   * @param index - Индекс элемента
   * @returns Элемент или undefined если индекс вне границ
   */
  at(index: number): (DeepControls<T> & GroupControlProxy<T>) | undefined;

  // ============================================================================
  // Итерация
  // ============================================================================

  /**
   * Итерировать по элементам массива
   * @param callback - Функция, вызываемая для каждого элемента
   */
  forEach(callback: (item: DeepControls<T> & GroupControlProxy<T>, index: number) => void): void;

  /**
   * Маппинг элементов массива
   * @param callback - Функция преобразования
   * @returns Новый массив результатов
   */
  map<R>(callback: (item: DeepControls<T> & GroupControlProxy<T>, index: number) => R): R[];

  // ============================================================================
  // Валидация и значения
  // ============================================================================

  /**
   * Валидировать все элементы массива
   */
  validate(): Promise<boolean>;

  /**
   * Получить значения всех элементов массива
   */
  getValue(): T[];

  /**
   * Установить значения элементов массива
   * Удаляет существующие элементы и создает новые
   */
  setValue(values: Partial<T>[]): void;

  /**
   * Пометить все элементы как touched
   */
  markAsTouched(): void;

  /**
   * Сбросить все элементы к начальным значениям
   */
  reset(): void;
}
