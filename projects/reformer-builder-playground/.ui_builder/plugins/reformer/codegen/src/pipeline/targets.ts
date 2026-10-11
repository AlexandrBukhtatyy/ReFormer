/**
 * Встроенные цели генерации — файлы модуля формы единого контракта сборки.
 *
 * Каждая запись отвечает на три вопроса, которые раньше были разнесены по четырём модулям:
 * как называется файл, перезаписывать ли его и производится ли он из правил. Порядок задаётся
 * `order` вклада, а не позицией в массиве, поэтому чужая цель может встать между нашими.
 *
 * Ни одна из них не знает ни рабочей области, ни источника: цель возвращает текст, записью
 * занимается доставка.
 *
 * ## Пути — шаблонами
 *
 * Модуль разложен по папкам ролей, и часть имён зависит от формы: страница называется типом
 * формы (`{Type}.tsx`), файлы типов, констант и потока — её kebab-именем (`types/{dir}.ts`), а
 * документ лежит там, где его нашли (`{schema}`). Токены подставляет прогон (`./generate`); здесь
 * они записаны так, чтобы раскладка читалась одним взглядом.
 *
 * @module plugins/reformer/codegen/pipeline/targets
 */

import {
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
  stepValidationTemplate,
  submitTemplate,
  typesTemplate,
  validationTemplate,
  emitSchema,
  emitStepSchema,
  LEGACY_SCHEMA_FILE,
  SCHEMA_FILE,
  STEP_SCHEMAS_DIR,
} from '../../../core/codegen';
import type { CodegenTarget } from '../contract';

/**
 * Встроенные цели в порядке раскладки модуля: производные файлы, затем авторские.
 *
 * `order` разрежен: между любыми двумя нашими целями помещается чужая, и вставка не требует
 * перенумеровать соседей. Цели шагов визарда встают рядом с файлами формы того же слоя (`15`,
 * `105`).
 *
 * Id целей сохранены там, где роль файла та же: пользовательские шаблоны заменяют цель по id
 * (`overrides`). Новые цели — `codegen.initial`, `codegen.create`, `codegen.entry`,
 * `codegen.barrel`, `codegen.flow`, `codegen.submit`. Снятые — в {@link RETIRED_TARGETS}.
 */
