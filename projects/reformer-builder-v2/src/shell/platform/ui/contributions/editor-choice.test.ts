/**
 * «Открыть с помощью»: хранилище выбора и правило его применения.
 *
 * Смену редактора командой проверяет [EditorArea.browser.test.tsx](EditorArea.browser.test.tsx) —
 * здесь только то, что от браузера не зависит.
 *
 * @module host/ui/editor-choice.test
 */

import { describe, expect, it, vi } from 'vitest';

import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { makeResourceId, type ResourceRef } from '@/shell/platform/primitives/resource';
import { createEditorProbe } from '@/shell/platform/workspace/model/provider';
import { createEditorChoiceStore, pickEditor } from './editor-choice';
import {
  EditorPoint,
  rankEditors,
  rankEditorsForDocument,
  type EditorCandidate,
  type EditorContribution,
  type EditorEntry,
} from './editors';

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
  editors: readonly { plugin?: string; editor: EditorContribution }[]
): readonly EditorEntry[] {
  const root = createExtensionRegistry();
  for (const item of editors) {
    root.forPlugin(item.plugin ?? 'test').contribute(EditorPoint, item.editor);
  }
  return root.get(EditorPoint);
}

const SCHEMA = ref('forms/credit/schema.json');

/** Кандидаты в том же виде, в каком их получает меню. */
function candidatesOf(
  editors: readonly { plugin?: string; editor: EditorContribution }[]
): readonly EditorCandidate[] {
  return rankEditors(entriesOf(editors), SCHEMA, createEditorProbe('{}'));
}

const A = makeResourceId('mem', 'a.json');
const B = makeResourceId('mem', 'b.json');

