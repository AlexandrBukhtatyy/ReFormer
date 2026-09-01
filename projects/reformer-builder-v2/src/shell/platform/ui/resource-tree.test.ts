import { describe, expect, it, vi } from 'vitest';

import {
  makeResourceId,
  mediaTypeFor,
  type ResourceId,
  type ResourceRef,
} from '@/shell/platform/primitives/resource';
import {
  collapseNode,
  createResourceTreeStore,
  createTreeState,
  expandNode,
  flattenTree,
  invalidateLevel,
  levelStatus,
  actionTargets,
  rangeIds,
  selectNode,
  setChecked,
  setChildren,
  toggleChecked,
  setLevelStatus,
  sortEntries,
  type ResourceTreeState,
} from './resource-tree';

const ROOT = 'mem:';

function dir(path: string): ResourceRef {
  return {
    id: makeResourceId('mem', path),
    sourceId: 'mem',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'directory',
    mediaType: 'inode/directory',
  };
}

function file(path: string): ResourceRef {
  return {
    id: makeResourceId('mem', path),
    sourceId: 'mem',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType: mediaTypeFor(path),
  };
}

/** Дерево проекта: два каталога и файлы. Уровни отдаются по одному обращению. */
const LEVELS: Readonly<Record<string, readonly ResourceRef[]>> = {
  'mem:': [file('package.json'), dir('forms'), dir('shared')],
  'mem:forms': [dir('forms/credit'), file('forms/index.ts')],
  'mem:forms/credit': [file('forms/credit/schema.json'), file('forms/credit/README.md')],
  'mem:shared': [file('shared/rules.ts')],
};

/**
 * Подставная рабочая область для дерева — с журналом обращений.
 *
 * `readText` объявлен намеренно и обязан остаться нетронутым: тип {@link TreeWorkspace}
 * его не содержит, но проверять надо не типы, а поведение — дерево не читает тел файлов.
 */
function fakeWorkspace() {
  const listCalls: ResourceId[] = [];
  const readText = vi.fn(() => Promise.resolve(''));
  const workspace = {
    list(id: ResourceId): Promise<readonly ResourceRef[]> {
      listCalls.push(id);
      const level = LEVELS[id];
      if (level === undefined) return Promise.reject(new Error(`нет каталога: ${id}`));
      return Promise.resolve(level);
    },
    readText,
  };
  return { workspace, listCalls, readText };
}

describe('sortEntries', () => {
  it('каталоги выше файлов, дальше — по имени с числами и без регистра', () => {
    const sorted = sortEntries([
      file('form10.json'),
      file('Form2.json'),
      dir('shared'),
      file('a.json'),
      dir('Assets'),
    ]);
    expect(sorted.map((entry) => entry.name)).toEqual([
      'Assets',
      'shared',
      'a.json',
      'Form2.json',
      'form10.json',
    ]);
  });
});

describe('состояние уровня', () => {
  it('неспрошенный каталог — `unloaded`, а не пустой список', () => {
    const state = createTreeState(ROOT);
    expect(levelStatus(state, ROOT)).toBe('unloaded');
    expect(flattenTree(state)).toEqual([]);
  });

  it('setChildren наводит порядок сам и помечает уровень прочитанным', () => {
    const state = setChildren(createTreeState(ROOT), ROOT, [file('b.json'), dir('a')]);
    expect(state.children.get(ROOT)?.map((entry) => entry.name)).toEqual(['a', 'b.json']);
    expect(levelStatus(state, ROOT)).toBe('loaded');
  });

  it('повторная запись того же статуса снимок не пересоздаёт', () => {
    const state = setLevelStatus(createTreeState(ROOT), ROOT, 'loading');
    expect(setLevelStatus(state, ROOT, 'loading')).toBe(state);
  });

  it('сворачивание НЕ забывает прочитанный уровень', () => {
    let state = setChildren(createTreeState(ROOT), ROOT, LEVELS[ROOT]);
    state = expandNode(state, 'mem:forms');
    state = setChildren(state, 'mem:forms', LEVELS['mem:forms']);
    const collapsed = collapseNode(state, 'mem:forms');
    expect(collapsed.children.has('mem:forms')).toBe(true);
    expect(levelStatus(collapsed, 'mem:forms')).toBe('loaded');
  });

  it('invalidateLevel забывает уровень целиком', () => {
    const state = setChildren(createTreeState(ROOT), ROOT, LEVELS[ROOT]);
    const dropped = invalidateLevel(state, ROOT);
    expect(dropped.children.has(ROOT)).toBe(false);
    expect(levelStatus(dropped, ROOT)).toBe('unloaded');
    // Уровня и не было — значит забывать нечего и снимок остаётся той же ссылкой.
    const fresh = createTreeState(ROOT);
    expect(invalidateLevel(fresh, ROOT)).toBe(fresh);
  });
});

