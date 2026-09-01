/**
 * Тексты встроенных шаблонов — исходники `.eta`, вшитые в сборку.
 *
 * ## Почему `?raw`, а не строки в модуле и не генерируемый файл
 *
 * Главное, что даёт перевод печати на шаблоны, — «скопируй встроенный шаблон и правь его».
 * Для этого встроенный обязан БЫТЬ ФАЙЛОМ: команда выгрузки отдаёт человеку ровно то, что
 * лежит здесь. Строка в модуле этого не даёт, а генерируемый файл означал бы, что правка
 * `.eta` не видна без повторного прогона шага сборки — плохой обмен для фичи про правку.
 *
 * Второй довод технический: `String.raw` не умеет держать обратную кавычку, а вывод
 * `index.tsx` содержит блок ```` ```ts ```` внутри JSDoc. Инлайн воспроизвёл бы ровно то
 * экранирование, ради устранения которого всё и затевалось.
 *
 * Размер нейтрален: Vite инлайнит `?raw` в тот же чанк, где эти байты уже лежали литералами.
 *
 * @module lib/codegen/templates/index
 */

import { registerPartial } from '../render';
import apiTemplate from './api.eta?raw';
import dataSourcesTemplate from './data-sources.eta?raw';
import modelTemplate from './model.eta?raw';
import indexTemplate from './index-tsx.eta?raw';
import readmeTemplate from './readme.eta?raw';
import typesTemplate from './types.eta?raw';
import validationTemplate from './validation.eta?raw';
import formBehaviorTemplate from './form-behavior.eta?raw';
import wizardTemplate from './wizard.eta?raw';
import registryTemplate from './registry.eta?raw';
import renderBehaviorTemplate from './render-behavior.eta?raw';
import snippetTemplate from './_snippet.eta?raw';

/**
 * Имя сниппета во внутреннем сторе включений.
 *
 * Константа, а не строка в двух местах: под этим именем его регистрируют здесь, зовут из
 * `readme.eta` и рендерят из `emit/snippet.ts`. Разъехавшись, они дали бы отказ «включение
 * не найдено» в шаблоне, который заведомо правильный.
 */
export const SNIPPET_PARTIAL = 'codegen.snippet';

// Регистрация СРАЗУ, а не при первом рендере сниппета: иначе доступность включения зависела бы
// от того, показывали ли до этого панель экспорта, — то есть README печатался бы по-разному
// в зависимости от порядка действий человека.
registerPartial(SNIPPET_PARTIAL, snippetTemplate);

export {
  apiTemplate,
  indexTemplate,
  modelTemplate,
  dataSourcesTemplate,
  readmeTemplate,
  snippetTemplate,
  typesTemplate,
  validationTemplate,
  formBehaviorTemplate,
  wizardTemplate,
  registryTemplate,
  renderBehaviorTemplate,
};
