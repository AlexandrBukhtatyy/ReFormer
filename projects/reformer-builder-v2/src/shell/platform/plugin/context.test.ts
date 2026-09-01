import { describe, expect, it } from 'vitest';

import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import {
  createExtensionRegistry,
  defineExtensionPoint,
} from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createPluginContext, type PluginContextDeps } from './context';
import { createMemoryStorageBackend, createSecretSessionStore } from './storage';

const PanelPoint = defineExtensionPoint<string>('test.panel');

function createDeps(): PluginContextDeps {
  return {
    services: createServiceRegistry(),
    extensions: createExtensionRegistry(),
    commands: createCommandRegistry(),
    events: createEventBus(),
    storage: createMemoryStorageBackend(),
    secrets: createSecretSessionStore(),
  };
}

describe('extensions в контексте — вид для плагина, а не корневой реестр', () => {
  it('вклад помечен идентификатором плагина, которого никто не передавал', () => {
    const deps = createDeps();
    const ctx = createPluginContext('acme', deps);

    ctx.extensions.contribute(PanelPoint, 'панель');

    const [contribution] = deps.extensions.get(PanelPoint);
    expect(contribution.pluginId).toBe('acme');
    expect(contribution.value).toBe('панель');
  });

  it('в контекст попадает именно вид: у него нет forPlugin и он совпадает с forPlugin(id)', () => {
    const deps = createDeps();
    const ctx = createPluginContext('acme', deps);

    // Если бы сюда попал корень, плагин мог бы взять вид любого другого плагина и внести
    // вклад от чужого имени — происхождение вклада перестало бы что-либо значить.
    expect(ctx.extensions).not.toBe(deps.extensions);
    expect('forPlugin' in ctx.extensions).toBe(false);
    expect(ctx.extensions).toBe(deps.extensions.forPlugin('acme'));
  });

  it('видит вклады соседей: разделение касается только записи', () => {
    const deps = createDeps();
    const acme = createPluginContext('acme', deps);
    const other = createPluginContext('other', deps);

    acme.extensions.contribute(PanelPoint, 'панель acme', { id: 'a' });
    other.extensions.contribute(PanelPoint, 'панель other', { id: 'b' });

    expect(other.extensions.get(PanelPoint).map((c) => c.pluginId)).toEqual(['acme', 'other']);
  });
});

describe('контекст принадлежит одной активации', () => {
  it('subscriptions — свежий пустой массив на каждый вызов', () => {
    const deps = createDeps();
    const first = createPluginContext('acme', deps);
    first.subscriptions.push({ dispose: () => {} });

    const second = createPluginContext('acme', deps);

    // Иначе повторная активация складывала бы вклады поверх старых, а деактивация
    // пыталась бы снять уже снятое.
    expect(second.subscriptions).toEqual([]);
    expect(second.subscriptions).not.toBe(first.subscriptions);
  });

  it('id контекста совпадает с идентификатором плагина', () => {
    expect(createPluginContext('acme', createDeps()).id).toBe('acme');
  });

  it('пустой идентификатор — отказ', () => {
    expect(() => createPluginContext('  ', createDeps())).toThrow(/пуст/);
  });
});

describe('пространства имён двух плагинов не пересекаются', () => {
  it('в хранилище', async () => {
    const deps = createDeps();
    const acme = createPluginContext('acme', deps);
    const other = createPluginContext('other', deps);

    await acme.storage.set('state', { открыто: 'a.json' });
    await other.storage.set('state', { открыто: 'b.json' });

    await expect(acme.storage.get('state')).resolves.toEqual({ открыто: 'a.json' });
    await expect(other.storage.get('state')).resolves.toEqual({ открыто: 'b.json' });
    await expect(acme.storage.keys()).resolves.toEqual(['state']);
  });

  it('в секретах', async () => {
    const deps = createDeps();
    const acme = createPluginContext('acme', deps);
    const other = createPluginContext('other', deps);

    await acme.secrets.set('api-key', 'ключ acme');

    await expect(other.secrets.get('api-key')).resolves.toBeUndefined();
    await expect(acme.secrets.get('api-key')).resolves.toBe('ключ acme');
  });

  it('секрет не виден через хранилище того же плагина', async () => {
    const deps = createDeps();
    const acme = createPluginContext('acme', deps);

    await acme.secrets.set('api-key', 'ключ', { persist: true });

    // Пространства данных и секретов различаются суффиксом: постоянный секрет не должен
    // всплыть в keys() обычного хранилища, откуда его выгрузит первый же экспорт настроек.
    await expect(acme.storage.keys()).resolves.toEqual([]);
    await expect(acme.storage.get('api-key')).resolves.toBeUndefined();
  });
});
