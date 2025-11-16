/**
 * FieldRegistry - управление полями в GroupNode
 *
 * Извлечено из GroupNode для соблюдения SRP (Single Responsibility Principle).
 * Отвечает только за хранение и управление коллекцией полей формы.
 *
 * @template T Тип формы (объект)
 *
 * @example
 * ```typescript
 * const registry = new FieldRegistry<{ email: string; name: string }>();
 * registry.set('email', emailField);
 * registry.set('name', nameField);
 *
 * const emailField = registry.get('email');
 * registry.forEach((field, key) => {
 *   console.log(key, field.value.value);
 * });
 * ```
 */

import type { FormNode } from '../form-node';
import type { FormValue } from '../../types';

/**
 * Реестр полей формы
 *
 * Предоставляет типобезопасный доступ к полям формы
 * через Map-подобный интерфейс
 *
 * @template T Тип формы (объект)
 */
export class FieldRegistry<T extends Record<string, FormValue>> {
  /**
   * Внутреннее хранилище полей
   * Map обеспечивает быструю lookup производительность O(1)
   */
  private fields = new Map<keyof T, FormNode<FormValue>>();

  /**
   * Установить поле в реестр
   *
   * @param key - Ключ поля (имя свойства в типе T)
   * @param node - FormNode для этого поля
   *
   * @example
   * ```typescript
   * registry.set('email', new FieldNode({ value: '' }));
   * ```
   */
  set<K extends keyof T>(key: K, node: FormNode<T[K]>): void {
    this.fields.set(key, node);
  }

  /**
   * Получить поле из реестра
   *
   * @param key - Ключ поля
   * @returns FormNode или undefined, если поле не найдено
   *
   * @example
   * ```typescript
   * const emailField = registry.get('email');
   * if (emailField) {
   *   console.log(emailField.value.value);
   * }
   * ```
   */
  get<K extends keyof T>(key: K): FormNode<T[K]> | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.fields.get(key) as any;
  }

  /**
   * Проверить наличие поля в реестре
   *
   * @param key - Ключ поля
   * @returns true если поле существует
   *
   * @example
   * ```typescript
   * if (registry.has('email')) {
   *   console.log('Email field exists');
   * }
   * ```
   */
  has(key: keyof T): boolean {
    return this.fields.has(key);
  }

  /**
   * Удалить поле из реестра
   *
   * @param key - Ключ поля
   * @returns true если поле было удалено, false если поля не было
   *
   * @example
   * ```typescript
   * registry.delete('email');
   * ```
   */
  delete(key: keyof T): boolean {
    return this.fields.delete(key);
  }

  /**
   * Перебрать все поля
   *
   * @param callback - Функция обратного вызова для каждого поля
   *
   * @example
   * ```typescript
   * registry.forEach((field, key) => {
   *   console.log(`${key}: ${field.value.value}`);
   * });
   * ```
   */
  forEach(callback: (field: FormNode<FormValue>, key: keyof T) => void): void {
    this.fields.forEach(callback);
  }

  /**
   * Получить итератор значений (полей)
   *
   * @returns Итератор по всем полям
   *
   * @example
   * ```typescript
   * for (const field of registry.values()) {
   *   await field.validate();
   * }
   * ```
   */
  values(): IterableIterator<FormNode<FormValue>> {
    return this.fields.values();
  }

  /**
   * Получить итератор пар [ключ, значение]
   *
   * @returns Итератор по всем записям
   *
   * @example
   * ```typescript
   * for (const [key, field] of registry.entries()) {
   *   console.log(key, field.value.value);
   * }
   * ```
   */
  entries(): IterableIterator<[keyof T, FormNode<FormValue>]> {
    return this.fields.entries();
  }

  /**
   * Получить итератор ключей полей
   *
   * @returns Итератор по всем ключам
   *
   * @example
   * ```typescript
   * const fieldNames = Array.from(registry.keys());
   * // ['email', 'name', 'age']
   * ```
   */
  keys(): IterableIterator<keyof T> {
    return this.fields.keys();
  }

  /**
   * Получить количество полей
   *
   * @returns Количество зарегистрированных полей
   *
   * @example
   * ```typescript
   * console.log(`Form has ${registry.size()} fields`);
   * ```
   */
  size(): number {
    return this.fields.size;
  }

  /**
   * Очистить все поля
   *
   * Удаляет все поля из реестра
   *
   * @example
   * ```typescript
   * registry.clear();
   * console.log(registry.size()); // 0
   * ```
   */
  clear(): void {
    this.fields.clear();
  }

  /**
   * Получить все поля как массив
   *
   * Полезно для операций, требующих работу с массивом
   *
   * @returns Массив всех полей
   *
   * @example
   * ```typescript
   * const allValid = registry.toArray().every(field => field.valid.value);
   * ```
   */
  toArray(): FormNode<FormValue>[] {
    return Array.from(this.fields.values());
  }

  /**
   * Получить Map-представление реестра (readonly)
   *
   * Используйте для совместимости с существующим кодом
   *
   * @returns ReadonlyMap с полями
   * @internal
   *
   * @example
   * ```typescript
   * const mapView = registry.asMap();
   * ```
   */
  asMap(): ReadonlyMap<keyof T, FormNode<FormValue>> {
    return this.fields;
  }
}
