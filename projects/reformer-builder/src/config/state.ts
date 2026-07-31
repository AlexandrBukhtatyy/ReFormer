/**
 * Module-level состояние runtime-конфигурации: активный конфиг клиента и его каталог компонентов.
 * Ставится один раз на бутстрапе ({@link '../config/load'.loadRuntimeBundle}) ДО инициализации графа
 * `store`/`catalog` (см. `main.tsx` — динамический импорт `App` после boot). Геттеры затем читаются
 * из точек внедрения (contract/PalettePanel/reducers/discovery/AppToolbar).
 *
 * Лист графа зависимостей: только типы, без импортов `store`/`catalog` (иначе цикл при чтении из
 * `contract`/`load`).
 *
 * @module reformer-builder/config/state
 */

import type { CatalogJson } from '../catalog/types';
import type { RuntimeConfig } from './types';

/** Пустой конфиг ⇒ все точки внедрения падают на встроенные дефолты. */
const EMPTY_CONFIG: RuntimeConfig = {};

let activeConfig: RuntimeConfig = EMPTY_CONFIG;
let clientCatalog: CatalogJson | null = null;

/** Активная runtime-конфигурация (пустой объект, если клиент не передал конфиг). */
export function getRuntimeConfig(): RuntimeConfig {
  return activeConfig;
}

/** Установить конфиг клиента (вызывается на бутстрапе после валидации). */
export function setRuntimeConfig(config: RuntimeConfig): void {
  activeConfig = config;
}

/** Клиентский каталог компонентов (если передан) — замещает вшитый `@reformer/ui-kit/catalog`. */
export function getClientCatalog(): CatalogJson | null {
  return clientCatalog;
}

/** Установить клиентский каталог (вызывается на бутстрапе после валидации). */
export function setClientCatalog(catalog: CatalogJson): void {
  clientCatalog = catalog;
}

/** Сбросить состояние к дефолтам (для тестов). */
export function resetRuntimeState(): void {
  activeConfig = EMPTY_CONFIG;
  clientCatalog = null;
}
