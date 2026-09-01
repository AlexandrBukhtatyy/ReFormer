import { describe, expect, it, vi } from 'vitest';

import { createModuleLoader } from '@/shell/platform/modules/loader';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import {
  createExtensionRegistry,
  defineExtensionPoint,
} from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createMemorySource, type MemorySource } from '@/shell/platform/source/memory';
import type { Source } from '@/shell/platform/source/types';
import {
  createProjectPluginCatalog,
  type ProjectPluginCatalogDeps,
  type EnabledPluginsStore,
  type ProjectPluginCatalog,
} from './catalog';
import { createPluginLoader, PLUGIN_CATALOG_DIR } from './loader';
import { createPluginRegistry, type PluginRegistry } from './registry';
import { createMemoryStorageBackend } from './storage';
import { definePlugin } from './types';

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
  options: { store?: TestStore; installStyles?: ProjectPluginCatalogDeps['installStyles'] } = {}
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
    onProblem: problems,
    installStyles: options.installStyles,
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
