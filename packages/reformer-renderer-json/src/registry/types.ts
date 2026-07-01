/**
 * Типы для реестра компонентов
 *
 * @module reformer/renderer-json/registry/types
 */

import type { ComponentType } from 'react';

/**
 * Запись реестра. Хранит сам компонент (или dataSource-значение) и его роль.
 *
 * @typeParam P - Пропсы компонента (для `field`/`container`).
 *
 * @example
 * ```typescript
 * const meta: ComponentMetadata = registry.get('Input')!;
 * meta.type; // 'component'
 * ```
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ComponentMetadata<P = any> {
  component: ComponentType<P> | unknown;
  type: 'component' | 'dataSource';
  description?: string;
}

/**
 * Read-only API реестра, доступное в рантайме.
 *
 * Создаётся через {@link defineRegistry}. Передаётся в `JsonRendererProvider`
 * через `settings.registry`.
 *
 * @example
 * ```typescript
 * if (registry.has('Input')) {
 *   registry.get('Input'); // ComponentMetadata
 * }
 * registry.names(); // ['Input', 'Box', 'LOAN_TYPES', ...]
 * ```
 */
export interface ComponentRegistry {
  get(name: string): ComponentMetadata | undefined;
  getDataSource<T = unknown>(name: string): T | undefined;
  has(name: string): boolean;
  names(): string[];
}

/**
 * Builder, который попадает в callback {@link defineRegistry}.
 *
 * @example
 * ```typescript
 * defineRegistry((reg: RegistryBuilder) => {
 *   reg.component('Input', Input);
 *   reg.component('Box', Box);
 *   reg.dataSource('LOAN_TYPES', LOAN_TYPES);
 * });
 * ```
 */
export interface RegistryBuilder {
  /**
   * Зарегистрировать React-компонент под именем — доступен в схеме как
   * `$component(name)`. Одним методом регистрируются и компоненты-листья
   * (Input/Select), и контейнеры (Box/Section/FormField): роль узла (лист vs
   * контейнер) определяется структурой узла схемы (`value` vs `children`),
   * а не регистрацией.
   */
  component<P>(name: string, component: ComponentType<P>, description?: string): void;
  dataSource<T>(name: string, value: T, description?: string): void;
}
