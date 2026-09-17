import { describe, expect, it, vi } from 'vitest';

import { createModuleLoader } from '@/shell/platform/modules/loader';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { defineExtensionPoint } from '@reformer/builder-plugin-api/internal';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createI18nService, type RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { createMemorySource, type MemorySource } from '@/shell/platform/source/memory';
import type { Source } from '@/shell/platform/source/types';
import {
  createProjectPluginCatalog,
  type ProjectPluginCatalogDeps,
  type EnabledPluginsStore,
  type ProjectPluginCatalog,
} from './catalog';
import { createPluginLoader } from './loader';
import { PLUGIN_CATALOG_DIR } from '@reformer/builder-plugin-api/internal';
import { createPluginRegistry, type PluginRegistry } from './registry';
import { createMemoryStorageBackend } from './storage';
import { definePlugin } from '@reformer/builder-plugin-api/internal';

const PanelPoint = defineExtensionPoint<string>('test.panel');

const dir = (id: string, file: string): string => `${PLUGIN_CATALOG_DIR}/${id}/${file}`;

const manifestOf = (id: string, fields: Record<string, unknown> = {}): string =>
  JSON.stringify({ id, apiVersion: '^1', main: 'main.js', ...fields });

/**
 * Плагин, вносящий панель и команду.
 *
 * Вкладов два и оба через `subscriptions` — именно на них проверяется главное свойство
 * выключения: система возвращается в исходное состояние целиком, а не наполовину.
 */
const contributingPlugin = (id: string, label: string): string => `
  const { definePlugin, PanelPoint } = require('@builder/sdk');
  module.exports = definePlugin({
    id: ${JSON.stringify(id)},
    activate(ctx) {
      ctx.subscriptions.push(
        ctx.extensions.contribute(PanelPoint, ${JSON.stringify(label)}, { id: ${JSON.stringify(`${id}.panel`)} }),
        ctx.commands.register({
          id: ${JSON.stringify(`${id}.hello`)},
          titleKey: 'test.command.hello',
          run: () => ${JSON.stringify(label)},
        })
      );
    },
  });
`;

interface Harness {
  readonly catalog: ProjectPluginCatalog;
  readonly plugins: PluginRegistry;
  readonly memory: MemorySource;
  readonly store: TestStore;
  readonly panels: () => string[];
  readonly commands: () => string[];
  readonly problems: ReturnType<typeof vi.fn>;
}

/** Хранилище включённых в памяти: контракт — две операции, плюс поле для правки извне. */
interface TestStore extends EnabledPluginsStore {
  readonly state: { ids: string[] };
}

/** Память вместо настроек: то же, что кладёт композиция в настройки рабочей области. */
function createStore(initial: readonly string[] = []): TestStore {
  const state = { ids: [...initial] };
  return {
    state,
    read: () => Promise.resolve([...state.ids]),
    write: (next) => {
      state.ids = [...next];
      return Promise.resolve();
    },
  };
}

function createHarness(
  files: Record<string, string>,
  options: {
    store?: TestStore;
    devStore?: TestStore;
    installStyles?: ProjectPluginCatalogDeps['installStyles'];
    i18n?: ProjectPluginCatalogDeps['i18n'];
    capabilities?: ProjectPluginCatalogDeps['capabilities'];
  } = {}
): Harness {
  const memory = createMemorySource(files);
  // Источник проекта — локальный каталог, ему исполнение кода разрешено (см. `loader.test`).
  const source: Source = {
    ...memory,
    capabilities: { ...memory.capabilities, executesCode: true },
  };

  const services = createServiceRegistry();
  const extensions = createExtensionRegistry();
  const commands = createCommandRegistry();
  const events = createEventBus();
  const plugins = createPluginRegistry({
    services,
    extensions,
    commands,
    events,
    storage: createMemoryStorageBackend(),
    onError: vi.fn(),
  });

  const modules = createModuleLoader({
    builtins: [['@builder/sdk', { definePlugin, PanelPoint }]],
  });
  const loader = createPluginLoader({ source: () => source, modules });
  const store = options.store ?? createStore();
  const problems = vi.fn();
  const catalog = createProjectPluginCatalog({
    loader,
    plugins,
    enabled: store,
    dev: options.devStore,
    onProblem: problems,
    installStyles: options.installStyles,
    i18n: options.i18n,
    capabilities: options.capabilities,
  });

  return {
    catalog,
    plugins,
    memory,
    store,
    problems,
    panels: () => extensions.get(PanelPoint).map((c) => c.value),
    commands: () => commands.getAll().map((c) => c.id),
  };
}

