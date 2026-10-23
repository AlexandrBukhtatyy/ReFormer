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
  messagesTemplate,
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
  isFlatLayoutPath,
  LEGACY_SCHEMA_FILE,
  SCHEMA_FILE,
  STEP_SCHEMAS_DIR,
} from '../../../core/codegen';
import type { CodegenTarget as SdkTarget } from '@reformer/builder-plugin-api';
import type { CodegenTarget } from './generate';

/**
 * Имя стека ReFormer в генерации кода: им помечены его цели (`CodegenTarget.stack`) и под ним
 * он стоит в точке стеков. Хозяин генерации отдаёт стеку только его цели и общие.
 */
export const CODEGEN_STACK_ID = 'reformer';

/**
 * Встроенные цели в порядке раскладки модуля: производные файлы, затем авторские.
 *
 * `order` разрежен: между любыми двумя нашими целями помещается чужая, и вставка не требует
 * перенумеровать соседей. Цели шагов визарда встают рядом с файлами формы того же слоя (`15`,
 * `105`), словарь замечаний — сразу за валидацией формы (`102`).
 *
 * Id целей сохранены там, где роль файла та же: пользовательские шаблоны заменяют цель по id
 * (`overrides`). Новые цели — `codegen.initial`, `codegen.create`, `codegen.entry`,
 * `codegen.barrel`, `codegen.flow`, `codegen.submit`, `codegen.messages`. Снятые — в
 * {@link RETIRED_TARGETS}.
 */
export const BUILTIN_TARGETS: readonly (CodegenTarget & { readonly order: number })[] =
  Object.freeze([
    {
      // Документ формы печатается туда, где он лежит: `schema/form.schema.json` либо, у формы
      // прежней плоской раскладки, в корень модуля. Прежнее имя — рядом с ним.
      id: 'codegen.schema',
      stack: CODEGEN_STACK_ID,
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
      stack: CODEGEN_STACK_ID,
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
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.types',
      path: 'types/{dir}.ts',
      cls: 'derived',
      order: 20,
      template: typesTemplate,
    },
    {
      id: 'codegen.initial',
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.initial',
      path: 'model/initial-value.ts',
      cls: 'derived',
      order: 25,
      template: initialTemplate,
    },
    {
      id: 'codegen.model',
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.model',
      path: 'model/model.ts',
      cls: 'derived',
      order: 30,
      template: modelTemplate,
    },
    {
      id: 'codegen.registry',
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.registry',
      path: 'schema/registry.ts',
      cls: 'derived',
      order: 40,
      template: registryTemplate,
    },
    {
      // Единственная сборка формы: ею пользуются и страница, и запись реестра форм.
      id: 'codegen.create',
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.create',
      path: 'application/create.ts',
      cls: 'derived',
      order: 44,
      template: createTemplate,
    },
    {
      id: 'codegen.entry',
      stack: CODEGEN_STACK_ID,
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
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.index',
      path: '{Type}.tsx',
      cls: 'derived',
      order: 50,
      template: pageTemplate,
    },
    {
      id: 'codegen.barrel',
      stack: CODEGEN_STACK_ID,
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
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.flow',
      path: 'flow/{dir}-flow.ts',
      cls: 'derived',
      order: 60,
      applies: (ctx) => ctx.layout.kind === 'wizard',
      template: flowTemplate,
    },
    {
      id: 'codegen.data-sources',
      stack: CODEGEN_STACK_ID,
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
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.form-behavior',
      path: 'behavior/index.ts',
      cls: 'user',
      regenerable: true,
      order: 90,
      template: formBehaviorTemplate,
    },
    {
      id: 'codegen.validation',
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.validation',
      path: 'validation/form.ts',
      cls: 'user',
      regenerable: true,
      order: 100,
      template: validationTemplate,
    },
    {
      // Тексты замечаний — словарь формы. Авторский и без маркера: тексты пишет человек, и
      // перезапись при смене правил стёрла бы его формулировки. Новый код замечания, которого в
      // словаре нет, показывается текстом локали — форма от этого не ломается.
      id: 'codegen.messages',
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.messages',
      path: 'validation/messages.ts',
      cls: 'user',
      order: 102,
      template: messagesTemplate,
    },
    {
      // Правила шага: «Далее» проверяет только их. В сборку они уходят потоком шагов.
      id: 'codegen.step-validation',
      stack: CODEGEN_STACK_ID,
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
      stack: CODEGEN_STACK_ID,
      titleKey: 'target.submit',
      path: 'application/submit.ts',
      cls: 'user',
      order: 108,
      template: submitTemplate,
    },
    {
      id: 'codegen.api',
      stack: CODEGEN_STACK_ID,
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
      stack: CODEGEN_STACK_ID,
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
 * Нужны ровно одному месту — устареванию замен ({@link staleOverride}): шаблон,
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

/**
 * Замена устарела: написана под ПРЕЖНИЙ контракт кода — крючок стека для правила замен хозяина.
 *
 * Шаблон, выгруженный до перехода на единый контракт и папки ролей, узнаётся по заголовку:
 *
 * - заменяет цель, которой больше нет ({@link RETIRED_TARGETS}: шим визарда, агрегатор шагов,
 *   слой рендера);
 * - заменяет живую цель, но печатает по пути плоской раскладки (`registry.ts` вместо
 *   `schema/registry.ts`).
 *
 * В обоих случаях его тело писалось под прежний вид (`it.wizard`, `it.layout.imports`,
 * `it.renderBehavior`) и под прежний контракт сборки: отрисовать его нечем, а напечатанный им
 * файл модуль не импортирует. Применить такую замену значило бы ещё и снять встроенную цель — то
 * есть оставить модуль без файла, который он импортирует. Поэтому замена не печатается, а текст
 * причины панель показывает рядом с отказами целей.
 */
export function staleOverride(target: SdkTarget, replaced: SdkTarget | undefined): string | null {
  if (target.overrides === undefined) return null;
  if (Object.hasOwn(RETIRED_TARGETS, target.overrides)) {
    return (
      `«${target.id}» заменяет цель «${target.overrides}», которой больше нет: ` +
      `${RETIRED_TARGETS[target.overrides]}. Шаблон не применён — перенесите правки и удалите его.`
    );
  }
  if (replaced === undefined || replaced.path === target.path) return null;
  if (!isFlatLayoutPath(target.path)) return null;
  return (
    `«${target.id}» заменяет «${replaced.id}», но написан под прежнюю плоскую раскладку: ` +
    `печатает «${target.path}», а модуль теперь импортирует «${replaced.path}». Шаблон не ` +
    'применён — модуль напечатан встроенным. Выгрузите шаблон заново и перенесите в него правки.'
  );
}
