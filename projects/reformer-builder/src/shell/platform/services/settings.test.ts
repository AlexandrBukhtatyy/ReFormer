import { describe, expect, it, vi } from 'vitest';

import {
  createInMemorySettingsBackend,
  createSettingsService,
  scopeForKey,
  type SettingsBackend,
} from './settings';

/** Хранилище, которое отказывает на записи, — для проверки отката кэша. */
function failingBackend(error: Error): SettingsBackend {
  return {
    read: () => Promise.resolve({}),
    write: () => Promise.reject(error),
    remove: () => Promise.reject(error),
  };
}

describe('scopeForKey', () => {
  it('workspace.* — область рабочей области, host.* и plugin.* — пользовательская', () => {
    expect(scopeForKey('workspace.formatOnSave')).toBe('workspace');
    expect(scopeForKey('host.theme')).toBe('user');
    expect(scopeForKey('plugin.assistant.model')).toBe('user');
  });
});

describe('разрешение: workspace → user → умолчание вклада', () => {
  it('без записей действует умолчание вклада', () => {
    const settings = createSettingsService(createInMemorySettingsBackend());
    settings.registerDefault('host.theme', 'system');

    expect(settings.get('host.theme')).toBe('system');
  });

  it('без записей и без умолчания — undefined, а не отказ', () => {
    const settings = createSettingsService(createInMemorySettingsBackend());

    expect(settings.get('host.theme')).toBeUndefined();
  });

  it('запись user перекрывает умолчание', async () => {
    const settings = createSettingsService(createInMemorySettingsBackend());
    settings.registerDefault('host.theme', 'system');

    await settings.set('host.theme', 'dark');

    expect(settings.get('host.theme')).toBe('dark');
  });

  it('workspace перекрывает user — независимо от порядка записи', async () => {
    const settings = createSettingsService(createInMemorySettingsBackend());

    // Сначала глобально, потом в рабочей области.
    await settings.set('host.theme', 'dark', 'user');
    await settings.set('host.theme', 'light', 'workspace');
    expect(settings.get('host.theme')).toBe('light');

    // И в обратном порядке: сильнее не тот, кто записал позже, а тот, чья область сильнее.
    const other = createSettingsService(createInMemorySettingsBackend());
    await other.set('host.theme', 'light', 'workspace');
    await other.set('host.theme', 'dark', 'user');
    expect(other.get('host.theme')).toBe('light');
  });

  it('снятие записи workspace открывает user, снятие user — умолчание', async () => {
    const settings = createSettingsService(createInMemorySettingsBackend());
    settings.registerDefault('host.theme', 'system');
    await settings.set('host.theme', 'dark', 'user');
    await settings.set('host.theme', 'light', 'workspace');

    await settings.set('host.theme', undefined, 'workspace');
    expect(settings.get('host.theme')).toBe('dark');

    await settings.set('host.theme', undefined, 'user');
    expect(settings.get('host.theme')).toBe('system');
  });

  it('снятие умолчания возвращает undefined', () => {
    const settings = createSettingsService(createInMemorySettingsBackend());
    const registration = settings.registerDefault('host.theme', 'system');

    registration.dispose();

    expect(settings.get('host.theme')).toBeUndefined();
  });

  it('два умолчания на один ключ — ошибка, а не тихая замена', () => {
    const settings = createSettingsService(createInMemorySettingsBackend());
    settings.registerDefault('host.theme', 'system');

    expect(() => settings.registerDefault('host.theme', 'dark')).toThrow(/умолчание/);
  });
});

describe('область записи по умолчанию берётся из ключа', () => {
  it('workspace.* пишется в область рабочей области', async () => {
    const backend = createInMemorySettingsBackend();
    const settings = createSettingsService(backend);

    await settings.set('workspace.formatOnSave', true);

    await expect(backend.read('workspace')).resolves.toEqual({ 'workspace.formatOnSave': true });
    await expect(backend.read('user')).resolves.toEqual({});
  });

  it('host.* пишется в пользовательскую область', async () => {
    const backend = createInMemorySettingsBackend();
    const settings = createSettingsService(backend);

    await settings.set('host.theme', 'dark');

    await expect(backend.read('user')).resolves.toEqual({ 'host.theme': 'dark' });
  });
});

