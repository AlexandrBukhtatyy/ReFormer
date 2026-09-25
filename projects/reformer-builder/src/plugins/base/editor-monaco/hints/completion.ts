/**
 * Подсказки в строковых значениях JSON: мост от Monaco к провайдеру модели документа.
 *
 * Провайдер автодополнения у Monaco ГЛОБАЛЕН — один на язык, а не на редактор, — поэтому
 * регистрируется он один раз на экземпляр Monaco, а документы подключаются к нему по адресу
 * модели. Что подсказать, решает провайдер модели документа (порт `completeString`): где строка
 * под курсором — знает этот модуль, что в ней уместно — только формат.
 *
 * Служба JSON со своими подсказками по схеме работает рядом: провайдеров у языка может быть
 * несколько, и Monaco сливает их ответы.
 *
 * @module plugins/base/editor-monaco/hints/completion
 */

import type { editor as MonacoEditor, languages, Position } from 'monaco-editor';
import type { Disposable, TextCompletion, TextStringSite } from '@reformer/builder-plugin-api';
import type { MonacoApi } from '../runtime/monaco-runtime';
import { stringSiteAt } from '../diagnostics/node-ranges';

/** Что подсказать в строке документа. */
export type StringCompleter = (site: TextStringSite) => readonly TextCompletion[];

export interface StringCompletions {
  /** Подключить документ с адресом модели `modelUri`. Снятие — `dispose` результата. */
  bind(modelUri: string, complete: StringCompleter): Disposable;
}

/**
 * Символы, после которых список открывается сам: `(` — вошли в оператор, `"` и `$` — начали
 * значение привязки, `.` — шаг вглубь пути.
 */
const TRIGGERS = ['(', '"', '$', '.'];

const registries = new WeakMap<object, StringCompletions>();

/**
 * Подсказки Monaco по готовым ответам провайдера: смещения внутри строки → координаты модели.
 *
 * Отдельно от регистрации ради теста: перевод координат умеет только модель, и в тесте она
 * подменяется парой функций.
 */
export function toSuggestions(
  site: { readonly start: number },
  items: readonly TextCompletion[],
  model: Pick<MonacoEditor.ITextModel, 'getPositionAt'>,
  kind: languages.CompletionItemKind
): languages.CompletionItem[] {
  return items.map((item, index) => {
    const start = model.getPositionAt(site.start + item.replace.start);
    const end = model.getPositionAt(site.start + item.replace.end);
    return {
      label: item.detail === undefined ? item.label : { label: item.label, detail: item.detail },
      kind,
      insertText: item.insert,
      // Порядок провайдера — осмысленный (порядок обхода формы); алфавит Monaco его бы сломал.
      sortText: String(index).padStart(5, '0'),
      range: {
        startLineNumber: start.lineNumber,
        startColumn: start.column,
        endLineNumber: end.lineNumber,
        endColumn: end.column,
      },
    };
  });
}

/** Реестр подсказок для экземпляра Monaco; провайдер регистрируется при первом обращении. */
export function stringCompletionsFor(monaco: MonacoApi): StringCompletions {
  const existing = registries.get(monaco);
  if (existing !== undefined) return existing;

  const bound = new Map<string, StringCompleter>();
  monaco.languages.registerCompletionItemProvider('json', {
    triggerCharacters: TRIGGERS,
    provideCompletionItems(model: MonacoEditor.ITextModel, position: Position) {
      const complete = bound.get(model.uri.toString());
      if (complete === undefined) return { suggestions: [] };
      const site = stringSiteAt(model.getValue(), model.getOffsetAt(position));
      if (site === null) return { suggestions: [] };
      const items = complete({ path: site.path, value: site.value, offset: site.offset });
      return {
        suggestions: toSuggestions(site, items, model, monaco.languages.CompletionItemKind.Value),
      };
    },
  });

  const registry: StringCompletions = {
    bind(modelUri, complete) {
      bound.set(modelUri, complete);
      return {
        dispose() {
          if (bound.get(modelUri) === complete) bound.delete(modelUri);
        },
      };
    },
  };
  registries.set(monaco, registry);
  return registry;
}
