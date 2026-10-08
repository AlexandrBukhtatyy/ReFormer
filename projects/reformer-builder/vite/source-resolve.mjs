/**
 * Как сборщик находит исходники билдера — одно место для конфига самого билдера и конфига
 * приложения, в которое билдер встроен.
 *
 * ## Зачем это общее
 *
 * Встроенный билдер собирает сборщик ЧУЖОГО приложения, и собирает из исходников: библиотечной
 * сборки у билдера пока нет. Исходники же написаны под псевдонимы — внутренний `@` и пакеты
 * контракта, которые резолвятся в свои исходники, а не в `dist`. Перепиши приложение этот
 * список у себя — и первая же правка псевдонимов билдера разведёт два конфига молча: билдер
 * соберётся, приложение с билдером — нет.
 *
 * ## Временное
 *
 * С библиотечной сборкой билдера приложению останется обычная зависимость от пакета, и этот
 * модуль понадобится только самому билдеру.
 *
 * ## Ограничение для приложения
 *
 * Псевдоним `@` принадлежит билдеру. Приложение, которое завело свой `@`, перехватит импорты
 * билдера — до библиотечной сборки такому приложению нужен другой псевдоним.
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

/** Вход библиотеки — билдер, встроенный в приложение. */
export const BUILDER_ENTRY = path.join(builderDir, 'src/index.ts');

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

/**
 * Раздел `resolve` для приложения, в которое встроен билдер: его исходники, вход библиотеки
 * под именем пакета и общие копии рантаймов.
 */
export function builderHostResolve() {
  return {
    dedupe: [...BUILDER_DEDUPE],
    alias: {
      '@reformer/builder': BUILDER_ENTRY,
      ...builderSourceAliases(),
    },
  };
}