describe('уведомление об изменении', () => {
  it('сообщает ключ, чьё действующее значение изменилось', async () => {
    const settings = createSettingsService(createInMemorySettingsBackend());
    const seen: string[] = [];
    settings.onDidChange((key) => seen.push(key));

    await settings.set('host.theme', 'dark');

    expect(seen).toEqual(['host.theme']);
  });

  it('умолчание вклада — тоже изменение: get начинает отдавать значение', () => {
    const settings = createSettingsService(createInMemorySettingsBackend());
    const seen: string[] = [];
    settings.onDidChange((key) => seen.push(key));

    settings.registerDefault('host.theme', 'system');

    expect(seen).toEqual(['host.theme']);
  });

  it('запись, перекрытая сильной областью, не уведомляет: get вернёт то же самое', async () => {
    const settings = createSettingsService(createInMemorySettingsBackend());
    await settings.set('host.theme', 'light', 'workspace');
    const seen: string[] = [];
    settings.onDidChange((key) => seen.push(key));

    await settings.set('host.theme', 'dark', 'user');

    expect(seen).toEqual([]);
    expect(settings.get('host.theme')).toBe('light');
  });

  it('повторная запись того же значения не уведомляет', async () => {
    const settings = createSettingsService(createInMemorySettingsBackend());
    await settings.set('host.theme', 'dark');
    const cb = vi.fn();
    settings.onDidChange(cb);

    await settings.set('host.theme', 'dark');

    expect(cb).not.toHaveBeenCalled();
  });

  it('dispose снимает подписку', async () => {
    const settings = createSettingsService(createInMemorySettingsBackend());
    const cb = vi.fn();
    settings.onDidChange(cb).dispose();

    await settings.set('host.theme', 'dark');

    expect(cb).not.toHaveBeenCalled();
  });
});

describe('запись видна до подтверждения хранилища', () => {
  it('get отдаёт новое значение, не дожидаясь промиса', () => {
    const settings = createSettingsService(createInMemorySettingsBackend());

    const pending = settings.set('host.theme', 'dark');

    expect(settings.get('host.theme')).toBe('dark');
    return pending;
  });

  it('отказ хранилища откатывает кэш и пробрасывается вызывающему', async () => {
    const settings = createSettingsService(failingBackend(new Error('IndexedDB недоступна')));
    settings.registerDefault('host.theme', 'system');
    const seen: string[] = [];
    settings.onDidChange((key) => seen.push(key));

    await expect(settings.set('host.theme', 'dark')).rejects.toThrow('IndexedDB недоступна');

    expect(settings.get('host.theme')).toBe('system');
    // Дважды: применили и откатили — подписчик обязан узнать про оба перехода.
    expect(seen).toEqual(['host.theme', 'host.theme']);
  });
});

describe('hydrate', () => {
  it('заполняет кэш обеими областями и уведомляет об изменившихся ключах', async () => {
    const backend = createInMemorySettingsBackend({
      user: { 'host.theme': 'dark', 'host.locale': 'ru' },
      workspace: { 'host.theme': 'light' },
    });
    const settings = createSettingsService(backend);
    settings.registerDefault('host.theme', 'system');
    const seen: string[] = [];
    settings.onDidChange((key) => seen.push(key));

    await settings.hydrate();

    expect(settings.get('host.theme')).toBe('light');
    expect(settings.get('host.locale')).toBe('ru');
    expect([...seen].sort()).toEqual(['host.locale', 'host.theme']);
  });

  it('до загрузки get отдаёт умолчание вклада, а не отказ', () => {
    const settings = createSettingsService(
      createInMemorySettingsBackend({ user: { 'host.theme': 'dark' } })
    );
    settings.registerDefault('host.theme', 'system');

    expect(settings.get('host.theme')).toBe('system');
  });

  it('не затирает запись, сделанную пока хранилище читалось', async () => {
    const settings = createSettingsService(
      createInMemorySettingsBackend({ user: { 'host.theme': 'dark' } })
    );

    const loading = settings.hydrate();
    await settings.set('host.theme', 'light');
    await loading;

    expect(settings.get('host.theme')).toBe('light');
  });
});