export const BUILTIN_TARGETS: readonly (CodegenTarget & { readonly order: number })[] =
  Object.freeze([
    {
      // Документ формы печатается туда, где он лежит: `schema/form.schema.json` либо, у формы
      // прежней плоской раскладки, в корень модуля. Прежнее имя — рядом с ним.
      id: 'codegen.schema',
      titleKey: 'target.schema',
      path: '{schema}',
      legacyPaths: [`{schemaDir}${LEGACY_SCHEMA_FILE}`],
      cls: 'derived',
      order: 10,
      emit: emitSchema,
    },
    {
      // Схема шага — только у визарда, разбитого по шагам: корень держит на неё ссылку,
      // относительную корневого документа, — поэтому файл лежит рядом с ним, а не в корне модуля.
      // Производная, как и корневая схема: её источник — форма в редакторе.
      id: 'codegen.step-schema',
      titleKey: 'target.step-schema',
      path: `{schemaDir}${STEP_SCHEMAS_DIR}/{stepDir}/${SCHEMA_FILE}`,
      each: 'step',
      cls: 'derived',
      order: 15,
      applies: (ctx) => ctx.step?.files.schema != null,
      emit: emitStepSchema,
    },
    {
      id: 'codegen.types',
      titleKey: 'target.types',
      path: 'types/{dir}.ts',
      cls: 'derived',
      order: 20,
      template: typesTemplate,
    },
    {
      id: 'codegen.initial',
      titleKey: 'target.initial',
      path: 'model/initial-value.ts',
      cls: 'derived',
      order: 25,
      template: initialTemplate,
    },
    {
      id: 'codegen.model',
      titleKey: 'target.model',
      path: 'model/model.ts',
      cls: 'derived',
      order: 30,
      template: modelTemplate,
    },
    {
      id: 'codegen.registry',
      titleKey: 'target.registry',
      path: 'schema/registry.ts',
      cls: 'derived',
      order: 40,
      template: registryTemplate,
    },
    {
      // Единственная сборка формы: ею пользуются и страница, и запись реестра форм.
      id: 'codegen.create',
      titleKey: 'target.create',
      path: 'application/create.ts',
      cls: 'derived',
      order: 44,
      template: createTemplate,
    },
    {
      id: 'codegen.entry',
      titleKey: 'target.entry',
      path: 'application/entry.ts',
      cls: 'derived',
      order: 47,
      template: entryTemplate,
    },
    {
      // Страница. Id прежний (`codegen.index`): роль та же — точка входа, которую монтирует
      // приложение; изменилось имя файла.
      id: 'codegen.index',
      titleKey: 'target.index',
      path: '{Type}.tsx',
      cls: 'derived',
      order: 50,
      template: pageTemplate,
    },
    {
      id: 'codegen.barrel',
      titleKey: 'target.barrel',
      path: 'index.ts',
      cls: 'derived',
      order: 55,
      template: barrelTemplate,
    },
    {
      // Поток шагов — только у визарда: порядок шагов берётся из схемы, поэтому файл производный —
      // перестановка шагов не требует ручной правки ни одного файла человека.
      id: 'codegen.flow',
      titleKey: 'target.flow',
      path: 'flow/{dir}-flow.ts',
      cls: 'derived',
      order: 60,
      applies: (ctx) => ctx.layout.kind === 'wizard',
      template: flowTemplate,
    },
    {
      id: 'codegen.data-sources',
      titleKey: 'target.data-sources',
      path: 'constants/{dir}.ts',
      cls: 'user',
      order: 70,
      template: dataSourcesTemplate,
    },
    {
      // Единственное поведение формы: связи над моделью и правила узлов схемы. Производится из
      // правил формы, поэтому несёт маркер и перезаписывается, пока его не правили руками.
      id: 'codegen.form-behavior',
      titleKey: 'target.form-behavior',
      path: 'behavior/index.ts',
      cls: 'user',
      regenerable: true,
      order: 90,
      template: formBehaviorTemplate,
    },
    {
      id: 'codegen.validation',
      titleKey: 'target.validation',
      path: 'validation/form.ts',
      cls: 'user',
      regenerable: true,
      order: 100,
      template: validationTemplate,
    },
    {
      // Правила шага: «Далее» проверяет только их. В сборку они уходят потоком шагов.
      id: 'codegen.step-validation',
      titleKey: 'target.step-validation',
      path: 'validation/{step}.ts',
      each: 'step',
      cls: 'user',
      regenerable: true,
      order: 105,
      template: stepValidationTemplate,
    },
    // Отправка и бэкенд: перевыводить их не из чего, поэтому маркера они не несут.
    {
      id: 'codegen.submit',
      titleKey: 'target.submit',
      path: 'application/submit.ts',
      cls: 'user',
      order: 108,
      template: submitTemplate,
    },
    {
      id: 'codegen.api',
      titleKey: 'target.api',
      path: 'api/index.ts',
      cls: 'user',
      order: 110,
      template: apiTemplate,
    },
    // README печатается последним не по прихоти: он перечисляет состав модуля, и состав
    // к этому моменту уже известен целиком.
    {
      id: 'codegen.readme',
      titleKey: 'target.readme',
      path: 'README.md',
      cls: 'derived',
      order: 120,
      template: readmeTemplate,
    },
  ]);

/**
 * Цели прежнего контракта, которых больше нет, и что пришло им на смену.
 *
 * Нужны ровно одному месту — разбору пользовательских шаблонов (`./user-targets`): шаблон,
 * выгруженный до перехода на единый контракт, объявляет `overrides` на одну из них. Печатать его
 * нельзя (он описывает файл, которого в модуле больше нет, и читает поля вида, которых больше
 * нет), а промолчать — значит оставить человека с правкой, которая перестала действовать.
 */
export const RETIRED_TARGETS: Readonly<Record<string, string>> = Object.freeze({
  'codegen.wizard':
    'переходника визарда (wizard.tsx) больше нет: визард — библиотечный компонент, он регистрируется в schema/registry.ts',
  'codegen.steps-index':
    'агрегатора шагов (steps/index.ts) больше нет: порядок шагов и их правила задаёт поток — flow/<форма>-flow.ts',
  'codegen.render-behavior':
    'слоя рендера (form.render.ts) больше нет: правила узлов схемы печатаются в behavior/index.ts, отправка — в application/submit.ts',
  'codegen.step-render':
    'слоя рендера шага (steps/<шаг>/form.render.ts) больше нет: правила узлов шага печатаются в behavior/index.ts',
});