describe('flattenTree', () => {
  function loaded(): ResourceTreeState {
    let state = setChildren(createTreeState(ROOT), ROOT, LEVELS[ROOT]);
    state = expandNode(state, 'mem:forms');
    state = setChildren(state, 'mem:forms', LEVELS['mem:forms']);
    return state;
  }

  it('дети раскрытого каталога идут сразу за ним и глубже на уровень', () => {
    const rows = flattenTree(loaded());
    expect(rows.map((row) => `${row.depth}:${row.ref.name}`)).toEqual([
      '0:forms',
      '1:credit',
      '1:index.ts',
      '0:shared',
      '0:package.json',
    ]);
  });

  it('свёрнутый каталог детей не показывает, хотя они прочитаны', () => {
    const rows = flattenTree(collapseNode(loaded(), 'mem:forms'));
    expect(rows.map((row) => row.ref.name)).toEqual(['forms', 'shared', 'package.json']);
  });

  it('раскрытый, но ещё не прочитанный каталог строк не добавляет', () => {
    const state = expandNode(loaded(), 'mem:shared');
    expect(flattenTree(state).map((row) => row.ref.name)).toEqual([
      'forms',
      'credit',
      'index.ts',
      'shared',
      'package.json',
    ]);
  });

  it('несёт состояние строки: раскрытость, чтение, отказ, выделение', () => {
    let state = expandNode(loaded(), 'mem:shared');
    state = setLevelStatus(state, 'mem:shared', 'loading');
    state = setLevelStatus(state, 'mem:forms/credit', 'failed');
    state = selectNode(state, 'mem:forms/index.ts');
    const rows = flattenTree(state);

    expect(rows.find((row) => row.ref.name === 'forms')?.expanded).toBe(true);
    expect(rows.find((row) => row.ref.name === 'shared')?.loading).toBe(true);
    expect(rows.find((row) => row.ref.name === 'credit')?.failed).toBe(true);
    expect(rows.find((row) => row.ref.name === 'index.ts')?.selected).toBe(true);
  });

  it('файл раскрытым не считается, даже если попал в набор раскрытых', () => {
    const state = expandNode(loaded(), 'mem:package.json');
    expect(flattenTree(state).find((row) => row.ref.name === 'package.json')?.expanded).toBe(false);
  });
});

describe('createResourceTreeStore — ленивое раскрытие', () => {
  it('уровень берётся ОДНИМ обращением, а тела файлов не читаются', async () => {
    const fake = fakeWorkspace();
    const store = createResourceTreeStore({ workspace: fake.workspace, rootId: ROOT });

    await store.expand(ROOT);

    expect(fake.listCalls).toEqual([ROOT]);
    expect(fake.readText).not.toHaveBeenCalled();
    expect(flattenTree(store.get()).map((row) => row.ref.name)).toEqual([
      'forms',
      'shared',
      'package.json',
    ]);
    store.dispose();
  });

  it('раскрытие идёт по уровням: соседний каталог не читается заранее', async () => {
    const fake = fakeWorkspace();
    const store = createResourceTreeStore({ workspace: fake.workspace, rootId: ROOT });

    await store.expand(ROOT);
    await store.expand('mem:forms');

    // Ни `shared`, ни `forms/credit` не спрошены: их никто не раскрывал.
    expect(fake.listCalls).toEqual([ROOT, 'mem:forms']);
    expect(fake.readText).not.toHaveBeenCalled();
    store.dispose();
  });

  it('свернуть и раскрыть обратно не стоит ни одного обращения', async () => {
    const fake = fakeWorkspace();
    const store = createResourceTreeStore({ workspace: fake.workspace, rootId: ROOT });

    await store.expand(ROOT);
    await store.toggle('mem:forms');
    await store.toggle('mem:forms');
    await store.toggle('mem:forms');

    expect(fake.listCalls).toEqual([ROOT, 'mem:forms']);
    store.dispose();
  });

  it('два раскрытия подряд не порождают двух листингов', async () => {
    const fake = fakeWorkspace();
    const store = createResourceTreeStore({ workspace: fake.workspace, rootId: ROOT });

    await Promise.all([store.expand(ROOT), store.expand(ROOT)]);

    expect(fake.listCalls).toEqual([ROOT]);
    store.dispose();
  });

  it('refresh перечитывает уровень: файлы могли появиться', async () => {
    const fake = fakeWorkspace();
    const store = createResourceTreeStore({ workspace: fake.workspace, rootId: ROOT });

    await store.expand(ROOT);
    await store.refresh(ROOT);

    expect(fake.listCalls).toEqual([ROOT, ROOT]);
    store.dispose();
  });

  it('отказ уровня — состояние строки, а не авария дерева', async () => {
    const fake = fakeWorkspace();
    const onError = vi.fn();
    const store = createResourceTreeStore({ workspace: fake.workspace, rootId: ROOT, onError });

    await store.expand(ROOT);
    await store.expand('mem:package.json');

    expect(levelStatus(store.get(), 'mem:package.json')).toBe('failed');
    expect(onError).toHaveBeenCalledOnce();
    // Остальное дерево цело.
    expect(flattenTree(store.get())).toHaveLength(3);
    store.dispose();
  });

  it('подписчик получает уведомление, а снимок между изменениями стабилен', async () => {
    const fake = fakeWorkspace();
    const store = createResourceTreeStore({ workspace: fake.workspace, rootId: ROOT });
    const listener = vi.fn();
    store.subscribe(listener);

    const before = store.get();
    await store.expand(ROOT);
    const after = store.get();

    expect(listener).toHaveBeenCalled();
    expect(after).not.toBe(before);
    expect(store.get()).toBe(after);
    store.dispose();
  });

  it('выделение — часть состояния дерева, а не отдельная переменная отрисовки', async () => {
    const fake = fakeWorkspace();
    const store = createResourceTreeStore({ workspace: fake.workspace, rootId: ROOT });
    await store.expand(ROOT);

    store.select('mem:package.json');
    expect(flattenTree(store.get()).find((row) => row.selected)?.ref.name).toBe('package.json');

    store.select(null);
    expect(flattenTree(store.get()).some((row) => row.selected)).toBe(false);
    store.dispose();
  });
});

