/**
 * Тесты Workspace — против подставного OPFS, подставной IndexedDB и подставного источника
 * с журналом обращений.
 *
 * Проверяется не «метод вызвался», а свойства контракта, каждое из которых при наивной
 * реализации ломается молча:
 *
 * - открытие материализует и создаёт документ, повторное — НЕ ходит в источник;
 * - `writeText` не трогает источник (доказывается пустым журналом записи, а не состоянием);
 * - `save` пишет и обновляет BASE, а при разошедшейся ревизии даёт конфликт и BASE не трогает;
 * - бюджет догрузки останавливается и сообщает;
 * - вытеснение не трогает открытые, `close` снимает закрепление, но не удаляет, а BASE
 *   уходит в паре с содержимым;
 * - события приходят пакетами, а не по одному.
 *
 * Фейковых таймеров здесь нет намеренно: коммит транзакции в подставной IndexedDB назначается
 * через `setTimeout` (см. шапку `storage/testing.ts`), и с `vi.useFakeTimers()` он не наступил
 * бы сам.
 *
 * @module host/workspace/workspace.test
 */

import { describe, expect, it, vi } from 'vitest';

import type { Diagnostic } from '@/shell/platform/diagnostics/types';
import { makeResourceId, type ResourceId } from '@/shell/platform/primitives/resource';
import { createWorkspaceMetaStore, type WorkspaceMetaStore } from './storage/idb';
import { createWorkspaceFileStore } from './storage/opfs';
import { createMemoryIndexedDb, createMemoryOpfs, type MemoryOpfs } from './storage/testing';
import { createFsAccessSource } from '@/shell/platform/source/fs-access';
import { createFakeDirectory } from '@/shell/platform/source/testing';
import { createMemorySource, type MemorySource, type MemorySourceOptions } from './testing';
import { createJournal, type Journal } from './journal/journal';
import {
  createWorkspace,
  type SaveResult,
  type Workspace,
  type WorkspaceChange,
  type WorkspaceOptions,
} from './workspace';

/** Публикация диагностик догрузки — то, чем «сказать» отличается от «усечь молча». */
interface Published {
  readonly resource: ResourceId;
  readonly source: string;
  readonly items: readonly Diagnostic[];
}

interface Harness {
  readonly ws: Workspace;
  /** Идентификатор рабочей области: им адресуются записи в хранилище метаданных. */
  readonly wsId: string;
  readonly source: MemorySource;
  readonly opfs: MemoryOpfs;
  readonly meta: WorkspaceMetaStore;
  readonly events: WorkspaceChange[];
  readonly published: Published[];
  /** Идентификатор ресурса в этом источнике. */
  rid(path: string): ResourceId;
  /** Содержимое слоя рабочей области или `undefined`, если файла там нет. */
  layer(layer: 'files' | 'base', path: string): string | undefined;
}

let seq = 0;

function makeWorkspace(
  initial: Readonly<Record<string, string>> = {},
  options: {
    readonly source?: MemorySourceOptions;
    readonly workspace?: Partial<Omit<WorkspaceOptions, 'id' | 'source' | 'files' | 'meta'>>;
  } = {}
): Harness {
  seq += 1;
  const id = `w${seq}`;
  const opfs = createMemoryOpfs();
  const memoryDb = createMemoryIndexedDb();
  const source = createMemorySource(initial, options.source);
  const files = createWorkspaceFileStore(id, { directory: opfs.directory });
  const meta = createWorkspaceMetaStore({
    factory: memoryDb.factory,
    databaseName: `ws-${seq}`,
    estimate: async () => ({ usage: 0, quota: 1_000_000 }),
  });

  const events: WorkspaceChange[] = [];
  const published: Published[] = [];
  // Часы шагают на каждом обращении: `lastUsedAt` обязан быть строго монотонным, иначе
  // порядок вытеснения зависит от разрешения системного таймера и тест падает через раз.
  let clock = 0;

  const ws = createWorkspace({
    id,
    source,
    files,
    meta,
    diagnostics: {
      publish: (resource, sourceId, items) => {
        published.push({ resource, source: sourceId, items });
      },
    },
    now: () => {
      clock += 1;
      return clock;
    },
    ...options.workspace,
  });

  ws.onDidChange((event) => events.push(event));

  return {
    ws,
    wsId: id,
    source,
    opfs,
    meta,
    events,
    published,
    rid: (path) => makeResourceId(source.id, path),
    layer: (which, path) => opfs.files()[`ws/${id}/${which}/${path}`],
  };
}

/** Даёт отработать и микрозадачам (пакет событий), и коммитам подставной IndexedDB. */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** Все изменения из всех пакетов — для утверждений «событие про этот ресурс было». */
const allChanges = (events: readonly WorkspaceChange[]) => events.flatMap((e) => e.changes);

