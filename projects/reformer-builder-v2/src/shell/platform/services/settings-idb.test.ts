/**
 * Тесты хранилища настроек над IndexedDB.
 *
 * Проверяется то, ради чего модуль написан: настройки переживают перезагрузку, область
 * `workspace` пер-проектная, отказ IndexedDB деградирует в память, а не роняет инструмент,
 * и отказ ЗАПИСИ доходит до вызывающего — иначе служба не сможет откатить кэш.
 *
 * Двойник хранилища здесь свой, а не подставная IndexedDB: проверяется договор с
 * `WorkspaceMetaStore`, а не работа самой базы — та проверена в `workspace/storage/idb.test`.
 *
 * @module host/services/settings-idb.test
 */

import { describe, expect, it, vi } from 'vitest';

import { StorageError } from '@/shell/platform/workspace/storage/errors';
import { createIdbSettingsBackend, type SettingsMetaStore } from './settings-idb';
import { createSettingsService } from './settings';

type Bag = Record<string, unknown>;

/** Двойник метаданных: то же разделение «запись приложения / запись области». */
function fakeMeta(): SettingsMetaStore & {
  app: Map<string, Bag>;
  workspaces: Map<string, Bag>;
  known: Set<string>;
} {
  const app = new Map<string, Bag>();
  const workspaces = new Map<string, Bag>();
  const known = new Set<string>(['w1', 'w2']);
  return {
    app,
    workspaces,
    known,
    getAppSettings: (scope) => Promise.resolve(app.get(scope) ?? {}),
    putAppSettings: (scope, values) => {
      app.set(scope, { ...values });
      return Promise.resolve();
    },
    getWorkspaceSettings: (id) => Promise.resolve(workspaces.get(id) ?? {}),
    putWorkspaceSettings: (id, values) => {
      if (!known.has(id)) {
        return Promise.reject(new StorageError('bad-workspace-id', `нет области ${id}`));
      }
      workspaces.set(id, { ...values });
      return Promise.resolve();
    },
  };
}

/** Хранилище, которого в этом окружении нет, — ровно то, что отдаёт приватное окно. */
function unavailableMeta(): SettingsMetaStore {
  const fail = (): Promise<never> =>
    Promise.reject(new StorageError('idb-unavailable', 'IndexedDB недоступен в этом окружении'));
  return {
    getAppSettings: fail,
    putAppSettings: fail,
    getWorkspaceSettings: fail,
    putWorkspaceSettings: fail,
  };
}

describe('область user', () => {
  it('запись переживает пересоздание хранилища — это и есть «переживает перезагрузку»', async () => {
    const meta = fakeMeta();
    const first = createIdbSettingsBackend(meta);
    await first.write('user', 'host.locale', 'en');

    const second = createIdbSettingsBackend(meta);
    expect(await second.read('user')).toEqual({ 'host.locale': 'en' });
  });

  it('снятие ключа убирает его, а не пишет undefined', async () => {
    const meta = fakeMeta();
    const backend = createIdbSettingsBackend(meta);
    await backend.write('user', 'a', 1);
    await backend.write('user', 'b', 2);
    await backend.remove('user', 'a');
    expect(await backend.read('user')).toEqual({ b: 2 });
    expect(Object.keys(meta.app.get('user') ?? {})).toEqual(['b']);
  });

  it('запись, сделанная до первого чтения, не затирает то, что уже лежит в хранилище', async () => {
    const meta = fakeMeta();
    meta.app.set('user', { 'host.locale': 'en' });
    const backend = createIdbSettingsBackend(meta);

    await backend.write('user', 'host.theme', 'dark');

    expect(meta.app.get('user')).toEqual({ 'host.locale': 'en', 'host.theme': 'dark' });
  });
});

