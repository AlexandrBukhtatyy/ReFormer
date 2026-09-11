/**
 * Тесты списка недавних проектов.
 *
 * Хранилище здесь — двойник: список проверяется как проекция записей, без IndexedDB. Порядок
 * и флаг отдаёт хранилище (это проверено в `workspace/storage/idb.test`), а правила «кого
 * не показывать» и «когда будить подписчиков» — этот модуль.
 *
 * @module shell/boot/project/recent.test
 */

import { describe, expect, it, vi } from 'vitest';

import type { WorkspaceRecord } from '@/shell/platform/workspace/storage/idb';
import { createRecentProjects, recentFromRecords } from './recent';

function record(
  id: string,
  lastOpenedAt: number,
  extra: Partial<WorkspaceRecord> = {}
): WorkspaceRecord {
  return {
    id,
    sourceId: 'fs',
    descriptor: { kind: 'fs', handleKey: id },
    label: `папка-${id}`,
    createdAt: 0,
    lastOpenedAt,
    ...extra,
  };
}

/** Двойник хранилища: записи в памяти, свежие первыми, `hideWorkspaces` ставит флаг. */
function fakeMeta(initial: readonly WorkspaceRecord[]) {
  let records = [...initial];
  const hidden: string[][] = [];
  const listWorkspaces = vi.fn(
    (): Promise<readonly WorkspaceRecord[]> =>
      Promise.resolve([...records].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt))
  );
  const hideWorkspaces = vi.fn((ids: readonly string[]): Promise<void> => {
    hidden.push([...ids]);
    records = records.map((it) => (ids.includes(it.id) ? { ...it, hiddenFromRecent: true } : it));
    return Promise.resolve();
  });
  return {
    listWorkspaces,
    hideWorkspaces,
    hidden,
    set: (next: readonly WorkspaceRecord[]) => {
      records = [...next];
    },
  };
}

const ids = (list: readonly { readonly id: string }[]): string[] => list.map((it) => it.id);

describe('записи → список', () => {
  it('без убранных и без открытого сейчас, в порядке хранилища', () => {
    const list = recentFromRecords(
      [record('b', 3), record('a', 2, { hiddenFromRecent: true }), record('c', 1)],
      'c'
    );

    expect(ids(list)).toEqual(['b']);
  });

  it('подпись без имени — идентификатор: по пустой строке в меню не щёлкнуть', () => {
    expect(recentFromRecords([record('x', 1, { label: undefined })], null)[0]?.label).toBe('x');
  });

  it('пустой список — всегда одна и та же ссылка', () => {
    expect(recentFromRecords([], null)).toBe(
      recentFromRecords([record('a', 1, { hiddenFromRecent: true })], null)
    );
  });
});

describe('список недавних', () => {
  it('до первого чтения пуст, после — проекция записей', async () => {
    const meta = fakeMeta([record('a', 1), record('b', 2)]);
    const recent = createRecentProjects({ meta, currentId: () => null });

    expect(recent.get()).toEqual([]);
    await recent.refresh();

    expect(ids(recent.get())).toEqual(['b', 'a']);
  });

  it('тот же состав — та же ссылка и ни одного будильника', async () => {
    const meta = fakeMeta([record('a', 1)]);
    const recent = createRecentProjects({ meta, currentId: () => null });
    await recent.refresh();
    const first = recent.get();
    const woken = vi.fn();
    recent.subscribe(woken);

    await recent.refresh();

    // Иначе меню и стартовая страница перерисовывались бы на каждом открытии проекта впустую.
    expect(recent.get()).toBe(first);
    expect(woken).not.toHaveBeenCalled();
  });

  it('новый порядок будит подписчиков', async () => {
    const meta = fakeMeta([record('a', 1), record('b', 2)]);
    const recent = createRecentProjects({ meta, currentId: () => null });
    await recent.refresh();
    const woken = vi.fn();
    recent.subscribe(woken);

    meta.set([record('a', 3), record('b', 2)]);
    await recent.refresh();

    expect(ids(recent.get())).toEqual(['a', 'b']);
    expect(woken).toHaveBeenCalledOnce();
  });

  it('открытый сейчас проект спрашивается на каждом пересчёте, а не запоминается', async () => {
    let current: string | null = null;
    const meta = fakeMeta([record('a', 1), record('b', 2)]);
    const recent = createRecentProjects({ meta, currentId: () => current });
    await recent.refresh();
    expect(ids(recent.get())).toEqual(['b', 'a']);

    current = 'b';
    await recent.refresh();

    expect(ids(recent.get())).toEqual(['a']);
  });

  it('«убрать» ставит флаг ровно этой области и перечитывает список', async () => {
    const meta = fakeMeta([record('a', 1), record('b', 2)]);
    const recent = createRecentProjects({ meta, currentId: () => null });
    await recent.refresh();

    await recent.forget('b');

    expect(meta.hidden).toEqual([['b']]);
    expect(ids(recent.get())).toEqual(['a']);
  });

  it('«очистить» убирает всех, кроме открытого, — и тех, кого снимок ещё не видел', async () => {
    const meta = fakeMeta([record('a', 1), record('b', 2)]);
    const recent = createRecentProjects({ meta, currentId: () => 'b' });
    await recent.refresh();
    meta.set([record('a', 1), record('b', 2), record('c', 3)]);

    await recent.clear();

    expect(meta.hidden).toEqual([['c', 'a']]);
    expect(recent.get()).toEqual([]);
  });

  it('отказ хранилища оставляет прежний снимок и не бросает', async () => {
    const meta = fakeMeta([record('a', 1)]);
    const recent = createRecentProjects({ meta, currentId: () => null });
    await recent.refresh();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    meta.listWorkspaces.mockImplementationOnce(() =>
      Promise.reject(new Error('IndexedDB недоступен'))
    );

    // Список — удобство: отказ не должен ронять открытие проекта, которое его обновляет.
    await expect(recent.refresh()).resolves.toBeUndefined();

    expect(ids(recent.get())).toEqual(['a']);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it('ответ на устаревшее чтение не перетирает свежий', async () => {
    const meta = fakeMeta([record('a', 1)]);
    let release: (value: readonly WorkspaceRecord[]) => void = () => undefined;
    meta.listWorkspaces.mockImplementationOnce(
      () =>
        new Promise<readonly WorkspaceRecord[]>((resolve) => {
          release = resolve;
        })
    );
    const recent = createRecentProjects({ meta, currentId: () => null });

    const stale = recent.refresh();
    await recent.refresh();
    release([record('устаревшая', 5)]);
    await stale;

    expect(ids(recent.get())).toEqual(['a']);
  });

  it('после закрытия подписчиков не будит', async () => {
    const meta = fakeMeta([record('a', 1)]);
    const recent = createRecentProjects({ meta, currentId: () => null });
    const woken = vi.fn();
    recent.subscribe(woken);

    recent.dispose();
    await recent.refresh();

    expect(woken).not.toHaveBeenCalled();
  });
});