describe('Workspace: открытие', () => {
  it('материализует ресурс и его замыкание и отдаёт документ с текстом', async () => {
    const h = makeWorkspace({
      'src/form/schema.ts': "import { rules } from './rules';\nexport const schema = rules;",
      'src/form/rules.ts': 'export const rules = 1;',
      'src/other/untouched.ts': 'export const nope = 1;',
    });

    const document = await h.ws.open(h.rid('src/form/schema.ts'));

    expect(document.getText()).toContain('export const schema');
    expect(document.isDirty()).toBe(false);
    expect(document.ref.path).toBe('src/form/schema.ts');
    expect(document.ref.mediaType).toBe('text/typescript');

    // Замыкание догружено, посторонние файлы — нет.
    expect(h.layer('files', 'src/form/rules.ts')).toBe('export const rules = 1;');
    expect(h.layer('base', 'src/form/rules.ts')).toBe('export const rules = 1;');
    expect(h.layer('files', 'src/other/untouched.ts')).toBeUndefined();

    // opened ⊆ materialized: вкладка одна, материализованных — две.
    expect(h.ws.openedResources()).toEqual([h.rid('src/form/schema.ts')]);
  });

  it('BASE появляется вместе с содержимым, а не позже', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });

    await h.ws.open(h.rid('a.ts'));

    expect(h.layer('files', 'a.ts')).toBe('x');
    expect(h.layer('base', 'a.ts')).toBe('x');
  });

  it('повторное открытие отдаёт тот же документ и не ходит в источник', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });

    const first = await h.ws.open(h.rid('a.ts'));
    h.source.forget();
    const second = await h.ws.open(h.rid('a.ts'));

    expect(second).toBe(first);
    expect(h.source.countOf('read')).toBe(0);
    expect(h.ws.openedResources()).toHaveLength(1);
  });

  it('закрыть и открыть заново — тоже не поход в источник: удаление ленивое', async () => {
    const h = makeWorkspace({ 'a.ts': "import './b';", 'b.ts': 'y' });

    await h.ws.open(h.rid('a.ts'));
    await h.ws.close(h.rid('a.ts'));
    h.source.forget();
    const again = await h.ws.open(h.rid('a.ts'));

    expect(again.getText()).toBe("import './b';");
    expect(h.source.countOf('read')).toBe(0);
    expect(h.source.countOf('stat')).toBe(0);
  });

  it('отсутствующий ресурс — отказ открытия, а не пустой документ', async () => {
    const h = makeWorkspace({});

    await expect(h.ws.open(h.rid('gone.ts'))).rejects.toMatchObject({ kind: 'not-found' });
  });

  it('ресурс чужого источника отвергается', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });

    await expect(h.ws.open('other:a.ts')).rejects.toThrow(/чужого источника/);
  });
});

describe('Workspace: рабочая копия', () => {
  it('writeText пишет в рабочую копию и НЕ трогает источник', async () => {
    const h = makeWorkspace({ 'a.ts': 'было' });

    await h.ws.open(h.rid('a.ts'));
    h.source.forget();
    await h.ws.writeText(h.rid('a.ts'), 'стало');

    // Доказательство — журнал: по состоянию источника «запись не дошла» и «записи не было»
    // выглядят одинаково.
    expect(h.source.countOf('write')).toBe(0);
    expect(h.source.textOf('a.ts')).toBe('было');

    expect(h.layer('files', 'a.ts')).toBe('стало');
    expect(h.layer('base', 'a.ts')).toBe('было');
    expect(h.ws.isDirty(h.rid('a.ts'))).toBe(true);
    expect(await h.ws.readText(h.rid('a.ts'))).toBe('стало');
  });

  it('правка через writeText видна открытому документу', async () => {
    const h = makeWorkspace({ 'a.ts': 'было' });
    const document = await h.ws.open(h.rid('a.ts'));
    const seen: string[] = [];
    document.onDidChangeContent((text) => seen.push(text));

    await h.ws.writeText(h.rid('a.ts'), 'стало');

    expect(document.getText()).toBe('стало');
    expect(document.isDirty()).toBe(true);
    expect(seen).toEqual(['стало']);
  });

  it('возврат к прежнему тексту снимает признак изменённости', async () => {
    const h = makeWorkspace({ 'a.ts': 'было' });

    await h.ws.writeText(h.rid('a.ts'), 'стало');
    expect(h.ws.isDirty()).toBe(true);

    await h.ws.writeText(h.rid('a.ts'), 'было');
    expect(h.ws.isDirty()).toBe(false);
  });

  it('создаёт файл, которого нет в источнике: BASE у него не бывает', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });

    await h.ws.writeText(h.rid('new.ts'), 'свежий');

    expect(h.layer('files', 'new.ts')).toBe('свежий');
    expect(h.layer('base', 'new.ts')).toBeUndefined();
    expect(h.ws.isDirty(h.rid('new.ts'))).toBe(true);
    expect(h.source.countOf('write')).toBe(0);
  });

  it('revert возвращает рабочую копию к BASE', async () => {
    const h = makeWorkspace({ 'a.ts': 'было' });
    const document = await h.ws.open(h.rid('a.ts'));
    await h.ws.writeText(h.rid('a.ts'), 'стало');

    await h.ws.revert(h.rid('a.ts'));

    expect(h.layer('files', 'a.ts')).toBe('было');
    expect(document.getText()).toBe('было');
    expect(h.ws.isDirty(h.rid('a.ts'))).toBe(false);
  });

  it('revert локально созданного файла означает его исчезновение', async () => {
    const h = makeWorkspace({});
    await h.ws.writeText(h.rid('new.ts'), 'свежий');

    await h.ws.revert(h.rid('new.ts'));

    expect(h.layer('files', 'new.ts')).toBeUndefined();
    expect(h.ws.isDirty()).toBe(false);
  });

  it('readText двоичного ресурса — отказ ДО обращения к источнику', async () => {
    const h = makeWorkspace({ 'logo.png': 'PNG' }, { source: { binary: true } });

    await expect(h.ws.readText(h.rid('logo.png'))).rejects.toThrow(/не читается текстом/);
    expect(h.source.countOf('read')).toBe(0);
    expect(h.source.countOf('readBytes')).toBe(0);
  });

  it('readBytes берёт байты у источника, когда он это умеет', async () => {
    const h = makeWorkspace({ 'logo.png': 'PNG' }, { source: { binary: true } });

    const bytes = await h.ws.readBytes(h.rid('logo.png'));

    expect(new TextDecoder().decode(bytes)).toBe('PNG');
    expect(h.source.countOf('readBytes')).toBe(1);
    expect(h.source.countOf('read')).toBe(0);
  });
});

