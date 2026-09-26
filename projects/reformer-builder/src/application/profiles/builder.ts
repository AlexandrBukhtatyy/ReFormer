/**
 * «ReFormer Builder» — состав, который получает человек, открывший инструмент, — и его основа.
 *
 * ## Основа и стек
 *
 * Состав собран из двух частей, и граница между ними — СТЕК. {@link baseProfile} — то, что нужно
 * любому конструктору форм, каким бы форматом схемы и способом отрисовки он ни работал: дерево
 * файлов, редакторы текста и markdown, управление плагинами и превью-хост (правило выбора
 * поверхности и живой вид — но ни одной поверхности). {@link builderProfile} добавляет к ней
 * стек ReFormer: киты, валидатор схемы, визуальный редактор, поверхности формы, ассистента,
 * генерацию кода и шаблоны.
 *
 * Второй стек собирается так же — своим профилем с `extends: 'builder.base'`, — и основе при
 * этом не нужно ни строчки правки. Это и проверяется: основа поднимается сама по себе, без
 * единого плагина стека (`shell/boot/integration`).
 *
 * `reformer.builder` остаётся умолчанием запуска: без `preset` в конфиге собирается именно он
 * (`application/builder-application`). Список полный по определению — любое сокращение видно
 * в тесте состава поимённо, а не числом.
 *
 * @module application/profiles/builder
 */

import { defineProfile } from './profile';

export const BASE_PROFILE_ID = 'builder.base';
export const BUILDER_PROFILE_ID = 'reformer.builder';

export const baseProfile = defineProfile({
  id: BASE_PROFILE_ID,
  name: 'Основа конструктора',
  plugins: [
    'reformer.files',
    'reformer.editor-monaco',
    'reformer.editor-markdown',
    'reformer.plugin-manager',
    'reformer.preview',
  ],
});

export const builderProfile = defineProfile({
  id: BUILDER_PROFILE_ID,
  name: 'ReFormer Builder',
  extends: BASE_PROFILE_ID,
  plugins: [
    // Статические: их значения нужны композиции при сборке — причина у каждого записана
    // в его манифесте.
    'reformer.validator-schema',
    'reformer.kits',
    // Ленивые: приезжают своим файлом, но встают до первой отрисовки — их дожидается `ready`.
    'reformer.editor-schema',
    'reformer.preview-runtime',
    'reformer.ai',
    'reformer.codegen',
    'reformer.templates',
  ],
});

export const PLAIN_PROFILE_ID = 'plain.builder';

/**
 * Демо-стек поверх основы: ни одного плагина стека ReFormer. Доказывает, что основа билдера
 * принимает другой формат схемы, другой рендер и свой экспорт — одним плагином.
 */
export const plainProfile = defineProfile({
  id: PLAIN_PROFILE_ID,
  name: 'Простая форма (демо-стек)',
  extends: BASE_PROFILE_ID,
  plugins: ['reformer.plain'],
});

export const RJSF_PROFILE_ID = 'rjsf.builder';

/**
 * Домен RJSF поверх основы: формы react-jsonschema-form, нарисованные активным китом.
 *
 * Киты — платформа, а не часть стека ReFormer, поэтому `reformer.kits` здесь свой: тема RJSF
 * строится из того же активного кита, что рисует формы ReFormer, и кит, внесённый внешним
 * плагином, работает в обоих доменах без правки. Ни одного плагина стека ReFormer.
 */
export const rjsfProfile = defineProfile({
  id: RJSF_PROFILE_ID,
  name: 'RJSF Builder',
  extends: BASE_PROFILE_ID,
  plugins: ['reformer.kits', 'reformer.rjsf.editor', 'reformer.rjsf.render'],
});
