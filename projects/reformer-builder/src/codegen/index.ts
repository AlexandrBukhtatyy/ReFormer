/**
 * Кодоген полноценного примера формы (renderer-json) из схемы + мока билдера. Чистое ядро (без
 * DOM/FS): `buildExampleFiles` возвращает файлы в памяти; доставка/форматирование — снаружи.
 *
 * Классы файлов: `derived` (перезаписываются при регенерации) и `user` (пишутся один раз —
 * реализованные пользователем методы не затираются).
 *
 * @module reformer-builder/codegen
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { isStepsHostName } from '../model';
import { hasBehaviorRules, hasValidationRules, type FormRules } from '../model/rules';
import type { MockData } from '../preview-runtime/mock-synth';
import { assignSelectors } from './assign-selectors';
import { collect } from './collect';
import { makeNames } from './naming';
import { emitSchema } from './emit-schema';
import { emitTypes } from './emit-types';
import { emitModel } from './emit-model';
import { emitRegistry } from './emit-registry';
import { emitIndex } from './emit-index';
import { emitReadme } from './emit-readme';
import { emitDataSources } from './emit-data-sources';
import { emitBehavior } from './emit-behavior';
import { emitFormBehavior } from './emit-form-behavior';
import { emitFormBehaviorFromRules, emitValidationFromRules } from './emit-rules';
import { emitValidation } from './emit-validation';
import { emitApi } from './emit-api';
import { emitWizard } from './emit-wizard';

export type FileClass = 'derived' | 'user';

export interface FileOut {
  /** Путь относительно папки примера. */
  path: string;
  content: string;
  /** derived — перезаписывать; user — писать один раз (skip-if-exists). */
  cls: FileClass;
}

/** Построить все файлы примера из схемы + мока. Детерминированно при детерминированном моке. */
export function buildExampleFiles(
  rawSchema: JsonFormSchema,
  mock: MockData,
  formName: string,
  rules?: FormRules
): FileOut[] {
  const names = makeNames(formName);
  const { schema, info } = assignSelectors(rawSchema);
  const c = collect(schema, mock);
  // Шим визарда — опциональный файл канона: он появляется ровно у той формы, где есть
  // `$component(Wizard)`. Без него экспорт визарда уезжал с `reg.component('Wizard', Placeholder)`.
  const hasWizard = c.components.some(isStepsHostName);

  return [
    { path: 'renderer.schema.json', content: emitSchema(schema), cls: 'derived' },
    { path: 'types.ts', content: emitTypes(c, names), cls: 'derived' },
    { path: 'model.ts', content: emitModel(mock, names), cls: 'derived' },
    { path: 'registry.ts', content: emitRegistry(c), cls: 'derived' },
    { path: 'index.tsx', content: emitIndex(names), cls: 'derived' },
    { path: 'README.md', content: emitReadme(names, info, c), cls: 'derived' },
    { path: 'data-sources.ts', content: emitDataSources(c, mock), cls: 'user' },
    { path: 'renderer.behavior.ts', content: emitBehavior(names, info, rules), cls: 'user' },
    // Есть правила — собираем из них (билдерами MCP); нет — прежние заглушки с примерами.
    // Форма без правил валидна, и генерироваться она обязана в компилируемый код.
    //
    // Вопрос задаётся КАЖДОМУ файлу отдельно: правила одного вида ничего не говорят о другом,
    // а общий признак подменял богатую заглушку пустой и терял выведенные из схемы `required`.
    {
      path: 'form.behavior.ts',
      content: hasBehaviorRules(rules)
        ? emitFormBehaviorFromRules(rules!, names)
        : emitFormBehavior(names),
      cls: 'user',
    },
    {
      path: 'validation.ts',
      content: hasValidationRules(rules)
        ? emitValidationFromRules(rules!, names)
        : emitValidation(c, names),
      cls: 'user',
    },
    { path: 'api.ts', content: emitApi(names), cls: 'user' },
    ...(hasWizard
      ? [{ path: 'renderer.wizard.tsx', content: emitWizard(names), cls: 'derived' as const }]
      : []),
  ];
}

export { makeNames, type Names } from './naming';
export { appSnippet } from './app-snippet';
export { validateExportable, type ExportReport } from './validate-exportable';
export { assignSelectors } from './assign-selectors';