describe('Workspace: сохранение', () => {
  it('save пишет в источник и обновляет BASE', async () => {
    const h = makeWorkspace({ 'a.ts': 'было' });
    await h.ws.open(h.rid('a.ts'));
    const before = h.source.revisionOf('a.ts');
    await h.ws.writeText(h.rid('a.ts'), 'стало');

    const result = await h.ws.save(h.rid('a.ts'));

    expect(result.ok).toBe(true);
    expect(result.saved).toEqual([h.rid('a.ts')]);
    expect(h.source.textOf('a.ts')).toBe('стало');
    // BASE переехал на сохранённое: следующая правка меряется от него, а не от старого текста.
    expect(h.layer('base', 'a.ts')).toBe('стало');
    expect(h.ws.isDirty(h.rid('a.ts'))).toBe(false);

    // Ревизия в свойствах обновлена — иначе следующий save немедленно дал бы конфликт.
    expect(h.source.revisionOf('a.ts')).not.toBe(before);
    const stat = await h.ws.stat(h.rid('a.ts'));
    expect(stat?.revision).toBe(h.source.revisionOf('a.ts'));
  });

  it('новый файл в ещё не существующем каталоге: каталог создаётся при сохранении', async () => {
    // Источник с НАСТОЯЩИМ деревом, а не плоский двойник: `Source.write` пишет файл, а не
    // путь, и на несуществующем каталоге отвечает `not-found`. Так создаётся любой новый
    // модуль — форма по шаблону, вывод кодогена, — и без этого файл оставался бы рабочей
    // копией при полном молчании: операция сообщала об успехе, на диске пусто.
    seq += 1;
    const id = `fs${seq}`;
    const { root } = createFakeDirectory({ 'src/old.ts': 'x' });
    const source = createFsAccessSource(root, { id, handleKey: id });
    const opfs = createMemoryOpfs();
    const memoryDb = createMemoryIndexedDb();
    const ws = createWorkspace({
      id,
      source,
      files: createWorkspaceFileStore(id, { directory: opfs.directory }),
      meta: createWorkspaceMetaStore({ factory: memoryDb.factory, databaseName: `fs-${seq}` }),
    });
    const target = makeResourceId(id, 'src/forms/credit/model.ts');

    await ws.writeText(target, 'export const model = 1;');
    const result = await ws.save(target);

    expect(result.ok).toBe(true);
    expect((await source.read('src/forms/credit/model.ts')).text).toBe('export const model = 1;');
  });

  it('второе сохранение подряд проходит: ревизия не устарела', async () => {
    const h = makeWorkspace({ 'a.ts': 'v0' });

    await h.ws.writeText(h.rid('a.ts'), 'v1');
    expect((await h.ws.save()).ok).toBe(true);
    await h.ws.writeText(h.rid('a.ts'), 'v2');

    expect((await h.ws.save()).ok).toBe(true);
    expect(h.source.textOf('a.ts')).toBe('v2');
  });

  it('разошедшаяся ревизия даёт конфликт и не трогает BASE', async () => {
    const h = makeWorkspace({ 'a.ts': 'было' });
    await h.ws.open(h.rid('a.ts'));
    await h.ws.writeText(h.rid('a.ts'), 'наше');

    // Кто-то изменил файл мимо нас — ревизия у источника другая.
    h.source.put('a.ts', 'чужое');

    const result = await h.ws.save(h.rid('a.ts'));

    expect(result.ok).toBe(false);
    expect(result.saved).toEqual([]);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].id).toBe(h.rid('a.ts'));
    // Текущая ревизия источника обязана приехать в конфликте: без неё диалогу слияния
    // нечего показать.
    expect(result.conflicts[0].actual).toBe(h.source.revisionOf('a.ts'));
    expect(result.conflicts[0].expected).not.toBe(result.conflicts[0].actual);

    // Основание слияния сохранено: BASE прежний, правка на месте, признак изменённости жив.
    expect(h.layer('base', 'a.ts')).toBe('было');
    expect(h.layer('files', 'a.ts')).toBe('наше');
    expect(h.ws.isDirty(h.rid('a.ts'))).toBe(true);
    expect(h.source.textOf('a.ts')).toBe('чужое');
  });

  it('save без аргумента сохраняет всё изменённое; один конфликт не отменяет остальных', async () => {
    const h = makeWorkspace({ 'a.ts': 'a0', 'b.ts': 'b0', 'c.ts': 'c0' });

    await h.ws.writeText(h.rid('a.ts'), 'a1');
    await h.ws.writeText(h.rid('b.ts'), 'b1');
    // c.ts материализован, но не изменён — в сохранение он не попадает вовсе.
    await h.ws.readText(h.rid('c.ts'));
    h.source.put('b.ts', 'извне');

    const result: SaveResult = await h.ws.save();

    expect(result.saved).toEqual([h.rid('a.ts')]);
    expect(result.conflicts.map((conflict) => conflict.id)).toEqual([h.rid('b.ts')]);
    expect(result.ok).toBe(false);
    expect(h.source.textOf('a.ts')).toBe('a1');
    expect(h.source.textOf('c.ts')).toBe('c0');
  });

  it('сохранение неизменённого ничего не пишет', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });
    await h.ws.open(h.rid('a.ts'));
    h.source.forget();

    const result = await h.ws.save(h.rid('a.ts'));

    expect(result.ok).toBe(true);
    expect(result.saved).toEqual([]);
    expect(h.source.countOf('write')).toBe(0);
  });

  it('источник без записи отвечает отказом, а не исключением', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' }, { source: { writable: false } });
    await h.ws.writeText(h.rid('a.ts'), 'y');

    const result = await h.ws.save();

    expect(result.ok).toBe(false);
    expect(result.failures).toEqual([
      { id: h.rid('a.ts'), kind: 'unsupported', message: 'источник не поддерживает запись' },
    ]);
    // Правка не потеряна: она осталась в рабочей копии.
    expect(h.layer('files', 'a.ts')).toBe('y');
  });

  it('отказ сети попадает в failures, а не в конфликты', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });
    await h.ws.writeText(h.rid('a.ts'), 'y');
    h.source.failNext('write', 'a.ts', 'network');

    const result = await h.ws.save();

    expect(result.conflicts).toEqual([]);
    expect(result.failures[0]).toMatchObject({ id: h.rid('a.ts'), kind: 'network' });
    expect(h.ws.isDirty()).toBe(true);
  });
});

