/**
 * Типы для реестра компонентов
 *
 * @module reformer/renderer-json/registry/types
 */

import type { ComponentType } from 'react';

/**
 * Метаданные зарегистрированной записи реестра.
 *
 * Реестр хранит записи трёх типов:
 * - 'field' — React-компонент для поля формы (Input, Select, ...).
 * - 'container' — React-компонент для layout (Box, Section, Wizard, ...).
 * - 'source' — произвольное значение (функция, массив, константа), подставляемое
 *   в componentProps по имени.
 *
 * Формы в registry не регистрируются — они живут в closure behavior-а и инжектятся
 * в componentProps через `onInit(schema.node('wizard'), () => ({ form }))`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ComponentMetadata<P = any> {
  /**
   * Значение записи:
   * - для 'field'/'container' — React-компонент;
   * - для 'source' — произвольное значение (options-фабрика, computed-функция, константа).
   */
  component: ComponentType<P> | unknown;

  /**
   * Тип записи.
   */
  type: 'field' | 'container' | 'source';

  /**
   * Описание (для документации)
   */
  description?: string;
}

/**
 * Интерфейс реестра компонентов
 *
 * Реестр позволяет регистрировать компоненты по имени
 * и получать их для рендеринга из JSON-схемы.
 *
 * @example
 * ```typescript
 * const registry = createComponentRegistry()
 *   .register('Input', { component: Input, type: 'field' })
 *   .register('Box', { component: Box, type: 'container' });
 *
 * const meta = registry.get('Input');
 * // meta.component === Input
 * ```
 */
export interface ComponentRegistry {
  /**
   * Регистрирует запись в реестре.
   *
   * @param name - Уникальное имя записи
   * @param metadata - Метаданные (компонент или source)
   * @returns this для chaining
   */
  register<P>(name: string, metadata: ComponentMetadata<P>): this;

  /**
   * Сахар для регистрации source-значения: функции, массива опций, константы.
   * Эквивалент `register(name, { component: value, type: 'source', description })`.
   */
  registerSource<T>(name: string, value: T, description?: string): this;

  /**
   * Получает метаданные записи по имени.
   *
   * @param name - Имя записи
   * @returns Метаданные или undefined если не найден
   */
  get(name: string): ComponentMetadata | undefined;

  /**
   * Получает значение source-записи по имени.
   * Возвращает undefined, если запись не существует или не имеет типа 'source'.
   */
  getSource<T = unknown>(name: string): T | undefined;

  /**
   * Проверяет наличие записи в реестре
   *
   * @param name - Имя записи
   */
  has(name: string): boolean;

  /**
   * Возвращает список всех зарегистрированных имён
   */
  names(): string[];

  /**
   * Создаёт новый реестр на основе текущего (для расширения)
   *
   * @returns Новый реестр с копией всех записей
   */
  extend(): ComponentRegistry;
}
