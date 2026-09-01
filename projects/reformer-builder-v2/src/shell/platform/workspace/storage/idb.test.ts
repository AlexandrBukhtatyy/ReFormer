/**
 * Тесты хранилища метаданных — против подставной базы из `testing.ts`.
 *
 * Проверяются те три вещи, ради которых модуль переписан относительно v1: одно соединение,
 * резолв записи ПОСЛЕ коммита и обработка квоты ровно с одним повтором. Всё остальное
 * (четыре хранилища, каскад, порядок) — вокруг них.
 *
 * @module host/workspace/storage/idb.test
 */

import { describe, expect, it, vi } from 'vitest';

import { isStorageError } from './errors';
import {
  STORE_HISTORY,
  STORE_OPENED,
  STORE_STATS,
  createWorkspaceMetaStore,
  type HistoryRecord,
  type OpenedRecord,
  type StatRecord,
  type WorkspaceMetaStore,
  type WorkspaceMetaStoreOptions,
  type WorkspaceRecord,
} from './idb';
import { createMemoryIndexedDb, type MemoryIndexedDbControl } from './testing';

let dbSeq = 0;

/** Своя база на тест: модульный пул соединений иначе протёк бы между тестами. */
function makeStore(options: Omit<WorkspaceMetaStoreOptions, 'factory' | 'databaseName'> = {}): {
  store: WorkspaceMetaStore;
  control: MemoryIndexedDbControl;
} {
  const memory = createMemoryIndexedDb();
  dbSeq += 1;
  const store = createWorkspaceMetaStore({
    factory: memory.factory,
    databaseName: `test-${dbSeq}`,
    // Оценку места по умолчанию берут у navigator — в node его нет; отдаём «места вдоволь»,
    // чтобы превентивная ветка не мешала проверять остальное.
    estimate: async () => ({ usage: 0, quota: 1_000_000 }),
    ...options,
  });
  return { store, control: memory.control };
}

const workspace = (id: string, lastOpenedAt = 1): WorkspaceRecord => ({
  id,
  sourceId: 'fs',
  descriptor: { kind: 'fs', handleKey: `handle-${id}` },
  createdAt: 0,
  lastOpenedAt,
});

const opened = (workspaceId: string, resourceId: string, order: number): OpenedRecord => ({
  workspaceId,
  resourceId,
  order,
  pinned: false,
  openedAt: 0,
  activatedAt: 0,
});

const stat = (workspaceId: string, path: string): StatRecord => ({
  workspaceId,
  path,
  kind: 'file',
  revision: 'r1',
  size: 10,
  hasBase: true,
  materializedAt: 0,
  lastUsedAt: 0,
  dirty: false,
});

const entry = (workspaceId: string, resourceId: string, seq: number): HistoryRecord => ({
  kind: 'entry',
  workspaceId,
  resourceId,
  seq,
  ts: seq,
  bytes: 1,
  origin: 'user',
  payload: { kind: 'text', edits: [{ offset: 0, removed: '', inserted: 'a' }] },
});

describe('соединение', () => {
  it('открывается один раз на много операций', async () => {
    const { store, control } = makeStore();
    await store.putWorkspace(workspace('w1'));
    await store.getWorkspace('w1');
    await store.listWorkspaces();

    // Ошибка v1: открытие БД на каждый вызов. Оно не бесплатно, а платится за каждую операцию.
    expect(control.opens).toBe(1);
    store.dispose();
  });

  it('переоткрывается, если соединение закрыли снаружи', async () => {
    const { store, control } = makeStore();
    await store.putWorkspace(workspace('w1'));

    // Очистка данных сайта или версия из другой вкладки: без переоткрытия хранилище
    // осталось бы сломанным до перезагрузки страницы.
    control.closeAll('close');
    expect(await store.getWorkspace('w1')).not.toBeNull();
    expect(control.opens).toBe(2);
    store.dispose();
  });

  it('делит соединение между хранилищами и закрывает его по последнему владельцу', async () => {
    const memory = createMemoryIndexedDb();
    const shared = { factory: memory.factory, databaseName: 'shared' };
    const first = createWorkspaceMetaStore(shared);
    const second = createWorkspaceMetaStore(shared);

    await first.putWorkspace(workspace('w1'));
    await second.getWorkspace('w1');
    expect(memory.control.opens).toBe(1);

    first.dispose();
    await expect(second.getWorkspace('w1')).resolves.not.toBeNull();
    expect(memory.control.opens).toBe(1);
    second.dispose();
  });
});