describe('Workspace: бюджет догрузки', () => {
  it('останавливается на потолке файлов и сообщает, где именно', async () => {
    const h = makeWorkspace(
      {
        'root.ts': "import './d1';\nimport './d2';\nimport './d3';\nimport './d4';",
        'd1.ts': 'a',
        'd2.ts': 'b',
        'd3.ts': 'c',
        'd4.ts': 'd',
      },
      { workspace: { closureBudget: { depth: 8, files: 3, bytes: 8 * 1024 * 1024 } } }
    );

    await h.ws.open(h.rid('root.ts'));

    expect(h.published).toHaveLength(1);
    const [diagnostic] = h.published[0].items;
    expect(diagnostic.code).toBe('workspace.closure-budget-files');
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.params).toMatchObject({ at: 'd3.ts', limit: 3, materialized: 3, pending: 2 });

    // Усечение действительно произошло — но не молча: d3 и d4 в рабочей области нет.
    expect(h.layer('files', 'd2.ts')).toBe('b');
    expect(h.layer('files', 'd3.ts')).toBeUndefined();
    expect(h.layer('files', 'd4.ts')).toBeUndefined();
  });

  it('останавливается на глубине', async () => {
    const h = makeWorkspace(
      {
        'f0.ts': "import './f1';",
        'f1.ts': "import './f2';",
        'f2.ts': "import './f3';",
        'f3.ts': 'end',
      },
      { workspace: { closureBudget: { depth: 1, files: 200, bytes: 8 * 1024 * 1024 } } }
    );

    await h.ws.open(h.rid('f0.ts'));

    expect(h.published[0].items[0]).toMatchObject({
      code: 'workspace.closure-budget-depth',
      params: { at: 'f1.ts', limit: 1 },
    });
    expect(h.layer('files', 'f2.ts')).toBeUndefined();
  });

  it('замыкание в пределах бюджета публикует пустой список, а не молчит', async () => {
    const h = makeWorkspace({ 'a.ts': "import './b';", 'b.ts': 'x' });

    await h.ws.open(h.rid('a.ts'));

    // Пустая публикация — законная: она снимает то, что догрузка сообщала раньше.
    expect(h.published).toHaveLength(1);
    expect(h.published[0].items).toEqual([]);
    expect(h.published[0].source).toBe('workspace.closure');
  });

  it('бэйр-спецификаторы не догружаются вовсе: за ними даже не ходят', async () => {
    const h = makeWorkspace({
      'a.ts': "import React from 'react';\nimport { core } from '@reformer/core';",
    });

    await h.ws.open(h.rid('a.ts'));

    expect(h.source.calls.map((call) => call.path)).not.toContain('react');
    expect(h.source.countOf('stat')).toBe(0);
    expect(h.published[0].items).toEqual([]);
  });
});