describe('каталог плагинов проекта', () => {
  it('найденный плагин появляется выключенным и ничего не вносит', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms', { name: 'Acme Forms' }),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
    });

    const list = await harness.catalog.refresh();

    // Уровень доверия называется явно: код из каталога проекта исполняется в том же realm,
    // что дескрипторы файлов и секреты, поэтому запускает его человек, а не находка на диске.
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'acme-forms', name: 'Acme Forms', state: 'disabled' });
    expect(harness.panels()).toEqual([]);
    expect(harness.plugins.statuses()).toEqual([]);
  });

  it('включение вносит вклады, выключение снимает их полностью', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms'),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
    });
    await harness.catalog.refresh();

    expect(await harness.catalog.enable('acme-forms')).toBe(true);
    expect(harness.panels()).toEqual(['панель Acme']);
    expect(harness.commands()).toEqual(['acme-forms.hello']);
    expect(harness.catalog.list()[0].state).toBe('enabled');
    expect(harness.store.state.ids).toEqual(['acme-forms']);

    harness.catalog.disable('acme-forms');

    // Возврат в исходное состояние — целиком: и панель, и команда сняты через subscriptions.
    expect(harness.panels()).toEqual([]);
    expect(harness.commands()).toEqual([]);
    expect(harness.plugins.isActive('acme-forms')).toBe(false);
    expect(harness.catalog.list()[0].state).toBe('disabled');
    expect(harness.store.state.ids).toEqual([]);
  });

  it('упавший при активации выключается и показывается, автоповтора нет', async () => {
    const harness = createHarness({
      [dir('boom', 'manifest.json')]: manifestOf('boom'),
      [dir('boom', 'main.js')]: `
        module.exports = {
          id: 'boom',
          activate() { throw new Error('нужен ключ провайдера'); },
        };
      `,
    });
    await harness.catalog.refresh();

    expect(await harness.catalog.enable('boom')).toBe(false);

    const entry = harness.catalog.list()[0];
    expect(entry.state).toBe('failed');
    expect(entry.problem?.code).toBe('activate-failed');
    expect(entry.problem?.message).toContain('нужен ключ провайдера');
    expect(harness.problems).toHaveBeenCalledOnce();
    // Из включённых вычеркнут — иначе следующий запуск снова уронил бы его на том же месте,
    // и добраться до выключателя было бы нечем.
    expect(harness.store.state.ids).toEqual([]);
    await expect(harness.catalog.restoreEnabled()).resolves.toEqual([]);
  });

  it('перезагрузка снимает старые вклады и ставит новые', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms'),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель первой версии'),
    });
    await harness.catalog.refresh();
    await harness.catalog.enable('acme-forms');
    expect(harness.panels()).toEqual(['панель первой версии']);

    // Автор поправил файл в каталоге. Наблюдения за файлами нет — перезагрузка это команда.
    harness.memory.put(
      dir('acme-forms', 'main.js'),
      contributingPlugin('acme-forms', 'панель второй версии')
    );

    expect(await harness.catalog.reload('acme-forms')).toBe(true);

    expect(harness.panels()).toEqual(['панель второй версии']);
    expect(harness.commands()).toEqual(['acme-forms.hello']);
    expect(harness.catalog.list()[0].state).toBe('enabled');
  });

  it('перезагрузка выключенного не включает его', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms'),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
    });
    await harness.catalog.refresh();

    expect(await harness.catalog.reload('acme-forms')).toBe(true);

    expect(harness.panels()).toEqual([]);
    expect(harness.catalog.list()[0].state).toBe('disabled');
  });

  it('неудачная перезагрузка не оставляет вкладов прошлой версии', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms'),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
    });
    await harness.catalog.refresh();
    await harness.catalog.enable('acme-forms');

    harness.memory.put(dir('acme-forms', 'main.js'), 'throw new Error("опечатка");');

    expect(await harness.catalog.reload('acme-forms')).toBe(false);

    // Сначала снять, потом читать: иначе в системе остались бы панель и команда кода,
    // которого на диске уже нет.
    expect(harness.panels()).toEqual([]);
    expect(harness.commands()).toEqual([]);
    expect(harness.catalog.list()[0].problem?.code).toBe('code-failed');
  });

  it('включённые восстанавливаются, а выключенные остаются выключенными', async () => {
    const files = {
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms'),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
      [dir('zeta', 'manifest.json')]: manifestOf('zeta'),
      [dir('zeta', 'main.js')]: contributingPlugin('zeta', 'панель Zeta'),
    };
    const store = createStore();

    const first = createHarness(files, { store });
    await first.catalog.refresh();
    await first.catalog.enable('acme-forms');
    first.catalog.dispose();

    // Новая вкладка: другой рантайм, другие реестры, то же хранилище выбора человека.
    const second = createHarness(files, { store });
    await second.catalog.refresh();

    await expect(second.catalog.restoreEnabled()).resolves.toEqual(['acme-forms']);
    expect(second.panels()).toEqual(['панель Acme']);
    expect(second.catalog.list().map((e) => `${e.id}:${e.state}`)).toEqual([
      'acme-forms:enabled',
      'zeta:disabled',
    ]);
  });

  it('битый плагин показан причиной и включиться не может', async () => {
    const harness = createHarness({
      [dir('from-future', 'manifest.json')]: manifestOf('from-future', { apiVersion: '^2' }),
      [dir('from-future', 'main.js')]: contributingPlugin('from-future', 'панель будущего'),
    });

    const list = await harness.catalog.refresh();

    expect(list[0]).toMatchObject({ id: 'from-future', state: 'failed' });
    expect(list[0].problem?.code).toBe('api-version');
    expect(await harness.catalog.enable('from-future')).toBe(false);
    expect(harness.panels()).toEqual([]);
  });

  it('идентификатор, занятый другим плагином, — отказ с причиной', async () => {
    const harness = createHarness({
      [dir('files', 'manifest.json')]: manifestOf('files'),
      [dir('files', 'main.js')]: contributingPlugin('files', 'подделка'),
    });
    // Так выглядит столкновение со встроенным плагином: идентификатор уже занят.
    harness.plugins.register(definePlugin({ id: 'files', activate() {} }));
    await harness.catalog.refresh();

    expect(await harness.catalog.enable('files')).toBe(false);

    expect(harness.catalog.list()[0].problem?.code).toBe('id-taken');
    expect(harness.panels()).toEqual([]);
  });

  it('восстановление берёт хранилище за истину, а не дополняет им память', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms'),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
    });
    await harness.catalog.refresh();
    await harness.catalog.enable('acme-forms');

    // Так выглядит смена проекта: в записи нового включённых нет. Перенести сюда выбор,
    // сделанный в прежнем проекте, значило бы включить код без спроса.
    harness.store.state.ids = [];

    await expect(harness.catalog.restoreEnabled()).resolves.toEqual([]);

    expect(harness.panels()).toEqual([]);
    expect(harness.catalog.list()[0].state).toBe('disabled');
  });

  it('исчезнувший из каталога плагин теряет вклады при обновлении списка', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms'),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
    });
    await harness.catalog.refresh();
    await harness.catalog.enable('acme-forms');

    harness.memory.drop(dir('acme-forms', 'manifest.json'));
    harness.memory.drop(dir('acme-forms', 'main.js'));

    await expect(harness.catalog.refresh()).resolves.toEqual([]);

    expect(harness.panels()).toEqual([]);
    // Включённость помним: плагин вернётся вместе с проектом, и включать его заново незачем.
    expect(harness.store.state.ids).toEqual(['acme-forms']);
  });

  it('смена проекта снимает вклады, но не выбор человека', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms'),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
    });
    await harness.catalog.refresh();
    await harness.catalog.enable('acme-forms');

    harness.catalog.deactivateAll();

    expect(harness.panels()).toEqual([]);
    expect(harness.store.state.ids).toEqual(['acme-forms']);

    await expect(harness.catalog.restoreEnabled()).resolves.toEqual(['acme-forms']);
    expect(harness.panels()).toEqual(['панель Acme']);
  });

  it('список отзывчив: каждое изменение уведомляет подписчика', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms'),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
    });
    const listener = vi.fn();
    const subscription = harness.catalog.subscribe(listener);

    await harness.catalog.refresh();
    await harness.catalog.enable('acme-forms');
    harness.catalog.disable('acme-forms');

    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
    subscription.dispose();
    harness.catalog.disable('acme-forms');
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

