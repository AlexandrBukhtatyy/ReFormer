/**
 * Валидатор домена RJSF: находки `checkRjsfForm` — в общий свод диагностик.
 *
 * Коды несут владельца (`reformer.rjsf.editor:order-missing`): тексты лежат в словаре ЭТОГО
 * плагина, оболочка ошибок домена не знает. Цель находки — место в тексте, где написано имя:
 * ключ поля в `schema.properties`, имя в `schema.required` или в `uiSchema["ui:order"]`.
 *
 * `ui:widget` сверяется с тем, что форма сейчас умеет нарисовать: реестр RJSF и поля активного
 * кита (тема делает каждое поле кита виджетом под его именем). Пока каталог кита не доехал,
 * виджеты не проверяются — иначе каждое имя кита было бы ложной находкой; доезд каталога
 * перепроверяет документ (`onDidChangeInputs`).
 *
 * @module plugins/rjsf/editor/validator
 */

import {
  checkRjsfForm,
  isRjsfForm,
  RJSF_PROVIDER_ID,
  RJSF_STANDARD_WIDGETS,
  type RjsfProblem,
} from '@/plugins/rjsf/core';
import {
  pluginDiagnosticCode,
  type Diagnostic,
  type DocumentRef,
  type KitsService,
  type TextRange,
  type ValidatorContribution,
} from '@reformer/builder-plugin-api';
import { RJSF_EDITOR_PLUGIN_ID, RJSF_VALIDATOR_ID } from './contract';

/** Разделитель сегментов пути: в именах полей его не бывает. */
const SEP = '\u0000';

interface Container {
  readonly kind: 'object' | 'array';
  readonly path: string;
  expectKey: boolean;
  key: string;
  index: number;
}

/**
 * Где в JSON-тексте написаны ключи и строковые элементы массивов — по их пути.
 *
 * Ключ: `schema␀properties␀name` → диапазон ключа `"name"`. Элемент массива:
 * `schema␀required=name` → первое вхождение строки `"name"` в массиве. Диапазон — вместе с
 * кавычками, так пустое имя тоже видно. Путь, а не поиск по тексту: поле `title` не должно
 * найтись в `"title"` соседнего поля.
 */
export function locateNames(text: string): ReadonlyMap<string, TextRange> {
  const found = new Map<string, TextRange>();
  const stack: Container[] = [];
  const join = (path: string, segment: string) =>
    path === '' ? segment : `${path}${SEP}${segment}`;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const top = stack[stack.length - 1];
    if (ch === '"') {
      let end = i + 1;
      while (end < text.length && text[end] !== '"') end += text[end] === '\\' ? 2 : 1;
      let value = '';
      try {
        value = JSON.parse(text.slice(i, end + 1)) as string;
      } catch {
        // Битая строка — буфер не разбирается, и находок по нему не будет.
      }
      const range = { start: i, end: end + 1 };
      if (top?.kind === 'object' && top.expectKey) {
        top.key = value;
        top.expectKey = false;
        const path = join(top.path, value);
        if (!found.has(path)) found.set(path, range);
      } else if (top?.kind === 'array') {
        const path = `${top.path}=${value}`;
        if (!found.has(path)) found.set(path, range);
      }
      i = end;
    } else if (ch === '{' || ch === '[') {
      const path =
        top === undefined
          ? ''
          : join(top.path, top.kind === 'object' ? top.key : String(top.index));
      stack.push({
        kind: ch === '{' ? 'object' : 'array',
        path,
        expectKey: ch === '{',
        key: '',
        index: 0,
      });
    } else if (ch === '}' || ch === ']') {
      stack.pop();
    } else if (ch === ',' && top !== undefined) {
      if (top.kind === 'object') top.expectKey = true;
      else top.index += 1;
    }
  }
  return found;
}

/** Место находки в тексте документа. */
function problemPath(problem: RjsfProblem): string | undefined {
  const name = String(problem.params.name ?? problem.field ?? '');
  switch (problem.code) {
    case 'required-unknown':
      return `schema${SEP}required=${name}`;
    case 'order-unknown':
      return `uiSchema${SEP}ui:order=${name}`;
    default:
      return problem.field === undefined
        ? undefined
        : `schema${SEP}properties${SEP}${problem.field}`;
  }
}

/**
 * Виджеты, которые форма умеет нарисовать: реестр RJSF и поля активного кита. `undefined` —
 * не известно (каталог кита ещё едет), и виджеты не проверяются.
 */
export function availableWidgets(kits: KitsService | undefined): ReadonlySet<string> | undefined {
  if (kits === undefined) return new Set(RJSF_STANDARD_WIDGETS);
  const components = kits.catalogJson().components;
  if (components.length === 0) return undefined;
  return new Set([
    ...RJSF_STANDARD_WIDGETS,
    ...components.filter((record) => record.role === 'field').map((record) => record.name),
  ]);
}

export function createRjsfValidator(kits: () => KitsService | undefined): ValidatorContribution {
  return {
    id: RJSF_VALIDATOR_ID,
    applies: (doc: DocumentRef) => doc.providerId === RJSF_PROVIDER_ID,
    validate(ctx): readonly Diagnostic[] {
      const model = ctx.model();
      // Модели нет — буфер не разбирается; об этом уже сказал разбор, повторять незачем.
      if (!isRjsfForm(model)) return [];
      const widgets = availableWidgets(kits());
      const problems = checkRjsfForm(model, widgets === undefined ? {} : { widgets });
      if (problems.length === 0) return [];
      const names = locateNames(ctx.text());
      return problems.map((problem) => {
        const path = problemPath(problem);
        const range = path === undefined ? undefined : names.get(path);
        return {
          source: RJSF_VALIDATOR_ID,
          severity: problem.severity,
          code: pluginDiagnosticCode(RJSF_EDITOR_PLUGIN_ID, problem.code),
          params: problem.params,
          target: range === undefined ? { kind: 'resource' } : { kind: 'range', range },
        };
      });
    },
    // Смена кита или доезд его каталога меняет набор виджетов — перепроверить открытые формы.
    onDidChangeInputs: (cb) => kits()?.onDidChange(cb) ?? { dispose: () => {} },
  };
}
