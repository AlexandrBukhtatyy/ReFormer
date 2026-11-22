/**
 * Структурный режим стека: запись хода — визард, появившийся в ходе, ложится по файлам шагов.
 *
 * Печать модуля после хода с настоящей генерацией проверяет интеграция
 * (`reformer/integration/assistant-bridge.test`).
 *
 * @module plugins/reformer/ai/stack/structured.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import type { FormDocumentDoor, FormWriteMark } from '@reformer/builder-plugin-api';
import { builtinEntries } from '../../../core/testing';
import { emptySchema } from '../../../core/form-model';
import { printSchemaText } from '../model/schema-text';
import { createEditorToolRegistry } from '../tools/registry';
import type { ToolContext } from '../model/types';
import { createStructuredMode } from './structured';
import { createFakeDocuments, createFakeFiles } from './testing';
import type { FormSplitWriter } from './workspace';

const DOC = 'forms/quiz/schema/form.schema.json';
const tools = createEditorToolRegistry();

/** Визард с одним шагом и полем в нём. */
const WIZARD_FORM = {
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        component: '$component(Wizard)',
        children: [
          {
            component: '$component(Step)',
            componentProps: { title: 'Имя' },
            children: [{ component: '$component(Input)', model: '$model(name)' }],
          },
        ],
      },
    ],
  },
} as unknown as JsonFormSchema;

interface Bench {
  readonly split?: FormSplitWriter | null;
  readonly door?: FormDocumentDoor | null;
}

/** Режим над формой `schema`: ход вставляет `nodes` в `parent` и записывается. */
async function landInsert(
  schema: JsonFormSchema,
  parent: string,
  nodes: readonly object[],
  bench: Bench = {}
) {
  const files = createFakeFiles({ [DOC]: printSchemaText(schema) });
  const documents = createFakeDocuments(files);
  const calls: { text: string; mark?: FormWriteMark }[] = [];
  const split: FormSplitWriter | null =
    bench.split === undefined
      ? async (text, mark) => {
          calls.push({ text, ...(mark === undefined ? {} : { mark }) });
          await documents.writeText(DOC, text, mark);
        }
      : bench.split;
  const mode = createStructuredMode({
    stack: 'reformer',
    host: { documentOf: documents.documentOf, writeText: documents.writeText, files },
    tools: [],
    catalog: () => builtinEntries(),
    validateForm: () => Promise.resolve(validateFormSchema),
    prepared: () => validateFormSchema,
    door: () => bench.door ?? null,
    splitWriter: () => split,
    refuse: () => null,
  });

  const loaded = await mode.load({ resource: DOC, path: DOC, text: printSchemaText(schema) });
  if (loaded === null) throw new Error('форма не разобралась');
  const turn = mode.begin(loaded);
  const outcome = await tools.invoke(
    'insert_node',
    { parent, nodes },
    turn.context() as ToolContext
  );
  expect(outcome.ok, outcome.text).toBe(true);
  turn.accept?.(outcome);
  const landed = await mode.land({
    loaded,
    set: turn.result(),
    mark: { origin: 'agent', txId: 't1' },
    force: false,
  });
  return { landed, calls, documents };
}

const wizard = {
  component: 'Wizard',
  children: [
    {
      component: 'Step',
      props: { title: 'Имя' },
      children: [{ component: 'Input', model: 'name' }],
    },
    {
      component: 'Step',
      props: { title: 'Почта' },
      children: [{ component: 'Input', model: 'email' }],
    },
  ],
};

describe('визард хода — по файлам шагов', () => {
  it('визард появился в ходе — форма пишется с разбиением, той же пометкой хода', async () => {
    const { landed, calls, documents } = await landInsert(emptySchema(), '/root', [wizard]);

    expect(landed.status).toBe('applied');
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain('$component(Wizard)');
    expect(calls[0].mark).toEqual({ origin: 'agent', txId: 't1' });
    // Запись одна — та, что разносит шаги; второй записи текстом нет.
    expect(documents.writes).toHaveLength(1);
  });

  it('визард был до хода и лежит одним файлом — не разбивается: его могли собрать намеренно', async () => {
    const { calls, documents } = await landInsert(WIZARD_FORM, '/root/children/0/children/0', [
      { component: 'Input', model: 'phone' },
    ]);

    expect(calls).toHaveLength(0);
    expect(documents.writes).toHaveLength(1);
  });

  it('форма уже составная — пишется своей дверью, повторно не разбивается', async () => {
    const door: FormDocumentDoor = {
      getText: () => printSchemaText(emptySchema()),
      write: vi.fn(() => Promise.resolve()),
    };
    const { calls } = await landInsert(emptySchema(), '/root', [wizard], { door });

    expect(calls).toHaveLength(0);
    expect(door.write).toHaveBeenCalledTimes(1);
  });

  it('разносить нечем — визард ложится одним файлом, ход не падает', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const { landed, documents } = await landInsert(emptySchema(), '/root', [wizard], {
      split: null,
    });

    expect(landed.status).toBe('applied');
    expect(documents.writes).toHaveLength(1);
    expect(info).toHaveBeenCalledWith(expect.stringContaining('одним файлом'));
    info.mockRestore();
  });
});