describe('createEditorChoiceStore', () => {
  it('без выбора решает приоритет', () => {
    const store = createEditorChoiceStore();
    expect(store.chosenFor(A)).toBeNull();
  });

  it('выбор помнится по ресурсу и переживает уход на соседнюю вкладку', () => {
    const store = createEditorChoiceStore();
    store.choose(A, 'editor.monaco');
    // «Ушли на b, вернулись на a» — это ровно два чтения, между которыми ничего не писали.
    expect(store.chosenFor(B)).toBeNull();
    expect(store.chosenFor(A)).toBe('editor.monaco');
  });

  it('выбор одного ресурса не трогает соседний', () => {
    const store = createEditorChoiceStore();
    store.choose(A, 'editor.monaco');
    store.choose(B, 'editor.schema');
    expect(store.chosenFor(A)).toBe('editor.monaco');
    expect(store.chosenFor(B)).toBe('editor.schema');
  });

  it('сброс возвращает решение приоритету', () => {
    const store = createEditorChoiceStore();
    store.choose(A, 'editor.monaco');
    store.reset(A);
    expect(store.chosenFor(A)).toBeNull();
  });

  it('уведомляет подписчика о выборе и о сбросе', () => {
    const store = createEditorChoiceStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.choose(A, 'editor.monaco');
    expect(listener).toHaveBeenCalledTimes(1);

    store.reset(A);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('повторный выбор того же редактора не уведомляет', () => {
    const store = createEditorChoiceStore();
    store.choose(A, 'editor.monaco');
    const listener = vi.fn();
    store.subscribe(listener);
    store.choose(A, 'editor.monaco');
    expect(listener).not.toHaveBeenCalled();
  });

  it('сброс того, чего не выбирали, не уведомляет', () => {
    const store = createEditorChoiceStore();
    const listener = vi.fn();
    store.subscribe(listener);
    store.reset(A);
    expect(listener).not.toHaveBeenCalled();
  });

  it('снимок стабилен по ссылке между изменениями', () => {
    const store = createEditorChoiceStore();
    expect(store.get()).toBe(store.get());
    store.choose(A, 'editor.monaco');
    const snapshot = store.get();
    expect(store.get()).toBe(snapshot);
    store.choose(B, 'editor.schema');
    expect(store.get()).not.toBe(snapshot);
  });

  it('снимок не переписывается на месте: прежний остаётся прежним', () => {
    const store = createEditorChoiceStore();
    store.choose(A, 'editor.monaco');
    const before = store.get();
    store.choose(B, 'editor.schema');
    expect(before.has(B)).toBe(false);
  });

  it('падение подписчика не мешает остальным', () => {
    const store = createEditorChoiceStore();
    const failure = vi.spyOn(console, 'error').mockImplementation(() => {});
    const second = vi.fn();
    store.subscribe(() => {
      throw new Error('подписчик упал');
    });
    store.subscribe(second);

    store.choose(A, 'editor.monaco');

    expect(second).toHaveBeenCalledTimes(1);
    failure.mockRestore();
  });

  it('снятая подписка больше не зовётся', () => {
    const store = createEditorChoiceStore();
    const listener = vi.fn();
    store.subscribe(listener).dispose();
    store.choose(A, 'editor.monaco');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('pickEditor', () => {
  it('без выбора берёт кандидата с наибольшим приоритетом', () => {
    const candidates = candidatesOf([
      { editor: editor({ id: 'editor.monaco', canOpen: () => 10 }) },
      { editor: editor({ id: 'editor.schema', canOpen: () => 100 }) },
    ]);
    expect(pickEditor(candidates, null)?.value.id).toBe('editor.schema');
  });

  it('выбор человека перебивает приоритет — ради этого всё и заведено', () => {
    const candidates = candidatesOf([
      { editor: editor({ id: 'editor.monaco', canOpen: () => 10 }) },
      { editor: editor({ id: 'editor.schema', canOpen: () => 100 }) },
    ]);
    expect(pickEditor(candidates, 'editor.monaco')?.value.id).toBe('editor.monaco');
  });

  it('выбор редактора, который сегодня не берётся за файл, откатывается на умолчание', () => {
    const candidates = candidatesOf([
      { editor: editor({ id: 'editor.schema', canOpen: () => 100 }) },
    ]);
    // Плагин сняли или содержимое перестало разбираться: показать «редактора нет» значило бы
    // наказать человека за чужую перезагрузку.
    expect(pickEditor(candidates, 'editor.monaco')?.value.id).toBe('editor.schema');
  });

  it('без кандидатов — null, а не отказ', () => {
    expect(pickEditor([], 'editor.monaco')).toBeNull();
    expect(pickEditor([], null)).toBeNull();
  });
});

describe('rankEditorsForDocument', () => {
  const document = { ref: SCHEMA, getText: () => '{}' };

  it('отдаёт ВСЕХ согласившихся, а не только победителя', () => {
    const entries = entriesOf([
      { editor: editor({ id: 'editor.monaco', canOpen: () => 10 }) },
      { editor: editor({ id: 'editor.schema', canOpen: () => 100 }) },
    ]);
    expect(rankEditorsForDocument(entries, document).map((c) => c.entry.value.id)).toEqual([
      'editor.schema',
      'editor.monaco',
    ]);
  });

  it('отказавшийся кандидат в меню не попадает', () => {
    const entries = entriesOf([
      { editor: editor({ id: 'editor.monaco', canOpen: () => 10 }) },
      { editor: editor({ id: 'editor.image', canOpen: () => false }) },
    ]);
    expect(rankEditorsForDocument(entries, document).map((c) => c.entry.value.id)).toEqual([
      'editor.monaco',
    ]);
  });

  it('содержимое читается из буфера: обращения к рабочей области нет ни одного', () => {
    const reads = vi.fn(() => '{}');
    const entries = entriesOf([{ editor: editor({ id: 'editor.monaco' }) }]);
    rankEditorsForDocument(entries, { ref: SCHEMA, getText: reads });
    expect(reads).toHaveBeenCalledTimes(1);
  });

  it('пустая точка расширения — пустой список и та же ссылка', () => {
    expect(rankEditorsForDocument([], document)).toBe(rankEditorsForDocument([], document));
  });
});