describe('отмеченный набор', () => {
  it('щелчок с Ctrl добавляет строку и убирает её обратно', () => {
    const state = setChildren(createTreeState(ROOT), ROOT, LEVELS[ROOT] ?? []);

    const added = toggleChecked(state, 'mem:package.json');
    expect(flattenTree(added).filter((row) => row.checked)).toHaveLength(1);

    const removed = toggleChecked(added, 'mem:package.json');
    expect(flattenTree(removed).some((row) => row.checked)).toBe(false);
  });

  it('повторная установка того же набора не меняет состояние', () => {
    const state = setChecked(setChildren(createTreeState(ROOT), ROOT, LEVELS[ROOT] ?? []), [
      'mem:package.json',
    ]);

    expect(setChecked(state, ['mem:package.json'])).toBe(state);
  });

  it('диапазон считается по ВИДИМЫМ строкам, а не по дереву', async () => {
    const fake = fakeWorkspace();
    const store = createResourceTreeStore({ workspace: fake.workspace, rootId: ROOT });
    await store.expand(ROOT);
    await store.expand('mem:forms');

    const rows = flattenTree(store.get());
    expect(rangeIds(rows, 'mem:forms', 'mem:forms/index.ts')).toEqual([
      'mem:forms',
      'mem:forms/credit',
      'mem:forms/index.ts',
    ]);

    // Свёрнутый каталог прячет своих детей — и из диапазона они тоже уходят.
    store.collapse('mem:forms');
    expect(rangeIds(flattenTree(store.get()), 'mem:forms', 'mem:package.json')).toEqual([
      'mem:forms',
      'mem:shared',
      'mem:package.json',
    ]);
    store.dispose();
  });

  it('неизвестная граница диапазона не выделяет ничего', () => {
    const state = setChildren(createTreeState(ROOT), ROOT, LEVELS[ROOT] ?? []);

    expect(rangeIds(flattenTree(state), 'mem:package.json', 'mem:gone.ts')).toEqual([]);
  });

  it('действие применяется к набору, только если фокус стоит внутри него', () => {
    const base = setChildren(createTreeState(ROOT), ROOT, LEVELS[ROOT] ?? []);
    const checked = setChecked(base, ['mem:package.json', 'mem:shared']);

    // Фокус внутри набора — действуют все отмеченные, в порядке строк.
    const inside = flattenTree(selectNode(checked, 'mem:package.json'));
    expect(actionTargets(inside).map((ref) => ref.id)).toEqual(['mem:shared', 'mem:package.json']);

    // Фокус ушёл на строку вне набора — действует она одна.
    const outside = flattenTree(selectNode(checked, 'mem:forms'));
    expect(actionTargets(outside).map((ref) => ref.id)).toEqual(['mem:forms']);
  });

  it('без выделения и без отметок действовать не над чем', () => {
    const state = setChildren(createTreeState(ROOT), ROOT, LEVELS[ROOT] ?? []);

    expect(actionTargets(flattenTree(state))).toEqual([]);
  });

  it('хранилище переносит набор в строки', async () => {
    const fake = fakeWorkspace();
    const store = createResourceTreeStore({ workspace: fake.workspace, rootId: ROOT });
    await store.expand(ROOT);

    store.check(['mem:package.json', 'mem:shared']);
    expect(flattenTree(store.get()).filter((row) => row.checked)).toHaveLength(2);

    store.toggleCheck('mem:shared');
    expect(flattenTree(store.get()).filter((row) => row.checked)).toHaveLength(1);

    store.check([]);
    expect(flattenTree(store.get()).some((row) => row.checked)).toBe(false);
    store.dispose();
  });
});
