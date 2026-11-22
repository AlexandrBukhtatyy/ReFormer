/**
 * Как сборщик находит исходники билдера — псевдонимы и общие копии рантаймов для его конфига
 * сборки (`../vite.config.ts`).
 *
 * Исходники билдера написаны под псевдонимы: внутренний `@` и пакеты контракта, которые
 * резолвятся в свои исходники, а не в `dist`.
 *
 * Приложению, в которое билдер встроен, этот модуль не нужен: приложение билдер не компилирует.
 * Его отдаёт dev-сервер приложения вложенным сервером с конфигом самого билдера
 * (`./plugin.mjs`), и псевдонимы действуют только там.
 *
 * @module vite/source-resolve
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const builderDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packagesDir = path.resolve(builderDir, '../../packages');

/**
 * Одна копия на страницу: вторая копия React, Radix или сигналов — два мира, не видящих друг
 * друга (`instanceof Signal` и контекст Radix ломаются).
 */
export const BUILDER_DEDUPE = Object.freeze([
  'react',
  'react-dom',
  'radix-ui',
  '@preact/signals-core',
]);

/**
 * Псевдонимы исходников билдера.
 *
 * Порядок значим: подпуть обязан стоять ПЕРЕД корнем пакета, иначе корневой псевдоним съедает
 * `/internal` и оболочка получает поверхность плагина вместо примитивов.
 */
export function builderSourceAliases() {
  return {
    '@': path.join(builderDir, 'src'),
    '@reformer/builder-plugin-api/internal': path.join(
      packagesDir,
      'reformer-builder-plugin-api/src/internal.ts'
    ),
    // Инструменты автора плагина (разбор манифеста, проверка каталога кита) — тем же приёмом.
    '@reformer/builder-plugin-api/tooling': path.join(
      packagesDir,
      'reformer-builder-plugin-api/src/tooling.ts'
    ),
    '@reformer/builder-plugin-api': path.join(
      packagesDir,
      'reformer-builder-plugin-api/src/index.ts'
    ),
    // Нейтральные помощники печати стеков — в исходники тем же доводом.
    '@reformer/builder-toolkit': path.join(packagesDir, 'reformer-builder-toolkit/src/index.ts'),
  };
}