describe('запись резолвится после коммита', () => {
  it('к моменту возврата транзакция уже закоммичена', async () => {
    const { store, control } = makeStore();
    const before = control.commits;

    await store.putWorkspace(workspace('w1'));

    // Резолв по `request.onsuccess` (как в v1) означал бы «запрос принят», а не «данные
    // на диске»: читатель следом мог бы не увидеть запись.
    expect(control.commits).toBe(before + 1);
    expect(await store.getWorkspace('w1')).not.toBeNull();
  });
});

describe('workspaces', () => {
  it('кладёт и достаёт дескриптор источника', async () => {
    const { store } = makeStore();
    await store.putWorkspace(workspace('w1'));
    expect(await store.getWorkspace('w1')).toMatchObject({
      id: 'w1',
      sourceId: 'fs',
      descriptor: { kind: 'fs', handleKey: 'handle-w1' },
    });
  });

  it('отсутствующая область — null, а не отказ', async () => {
    const { store } = makeStore();
    expect(await store.getWorkspace('нет')).toBeNull();
  });

  it('список идёт свежими вперёд', async () => {
    const { store } = makeStore();
    await store.putWorkspace(workspace('w1', 10));
    await store.putWorkspace(workspace('w2', 30));
    await store.putWorkspace(workspace('w3', 20));
    expect((await store.listWorkspaces()).map((it) => it.id)).toEqual(['w2', 'w3', 'w1']);
  });
});

describe('настройки', () => {
  it('область приложения переживает перезапись целиком', async () => {
    const { store } = makeStore();
    expect(await store.getAppSettings('user')).toEqual({});
    await store.putAppSettings('user', { 'host.locale': 'en' });
    await store.putAppSettings('user', { 'host.locale': 'en', 'host.theme': 'dark' });
    expect(await store.getAppSettings('user')).toEqual({
      'host.locale': 'en',
      'host.theme': 'dark',
    });
  });

  it('настройки области лежат в её записи и у каждой области свои', async () => {
    const { store } = makeStore();
    await store.putWorkspace(workspace('w1'));
    await store.putWorkspace(workspace('w2'));

    await store.putWorkspaceSettings('w1', { 'workspace.plugins.enabled': ['a'] });

    expect(await store.getWorkspaceSettings('w1')).toEqual({ 'workspace.plugins.enabled': ['a'] });
    // Половина ценности задачи: список включённых плагинов принадлежит проекту, а не оболочке.
    expect(await store.getWorkspaceSettings('w2')).toEqual({});
  });

  it('запись настроек не затирает остальную запись области', async () => {
    const { store } = makeStore();
    await store.putWorkspace(workspace('w1', 42));
    await store.putWorkspaceSettings('w1', { a: 1 });
    expect(await store.getWorkspace('w1')).toMatchObject({
      id: 'w1',
      sourceId: 'fs',
      lastOpenedAt: 42,
      settings: { a: 1 },
    });
  });

  it('настройки уходят вместе с областью — отдельной уборки им не нужно', async () => {
    const { store } = makeStore();
    await store.putWorkspace(workspace('w1'));
    await store.putWorkspaceSettings('w1', { a: 1 });
    await store.removeWorkspace('w1');
    expect(await store.getWorkspaceSettings('w1')).toEqual({});
  });

  it('области нет — отказ, а не молчаливая потеря записи', async () => {
    const { store } = makeStore();
    await expect(store.putWorkspaceSettings('нет', { a: 1 })).rejects.toSatisfy((err) =>
      isStorageError(err, 'bad-workspace-id')
    );
  });
});