describe('Workspace: вытеснение', () => {
  const tight = { workspace: { evictionBudget: { files: 3, bytes: 1_000_000 } } };

  it('не трогает открытые и их зависимости, выбрасывая самое давнее', async () => {
    const h = makeWorkspace(
      { 'app.ts': "import './dep';", 'dep.ts': 'd', 'x.ts': 'x', 'y.ts': 'y' },
      tight
    );

    await h.ws.open(h.rid('app.ts')); // app + dep — оба защищены
    await h.ws.readText(h.rid('x.ts')); // третий
    await h.ws.readText(h.rid('y.ts')); // четвёртый — потолок превышен
    await settle();

    expect(h.layer('files', 'app.ts')).toBeDefined();
    expect(h.layer('files', 'dep.ts')).toBeDefined();
    expect(h.layer('files', 'y.ts')).toBeDefined();
    // Вытеснили самое давнее из незащищённого.
    expect(h.layer('files', 'x.ts')).toBeUndefined();
    expect(allChanges(h.events)).toContainEqual({ id: h.rid('x.ts'), type: 'evicted' });
  });

  it('BASE уходит в паре с содержимым', async () => {
    const h = makeWorkspace({ 'a.ts': 'a', 'b.ts': 'b', 'c.ts': 'c', 'd.ts': 'd' }, tight);

    await h.ws.readText(h.rid('a.ts'));
    await h.ws.readText(h.rid('b.ts'));
    await h.ws.readText(h.rid('c.ts'));
    await h.ws.readText(h.rid('d.ts'));

    expect(h.layer('files', 'a.ts')).toBeUndefined();
    // Выброшенный в одиночку BASE означал бы потерю возможности слияния.
    expect(h.layer('base', 'a.ts')).toBeUndefined();
    expect(h.layer('base', 'd.ts')).toBe('d');
  });

  it('изменённое не вытесняется, даже если оно самое давнее', async () => {
    const h = makeWorkspace({ 'a.ts': 'a', 'b.ts': 'b', 'c.ts': 'c', 'd.ts': 'd' }, tight);

    await h.ws.writeText(h.rid('a.ts'), 'правка');
    await h.ws.readText(h.rid('b.ts'));
    await h.ws.readText(h.rid('c.ts'));
    await h.ws.readText(h.rid('d.ts'));

    expect(h.layer('files', 'a.ts')).toBe('правка');
    expect(h.layer('files', 'b.ts')).toBeUndefined();
  });

  it('close снимает закрепление, но содержимое остаётся', async () => {
    const h = makeWorkspace({ 'app.ts': "import './dep';", 'dep.ts': 'd', 'x.ts': 'x' }, tight);

    await h.ws.open(h.rid('app.ts'));
    await h.ws.readText(h.rid('x.ts'));
    await h.ws.close(h.rid('app.ts'));

    // Потолок не превышен — закрытие само по себе ничего не удаляет.
    expect(h.ws.openedResources()).toEqual([]);
    expect(h.layer('files', 'app.ts')).toBe("import './dep';");
    expect(h.layer('files', 'dep.ts')).toBe('d');
    expect(allChanges(h.events).some((change) => change.type === 'evicted')).toBe(false);
  });

  it('после close бывшее открытым становится обычным кандидатом', async () => {
    const h = makeWorkspace(
      { 'app.ts': "import './dep';", 'dep.ts': 'd', 'x.ts': 'x', 'y.ts': 'y' },
      tight
    );

    await h.ws.open(h.rid('app.ts'));
    await h.ws.readText(h.rid('x.ts'));
    await h.ws.close(h.rid('app.ts'));
    // Четвёртый файл: теперь незащищённых четверо, и самый давний — бывшая вкладка.
    await h.ws.readText(h.rid('y.ts'));

    expect(h.layer('files', 'app.ts')).toBeUndefined();
    expect(h.layer('base', 'app.ts')).toBeUndefined();
    expect(h.layer('files', 'y.ts')).toBe('y');
  });

  it('вытесненное перечитывается из источника при следующем обращении', async () => {
    const h = makeWorkspace({ 'a.ts': 'a', 'b.ts': 'b', 'c.ts': 'c', 'd.ts': 'd' }, tight);

    for (const path of ['a.ts', 'b.ts', 'c.ts', 'd.ts']) await h.ws.readText(h.rid(path));
    h.source.forget();

    expect(await h.ws.readText(h.rid('a.ts'))).toBe('a');
    expect(h.source.countOf('read', 'a.ts')).toBe(1);
  });
});

