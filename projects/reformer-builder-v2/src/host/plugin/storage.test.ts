import { describe, expect, it } from 'vitest';

import {
  createMemoryStorageBackend,
  createPluginStorage,
  createSecretSessionStore,
  createSecretStorage,
  type PluginStorageBackend,
} from './storage';

interface Write {
  readonly namespace: string;
  readonly key: string;
  readonly value: unknown;
}

interface RecordingBackend extends PluginStorageBackend {
  readonly writes: Write[];
}

/**
 * Подставной бэкенд: памятный плюс журнал записей.
 *
 * Журнал нужен ровно одному утверждению — «секрет без `persist` не попадает в бэкенд».
 * Проверять это через `keys()` было бы слабее: запись, тут же стёртая, в ключах не видна,
 * а в базе она уже побывала.
 */
function createRecordingBackend(): RecordingBackend {
  const inner = createMemoryStorageBackend();
  const writes: Write[] = [];

  return {
    writes,
    get: (namespace, key) => inner.get(namespace, key),
    set: async (namespace, key, value) => {
      writes.push({ namespace, key, value });
      await inner.set(namespace, key, value);
    },
    delete: (namespace, key) => inner.delete(namespace, key),
    keys: (namespace) => inner.keys(namespace),
  };
}

describe('PluginStorage', () => {
  it('кладёт, отдаёт, удаляет и перечисляет свои ключи', async () => {
    const storage = createPluginStorage('acme', createMemoryStorageBackend());

    await storage.set('открытые', ['a.json', 'b.json']);
    await storage.set('масштаб', 1.5);

    await expect(storage.get('открытые')).resolves.toEqual(['a.json', 'b.json']);
    await expect(storage.keys()).resolves.toEqual(['открытые', 'масштаб']);

    await storage.delete('масштаб');
    await expect(storage.get('масштаб')).resolves.toBeUndefined();
    await expect(storage.keys()).resolves.toEqual(['открытые']);
  });

  it('пространства двух плагинов над одним бэкендом не пересекаются', async () => {
    const backend = createMemoryStorageBackend();
    const acme = createPluginStorage('acme', backend);
    const other = createPluginStorage('other', backend);

    await acme.set('состояние', 'а');
    await other.set('состояние', 'б');

    await expect(acme.get('состояние')).resolves.toBe('а');
    await expect(other.get('состояние')).resolves.toBe('б');
    await expect(other.keys()).resolves.toEqual(['состояние']);
  });

  it('идентификатор с двоеточием не попадает в чужое пространство', async () => {
    const backend = createMemoryStorageBackend();
    // Пространства строятся как `plugin:<id>:data` и `plugin:<id>:secrets`; без суффикса
    // плагин с таким именем читал бы чужие секреты.
    const tricky = createPluginStorage('acme:secrets', backend);
    const acme = createPluginStorage('acme', backend);
    const acmeSecrets = createSecretStorage('acme', {
      session: createSecretSessionStore(),
      backend,
    });

    await acmeSecrets.set('токен', 'секрет', { persist: true });
    await acme.set('токен', 'данные');

    await expect(tricky.get('токен')).resolves.toBeUndefined();
    await expect(tricky.keys()).resolves.toEqual([]);
  });

  it('отдаёт копию, а не ссылку на хранимое: так ведёт себя IndexedDB', async () => {
    const storage = createPluginStorage('acme', createMemoryStorageBackend());
    const value = { вкладки: ['a.json'] };

    await storage.set('состояние', value);
    value.вкладки.push('b.json');
    const stored = await storage.get<{ вкладки: string[] }>('состояние');
    stored?.вкладки.push('c.json');

    await expect(storage.get('состояние')).resolves.toEqual({ вкладки: ['a.json'] });
  });

  it('пустой ключ — отказ, а не запись под именем «»', async () => {
    const storage = createPluginStorage('acme', createMemoryStorageBackend());

    await expect(storage.set('  ', 1)).rejects.toThrow(/ключ/);
    await expect(storage.get('')).rejects.toThrow(/ключ/);
  });

  it('пустой идентификатор плагина — отказ', () => {
    expect(() => createPluginStorage(' ', createMemoryStorageBackend())).toThrow(/пуст/);
  });
});

