/**
 * Реестр компонентов для React: тот же реестр, что в `registry-core.ts`, с границей ошибок схемы
 * {@link SchemaErrorBoundary} и типом компонента `ComponentType`.
 *
 * @module reformer/renderer-json/registry/component-registry
 */

import type { ComponentRegistry } from './types';
import type { RegistryBuilder } from './react-types';
import { SchemaErrorBoundary } from '../components/schema-error-boundary';
import {
  ComponentRegistryImpl,
  composeRegistriesWith,
  defineRegistry as defineNeutralRegistry,
} from './registry-core';

export { ComponentRegistryImpl };

/**
 * Композиция реестров слева направо: каждый следующий перекрывает предыдущие
 * (last-wins, как `Object.assign`).
 *
 * Нужна там, где реестр собирается из нескольких источников по порядку ВЛАДЕНИЯ (форма →
 * микрофронт → общее ядро): результат передаётся сборке формы одним реестром
 * (`createForm({ model, schema, registry })`), без React-контекста.
 *
 * @param registries - Реестры от наименее приоритетного к наиболее приоритетному.
 * @returns Объединённый {@link ComponentRegistry}; пустой, если аргументов нет.
 *
 * @example Общее ядро + расширения микрофронта + специфика формы
 * ```typescript
 * const registry = composeRegistries(coreRegistry, mfeRegistry, formRegistry);
 * // formRegistry перекрывает mfeRegistry, тот — coreRegistry
 * ```
 */
export function composeRegistries(...registries: readonly ComponentRegistry[]): ComponentRegistry {
  return composeRegistriesWith(registries, { errorBoundary: SchemaErrorBoundary });
}

/**
 * Создаёт реестр компонентов через builder-callback.
 *
 * Реестр обязателен для сборки формы из документа — иначе компоненты, упомянутые в JSON-схеме,
 * не отрезолвятся.
 *
 * @param fn - Builder-callback. Получает {@link RegistryBuilder} с методами `component`, `dataSource`.
 * @returns Готовый {@link ComponentRegistry}, который передаётся сборке:
 *   `createForm({ model, schema: document, registry })`.
 *
 * @example
 * ```typescript
 * import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
 * import { Input, SelectAsync, FormField } from '@reformer/ui-kit';
 *
 * const registry = defineRegistry((reg) => {
 *   reg.component('Input', Input);
 *   // Поле выбора — `SelectAsync`; базовый `Select` кита — shadcn-примитив, не поле формы.
 *   reg.component('Select', SelectAsync);
 *   reg.component(FIELD_WRAPPER, FormField);
 *   reg.dataSource('LOAN_TYPES', [
 *     { value: 'consumer', label: 'Потребительский' },
 *     { value: 'mortgage', label: 'Ипотека' },
 *   ]);
 * });
 * ```
 *
 * @see [docs/llms/03-registry.md](../../docs/llms/03-registry.md)
 */
export function defineRegistry(fn: (reg: RegistryBuilder) => void): ComponentRegistry {
  // Builder один и тот же: вход для React только уточняет тип компонента до `ComponentType`.
  return defineNeutralRegistry(fn as (reg: unknown) => void, {
    errorBoundary: SchemaErrorBoundary,
  });
}