describe('Workspace: события', () => {
  it('материализация замыкания приходит ОДНИМ пакетом, а не событием на ресурс', async () => {
    const h = makeWorkspace({
      'root.ts': "import './d1';\nimport './d2';",
      'd1.ts': 'a',
      'd2.ts': 'b',
    });

    await h.ws.open(h.rid('root.ts'));
    await settle();

    expect(h.events).toHaveLength(1);
    expect(h.events[0].changes).toEqual([
      { id: h.rid('root.ts'), type: 'materialized' },
      { id: h.rid('d1.ts'), type: 'materialized' },
      { id: h.rid('d2.ts'), type: 'materialized' },
    ]);
  });

  it('одиночное изменение — тоже пакет, из одного', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });
    await h.ws.open(h.rid('a.ts'));
    await settle();
    h.events.length = 0;

    await h.ws.writeText(h.rid('a.ts'), 'y');
    await settle();

    expect(h.events).toHaveLength(1);
    expect(h.events[0].changes).toEqual([{ id: h.rid('a.ts'), type: 'written' }]);
  });

  it('save отдаёт тип saved', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });
    await h.ws.writeText(h.rid('a.ts'), 'y');
    await settle();
    h.events.length = 0;

    await h.ws.save();
    await settle();

    expect(allChanges(h.events)).toEqual([{ id: h.rid('a.ts'), type: 'saved' }]);
  });

  it('соседние операции коалесцируются в один пакет', async () => {
    const h = makeWorkspace({ 'a.ts': 'x', 'b.ts': 'y' });

    await Promise.all([h.ws.readText(h.rid('a.ts')), h.ws.readText(h.rid('b.ts'))]);
    await settle();

    expect(h.events).toHaveLength(1);
    expect(h.events[0].changes).toHaveLength(2);
  });

  it('подписка снимается', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });
    const seen: WorkspaceChange[] = [];
    const subscription = h.ws.onDidChange((event) => seen.push(event));

    subscription.dispose();
    await h.ws.readText(h.rid('a.ts'));
    await settle();

    expect(seen).toEqual([]);
    expect(h.events).toHaveLength(1);
  });
});

describe('Workspace: свойства и листинг', () => {
  it('stat отвечает, не материализуя', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });

    const stat = await h.ws.stat(h.rid('a.ts'));

    expect(stat).toMatchObject({ kind: 'file', revision: h.source.revisionOf('a.ts') });
    expect(h.layer('files', 'a.ts')).toBeUndefined();
    expect(h.source.countOf('read')).toBe(0);
  });

  it('stat отсутствующего — null, а не отказ', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });

    expect(await h.ws.stat(h.rid('nope.ts'))).toBeNull();
  });

  it('stat материализованного отвечает из памяти', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });
    await h.ws.writeText(h.rid('a.ts'), 'длиннее');
    h.source.forget();

    const stat = await h.ws.stat(h.rid('a.ts'));

    expect(stat?.size).toBe(new TextEncoder().encode('длиннее').length);
    expect(h.source.countOf('stat')).toBe(0);
  });

  it('list показывает каталог источника', async () => {
    const h = makeWorkspace({ 'src/a.ts': 'a', 'src/b.ts': 'b', 'src/sub/c.ts': 'c' });

    const entries = await h.ws.list(h.rid('src'));

    expect(entries.map((entry) => `${entry.kind}:${entry.name}`)).toEqual([
      'directory:sub',
      'file:a.ts',
      'file:b.ts',
    ]);
    expect(entries[1].id).toBe(h.rid('src/a.ts'));
    expect(entries[1].mediaType).toBe('text/typescript');
  });

  it('list показывает и созданное локально, ещё не сохранённое', async () => {
    const h = makeWorkspace({ 'src/a.ts': 'a' });
    await h.ws.writeText(h.rid('src/new.ts'), 'свежий');

    const entries = await h.ws.list(h.rid('src'));

    expect(entries.map((entry) => entry.name)).toEqual(['a.ts', 'new.ts']);
  });

  it('list каталога, которого нет ни в источнике, ни локально — отказ источника', async () => {
    const h = makeWorkspace({ 'src/a.ts': 'a' });

    await expect(h.ws.list(h.rid('nope'))).rejects.toMatchObject({ kind: 'not-found' });
  });
});

