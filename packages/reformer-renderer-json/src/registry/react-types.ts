/**
 * Типы реестра компонентов, уточнённые под React: компонент записи — `ComponentType`. Их отдаёт
 * основной вход пакета; нейтральные — в `types.ts`.
 *
 * @module reformer/renderer-json/registry/react-types
 */

import type { ComponentType } from 'react';
import type {
  ComponentMetadata as NeutralComponentMetadata,
  RegistryBuilder as NeutralRegistryBuilder,
} from './types';

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
export interface ComponentMetadata<P = any> extends NeutralComponentMetadata {
  component: ComponentType<P> | unknown;
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
export interface RegistryBuilder extends Omit<NeutralRegistryBuilder, 'component'> {
  /**
   * Зарегистрировать React-компонент под именем — доступен в схеме как
   * `$component(name)`. Одним методом регистрируются и компоненты-листья
   * (Input/Select), и контейнеры (Box/Section/FormField): роль узла (лист vs
   * контейнер) определяется структурой узла схемы (`model` vs `children`),
   * а не регистрацией.
   */
  component<P>(name: string, component: ComponentType<P>, description?: string): void;
}