describe('стили плагина живут ровно столько же, сколько плагин', () => {
  /**
   * Двойник установки: считает поставленные и снятые таблицы.
   *
   * Настоящая требует `CSSStyleSheet`, которого в `node` нет, — и это не обход проверки,
   * а разделение: РАЗБОР CSS проверяет браузерный прогон (17 тестов), ЖИЗНЕННЫЙ ЦИКЛ —
   * здесь. Смешай их — и цикл проверялся бы только вместе с браузером.
   */
  function fakeInstaller() {
    const live = new Set<string>();
    const installed: string[] = [];
    return {
      live,
      installed,
      install: ((css: string, id: string) => {
        installed.push(css);
        live.add(id);
        return { ok: true as const, subscription: { dispose: () => live.delete(id) } };
      }) as ProjectPluginCatalogDeps['installStyles'],
    };
  }

  const withStyles = (css?: string): Record<string, string> => ({
    [dir('acme', 'manifest.json')]: manifestOf(
      'acme',
      css === undefined ? {} : { styles: { file: 'plugin.css', isolation: 'scoped' } }
    ),
    [dir('acme', 'main.js')]: contributingPlugin('acme', 'панель Acme'),
    ...(css === undefined ? {} : { [dir('acme', 'plugin.css')]: css }),
  });

  it('ставятся при включении и снимаются при выключении', async () => {
    const f = fakeInstaller();
    const h = createHarness(withStyles('.panel { color: red }'), { installStyles: f.install });

    await h.catalog.refresh();
    await h.catalog.enable('acme');
    expect([...f.live]).toEqual(['acme']);
    expect(f.installed).toEqual(['.panel { color: red }']);

    h.catalog.disable('acme');
    expect([...f.live]).toEqual([]);
  });

  it('перезагрузка снимает ПРЕЖНЮЮ таблицу, а не добавляет вторую', async () => {
    // Иначе после нескольких перезагрузок на странице лежит несколько поколений таблицы,
    // и побеждает последнее по ПОРЯДКУ, а не последнее по времени: правка стилей плагина
    // переставала бы действовать без всякого признака.
    const f = fakeInstaller();
    const h = createHarness(withStyles('.panel { color: red }'), { installStyles: f.install });

    await h.catalog.refresh();
    await h.catalog.enable('acme');
    await h.catalog.reload('acme');

    expect(f.installed).toHaveLength(2);
    expect([...f.live]).toEqual(['acme']);
  });

  it('без установки плагин всё равно включается', async () => {
    // Деградация, а не отказ: код плагина важнее его вида.
    const h = createHarness(withStyles('.panel { color: red }'));

    await h.catalog.refresh();

    await expect(h.catalog.enable('acme')).resolves.toBe(true);
  });

  it('плагин без стилей установку не зовёт', async () => {
    const f = fakeInstaller();
    const h = createHarness(withStyles(), { installStyles: f.install });

    await h.catalog.refresh();
    await h.catalog.enable('acme');

    expect(f.installed).toEqual([]);
  });
});

