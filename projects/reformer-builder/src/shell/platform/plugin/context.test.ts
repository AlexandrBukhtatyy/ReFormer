import { describe, expect, it } from 'vitest';

import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { defineExtensionPoint } from '@reformer/builder-plugin-api/internal';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createI18nService, type RootI18nService } from '@/shell/platform/services/i18n/i18n';
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

describe('i18n в контексте — словарь плагина, а не общий', () => {
  /** Стенд отдаёт и службу отдельно: сменить язык — дело корня, а не вида плагина. */
  function withI18n(): { readonly deps: PluginContextDeps; readonly i18n: RootI18nService } {
    const i18n = createI18nService({ loadHostMessages: () => Promise.resolve({}) });
    return { deps: { ...createDeps(), i18n }, i18n };
  }

  it('ключи живут в пространстве имён плагина: одинаковые ключи у двоих — разные строки', () => {
    // Ровно то, ради чего словарь приходит ВИДОМ, а не общим сервисом: `editor.label`
    // двух редакторов — две разные строки, и общего пространства имён у них нет.
    const { deps } = withI18n();
    const acme = createPluginContext('acme', deps);
    const other = createPluginContext('other', deps);

    acme.i18n.contribute('en', { 'editor.label': 'Acme' });
    other.i18n.contribute('en', { 'editor.label': 'Other' });

    expect(acme.i18n.t('editor.label')).toBe('Acme');
    expect(other.i18n.t('editor.label')).toBe('Other');
  });

  it('промах отдаёт ключ, а не пустоту: маркер видно в интерфейсе', () => {
    // Маркер с пространством имён: по строке в интерфейсе видно, ЧЕЙ ключ не нашёлся.
    expect(createPluginContext('acme', withI18n().deps).i18n.t('нет.такого')).toBe(
      '⟦acme.нет.такого⟧'
    );
  });

  it('сообщает о смене языка — иначе панель плагина осталась бы на прежних строках', async () => {
    const { deps, i18n } = withI18n();
    const ctx = createPluginContext('acme', deps);
    const seen: string[] = [];
    ctx.i18n.onDidChangeLocale((locale) => seen.push(locale));

    await i18n.setLocale('ru');

    expect(seen).toEqual(['ru']);
    expect(ctx.i18n.locale).toBe('ru');
  });

  it('без службы контекст всё равно собирается: `t` отдаёт ключ, `contribute` безвреден', () => {
    // Названная деградация, а не поломка: стенду локализация не нужна, а падать
    // на `ctx.i18n.t` он не должен — это тот же ответ, что у настоящей службы на промах.
    const ctx = createPluginContext('acme', createDeps());

    expect(() => ctx.i18n.contribute('en', { a: 'b' })).not.toThrow();
    // Тот же маркер, что у настоящей службы на промахе: «локализации нет» и «перевода нет»
    // обязаны выглядеть одинаково — иначе стенд проверял бы не то приложение.
    expect(ctx.i18n.t('a')).toBe('⟦acme.a⟧');
    expect(() => ctx.i18n.onDidChangeLocale(() => {}).dispose()).not.toThrow();
  });
});