/**
 * Хранилище, содержимое которого можно подменить снаружи, — так выглядит смена проекта:
 * область `workspace` та же, а записи под ней уже другого проекта.
 */
function swappableBackend(): SettingsBackend & { data: Record<string, Record<string, unknown>> } {
  const data: Record<string, Record<string, unknown>> = { user: {}, workspace: {} };
  return {
    data,
    read: (scope) => Promise.resolve({ ...data[scope] }),
    write: (scope, key, value) => {
      data[scope][key] = value;
      return Promise.resolve();
    },
    remove: (scope, key) => {
      delete data[scope][key];
      return Promise.resolve();
    },
  };
}

describe('hydrate({ forget })', () => {
  it('забытая область берёт значения хранилища, а не записи этой сессии', async () => {
    const backend = swappableBackend();
    const settings = createSettingsService(backend);
    await settings.set('workspace.k', 'моё', 'workspace');

    backend.data.workspace = { 'workspace.k': 'другого проекта' };
    await settings.hydrate({ forget: ['workspace'] });

    expect(settings.get('workspace.k')).toBe('другого проекта');
  });

  it('без forget запись этой сессии перечитывание переживает — прежнее поведение цело', async () => {
    const backend = swappableBackend();
    const settings = createSettingsService(backend);
    await settings.set('workspace.k', 'моё', 'workspace');

    backend.data.workspace = { 'workspace.k': 'другого проекта' };
    await settings.hydrate();

    expect(settings.get('workspace.k')).toBe('моё');
  });

  it('забывается и СНЯТИЕ значения, а не только запись', async () => {
    const backend = swappableBackend();
    backend.data.workspace = { 'workspace.k': 'прежнего проекта' };
    const settings = createSettingsService(backend);
    await settings.hydrate();
    // Снятый ключ в кэше не лежит: обход кэша его бы не нашёл, и «снято» пережило бы смену.
    await settings.set('workspace.k', undefined, 'workspace');

    backend.data.workspace = { 'workspace.k': 'нового проекта' };
    await settings.hydrate({ forget: ['workspace'] });

    expect(settings.get('workspace.k')).toBe('нового проекта');
  });

  it('пустая область нового проекта опустошает и кэш', async () => {
    const backend = swappableBackend();
    const settings = createSettingsService(backend);
    await settings.set('workspace.k', 'моё', 'workspace');

    backend.data.workspace = {};
    await settings.hydrate({ forget: ['workspace'] });

    expect(settings.get('workspace.k')).toBeUndefined();
  });

  it('чужая область не забывается заодно', async () => {
    const backend = swappableBackend();
    const settings = createSettingsService(backend);
    await settings.set('host.theme', 'light');
    await settings.set('workspace.k', 'моё', 'workspace');

    backend.data.user = { 'host.theme': 'dark' };
    backend.data.workspace = {};
    await settings.hydrate({ forget: ['workspace'] });

    expect(settings.get('host.theme')).toBe('light');
    expect(settings.get('workspace.k')).toBeUndefined();
  });

  it('о забытом ключе подписчику сообщают: действующее значение изменилось', async () => {
    const backend = swappableBackend();
    const settings = createSettingsService(backend);
    await settings.set('workspace.k', 'моё', 'workspace');
    const seen: string[] = [];
    settings.onDidChange((key) => seen.push(key));

    backend.data.workspace = {};
    await settings.hydrate({ forget: ['workspace'] });

    expect(seen).toEqual(['workspace.k']);
  });
});