describe('словарь плагина приезжает манифестом', () => {
  /**
   * Настоящий сервис локализации плюс счётчик обращений.
   *
   * Двойник здесь проверял бы только сам себя: вклад в словарь виден ровно одним способом —
   * `t` перестаёт отдавать маркер промаха. Поэтому сервис берётся настоящий, а `forPlugin`
   * оборачивается, чтобы видеть, что каталог обратился именно к виду своего плагина.
   * Словарь Host отключён: он к делу не относится, а грузится асинхронно.
   */
  function spyI18n() {
    const i18n = createI18nService({ dev: true, loadHostMessages: () => Promise.resolve({}) });
    const forPlugin = vi.fn((pluginId: string) => i18n.forPlugin(pluginId));
    return { i18n, forPlugin, deps: { forPlugin } satisfies Pick<RootI18nService, 'forPlugin'> };
  }

  const withMessages = (
    messages: Record<string, string>,
    files: Record<string, string>
  ): Record<string, string> => ({
    [dir('acme', 'manifest.json')]: manifestOf('acme', { contributes: { messages } }),
    [dir('acme', 'main.js')]: contributingPlugin('acme', 'панель Acme'),
    ...files,
  });

  const enMessages = (title: string): Record<string, string> => ({
    [dir('acme', 'locales/en.json')]: JSON.stringify({ 'command.hello': title }),
  });

  it('после включения команда показывается заголовком, а не маркером промаха', async () => {
    const spy = spyI18n();
    const h = createHarness(withMessages({ en: 'locales/en.json' }, enMessages('Say hello')), {
      i18n: spy.deps,
    });
    await h.catalog.refresh();

    // Ровно то, ради чего поле и заведено: без словаря заголовок команды внешнего плагина
    // разрешить нечем, и палитра показывает промах.
    expect(spy.i18n.forPlugin('acme').t('command.hello')).toBe('⟦acme.command.hello⟧');

    await expect(h.catalog.enable('acme')).resolves.toBe(true);

    expect(spy.forPlugin).toHaveBeenCalledWith('acme');
    expect(spy.i18n.forPlugin('acme').t('command.hello')).toBe('Say hello');
  });

  it('вносятся все объявленные локали', async () => {
    const spy = spyI18n();
    const h = createHarness(
      withMessages(
        { en: 'locales/en.json', ru: 'locales/ru.json' },
        {
          ...enMessages('Say hello'),
          [dir('acme', 'locales/ru.json')]: JSON.stringify({ 'command.hello': 'Поздороваться' }),
        }
      ),
      { i18n: spy.deps }
    );
    await h.catalog.refresh();
    await h.catalog.enable('acme');

    await spy.i18n.setLocale('ru');

    expect(spy.i18n.forPlugin('acme').t('command.hello')).toBe('Поздороваться');
  });

  it('выключение словарь НЕ снимает — это правило i18n, а не упущение', async () => {
    const spy = spyI18n();
    const h = createHarness(withMessages({ en: 'locales/en.json' }, enMessages('Say hello')), {
      i18n: spy.deps,
    });
    await h.catalog.refresh();
    await h.catalog.enable('acme');

    h.catalog.disable('acme');

    // Вклад в словарь не снимается ни у кого: снять его нечем, да и незачем — показывать
    // заголовок уже снятой команды некому.
    expect(h.panels()).toEqual([]);
    expect(spy.i18n.forPlugin('acme').t('command.hello')).toBe('Say hello');
  });

  it('перезагрузка перекрывает ключи новой версией', async () => {
    const spy = spyI18n();
    const h = createHarness(withMessages({ en: 'locales/en.json' }, enMessages('Say hello')), {
      i18n: spy.deps,
    });
    await h.catalog.refresh();
    await h.catalog.enable('acme');

    h.memory.put(dir('acme', 'locales/en.json'), JSON.stringify({ 'command.hello': 'Greet' }));

    expect(await h.catalog.reload('acme')).toBe(true);

    expect(spy.i18n.forPlugin('acme').t('command.hello')).toBe('Greet');
  });

  it('неразбираемое сообщение плагин не роняет, но доезжает отказом', async () => {
    const spy = spyI18n();
    const h = createHarness(
      withMessages(
        { en: 'locales/en.json' },
        // Множественное число без обязательной ветки other — отказ разбора на регистрации.
        {
          [dir('acme', 'locales/en.json')]: JSON.stringify({
            'files.count': '{count, plural, one{# file}}',
          }),
        }
      ),
      { i18n: spy.deps }
    );
    await h.catalog.refresh();

    // Деградация, а не отказ — та же, что у CSS: код плагина важнее его подписей.
    await expect(h.catalog.enable('acme')).resolves.toBe(true);
    expect(h.panels()).toEqual(['панель Acme']);
    expect(h.problems).toHaveBeenCalledOnce();
    expect(h.problems.mock.calls[0][1]).toMatchObject({ code: 'messages-invalid' });
  });

  it('без сервиса локализации плагин со словарём всё равно включается', async () => {
    const h = createHarness(withMessages({ en: 'locales/en.json' }, enMessages('Say hello')));

    await h.catalog.refresh();

    await expect(h.catalog.enable('acme')).resolves.toBe(true);
  });
});

