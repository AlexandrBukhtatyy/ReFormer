import { describe, expect, it, vi } from 'vitest';

import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { makeResourceId, type ResourceRef } from '@/shell/platform/primitives/resource';
import {
  createEditorProbe,
  isSyncEditorProbe,
  type EditorProbe,
} from '@/shell/platform/workspace/model/provider';
import {
  EditorPoint,
  chooseEditor,
  createLazyEditorProbe,
  createUnreadableProbe,
  createViewStateStore,
  rankEditors,
  resolveEditor,
  resolveEditorForDocument,
  type EditorContribution,
  type EditorEntry,
} from './editors';

/**
 * Редакторы теста — фиктивные и намеренно бессодержательные.
 *
 * Предметных («визуальный редактор схемы») здесь быть не может: Host о них не знает, и тест,
 * который их заводит, проверял бы собственную выдумку, а не выбор кандидата.
 */
const NOOP_BODY: EditorContribution['Body'] = () => null;

function ref(path: string, mediaType = 'application/json'): ResourceRef {
  return {
    id: makeResourceId('mem', path),
    sourceId: 'mem',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType,
  };
}

function editor(patch: Partial<EditorContribution> & { id: string }): EditorContribution {
  return { canOpen: () => 1, Body: NOOP_BODY, ...patch };
}

function entriesOf(
  editors: readonly { plugin?: string; editor: EditorContribution; order?: number }[]
): readonly EditorEntry[] {
  const root = createExtensionRegistry();
  for (const item of editors) {
    root
      .forPlugin(item.plugin ?? 'test')
      .contribute(EditorPoint, item.editor, { order: item.order });
  }
  return root.get(EditorPoint);
}

const SCHEMA = ref('forms/credit/schema.json');
const PROBE = createEditorProbe('{}');