describe('opened и stats', () => {
  it('вкладки отдаются в порядке ряда и только своей области', async () => {
    const { store } = makeStore();
    await store.putOpened(opened('w1', 'fs:b.ts', 2));
    await store.putOpened(opened('w1', 'fs:a.ts', 1));
    await store.putOpened(opened('w2', 'fs:c.ts', 1));

    expect((await store.listOpened('w1')).map((it) => it.resourceId)).toEqual([
      'fs:a.ts',
      'fs:b.ts',
    ]);
  });

  it('закрытие вкладки снимает запись, но соседей не трогает', async () => {
    const { store } = makeStore();
    await store.putOpened(opened('w1', 'fs:a.ts', 1));
    await store.putOpened(opened('w1', 'fs:b.ts', 2));
    await store.removeOpened('w1', 'fs:a.ts');
    expect((await store.listOpened('w1')).map((it) => it.resourceId)).toEqual(['fs:b.ts']);
  });

  it('свойства адресуются нормализованным путём', async () => {
    const { store } = makeStore();
    await store.putStat(stat('w1', 'src/a.ts'));
    // Два написания одного пути обязаны быть одной записью, иначе кэш материализуется дважды.
    expect(await store.getStat('w1', './src//a.ts')).toMatchObject({ path: 'src/a.ts' });
  });

  it('пакет свойств кладётся одной транзакцией', async () => {
    const { store, control } = makeStore();
    const before = control.commits;
    await store.putStats([stat('w1', 'a.ts'), stat('w1', 'b.ts'), stat('w1', 'c.ts')]);

    // Материализация замыкания приносит до 200 записей — по транзакции на каждую было бы
    // 200 коммитов на одно открытие документа.
    expect(control.commits).toBe(before + 1);
    expect((await store.listStats('w1')).map((it) => it.path)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('пустой пакет не заводит транзакции вовсе', async () => {
    const { store, control } = makeStore();
    const before = control.commits;
    await store.putStats([]);
    expect(control.commits).toBe(before);
  });

  it('снимает свойства выбранных путей', async () => {
    const { store } = makeStore();
    await store.putStats([stat('w1', 'a.ts'), stat('w1', 'b.ts')]);
    await store.removeStats('w1', ['a.ts']);
    expect((await store.listStats('w1')).map((it) => it.path)).toEqual(['b.ts']);
  });
});

describe('history', () => {
  it('журнал ресурса читается в порядке seq', async () => {
    const { store } = makeStore();
    await store.appendHistory(entry('w1', 'fs:a.ts', 3));
    await store.appendHistory(entry('w1', 'fs:a.ts', 1));
    await store.appendHistory(entry('w1', 'fs:b.ts', 2));

    expect((await store.listHistory('w1', 'fs:a.ts')).map((it) => it.seq)).toEqual([1, 3]);
  });

  it('seq монотонен по области, а не по ресурсу', async () => {
    const { store } = makeStore();
    await store.appendHistory(entry('w1', 'fs:a.ts', 1));
    await store.appendHistory(entry('w1', 'fs:b.ts', 7));
    await store.appendHistory(entry('w2', 'fs:a.ts', 99));

    // Журнал — ОДИН поток на область: иначе «покажи, что изменилось» пришлось бы собирать
    // из нескольких источников с разными правилами упорядочивания.
    expect(await store.lastSeq('w1')).toBe(7);
    expect(await store.lastSeq('w2')).toBe(99);
    expect(await store.lastSeq('нет-такой')).toBe(0);
  });

  it('удаляет записи старше границы', async () => {
    const { store } = makeStore();
    for (const seq of [1, 2, 3, 4]) await store.appendHistory(entry('w1', 'fs:a.ts', seq));

    expect(await store.removeHistoryBefore('w1', 3)).toBe(2);
    expect((await store.listHistory('w1', 'fs:a.ts')).map((it) => it.seq)).toEqual([3, 4]);
  });

  it('удаляет самые старые записи области поперёк ресурсов', async () => {
    const { store } = makeStore();
    await store.appendHistory(entry('w1', 'fs:b.ts', 1));
    await store.appendHistory(entry('w1', 'fs:a.ts', 2));
    await store.appendHistory(entry('w1', 'fs:b.ts', 3));

    expect(await store.removeOldestHistory('w1', 2)).toBe(2);
    expect((await store.listHistory('w1', 'fs:b.ts')).map((it) => it.seq)).toEqual([3]);
    expect(await store.listHistory('w1', 'fs:a.ts')).toEqual([]);
  });

  it('снимок хранит содержимое: от него журнал и проигрывается', async () => {
    const { store } = makeStore();
    await store.appendHistory({
      kind: 'snapshot',
      workspaceId: 'w1',
      resourceId: 'fs:a.ts',
      seq: 1,
      ts: 1,
      bytes: 5,
      content: 'текст',
    });
    const [record] = await store.listHistory('w1', 'fs:a.ts');
    expect(record).toMatchObject({ kind: 'snapshot', content: 'текст' });
  });
});

describe('удаление рабочей области', () => {
  it('уносит вкладки, свойства и журнал — и только своей области', async () => {
    const { store, control } = makeStore();
    await store.putWorkspace(workspace('w1'));
    await store.putWorkspace(workspace('w2'));
    await store.putOpened(opened('w1', 'fs:a.ts', 1));
    await store.putOpened(opened('w2', 'fs:a.ts', 1));
    await store.putStat(stat('w1', 'a.ts'));
    await store.putStat(stat('w2', 'a.ts'));
    await store.appendHistory(entry('w1', 'fs:a.ts', 1));
    await store.appendHistory(entry('w2', 'fs:a.ts', 1));

    await store.removeWorkspace('w1');

    // Полуудалённая область — это осиротевший журнал, который потом некому ни показать, ни убрать.
    expect(await store.getWorkspace('w1')).toBeNull();
    for (const name of [STORE_OPENED, STORE_STATS, STORE_HISTORY]) {
      expect(control.dump(name).map((it) => it.workspaceId)).toEqual(['w2']);
    }
  });
});

describe('квота', () => {
  it('освобождает место и повторяет запись — один раз', async () => {
    const relief = vi.fn(async () => undefined);
    const { store, control } = makeStore({ onQuotaPressure: relief });
    control.failNextWrites(1);

    await store.putWorkspace(workspace('w1'));

    expect(relief).toHaveBeenCalledTimes(1);
    expect(relief).toHaveBeenCalledWith({ workspaceId: 'w1', urgent: true });
    expect(await store.getWorkspace('w1')).not.toBeNull();
  });

  it('после второго отказа сдаётся с понятным кодом, а не крутит цикл', async () => {
    const relief = vi.fn(async () => undefined);
    const { store, control } = makeStore({ onQuotaPressure: relief });
    control.failNextWrites(5);

    await expect(store.putWorkspace(workspace('w1'))).rejects.toSatisfy((err: unknown) =>
      isStorageError(err, 'quota-exceeded')
    );

    // Бесконечный цикл «освободили — не влезло» опаснее отказа: он выглядит как зависший UI.
    expect(relief).toHaveBeenCalledTimes(1);
  });

  it('прерванная транзакция откатывается целиком', async () => {
    const { store, control } = makeStore({ onQuotaPressure: async () => undefined });
    control.failNextWrites(5);

    await expect(
      store.putStats([stat('w1', 'a.ts'), stat('w1', 'b.ts'), stat('w1', 'c.ts')])
    ).rejects.toThrow();

    // Половина пакета на диске была бы хуже, чем ничего: `stats` разошлись бы с OPFS.
    expect(control.dump(STORE_STATS)).toEqual([]);
    expect(control.aborts).toBeGreaterThan(0);
  });

  it('превентивно освобождает место, не дожидаясь отказа', async () => {
    const relief = vi.fn(async () => undefined);
    const { store } = makeStore({
      onQuotaPressure: relief,
      estimate: async () => ({ usage: 99, quota: 100 }),
    });

    await store.putWorkspace(workspace('w1'));

    expect(relief).toHaveBeenCalledWith({ workspaceId: 'w1', urgent: false });
  });

  it('оценку спрашивает не чаще одного раза в окно', async () => {
    const estimate = vi.fn(async () => ({ usage: 0, quota: 100 }));
    let clock = 1_000;
    const { store } = makeStore({ estimate, now: () => clock });

    await store.putWorkspace(workspace('w1'));
    await store.putWorkspace(workspace('w2'));
    expect(estimate).toHaveBeenCalledTimes(1);

    clock += 60_000;
    await store.putWorkspace(workspace('w3'));
    expect(estimate).toHaveBeenCalledTimes(2);
  });

  it('умолчательное освобождение выбрасывает самые старые записи журнала', async () => {
    const { store, control } = makeStore({ estimate: async () => ({ usage: 99, quota: 100 }) });
    for (const seq of [1, 2, 3]) await store.appendHistory(entry('w1', 'fs:a.ts', seq));
    control.failNextWrites(1);

    await store.putStat(stat('w1', 'a.ts'));

    // Умолчание намеренно грубое: инвариант опорного снимка знает владелец журнала (Э6),
    // и он обязан передать свою политику через onQuotaPressure.
    expect(await store.listHistory('w1', 'fs:a.ts')).toEqual([]);
    expect(await store.getStat('w1', 'a.ts')).not.toBeNull();
  });
});

describe('без IndexedDB', () => {
  it('отказывает промисом с объяснимым кодом', async () => {
    // В node глобального indexedDB нет — получаем ровно тот объект, что увидит приватный режим.
    const store = createWorkspaceMetaStore();
    await expect(store.getWorkspace('w1')).rejects.toSatisfy((err: unknown) =>
      isStorageError(err, 'idb-unavailable')
    );
    expect(() => store.dispose()).not.toThrow();
  });
});
