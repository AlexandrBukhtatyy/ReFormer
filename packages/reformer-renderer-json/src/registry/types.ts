/**
 * Типы для реестра компонентов
 *
 * @module reformer/renderer-json/registry/types
 */

import type { ComponentType } from 'react';
import type { LocaleResolver, LocaleService } from '../locale/locale-service';

/**
 * Запись реестра. Хранит значение (компонент / dataSource / функцию / сервис локализации) и его роль.
 *
 * @typeParam P - Пропсы компонента (для `component`).
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
  type: 'component' | 'dataSource' | 'fn' | 'locale';
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
  /**
   * Единственный сервис локализации (для оператора `$locale(key)`), если зарегистрирован через
   * `reg.locale(...)`. Опционален — сторонние реализации `ComponentRegistry` без него продолжают
   * компилироваться; при его отсутствии `$locale` мягко деградирует до самого ключа.
   */
  getLocale?(): LocaleService | undefined;
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
 *   reg.fn('formatCurrency', formatCurrency);
 *   reg.locale(createLocaleResolver({ 'fields.email.label': 'Email' }));
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
  /**
   * Зарегистрировать функцию под именем — доступна в схеме как `$fn(name)` (форматтеры,
   * компараторы, `itemLabel`, обработчики). Отдельный от `dataSource` вид: бросает при регистрации,
   * если передана не функция, и `validateFormSchema` отклоняет перепутанные `$fn`/`$dataSource`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn<F extends (...args: any[]) => any>(name: string, fn: F, description?: string): void;
  /**
   * Зарегистрировать единственный сервис локализации для оператора `$locale(key)`. Принимает
   * {@link LocaleService} (каталог через `createLocaleResolver` — включает validate-time проверку
   * ключей) либо голый резолвер `(key) => string`. Кладётся под зарезервированный ключ `LOCALE_SERVICE`.
   */
  locale(service: LocaleService | LocaleResolver, description?: string): void;
}
