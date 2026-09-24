/**
 * Встроенные цели генерации — те самые, что в v1 были литеральным массивом вызовов.
 *
 * Каждая запись отвечает на три вопроса, которые раньше были разнесены по четырём модулям:
 * как называется файл, перезаписывать ли его и производится ли он из правил. Порядок задаётся
 * `order` вклада, а не позицией в массиве, поэтому чужая цель может встать между нашими.
 *
 * Ни одна из них не знает ни рабочей области, ни источника: цель возвращает текст, записью
 * занимается доставка.
 *
 * @module plugins/codegen/pipeline/targets
 */

import {
  registryTemplate,
  renderBehaviorTemplate,
  typesTemplate,
  validationTemplate,
  formBehaviorTemplate,
  wizardTemplate,
  readmeTemplate,
  dataSourcesTemplate,
  modelTemplate,
  indexTemplate,
  apiTemplate,
  stepsIndexTemplate,
  stepValidationTemplate,
  stepRenderTemplate,
  emitSchema,
  emitStepSchema,
  wizardShimOf,
  MODULE_FILES,
  LEGACY_FILES,
  STEPS_INDEX,
  STEP_FILES,
} from '@reformer/builder-stack-reformer/codegen';
import type { CodegenTarget } from '../contract';

/**
 * Встроенные цели в каноническом порядке раскладки renderer-json.
 *
 * `order` кратен десяти: между любыми двумя нашими целями помещается чужая, и вставка не
 * требует перенумеровать соседей. Цели шагов визарда встают рядом с корневыми файлами того же
 * слоя (`15`, `55`, `85`, `105`).
 *
 * Имена файлов — из `MODULE_FILES` стека: они же нужны шаблонам (импорты), поиску схемы в
 * каталоге и превью, и литерал здесь разошёлся бы с ними при первом переименовании. Id целей
 * прежние: пользовательские шаблоны заменяют цель по id (`overrides`).
 */
export const BUILTIN_TARGETS: readonly (CodegenTarget & { readonly order: number })[] =
  Object.freeze([
    {
      id: 'codegen.schema',
      titleKey: 'target.schema',
      path: MODULE_FILES.schema,
      legacyPaths: LEGACY_FILES.schema,
      cls: 'derived',
      order: 10,
      emit: emitSchema,
    },
    {
      // Схема шага — только у визарда, разбитого по шагам: корень держит на неё ссылку.
      // Производная, как и корневая схема: её источник — форма в редакторе.
      id: 'codegen.step-schema',
      titleKey: 'target.step-schema',
      path: `steps/{step}/${STEP_FILES.schema}`,
      each: 'step',
      cls: 'derived',
      order: 15,
      applies: (ctx) => ctx.step?.files.schema != null,
      emit: emitStepSchema,
    },
    {
      id: 'codegen.types',
      titleKey: 'target.types',
      path: MODULE_FILES.types,
      cls: 'derived',
      order: 20,
      template: typesTemplate,
    },
    {
      id: 'codegen.model',
      titleKey: 'target.model',
      path: MODULE_FILES.model,
      cls: 'derived',
      order: 30,
      template: modelTemplate,
    },
    {
      id: 'codegen.registry',
      titleKey: 'target.registry',
      path: MODULE_FILES.registry,
      cls: 'derived',
      order: 40,
      template: registryTemplate,
    },
    {
      id: 'codegen.index',
      titleKey: 'target.index',
      path: MODULE_FILES.index,
      cls: 'derived',
      order: 50,
      template: indexTemplate,
    },
    {
      // Шим визарда — опциональный файл канона: он появляется ровно у той формы, где есть
      // узел-визард, И только если кит поставляет адаптер. Без адаптера файл не печатается,
      // а `registry.ts` регистрирует заглушку с внятной причиной — это лучше импорта из
      // чужого пакета, который у пользователя не соберётся.
      id: 'codegen.wizard',
      titleKey: 'target.wizard',
      path: MODULE_FILES.wizard,
      legacyPaths: LEGACY_FILES.wizard,
      cls: 'derived',
      order: 60,
      applies: (ctx) => wizardShimOf(ctx) !== null,
      template: wizardTemplate,
    },
    {
      // Агрегатор шагов визарда: порядок шагов берётся из схемы, поэтому файл производный —
      // перестановка шагов не требует ручной правки ни одного файла человека.
      id: 'codegen.steps-index',
      titleKey: 'target.steps-index',
      path: STEPS_INDEX,
      cls: 'derived',
      order: 55,
      applies: (ctx) => ctx.layout.kind === 'wizard',
      template: stepsIndexTemplate,
    },
    {
      id: 'codegen.data-sources',
      titleKey: 'target.data-sources',
      path: MODULE_FILES.dataSources,
      cls: 'user',
      order: 70,
      template: dataSourcesTemplate,
    },
    {
      // Производится из правил render-слоя, поэтому несёт маркер и перезаписывается,
      // пока его не правили руками.
      id: 'codegen.render-behavior',
      titleKey: 'target.render-behavior',
      path: MODULE_FILES.render,
      legacyPaths: LEGACY_FILES.render,
      cls: 'user',
      regenerable: true,
      order: 80,
      template: renderBehaviorTemplate,
    },
    {
      // Render-слой шага: правила и заготовки hideWhen узлов шага. Корневой form.render.ts
      // вызывает его через steps/index.ts.
      id: 'codegen.step-render',
      titleKey: 'target.step-render',
      path: `steps/{step}/${STEP_FILES.render}`,
      each: 'step',
      cls: 'user',
      regenerable: true,
      order: 85,
      template: stepRenderTemplate,
    },
    {
      id: 'codegen.form-behavior',
      titleKey: 'target.form-behavior',
      path: MODULE_FILES.behavior,
      cls: 'user',
      regenerable: true,
      order: 90,
      template: formBehaviorTemplate,
    },
    {
      id: 'codegen.validation',
      titleKey: 'target.validation',
      path: MODULE_FILES.validation,
      legacyPaths: LEGACY_FILES.validation,
      cls: 'user',
      regenerable: true,
      order: 100,
      template: validationTemplate,
    },
    {
      // Валидация шага: «Далее» проверяет только её. Корневой form.validation.ts собирает шаги.
      id: 'codegen.step-validation',
      titleKey: 'target.step-validation',
      path: `steps/{step}/${STEP_FILES.validation}`,
      each: 'step',
      cls: 'user',
      regenerable: true,
      order: 105,
      template: stepValidationTemplate,
    },
    // Заготовка под бэкенд: регенерировать её не из чего, поэтому маркера она не несёт.
    {
      id: 'codegen.api',
      titleKey: 'target.api',
      path: MODULE_FILES.api,
      cls: 'user',
      order: 110,
      template: apiTemplate,
    },
    // README печатается последним не по прихоти: он перечисляет состав модуля, и состав
    // к этому моменту уже известен целиком.
    {
      id: 'codegen.readme',
      titleKey: 'target.readme',
      path: MODULE_FILES.readme,
      cls: 'derived',
      order: 120,
      template: readmeTemplate,
    },
  ]);