describe('SecretStorage', () => {
  const withSession = (backend: PluginStorageBackend, pluginId = 'acme') =>
    createSecretStorage(pluginId, { session: createSecretSessionStore(), backend });

  it('секрет без persist не попадает в бэкенд, но читается в этой сессии', async () => {
    const backend = createRecordingBackend();
    const secrets = withSession(backend);

    await secrets.set('api-key', 'сек-рет');

    expect(backend.writes).toEqual([]);
    await expect(secrets.get('api-key')).resolves.toBe('сек-рет');
  });

  it('без persist не переживает перезагрузку страницы', async () => {
    const backend = createMemoryStorageBackend();
    await withSession(backend).set('api-key', 'сек-рет');

    // Новая память сессии над тем же постоянным хранилищем — это и есть перезагрузка страницы.
    await expect(withSession(backend).get('api-key')).resolves.toBeUndefined();
  });

  it('с persist переживает перезагрузку страницы', async () => {
    const backend = createRecordingBackend();

    await withSession(backend).set('api-key', 'сек-рет', { persist: true });

    expect(backend.writes).toHaveLength(1);
    expect(backend.writes[0].value).toBe('сек-рет');
    await expect(withSession(backend).get('api-key')).resolves.toBe('сек-рет');
  });

  it('set без persist снимает прежнюю постоянную копию того же ключа', async () => {
    const backend = createMemoryStorageBackend();
    const secrets = withSession(backend);

    await secrets.set('api-key', 'старый', { persist: true });
    await secrets.set('api-key', 'новый');

    await expect(secrets.get('api-key')).resolves.toBe('новый');
    // Иначе после перезагрузки вернулся бы старый ключ — «приложение помнит то, что я стёр».
    await expect(withSession(backend).get('api-key')).resolves.toBeUndefined();
  });

  it('delete убирает и сеансовую, и постоянную копию', async () => {
    const backend = createMemoryStorageBackend();
    const secrets = withSession(backend);
    await secrets.set('api-key', 'сек-рет', { persist: true });

    await secrets.delete('api-key');

    await expect(secrets.get('api-key')).resolves.toBeUndefined();
    await expect(withSession(backend).get('api-key')).resolves.toBeUndefined();
  });

  it('секреты двух плагинов не пересекаются', async () => {
    const backend = createMemoryStorageBackend();
    const session = createSecretSessionStore();
    const acme = createSecretStorage('acme', { session, backend });
    const other = createSecretStorage('other', { session, backend });

    await acme.set('api-key', 'ключ acme');
    await other.set('api-key', 'ключ other', { persist: true });

    await expect(acme.get('api-key')).resolves.toBe('ключ acme');
    await expect(other.get('api-key')).resolves.toBe('ключ other');
  });

  it('нестроковое значение в пространстве секретов не выдаётся за секрет', async () => {
    const backend = createRecordingBackend();
    const secrets = withSession(backend);
    await secrets.set('api-key', 'сек-рет', { persist: true });

    // Пространство секретов берём из журнала записей: снаружи оно не объявлено, и это
    // правильно — подделывать его некому.
    const namespace = backend.writes[0].namespace;
    await backend.set(namespace, 'api-key', 42);

    // Подставленное в заголовок запроса «42» — худший исход, чем отсутствие секрета.
    await expect(withSession(backend).get('api-key')).resolves.toBeUndefined();
  });

  it('пустой ключ — отказ', async () => {
    const secrets = withSession(createMemoryStorageBackend());

    await expect(secrets.set('', 'x')).rejects.toThrow(/ключ/);
    await expect(secrets.delete(' ')).rejects.toThrow(/ключ/);
  });
});