describe('rankEditors', () => {
  it('упорядочивает согласившихся по убыванию приоритета', () => {
    const entries = entriesOf([
      { editor: editor({ id: 'text', canOpen: () => 1 }) },
      { editor: editor({ id: 'schema', canOpen: () => 100 }) },
      { editor: editor({ id: 'json', canOpen: () => 10 }) },
    ]);

    expect(rankEditors(entries, SCHEMA, PROBE).map((c) => c.entry.value.id)).toEqual([
      'schema',
      'json',
      'text',
    ]);
  });

  it('отказ `false` убирает кандидата из списка', () => {
    const entries = entriesOf([
      { editor: editor({ id: 'image', canOpen: () => false }) },
      { editor: editor({ id: 'text', canOpen: () => 1 }) },
    ]);

    expect(rankEditors(entries, SCHEMA, PROBE).map((c) => c.entry.value.id)).toEqual(['text']);
  });

  it('нечисловой и неконечный ответ — тоже отказ', () => {
    const entries = entriesOf([
      { editor: editor({ id: 'nan', canOpen: () => Number.NaN }) },
      { editor: editor({ id: 'inf', canOpen: () => Number.POSITIVE_INFINITY }) },
      { editor: editor({ id: 'ok', canOpen: () => 1 }) },
    ]);

    expect(rankEditors(entries, SCHEMA, PROBE).map((c) => c.entry.value.id)).toEqual(['ok']);
  });

  it('при равном приоритете выигрывает объявленный порядок вклада', () => {
    const entries = entriesOf([
      { editor: editor({ id: 'late', canOpen: () => 5 }), order: 10 },
      { editor: editor({ id: 'early', canOpen: () => 5 }), order: -10 },
    ]);

    expect(rankEditors(entries, SCHEMA, PROBE).map((c) => c.entry.value.id)).toEqual([
      'early',
      'late',
    ]);
  });

  it('упавший кандидат пропускается, остальные спрашиваются дальше', () => {
    const entries = entriesOf([
      {
        editor: editor({
          id: 'broken',
          canOpen: () => {
            throw new Error('плагин сломан');
          },
        }),
      },
      { editor: editor({ id: 'ok', canOpen: () => 1 }) },
    ]);
    const onError = vi.fn();

    expect(rankEditors(entries, SCHEMA, PROBE, onError).map((c) => c.entry.value.id)).toEqual([
      'ok',
    ]);
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe('resolveEditor', () => {
  it('решение принимается по содержимому, а не по расширению', () => {
    // Два кандидата на один и тот же `.json`: схема формы и конфиг пакета. Различает их
    // разбор, а не суффикс — иначе один из двух был бы недостижим.
    const schemaEditor = editor({
      id: 'schema',
      canOpen: (_, probe) => {
        if (!isSyncEditorProbe(probe)) return false;
        const parsed: unknown = JSON.parse(probe.peek());
        return typeof parsed === 'object' && parsed !== null && '$schema' in parsed ? 100 : false;
      },
    });
    const packageEditor = editor({
      id: 'package',
      canOpen: (_, probe) => {
        if (!isSyncEditorProbe(probe)) return false;
        const parsed: unknown = JSON.parse(probe.peek());
        return typeof parsed === 'object' && parsed !== null && 'dependencies' in parsed
          ? 100
          : false;
      },
    });
    const entries = entriesOf([{ editor: schemaEditor }, { editor: packageEditor }]);

    const asSchema = resolveEditor(entries, SCHEMA, createEditorProbe('{"$schema":"form"}'));
    const asPackage = resolveEditor(entries, SCHEMA, createEditorProbe('{"dependencies":{}}'));

    expect(asSchema?.value.id).toBe('schema');
    expect(asPackage?.value.id).toBe('package');
  });

  it('когда отказались все — `null`, а не отказ открыть', () => {
    const entries = entriesOf([
      { editor: editor({ id: 'a', canOpen: () => false }) },
      { editor: editor({ id: 'b', canOpen: () => false }) },
    ]);

    expect(resolveEditor(entries, SCHEMA, PROBE)).toBeNull();
  });

  it('пустая точка расширения — тоже `null`', () => {
    expect(resolveEditor([], SCHEMA, PROBE)).toBeNull();
  });
});

describe('chooseEditor', () => {
  it('содержимое читается ОДИН раз на всех кандидатов', async () => {
    const readText = vi.fn(() => Promise.resolve('{"$schema":"form"}'));
    const seen: string[] = [];
    const peeking = (id: string): EditorContribution =>
      editor({
        id,
        canOpen: (_, probe) => {
          if (!isSyncEditorProbe(probe)) return false;
          seen.push(probe.peek());
          return 1;
        },
      });
    const entries = entriesOf([
      { editor: peeking('a') },
      { editor: peeking('b') },
      { editor: peeking('c') },
    ]);

    await chooseEditor(entries, SCHEMA, readText);

    expect(seen).toHaveLength(3);
    expect(readText).toHaveBeenCalledTimes(1);
  });

  it('пустая точка расширения не стоит ни одного чтения', async () => {
    const readText = vi.fn(() => Promise.resolve(''));
    expect(await chooseEditor([], SCHEMA, readText)).toBeNull();
    expect(readText).not.toHaveBeenCalled();
  });

  it('двоичный ресурс не читается вовсе, а проба отвечает отказом', async () => {
    const readText = vi.fn(() => Promise.resolve(''));
    let probeFailed = false;
    const entries = entriesOf([
      {
        editor: editor({
          id: 'image',
          canOpen: (candidate, probe) => {
            void probe.text().catch(() => {
              probeFailed = true;
            });
            return candidate.mediaType.startsWith('image/') ? 50 : false;
          },
        }),
      },
    ]);

    const chosen = await chooseEditor(entries, ref('logo.png', 'image/png'), readText);
    await Promise.resolve();

    expect(chosen?.value.id).toBe('image');
    expect(readText).not.toHaveBeenCalled();
    expect(probeFailed).toBe(true);
  });

  it('отказ чтения не превращается в «редактора нет»', async () => {
    const entries = entriesOf([{ editor: editor({ id: 'text' }) }]);
    await expect(
      chooseEditor(entries, SCHEMA, () => Promise.reject(new Error('файл исчез')))
    ).rejects.toThrow('файл исчез');
  });
});

describe('resolveEditorForDocument', () => {
  it('у открытого документа содержимое берётся из буфера — чтений ноль', () => {
    const getText = vi.fn(() => '{"$schema":"form"}');
    const entries = entriesOf([
      {
        editor: editor({
          id: 'schema',
          canOpen: (_, probe) => (isSyncEditorProbe(probe) ? probe.peek().length : false),
        }),
      },
    ]);

    expect(resolveEditorForDocument(entries, { ref: SCHEMA, getText })?.value.id).toBe('schema');
    // Буфер спрошен ровно один раз — по разу на кандидата его не спрашивают.
    expect(getText).toHaveBeenCalledTimes(1);
  });
});

describe('createLazyEditorProbe', () => {
  it('не читает, пока не спросили, и не читает дважды', async () => {
    const read = vi.fn(() => Promise.resolve('содержимое'));
    const probe: EditorProbe = createLazyEditorProbe(read);

    expect(read).not.toHaveBeenCalled();
    expect(await probe.text()).toBe('содержимое');
    expect(await probe.text()).toBe('содержимое');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('синхронного доступа не предлагает: вклад обязан решать по ссылке', () => {
    expect(isSyncEditorProbe(createLazyEditorProbe(() => Promise.resolve('')))).toBe(false);
  });
});

describe('createUnreadableProbe', () => {
  it('отвечает отказом, а не пустой строкой', async () => {
    await expect(createUnreadableProbe(ref('logo.png', 'image/png')).text()).rejects.toThrow(
      'не читается текстом'
    );
  });
});

describe('createViewStateStore', () => {
  const captured: unknown[] = [];
  const withViewState = (id: string, state: unknown): EditorContribution =>
    editor({
      id,
      viewState: {
        capture: () => state,
        restore: (_, value) => {
          captured.push(value);
        },
      },
    });

  it('состояние принадлежит паре «редактор + документ»', () => {
    captured.length = 0;
    const entries = entriesOf([
      { editor: withViewState('text', { scroll: 10 }) },
      { editor: withViewState('tree', { collapsed: ['a'] }) },
    ]);
    const [text, tree] = entries;
    const store = createViewStateStore();

    store.capture(text, 'mem:a.json');
    store.capture(tree, 'mem:a.json');

    expect(store.has(text, 'mem:a.json')).toBe(true);
    expect(store.has(tree, 'mem:a.json')).toBe(true);
    // Тот же документ в другом редакторе — другое состояние, а не общее.
    expect(store.has(text, 'mem:b.json')).toBe(false);

    store.restore(text, 'mem:a.json');
    store.restore(tree, 'mem:a.json');
    expect(captured).toEqual([{ scroll: 10 }, { collapsed: ['a'] }]);
  });

  it('без запомненного состояния `restore` не зовётся вовсе', () => {
    const restore = vi.fn();
    const entries = entriesOf([
      { editor: editor({ id: 'text', viewState: { capture: () => null, restore } }) },
    ]);

    createViewStateStore().restore(entries[0], 'mem:a.json');
    expect(restore).not.toHaveBeenCalled();
  });

  it('закрытая вкладка забывается во всех редакторах сразу', () => {
    const entries = entriesOf([
      { editor: withViewState('text', 1) },
      { editor: withViewState('tree', 2) },
    ]);
    const store = createViewStateStore();
    store.capture(entries[0], 'mem:a.json');
    store.capture(entries[1], 'mem:a.json');
    store.capture(entries[0], 'mem:b.json');

    store.forget('mem:a.json');

    expect(store.has(entries[0], 'mem:a.json')).toBe(false);
    expect(store.has(entries[1], 'mem:a.json')).toBe(false);
    expect(store.has(entries[0], 'mem:b.json')).toBe(true);
  });

  it('редактор без `viewState` не участвует', () => {
    const entries = entriesOf([{ editor: editor({ id: 'plain' }) }]);
    const store = createViewStateStore();
    store.capture(entries[0], 'mem:a.json');
    expect(store.has(entries[0], 'mem:a.json')).toBe(false);
  });
});
