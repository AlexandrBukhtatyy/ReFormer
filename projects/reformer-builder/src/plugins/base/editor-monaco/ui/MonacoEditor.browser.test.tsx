/**
 * Подсказки в настоящем Monaco: схема провайдера модели доходит до языковой службы JSON,
 * а строки под курсором — до `completeString` порта.
 *
 * Только браузер: сопоставление схемы с документом (`fileMatch`), разрешение `$schema`
 * из текста и слияние провайдеров автодополнения делает воркер Monaco, и чистыми тестами
 * это не проверить — там можно лишь пообещать, что адреса совпадут.
 *
 * @module plugins/base/editor-monaco/ui/MonacoEditor.browser.test
 */

import { describe, expect, it } from 'vitest';
import type {
  JsonSchemaHint,
  ResourceId,
  TextCompletion,
  TextStringSite,
} from '@reformer/builder-plugin-api';
import { renderReact } from '@/testing/render';
import type { MonacoHost } from '../host';
import { ensureMonaco } from '../runtime/monaco-setup';
import { MonacoEditorBody } from './MonacoEditor';

const SCHEMA: JsonSchemaHint = {
  uri: 'inmemory://schema/test-form.json',
  // Как у мета-схемы рендерера: свой сетевой `$id` и узел через локальный `$ref`. Такая схема
  // подсказывает, только если `$ref` не уходит по `$id` в сеть, — ради этого случая тест и есть.
  schema: {
    $id: 'https://reformer.dev/schemas/form-schema.schema.json',
    type: 'object',
    properties: { root: { $ref: '#/definitions/node' } },
    definitions: {
      node: {
        type: 'object',
        properties: {
          component: { enum: ['$component(Input)', '$component(Select)'] },
          value: { type: 'string' },
        },
      },
    },
  },
};

const NOOP = { dispose() {} };

function hostFor(id: ResourceId, path: string, text: string, sites: TextStringSite[]): MonacoHost {
  return {
    useTranslate: () => (key) => key,
    useDiagnosticMessage: () => (key) => key,
    documentOf: (documentId) =>
      documentId === id
        ? {
            ref: {
              id,
              sourceId: 'fs',
              path,
              name: path.split('/').pop() ?? path,
              kind: 'file',
              mediaType: 'application/json',
            },
            getText: () => text,
            onDidChangeContent: () => NOOP,
          }
        : null,
    writeText: () => Promise.resolve(),
    isTextual: () => true,
    diagnostics: { get: () => [], onDidChange: () => NOOP },
    jsonSchemaFor: () => SCHEMA,
    onDidChangeJsonSchema: () => NOOP,
    completeString: (_documentId, site): TextCompletion[] => {
      sites.push(site);
      return site.value.startsWith('$model(')
        ? [{ label: 'fullName', insert: 'fullName', replace: { start: 7, end: 7 } }]
        : [];
    },
  };
}

const focus = { isFocused: () => false, setFocused: () => {}, hasFocus: () => false };
const viewStates = { record: () => {}, peek: () => null, forget: () => {} };

/** Ждёт условия опросом: воркер JSON отвечает асинхронно и не сообщает о готовности. */
async function waitFor<T>(read: () => T | null | undefined, timeout = 8000): Promise<T> {
  const until = Date.now() + timeout;
  for (;;) {
    const value = read();
    if (value !== null && value !== undefined) return value;
    if (Date.now() > until) throw new Error('не дождались');
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

/** Монтирует редактор, ставит курсор после `marker` и открывает список подсказок. */
async function suggestAt(path: string, text: string, marker: string, sites: TextStringSite[] = []) {
  const id = `fs:${path}`;
  renderReact(
    <div style={{ width: 600, height: 300, display: 'flex' }}>
      <MonacoEditorBody
        host={hostFor(id, path, text, sites)}
        focus={focus}
        viewStates={viewStates}
        documentId={id}
      />
    </div>
  );
  const monaco = await ensureMonaco();
  const editor = await waitFor(() =>
    monaco.editor.getEditors().find((candidate) => candidate.getModel()?.uri.path.endsWith(path))
  );
  const model = await waitFor(() => editor.getModel());
  const position = model.getPositionAt(text.indexOf(marker) + marker.length);
  editor.focus();
  editor.setPosition(position);
  editor.trigger('test', 'editor.action.triggerSuggest', {});

  const labels = await waitFor(() => {
    const rows = [...document.querySelectorAll('.suggest-widget .monaco-list-row')];
    return rows.length === 0 ? null : rows.map((row) => row.textContent ?? '');
  });
  editor.trigger('test', 'hideSuggestWidget', {});
  return labels;
}

describe('подсказки в Monaco', () => {
  it('схема провайдера: допустимые значения ключа', async () => {
    const text = '{\n  "root": {\n    "component": ""\n  }\n}\n';
    const labels = await suggestAt('forms/plain/form.json', text, '"component": "');
    expect(labels.some((label) => label.includes('$component(Input)'))).toBe(true);
  });

  it('$schema в документе не отключает подсказки', async () => {
    const text =
      '{\n  "$schema": "./form-schema.schema.json",\n  "root": {\n    "component": ""\n  }\n}\n';
    const labels = await suggestAt('forms/declared/form.json', text, '"component": "');
    expect(labels.some((label) => label.includes('$component(Select)'))).toBe(true);
  });

  it('строка под курсором уходит порту, ответ показывается', async () => {
    const sites: TextStringSite[] = [];
    const text = '{\n  "root": {\n    "value": "$model()"\n  }\n}\n';
    const labels = await suggestAt('forms/model/form.json', text, '"value": "$model(', sites);
    expect(labels.some((label) => label.includes('fullName'))).toBe(true);
    expect(sites[0]).toEqual({ path: ['root', 'value'], value: '$model()', offset: 7 });
  });
});
