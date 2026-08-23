import { beforeEach, describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { editorActions, editorStore, activeTab, initialState } from '../store';
import { emptySchema } from '../model';
import { sampleSchema } from '../model/__fixtures__/sample-schema';
import { applyChangeSet, isStale } from './apply';
import { createChangeSet, withOutcome, type ChangeSet } from './core/changeset';
import { createEditorToolRegistry } from './core';

const reg = createEditorToolRegistry();

/** Открыть форму во вкладке и вернуть её схему. */
function openForm(schema: JsonFormSchema = emptySchema()): JsonFormSchema {
  editorStore.setState(initialState());
  editorActions.openTab('t1', { kind: 'new', name: 'form.json' }, schema);
  return activeTab(editorStore.getState())!.schema;
}

/** Набор изменений: одно добавленное поле поверх базы. */
async function oneChange(base: JsonFormSchema): Promise<ChangeSet> {
  const outcome = await reg.invoke(
    'insert_node',
    { parent: '/root', nodes: [{ component: 'Input', model: 'x', props: { label: 'Поле' } }] },
    { draft: base, base }
  );
  expect(outcome.error?.code, outcome.text).toBeUndefined();
  return withOutcome(createChangeSet(base), outcome);
}

beforeEach(() => {
  editorStore.setState(initialState());
});

describe('applyChangeSet', () => {
  it('применяет черновик к активной вкладке', async () => {
    const base = openForm();
    expect(applyChangeSet(await oneChange(base))).toEqual({ status: 'applied' });
    const tab = activeTab(editorStore.getState())!;
    expect((tab.schema.root as { children: unknown[] }).children).toHaveLength(1);
  });

  it('весь ход отменяется ОДНИМ undo', async () => {
    const base = openForm();
    // Набор из трёх правок — в истории обязана появиться ровно одна запись.
    let set = createChangeSet(base);
    for (const label of ['Имя', 'Email', 'Телефон']) {
      const outcome = await reg.invoke(
        'insert_node',
        { parent: '/root', nodes: [{ component: 'Input', model: label, props: { label } }] },
        { draft: set.draft, base }
      );
      set = withOutcome(set, outcome);
    }
    const before = activeTab(editorStore.getState())!.past.length;

    expect(applyChangeSet(set).status).toBe('applied');
    expect(activeTab(editorStore.getState())!.past.length).toBe(before + 1);

    editorActions.undo();
    expect(activeTab(editorStore.getState())!.schema).toBe(base);
  });

  it('пустой набор не трогает историю', () => {
    const base = openForm();
    expect(applyChangeSet(createChangeSet(base))).toEqual({ status: 'empty' });
    expect(activeTab(editorStore.getState())!.past).toHaveLength(0);
  });

  it('правка формы во время хода даёт конфликт, а не молчаливую перезапись', async () => {
    const base = openForm();
    const set = await oneChange(base);

    // Пользователь тем временем правит форму сам.
    editorActions.replaceSchema(sampleSchema());

    expect(applyChangeSet(set)).toEqual({ status: 'conflict' });
    expect(isStale(set)).toBe(true);
    // Схема пользователя цела.
    expect(activeTab(editorStore.getState())!.schema).not.toBe(set.draft);
  });

  it('force применяет поверх конфликта — это осознанный выбор пользователя', async () => {
    const base = openForm();
    const set = await oneChange(base);
    editorActions.replaceSchema(sampleSchema());

    expect(applyChangeSet(set, { force: true })).toEqual({ status: 'applied' });
    expect(activeTab(editorStore.getState())!.schema).toBe(set.draft);
  });

  it('невалидный черновик не применяется даже при force — строгий гейт барьер', () => {
    const base = openForm();
    const broken = {
      ...base,
      root: {
        component: '$component(Box)',
        children: [{ value: '$model(x)', component: '$component(ВыдуманныйКомпонент)' }],
      },
    } as unknown as JsonFormSchema;
    const set: ChangeSet = { base, draft: broken, ops: [] };

    const outcome = applyChangeSet(set, { force: true });
    expect(outcome.status).toBe('invalid');
    if (outcome.status === 'invalid') {
      expect(outcome.errors.join('\n')).toContain('ВыдуманныйКомпонент');
    }
    expect(activeTab(editorStore.getState())!.schema).toBe(base);
  });

  it('без открытой формы применять некуда', async () => {
    const set = await oneChange(emptySchema());
    editorStore.setState(initialState());
    expect(applyChangeSet(set)).toEqual({ status: 'no-form' });
  });

  it('на code-вкладке применять некуда', async () => {
    const set = await oneChange(emptySchema());
    editorStore.setState(initialState());
    editorActions.openCodeTab('c1', { kind: 'new', name: 'a.md' }, '# текст', 'markdown');
    expect(applyChangeSet(set)).toEqual({ status: 'no-form' });
  });
});
