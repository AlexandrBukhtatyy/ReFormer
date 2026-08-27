/**
 * `FormIntent` → форма редактора: схема разметки плюс правила.
 *
 * Мост между тем, что MCP умеет вывести из спеки, и тем, чем оперирует билдер. Разметку строит
 * сам MCP (`buildLayoutJson`) — заводить второй генератор layout здесь было бы той же ошибкой,
 * от которой уже отказались в `codegen/emit-rules.ts`: два комплекта расходятся на первой же
 * правке и расходятся молча. Правила переносятся один в один, потому что `FormRules` собран
 * из тех же типов `FormIntent`.
 *
 * Единственное, что здесь действительно ПЕРЕВОДИТСЯ, — имена компонентов. MCP адресует массивы
 * `$component(FormArray)`: он генерирует проект, где реестр импортирует одноимённый компонент
 * из `@reformer/ui-kit`, и для той задачи это верно. Билдер же адресует array-узлы ключом
 * своего реестра — `List` (`preview-runtime/known-names.ts`), а `FormArray` — единственное имя
 * из словаря MCP, которого нет среди известных билдеру. Навязать одному потребителю словарь
 * другого нельзя: сломается второй. Поэтому перевод живёт на мосту, у импортёра.
 *
 * @module reformer-builder/model/from-intent
 */

import { buildLayoutJson } from '@reformer/mcp/dist/core/generate/builders.js';
import type { FormIntent } from '@reformer/mcp/dist/core/generate/form-intent.js';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { knownComponentNames } from '../preview-runtime/known-names';
import { emptyRules, renderRuleFromVisibility, type FormRules } from './rules';

/**
 * Имена компонентов, которые MCP пишет в разметку, но билдер знает под другим именем.
 * Таблица намеренно крошечная: каждая запись — расхождение словарей, а не удобство.
 */
const RENAME: Record<string, string> = {
  // Редактируемый массив: у MCP — компонент ui-kit, у билдера — ключ реестра.
  FormArray: 'List',
};

export interface FormFromIntent {
  schema: JsonFormSchema;
  rules: FormRules;
  /**
   * Что осталось непереведённым или пришло из самого intent. Это не косметика: форма
   * с неизвестным компонентом откроется, но не отрисуется, и пользователь должен узнать об
   * этом от нас, а не от пустого места на канвасе.
   */
  warnings: string[];
}

export function formFromIntent(intent: FormIntent): FormFromIntent {
  const schema = JSON.parse(buildLayoutJson(intent)) as JsonFormSchema;
  const warnings = [...(intent.warnings ?? [])];

  const known = new Set(knownComponentNames());
  const unknown = new Set<string>();
  renameComponents(schema as unknown, known, unknown);

  for (const name of unknown) {
    warnings.push(
      `Компонент \`${name}\` неизвестен редактору — узел откроется, но не отрисуется. ` +
        'Замените его на компонент из палитры.'
    );
  }

  return {
    schema,
    rules: {
      ...emptyRules(),
      validation: [...intent.validation],
      behavior: [...intent.behavior],
      render: intent.visibility.map(renderRuleFromVisibility),
    },
    warnings,
  };
}

/** Обход разметки: перевод известных расхождений, сбор всего остального неизвестного. */
function renameComponents(node: unknown, known: Set<string>, unknown: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) renameComponents(item, known, unknown);
    return;
  }
  if (node === null || typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;
  const component = obj.component;
  if (typeof component === 'string') {
    const m = component.match(/^\$component\(([^)]*)\)$/);
    if (m) {
      const name = RENAME[m[1]] ?? m[1];
      if (name !== m[1]) obj.component = `$component(${name})`;
      // `$html(...)` сюда не попадает по построению: у него другой оператор и своя проверка.
      if (!known.has(name)) unknown.add(name);
    }
  }

  for (const value of Object.values(obj)) renameComponents(value, known, unknown);
}