describe('пометка «в разработке»', () => {
  const files = (): Record<string, string> => ({
    [dir('acme', 'manifest.json')]: manifestOf('acme'),
    [dir('acme', 'main.js')]: contributingPlugin('acme', 'панель'),
  });

  it('ставится, видна в списке и не трогает вклады', async () => {
    const devStore = createStore();
    const h = createHarness(files(), { devStore });
    await h.catalog.refresh();

    h.catalog.setDev('acme', true);

    expect(h.catalog.list()[0]).toMatchObject({ id: 'acme', dev: true, state: 'disabled' });
    // Пометка — сигнал наблюдателю, а не второй способ включить.
    expect(h.panels()).toEqual([]);
    expect(devStore.state.ids).toEqual(['acme']);

    h.catalog.setDev('acme', false);
    expect(h.catalog.list()[0]).toMatchObject({ dev: false });
    expect(devStore.state.ids).toEqual([]);
  });

  it('неизвестный идентификатор игнорируется, хранилище не трогается', async () => {
    const devStore = createStore();
    const h = createHarness(files(), { devStore });
    await h.catalog.refresh();

    h.catalog.setDev('нет-такого', true);

    expect(devStore.state.ids).toEqual([]);
  });

  it('переживает выключение, падение и восстановление: хранилище — истина', async () => {
    const devStore = createStore(['acme']);
    const h = createHarness(files(), { devStore });
    await h.catalog.refresh();
    await h.catalog.restoreEnabled();

    expect(h.catalog.list()[0]).toMatchObject({ dev: true, state: 'disabled' });

    await h.catalog.enable('acme');
    h.catalog.disable('acme');
    // Включённость менялась дважды — пометка не шелохнулась.
    expect(h.catalog.list()[0]).toMatchObject({ dev: true });
    expect(devStore.state.ids).toEqual(['acme']);
  });

  it('подписчик уведомляется о смене пометки, повторная установка — нет', async () => {
    const h = createHarness(files(), { devStore: createStore() });
    await h.catalog.refresh();
    let ticks = 0;
    h.catalog.subscribe(() => {
      ticks += 1;
    });

    h.catalog.setDev('acme', true);
    h.catalog.setDev('acme', true);

    expect(ticks).toBe(1);
  });
});