describe('область workspace пер-проектная', () => {
  it('у каждого проекта свои записи', async () => {
    const meta = fakeMeta();
    const backend = createIdbSettingsBackend(meta);

    backend.useWorkspace('w1');
    await backend.write('workspace', 'workspace.plugins.enabled', ['a']);
    backend.useWorkspace('w2');
    await backend.write('workspace', 'workspace.plugins.enabled', ['b']);

    expect(await backend.read('workspace')).toEqual({ 'workspace.plugins.enabled': ['b'] });
    backend.useWorkspace('w1');
    expect(await backend.read('workspace')).toEqual({ 'workspace.plugins.enabled': ['a'] });
  });

  it('проект, сменившийся в ожидании очереди, не получает чужую запись', async () => {
    const meta = fakeMeta();
    const backend = createIdbSettingsBackend(meta);

    backend.useWorkspace('w1');
    const pending = backend.write('workspace', 'a', 1);
    // Смена проекта, пока запись ещё в пути: адресат снят в момент вызова, а не работы.
    backend.useWorkspace('w2');
    await pending;

    expect(meta.workspaces.get('w1')).toEqual({ a: 1 });
    expect(meta.workspaces.get('w2')).toBeUndefined();
  });

  it('без проекта читать нечего, а писать некуда — и это разные ответы', async () => {
    const backend = createIdbSettingsBackend(fakeMeta());
    // Чтение обязано пройти: служба грузится ДО того, как проект восстановлен.
    expect(await backend.read('workspace')).toEqual({});
    await expect(backend.write('workspace', 'a', 1)).rejects.toThrow(/проект не открыт/);
  });

  it('отказ записи доходит до вызывающего: службе нужно чем откатить кэш', async () => {
    const meta = fakeMeta();
    meta.known.delete('w1');
    const backend = createIdbSettingsBackend(meta);
    backend.useWorkspace('w1');

    await expect(backend.write('workspace', 'a', 1)).rejects.toThrow(/нет области/);
  });
});

describe('деградация без IndexedDB', () => {
  it('настройки живут в памяти сессии, а не роняют инструмент', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const backend = createIdbSettingsBackend(unavailableMeta());

    expect(await backend.read('user')).toEqual({});
    await expect(backend.write('user', 'host.locale', 'en')).resolves.toBeUndefined();
    expect(await backend.read('user')).toEqual({ 'host.locale': 'en' });

    backend.useWorkspace('w1');
    await backend.write('workspace', 'a', 1);
    backend.useWorkspace('w2');
    // Даже в памяти область остаётся пер-проектной: иначе деградация меняла бы смысл настройки.
    expect(await backend.read('workspace')).toEqual({});

    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

describe('вместе со службой настроек', () => {
  it('перечитывание на смене проекта показывает настройки нового проекта', async () => {
    const meta = fakeMeta();
    meta.workspaces.set('w1', { 'workspace.k': 'первый' });
    meta.workspaces.set('w2', { 'workspace.k': 'второй' });
    const backend = createIdbSettingsBackend(meta);
    const settings = createSettingsService(backend);

    backend.useWorkspace('w1');
    await settings.hydrate();
    expect(settings.get('workspace.k')).toBe('первый');

    backend.useWorkspace('w2');
    await settings.hydrate({ forget: ['workspace'] });
    expect(settings.get('workspace.k')).toBe('второй');
  });

  it('своя запись в прежнем проекте не переезжает в новый', async () => {
    const meta = fakeMeta();
    const backend = createIdbSettingsBackend(meta);
    const settings = createSettingsService(backend);

    backend.useWorkspace('w1');
    await settings.hydrate();
    await settings.set('workspace.k', 'моё', 'workspace');

    backend.useWorkspace('w2');
    await settings.hydrate({ forget: ['workspace'] });

    expect(settings.get('workspace.k')).toBeUndefined();
    expect(meta.workspaces.get('w1')).toEqual({ 'workspace.k': 'моё' });
  });
});

describe('отвергнутая запись не остаётся в памяти', () => {
  it('следующая запись не уносит с собой то, что хранилище не приняло', async () => {
    const meta = fakeMeta();
    meta.known.delete('w1');
    const backend = createIdbSettingsBackend(meta);
    backend.useWorkspace('w1');

    await expect(backend.write('workspace', 'отвергнутое', 1)).rejects.toThrow(/нет области/);
    meta.known.add('w1');
    await backend.write('workspace', 'принятое', 2);

    // Область пишется целиком: останься отвергнутое в памяти — оно уехало бы этой записью.
    expect(meta.workspaces.get('w1')).toEqual({ принятое: 2 });
  });
});