describe('Workspace: свойства в хранилище', () => {
  it('материализация и сохранение доезжают до stats', async () => {
    const h = makeWorkspace({ 'a.ts': 'было' });

    await h.ws.open(h.rid('a.ts'));
    await h.ws.writeText(h.rid('a.ts'), 'стало');

    const dirty = await h.meta.getStat(h.wsId, 'a.ts');
    expect(dirty).toMatchObject({ dirty: true, hasBase: true, kind: 'file' });

    await h.ws.save();
    const saved = await h.meta.getStat(h.wsId, 'a.ts');
    expect(saved).toMatchObject({ dirty: false, revision: h.source.revisionOf('a.ts') });
  });

  it('вытесненное убирается из stats, а не остаётся врать', async () => {
    const h = makeWorkspace(
      { 'a.ts': 'a', 'b.ts': 'b', 'c.ts': 'c', 'd.ts': 'd' },
      { workspace: { evictionBudget: { files: 3, bytes: 1_000_000 } } }
    );

    for (const path of ['a.ts', 'b.ts', 'c.ts', 'd.ts']) await h.ws.readText(h.rid(path));

    const stats = await h.meta.listStats(h.wsId);
    expect(stats.map((record) => record.path).sort()).toEqual(['b.ts', 'c.ts', 'd.ts']);
  });

  it('вкладка попадает в opened и уходит оттуда при закрытии', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });

    await h.ws.open(h.rid('a.ts'));
    expect(await h.meta.listOpened(h.wsId)).toHaveLength(1);

    await h.ws.close(h.rid('a.ts'));
    expect(await h.meta.listOpened(h.wsId)).toEqual([]);
  });
});

describe('Workspace: деградация', () => {
  it('работает без метаданных: теряется восстановление набора, а не содержимое', async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });

    try {
      seq += 1;
      const id = `w${seq}`;
      const opfs = createMemoryOpfs();
      const source = createMemorySource({ 'a.ts': 'x' });
      // Хранилище без IndexedDB: каждая операция отказывает с `idb-unavailable`.
      const meta = createWorkspaceMetaStore({ databaseName: `dead-${seq}` });
      const ws = createWorkspace({
        id,
        source,
        files: createWorkspaceFileStore(id, { directory: opfs.directory }),
        meta,
      });

      const document = await ws.open(`${source.id}:a.ts`);
      await ws.writeText(`${source.id}:a.ts`, 'y');

      expect(document.getText()).toBe('y');
      expect(opfs.files()[`ws/${id}/files/a.ts`]).toBe('y');
      // Об отказе сказано вслух ровно один раз, а не на каждой операции.
      expect(errors).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});

/**
 * Шов с журналом изменений.
 *
 * Проверяется именно ШОВ, а не журнал: что правки рабочих копий доходят до него записями,
 * что без журнала не меняется ничего, и что его отказ не отменяет саму правку. Схлопывание,
 * снимки и уборка — предмет `journal/journal.test.ts`, и повторять их здесь нечего.
 */