describe('требования плагина сверяются ДО загрузки его кода', () => {
  /** То, что даёт остальное приложение: так его передаёт композиция из состава. */
  const builtinKits = () => [{ id: 'reformer.kit.catalog', version: '1.0.0', by: 'kits' }];

  const requiring = (range: string, kind: 'required' | 'optional' = 'required') =>
    manifestOf('acme-forms', { requires: { [kind]: [{ id: 'reformer.kit.catalog', range }] } });

  it('выполненное требование включению не мешает', async () => {
    const harness = createHarness(
      {
        [dir('acme-forms', 'manifest.json')]: requiring('^1'),
        [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
      },
      { capabilities: builtinKits }
    );
    await harness.catalog.refresh();

    expect(await harness.catalog.enable('acme-forms')).toBe(true);
    expect(harness.panels()).toEqual(['панель Acme']);
  });

  it('невыполненное — отказ, и код плагина не исполняется вовсе', async () => {
    const harness = createHarness(
      {
        [dir('acme-forms', 'manifest.json')]: requiring('^2'),
        // Код заведомо рабочий: провались проверка после загрузки — панель успела бы появиться.
        [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
      },
      { capabilities: builtinKits }
    );
    await harness.catalog.refresh();

    expect(await harness.catalog.enable('acme-forms')).toBe(false);
    expect(harness.panels()).toEqual([]);
    // Плагин не дошёл даже до регистрации в рантайме — это и значит «до загрузки кода».
    expect(harness.plugins.statuses()).toEqual([]);
  });

  it('причина видна строкой в списке и называет то, что есть на самом деле', async () => {
    const harness = createHarness(
      {
        [dir('acme-forms', 'manifest.json')]: requiring('^2'),
        [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
      },
      { capabilities: builtinKits }
    );
    await harness.catalog.refresh();
    await harness.catalog.enable('acme-forms');

    const entry = harness.catalog.list()[0];
    expect(entry.state).toBe('failed');
    expect(entry.problem?.code).toBe('requires-unsatisfied');
    // Разница между «поставь новее» и «поставь вообще» — первое, что спрашивает человек.
    expect(entry.problem?.message).toContain('1.0.0');
    expect(entry.problem?.message).toContain('«kits»');
  });

  it('без сведений о возможностях приложения требование не выполнено — и это честно', async () => {
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: requiring('^1'),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
    });
    await harness.catalog.refresh();

    expect(await harness.catalog.enable('acme-forms')).toBe(false);
    expect(harness.catalog.list()[0].problem?.message).toContain('не предоставляет никто');
  });

  it('НЕОБЯЗАТЕЛЬНОЕ требование на включение не влияет', async () => {
    const harness = createHarness(
      {
        [dir('acme-forms', 'manifest.json')]: requiring('^2', 'optional'),
        [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
      },
      { capabilities: builtinKits }
    );
    await harness.catalog.refresh();

    expect(await harness.catalog.enable('acme-forms')).toBe(true);
    expect(harness.panels()).toEqual(['панель Acme']);
  });

  it('требование удовлетворяется ВКЛЮЧЁННЫМ соседом по каталогу, а не найденным', async () => {
    // Возможность выключенного плагина никому не доступна: включать один плагин потому, что
    // другой когда-нибудь пообещал службу, — это и есть неявный порядок активации.
    const harness = createHarness({
      [dir('provider', 'manifest.json')]: JSON.stringify({
        id: 'provider',
        apiVersion: '^1',
        main: 'main.js',
        provides: [{ id: 'acme.forms', version: '1.2.0' }],
      }),
      [dir('provider', 'main.js')]: `
        const { definePlugin } = require('@builder/sdk');
        module.exports = definePlugin({
          id: 'provider',
          activate(ctx) {
            ctx.subscriptions.push(ctx.services.register({ id: 'acme.forms' }, {}));
          },
        });
      `,
      [dir('consumer', 'manifest.json')]: JSON.stringify({
        id: 'consumer',
        apiVersion: '^1',
        main: 'main.js',
        requires: { required: [{ id: 'acme.forms', range: '^1' }] },
      }),
      [dir('consumer', 'main.js')]: contributingPlugin('consumer', 'панель consumer'),
    });
    await harness.catalog.refresh();

    expect(await harness.catalog.enable('consumer')).toBe(false);

    expect(await harness.catalog.enable('provider')).toBe(true);
    expect(await harness.catalog.enable('consumer')).toBe(true);
  });

  it('объявленная возможность, не зарегистрированная в activate, — отдельная причина', async () => {
    // `activate` при этом не бросал: отличать это от `activate-failed` нужно тому,
    // кто чинит плагин, — ошибка в самом плагине, а не в его окружении.
    const harness = createHarness({
      [dir('acme-forms', 'manifest.json')]: manifestOf('acme-forms', {
        provides: [{ id: 'acme.forms', version: '1.0.0' }],
      }),
      [dir('acme-forms', 'main.js')]: contributingPlugin('acme-forms', 'панель Acme'),
    });
    await harness.catalog.refresh();

    expect(await harness.catalog.enable('acme-forms')).toBe(false);

    const entry = harness.catalog.list()[0];
    expect(entry.problem?.code).toBe('provides-unregistered');
    expect(harness.panels()).toEqual([]);
  });
});
