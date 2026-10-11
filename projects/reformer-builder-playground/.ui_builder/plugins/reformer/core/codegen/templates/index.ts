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
 * `application/entry.ts` содержит блок ```` ```ts ```` внутри JSDoc. Инлайн воспроизвёл бы ровно
 * то экранирование, ради устранения которого всё и затевалось.
 *
 * Размер нейтрален: Vite инлайнит `?raw` в тот же чанк, где эти байты уже лежали литералами.
 *
 * ## Состав — модуль единого контракта
 *
 * Шаблон на файл модуля: страница (`page`), реэкспорты (`barrel`), сборка (`create`), отправка
 * (`submit`), запись реестра форм (`entry`), запросы (`api`), начальные значения (`initial`),
 * модель (`model`), реестр компонентов (`registry`), валидация формы и шага, поведение, поток
 * шагов (`flow`), типы, константы источников данных и README. Шаблонов прежнего контракта —
 * шима визарда, агрегатора шагов и слоя рендера — больше нет.
 *
 * @module plugins/reformer/core/codegen/templates/index
 */

import { registerPartial } from '@reformer/builder-toolkit';
import apiTemplate from './api.eta?raw';
import barrelTemplate from './barrel.eta?raw';
import createTemplate from './create.eta?raw';
import dataSourcesTemplate from './data-sources.eta?raw';
import entryTemplate from './entry.eta?raw';
import flowTemplate from './flow.eta?raw';
import formBehaviorTemplate from './form-behavior.eta?raw';
import initialTemplate from './initial.eta?raw';
import modelTemplate from './model.eta?raw';
import pageTemplate from './page.eta?raw';
import readmeTemplate from './readme.eta?raw';
import registryTemplate from './registry.eta?raw';
import snippetTemplate from './_snippet.eta?raw';
import stepValidationTemplate from './step-validation.eta?raw';
import submitTemplate from './submit.eta?raw';
import typesTemplate from './types.eta?raw';
import validationTemplate from './validation.eta?raw';

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
  barrelTemplate,
  createTemplate,
  dataSourcesTemplate,
  entryTemplate,
  flowTemplate,
  formBehaviorTemplate,
  initialTemplate,
  modelTemplate,
  pageTemplate,
  readmeTemplate,
  registryTemplate,
  snippetTemplate,
  stepValidationTemplate,
  submitTemplate,
  typesTemplate,
  validationTemplate,
};