describe('Workspace: журнал изменений', () => {
  /** Рабочая область с настоящим журналом над тем же хранилищем метаданных. */
  function withJournal(initial: Readonly<Record<string, string>> = {}): {
    readonly h: Harness;
    readonly journal: Journal;
  } {
    // Журнал создаётся ПОСЛЕ рабочей области (ему нужно её содержимое для снимков), а нужен
    // ей в момент создания — то же отложенное замыкание, что и в `createJournalRelief`.
    const holder: { journal?: Journal } = {};
    const h = makeWorkspace(initial, {
      workspace: { journal: { record: (input) => holder.journal!.record(input) } },
    });
    holder.journal = createJournal({
      store: h.meta,
      workspaceId: h.wsId,
      content: (resource) => h.ws.readText(resource),
    });
    return { h, journal: holder.journal };
  }

  it('правка рабочей копии становится записью журнала от имени человека', async () => {
    const { h, journal } = withJournal({ 'a.ts': 'первый' });

    await h.ws.writeText(h.rid('a.ts'), 'первый и второй');

    const records = await journal.list(h.rid('a.ts'));
    expect(records).toHaveLength(1);
    expect(records[0]!.origin).toBe('user');
    expect(records[0]!.payload).toEqual({
      kind: 'text',
      edits: [{ offset: 6, removed: '', inserted: ' и второй' }],
    });
  });

  it('правку машины и правку человека в журнале видно порознь', async () => {
    // То, ради чего канал происхождения и заведён: дверь записи одна на всех, и без пометки
    // ход ассистента неотличим от набора текста руками — а различимость это половина
    // ценности аудита.
    const { h, journal } = withJournal({ 'a.ts': 'начало' });

    await h.ws.writeText(h.rid('a.ts'), 'начало человек');
    await h.ws.writeText(h.rid('a.ts'), 'начало человек машина', { origin: 'agent' });

    const records = await journal.list(h.rid('a.ts'));
    expect(records.map((record) => record.origin)).toEqual(['user', 'agent']);
  });

  it('пометка происхождения разводит записи, которые иначе схлопнулись бы в одну', async () => {
    // Не следствие теста выше, а отдельное свойство: обе правки идут подряд, в одно окно
    // схлопывания и по одному ресурсу — то есть без пометки журнал слил бы их в ОДНУ запись,
    // и правка человека растворилась бы в ходе ассистента (или наоборот).
    const { h, journal } = withJournal({ 'a.ts': 'начало' });

    await h.ws.writeText(h.rid('a.ts'), 'начало человек');
    await h.ws.writeText(h.rid('a.ts'), 'начало человек машина', { origin: 'agent' });

    expect(await journal.list(h.rid('a.ts'))).toHaveLength(2);
  });

  it('идентификатор шага доходит до записи — по нему ход откатывается целиком', async () => {
    const { h, journal } = withJournal({ 'a.ts': 'основание' });

    // Ход, приземлившийся ДВУМЯ записями (так бывает при второй попытке), и человеческая
    // правка между ними: `undoTransaction` обязан снять обе записи хода и не тронуть чужую.
    await h.ws.writeText(h.rid('a.ts'), 'основание+ход1', { origin: 'agent', txId: 'ход-7' });
    await h.ws.writeText(h.rid('a.ts'), 'основание+ход1+рука');
    await h.ws.writeText(h.rid('a.ts'), 'основание+ход1+рука+ход2', {
      origin: 'agent',
      txId: 'ход-7',
    });

    const records = await journal.list(h.rid('a.ts'));
    expect(records.filter((record) => record.txId === 'ход-7')).toHaveLength(2);
    expect(await journal.undoTransaction(h.rid('a.ts'), 'ход-7', 'основание+ход1+рука+ход2')).toBe(
      'основание+рука'
    );
  });

  it('без пометки поведение прежнее: происхождение — человек, шага нет', async () => {
    // Страховка для 73 тестов рабочей области и для всех, кто зовёт `writeText` двумя
    // аргументами: параметр необязателен, и умолчание обязано совпадать с тем, что было.
    const { h, journal } = withJournal({ 'a.ts': 'x' });

    await h.ws.writeText(h.rid('a.ts'), 'y');

    const records = await journal.list(h.rid('a.ts'));
    expect(records[0]!.origin).toBe('user');
    expect(records[0]!.txId).toBeUndefined();
  });

  it('первая запись влечёт опорный снимок — иначе восстанавливать не от чего', async () => {
    const { h, journal } = withJournal({ 'a.ts': 'первый' });

    await h.ws.writeText(h.rid('a.ts'), 'второй');

    expect(await journal.restore(h.rid('a.ts'))).toBe('второй');
  });

  it('создание файла — вставка всего текста: рабочей копии до правки не было', async () => {
    const { h, journal } = withJournal();

    await h.ws.writeText(h.rid('new.ts'), 'создан');

    const records = await journal.list(h.rid('new.ts'));
    expect(records[0]!.payload).toEqual({
      kind: 'text',
      edits: [{ offset: 0, removed: '', inserted: 'создан' }],
    });
  });

  it('запись без изменения текста в журнал не идёт: дельта пуста', async () => {
    const { h, journal } = withJournal({ 'a.ts': 'то же самое' });

    await h.ws.writeText(h.rid('a.ts'), 'то же самое');

    expect(await journal.list(h.rid('a.ts'))).toEqual([]);
  });

  it('откат к BASE — тоже правка буфера, и он тоже в журнале', async () => {
    const { h, journal } = withJournal({ 'a.ts': 'основание' });

    await h.ws.writeText(h.rid('a.ts'), 'правка');
    await h.ws.revert(h.rid('a.ts'));

    // Схлопывание слило обе правки в одну запись (они соседние и от одного лица),
    // а воспроизведение обязано дать то, что человек видит после отката.
    expect(await journal.restore(h.rid('a.ts'))).toBe('основание');
  });

  it('сохранение в источник записью не является: буфер не менялся', async () => {
    const { h, journal } = withJournal({ 'a.ts': 'x' });

    await h.ws.writeText(h.rid('a.ts'), 'y');
    const before = (await journal.list(h.rid('a.ts'))).length;
    await h.ws.save(h.rid('a.ts'));

    expect(await journal.list(h.rid('a.ts'))).toHaveLength(before);
  });

  it('без журнала история не ведётся и лишних записей в хранилище нет', async () => {
    const h = makeWorkspace({ 'a.ts': 'x' });

    await h.ws.writeText(h.rid('a.ts'), 'y');
    await settle();

    expect(await h.meta.listWorkspaceHistory(h.wsId)).toEqual([]);
    expect(h.layer('files', 'a.ts')).toBe('y');
  });

  it('отказ журнала не отменяет правку и сообщается один раз', async () => {
    const errors: unknown[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args);
    });

    try {
      const h = makeWorkspace(
        { 'a.ts': 'x' },
        {
          workspace: {
            journal: {
              record: () => Promise.reject(new Error('журнал недоступен')),
            },
          },
        }
      );

      await h.ws.writeText(h.rid('a.ts'), 'y');
      await h.ws.writeText(h.rid('a.ts'), 'z');

      expect(h.layer('files', 'a.ts')).toBe('z');
      expect(h.ws.isDirty(h.rid('a.ts'))).toBe(true);
      expect(errors).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });
});
