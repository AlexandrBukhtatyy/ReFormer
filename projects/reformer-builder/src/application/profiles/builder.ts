/**
 * «ReFormer Builder» — состав, который получает человек, открывший инструмент.
 *
 * Профиль перечисляет ВЕСЬ сегодняшний набор и остаётся умолчанием запуска: без `preset`
 * в конфиге собирается именно он (`application/builder-application`). Поэтому список тут
 * полный по определению — любое его сокращение видно в тесте состава поимённо, а не числом.
 *
 * Порядок записан тот же, в каком плагины собирались до появления профилей: сначала пятеро
 * статических, потом шестеро ленивых. На поведение он не влияет (рантайм плагинов проверяет
 * это отдельным тестом), но сохранён намеренно — чтобы переход на профили не менял ни одной
 * наблюдаемой мелочи, включая порядок в выводе диагностики.
 *
 * @module application/profiles/builder
 */

import { defineProfile } from './profile';

export const BUILDER_PROFILE_ID = 'reformer.builder';

export const builderProfile = defineProfile({
  id: BUILDER_PROFILE_ID,
  name: 'ReFormer Builder',
  plugins: [
    // Статические: их значения нужны композиции при сборке — причина у каждого записана
    // у его записи в карте встроенных.
    'files',
    'validator-schema',
    'editor-monaco',
    'kits',
    'preview',
    // Ленивые: приезжают своим файлом, но встают до первой отрисовки — их дожидается `ready`.
    'editor-markdown',
    'editor-schema',
    'plugin-manager',
    'ai',
    'codegen',
    'templates',
  ],
});
