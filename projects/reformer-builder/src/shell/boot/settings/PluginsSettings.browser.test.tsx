/**
 * Тело раздела «Плагины» — в настоящем браузере.
 *
 * Вне браузера здесь нечего проверять: строка живёт на `Checkbox` из кита (Radix), карточка
 * раскрывается состоянием компонента, а список перерисовывается по подписке на каталог.
 * Проверяется то, ради чего раздел заведён:
 *
 * - **переключатель доходит до каталога** — и у упавшего это «попробовать снова», а не «включить»;
 * - **список ЖИВОЙ**: каталог меняют мимо окна (палитра, обход проекта, авто-перезагрузка),
 *   и раздел обязан это показать без переоткрытия;
 * - **карточка раскрывается кнопкой** и несёт то, чего нет ни в тосте, ни в палитре, —
 *   причину отказа целиком;
 * - **пустые состояния разведены**: «проект не открыт» не выдаётся за «плагинов нет».
 *
 * Словарь берётся НАСТОЯЩИЙ (`locales/ru.json`), а не выдуманный: иначе промах в ключе
 * прошёл бы мимо всех проверок и всплыл маркером `⟦…⟧` у человека.
 *
 * @module shell/boot/settings/PluginsSettings.browser.test
 */

import { describe, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { toDisposable } from '@reformer/builder-plugin-api/internal';
import { renderReact } from '@/testing/render';
import hostRu from '@/shell/platform/services/i18n/locales/ru.json';
import { createPluginsSettingsBody } from './PluginsSettings';
import type { PluginCatalogEntry, PluginSettingsHost, PluginsSettingsPort } from './plugins-list';
import type { PluginsMarketplacePort } from './plugins-tabs';

/** Каталог-двойник: помнит вызовы и умеет сообщить подписчикам, что список изменился. */
function fakeCatalog(initial: readonly PluginCatalogEntry[], state?: { hasProject?: boolean }) {
  let entries = [...initial];
  const listeners = new Set<() => void>();
  const calls: string[] = [];
  const publish = (): void => {
    for (const listener of [...listeners]) listener();
  };
  const port: PluginsSettingsPort = {
    list: () => entries,
    subscribe: (listener) => {
      listeners.add(listener);
      return toDisposable(() => listeners.delete(listener));
    },
    enable: (id) => {
      calls.push(`enable:${id}`);
      return Promise.resolve(true);
    },
    disable: (id) => {
      calls.push(`disable:${id}`);
    },
    setDev: (id, on) => {
      calls.push(`setDev:${id}:${String(on)}`);
    },
    reload: (id) => {
      calls.push(`reload:${id}`);
      return Promise.resolve(true);
    },
    synced: () => true,
    hasProject: () => state?.hasProject ?? true,
  };
  return {
    port,
    calls,
    /** Имитирует изменение каталога извне: из палитры, обходом проекта, авто-перезагрузкой. */
    change(next: readonly PluginCatalogEntry[]) {
      entries = [...next];
      publish();
    },
  };
}

async function mount(
  catalog: { port: PluginsSettingsPort },
  settingsHost: PluginSettingsHost | null = null,
  marketplace: PluginsMarketplacePort | null = null
): Promise<{ unmount: () => void }> {
  const i18n = createI18nService({
    loadHostMessages: () => Promise.resolve(hostRu as Record<string, string>),
    dev: false,
  });
  await i18n.setLocale('ru');
  const Body = createPluginsSettingsBody(catalog.port, settingsHost, marketplace);
  return renderReact(<Body i18n={i18n} />);
}

const entry = (patch: Partial<PluginCatalogEntry> & { id: string }): PluginCatalogEntry => ({
  name: patch.id,
  state: 'disabled',
  dev: false,
  ...patch,
});

describe('раздел настроек «Плагины»', () => {
  it('переключатель выключенного просит каталог включить', async () => {
    const catalog = fakeCatalog([entry({ id: 'hello', name: 'Hello' })]);
    const view = await mount(catalog);

    await userEvent.click(page.getByTestId('settings-plugin-hello-toggle'));

    expect(catalog.calls).toEqual(['enable:hello']);
    view.unmount();
  });

  it('переключатель включённого просит выключить', async () => {
    const catalog = fakeCatalog([entry({ id: 'hello', name: 'Hello', state: 'enabled' })]);
    const view = await mount(catalog);

    await userEvent.click(page.getByTestId('settings-plugin-hello-toggle'));

    expect(catalog.calls).toEqual(['disable:hello']);
    view.unmount();
  });

  it('у упавшего нажатие — повтор включения, и это видно подписью', async () => {
    const catalog = fakeCatalog([
      entry({
        id: 'broken',
        name: 'Broken',
        state: 'failed',
        problem: { code: 'manifest-invalid', message: 'нет поля main', file: 'manifest.json' },
      }),
    ]);
    const view = await mount(catalog);

    const toggle = page.getByTestId('settings-plugin-broken-toggle');
    await expect.element(toggle).toHaveAttribute('aria-label', 'Включить «Broken» ещё раз');
    await userEvent.click(toggle);

    expect(catalog.calls).toEqual(['enable:broken']);
    view.unmount();
  });

  it('список живой: изменение каталога извне видно без переоткрытия', async () => {
    // Каталог меняют палитра, обход проекта и авто-перезагрузка dev-плагина. Раздел,
    // показывающий снимок на момент открытия, врал бы при каждом из трёх.
    const catalog = fakeCatalog([entry({ id: 'hello', name: 'Hello' })]);
    const view = await mount(catalog);

    catalog.change([
      entry({ id: 'hello', name: 'Hello', state: 'enabled' }),
      entry({ id: 'acme', name: 'Acme' }),
    ]);

    await expect.element(page.getByTestId('settings-plugin-acme-toggle')).toBeInTheDocument();
    await expect.element(page.getByTestId('settings-plugin-hello-toggle')).toBeChecked();
    view.unmount();
  });

  it('карточка раскрывается кнопкой и показывает причину отказа целиком', async () => {
    // Ни тост, ни палитра не показывают код и файл — только текст. Ради этого карточка
    // и заведена: место, где отказ виден полностью.
    const catalog = fakeCatalog([
      entry({
        id: 'broken',
        name: 'Broken',
        state: 'failed',
        problem: { code: 'manifest-invalid', message: 'нет поля main', file: 'manifest.json' },
      }),
    ]);
    const view = await mount(catalog);

    await userEvent.click(page.getByTestId('settings-plugin-broken-configure'));

    const problem = page.getByTestId('settings-plugin-broken-problem');
    await expect.element(problem).toBeInTheDocument();
    await expect.element(problem).toHaveTextContent('manifest-invalid');
    await expect.element(problem).toHaveTextContent('manifest.json');
    view.unmount();
  });

  it('в карточке помечают «в разработке», и пометка уходит в каталог', async () => {
    const catalog = fakeCatalog([entry({ id: 'hello', name: 'Hello', state: 'enabled' })]);
    const view = await mount(catalog);

    await userEvent.click(page.getByTestId('settings-plugin-hello-configure'));
    await userEvent.click(page.getByTestId('settings-plugin-hello-dev'));

    expect(catalog.calls).toEqual(['setDev:hello:true']);
    view.unmount();
  });

  it('перезагрузка предлагается только работающему', async () => {
    const catalog = fakeCatalog([entry({ id: 'hello', name: 'Hello', state: 'disabled' })]);
    const view = await mount(catalog);

    await userEvent.click(page.getByTestId('settings-plugin-hello-configure'));

    await expect.element(page.getByTestId('settings-plugin-hello-reload')).toBeDisabled();
    view.unmount();
  });

  it('без проекта говорим про проект, а не «плагинов нет»', async () => {
    const catalog = fakeCatalog([], { hasProject: false });
    const view = await mount(catalog);

    const empty = page.getByTestId('settings-plugins-empty');
    await expect.element(empty).toHaveTextContent('Проект не открыт');
    view.unmount();
  });
});

/** Двойник настроек плагина: схема одного поля и значения в памяти. */
function fakeSettingsHost(schema: unknown, initial: Record<string, unknown> = {}) {
  let values = { ...initial };
  const listeners = new Set<() => void>();
  const writes: Record<string, unknown>[] = [];
  const host: PluginSettingsHost = {
    schemaOf: () => schema,
    read: () => values,
    write: (_id, next) => {
      writes.push({ ...next });
      values = { ...next };
      for (const listener of [...listeners]) listener();
      return Promise.resolve();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return toDisposable(() => listeners.delete(listener));
    },
  };
  return { host, writes };
}

/** Схема настроек «как её напишет автор плагина»: одно текстовое поле. */
const ENDPOINT_SCHEMA = {
  version: '1.0',
  root: {
    $nodeId: 'root',
    component: '$html(div)',
    children: [
      {
        $nodeId: 'endpoint',
        component: '$component(Input)',
        value: '$model(endpoint)',
        componentProps: { label: 'Адрес сервиса', testId: 'endpoint' },
      },
    ],
  },
};

describe('настройки плагина в карточке', () => {
  it('схема плагина рисуется рендерером ReFormer, с сохранённым значением', async () => {
    const catalog = fakeCatalog([entry({ id: 'hello', name: 'Hello', state: 'enabled' })]);
    const settings = fakeSettingsHost(ENDPOINT_SCHEMA, { endpoint: 'https://saved.example' });
    const view = await mount(catalog, settings.host);

    await userEvent.click(page.getByTestId('settings-plugin-hello-configure'));

    const form = page.getByTestId('settings-plugin-hello-settings');
    await expect.element(form).toBeInTheDocument();
    await expect.element(page.getByRole('textbox')).toHaveValue('https://saved.example');
    view.unmount();
  });

  it('введённое доходит до хранилища', async () => {
    const catalog = fakeCatalog([entry({ id: 'hello', name: 'Hello', state: 'enabled' })]);
    const settings = fakeSettingsHost(ENDPOINT_SCHEMA, { endpoint: '' });
    const view = await mount(catalog, settings.host);

    await userEvent.click(page.getByTestId('settings-plugin-hello-configure'));
    await userEvent.fill(page.getByRole('textbox'), 'https://typed.example');

    await expect.poll(() => settings.writes.at(-1)?.endpoint).toBe('https://typed.example');
    view.unmount();
  });

  it('плагин не работает — объясняем, а не показываем пустую форму', async () => {
    const catalog = fakeCatalog([entry({ id: 'hello', name: 'Hello', state: 'disabled' })]);
    const settings = fakeSettingsHost(ENDPOINT_SCHEMA);
    const view = await mount(catalog, settings.host);

    await userEvent.click(page.getByTestId('settings-plugin-hello-configure'));

    await expect
      .element(page.getByTestId('settings-plugin-hello-settings-off'))
      .toBeInTheDocument();
    view.unmount();
  });

  it('непригодная схема не роняет карточку, а объясняется словами', async () => {
    const catalog = fakeCatalog([entry({ id: 'hello', name: 'Hello', state: 'enabled' })]);
    // Композиция такую отсекает раньше, но тело обязано пережить и её: схема приходит
    // из кода в проекте пользователя.
    const settings = fakeSettingsHost({ version: '1.0', root: { component: '$component(Nope)' } });
    const view = await mount(catalog, settings.host);

    await userEvent.click(page.getByTestId('settings-plugin-hello-configure'));

    await expect.element(page.getByTestId('settings-plugin-hello-card')).toBeInTheDocument();
    view.unmount();
  });
});

/** Двойник установки из npm: помнит вызовы, отвечает заранее заданным каталогом. */
function fakeMarketplace(over: Partial<PluginsMarketplacePort> = {}): {
  port: PluginsMarketplacePort;
  calls: string[];
} {
  const calls: string[] = [];
  const port: PluginsMarketplacePort = {
    configured: () => true,
    catalog: () => {
      calls.push('catalog');
      return Promise.resolve({
        ok: true as const,
        entries: [
          { id: 'acme', package: '@acme/plugin', name: 'Acme', publisher: 'Acme Inc' },
          { id: 'hello', package: '@acme/hello', name: 'Hello' },
        ],
      });
    },
    installed: () =>
      Promise.resolve([
        { id: 'hello', package: '@acme/hello', version: '1.0.0', versions: ['1.0.0'] },
      ]),
    install: (packageName) => {
      calls.push(`install:${packageName}`);
      return Promise.resolve({ ok: true });
    },
    checkUpdates: () => {
      calls.push('checkUpdates');
      return Promise.resolve({
        ok: true as const,
        rows: [
          {
            id: 'hello',
            package: '@acme/hello',
            name: 'Hello',
            current: '1.0.0',
            available: '1.2.0',
          },
        ],
      });
    },
    update: (row) => {
      calls.push(`update:${row.id}`);
      return Promise.resolve({ ok: true });
    },
    rollback: (id) => {
      calls.push(`rollback:${id}`);
      return Promise.resolve();
    },
    uninstall: (id) => {
      calls.push(`uninstall:${id}`);
      return Promise.resolve();
    },
    ...over,
  };
  return { port, calls };
}

describe('вкладки раздела', () => {
  it('без установки из npm каталога и обновлений нет', async () => {
    // Вкладка, которой не у кого спросить, хуже отсутствующей: она обещает то, чего не будет.
    const view = await mount(fakeCatalog([entry({ id: 'hello', name: 'Hello' })]));

    await expect.element(page.getByTestId('settings-plugins-tab-installed')).toBeInTheDocument();
    await expect.element(page.getByTestId('settings-plugins-tab-development')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="settings-plugins-tab-marketplace"]')).toBeNull();
    expect(document.querySelector('[data-testid="settings-plugins-tab-updates"]')).toBeNull();
    view.unmount();
  });

  it('«В разработке» показывает только помеченные', async () => {
    const catalog = fakeCatalog([
      entry({ id: 'hello', name: 'Hello' }),
      entry({ id: 'acme', name: 'Acme', dev: true }),
    ]);
    const view = await mount(catalog);

    await userEvent.click(page.getByTestId('settings-plugins-tab-development'));

    await expect.element(page.getByTestId('settings-plugin-acme-toggle')).toBeInTheDocument();
    expect(document.querySelector('[data-testid="settings-plugin-hello-toggle"]')).toBeNull();
    view.unmount();
  });

  it('каталог читается при переходе на вкладку, а не при открытии окна', async () => {
    // Человек зашёл поменять тему — ходить за него в сеть незачем.
    const market = fakeMarketplace();
    const view = await mount(fakeCatalog([entry({ id: 'hello' })]), null, market.port);

    expect(market.calls).toEqual([]);
    await userEvent.click(page.getByTestId('settings-plugins-tab-marketplace'));

    await expect.element(page.getByTestId('marketplace-list')).toBeInTheDocument();
    expect(market.calls).toEqual(['catalog']);
    view.unmount();
  });

  it('установленное в каталоге помечено, и ставить его второй раз нельзя', async () => {
    const market = fakeMarketplace();
    const view = await mount(fakeCatalog([entry({ id: 'hello' })]), null, market.port);

    await userEvent.click(page.getByTestId('settings-plugins-tab-marketplace'));

    await expect.element(page.getByTestId('marketplace-hello-install')).toBeDisabled();
    await userEvent.click(page.getByTestId('marketplace-acme-install'));

    expect(market.calls).toContain('install:@acme/plugin');
    view.unmount();
  });

  it('каталог без проекта всё равно открывается', async () => {
    // Каталог про то, что стоит в браузере, а не в проекте: закрывать его пустым состоянием
    // списка плагинов значило бы прятать работающую вещь.
    const market = fakeMarketplace();
    const view = await mount(fakeCatalog([], { hasProject: false }), null, market.port);

    // Про проект по-прежнему сказано — но панель вкладок пустое состояние не съедает.
    await expect.element(page.getByTestId('settings-plugins-empty')).toBeInTheDocument();
    await userEvent.click(page.getByTestId('settings-plugins-tab-marketplace'));

    await expect.element(page.getByTestId('marketplace-list')).toBeInTheDocument();
    view.unmount();
  });

  it('обновления не спрашивают npm до нажатия', async () => {
    const market = fakeMarketplace();
    const view = await mount(fakeCatalog([entry({ id: 'hello' })]), null, market.port);

    await userEvent.click(page.getByTestId('settings-plugins-tab-updates'));
    await expect.element(page.getByTestId('updates-check')).toBeInTheDocument();
    expect(market.calls).toEqual([]);

    await userEvent.click(page.getByTestId('updates-check'));
    await expect.element(page.getByTestId('updates-hello-apply')).toBeInTheDocument();
    await userEvent.click(page.getByTestId('updates-hello-apply'));

    expect(market.calls).toContain('update:hello');
    view.unmount();
  });

  it('пусто после проверки значит «нечего обновлять», а не «не смотрели»', async () => {
    const market = fakeMarketplace({
      checkUpdates: () => Promise.resolve({ ok: true as const, rows: [] }),
    });
    const view = await mount(fakeCatalog([entry({ id: 'hello' })]), null, market.port);

    await userEvent.click(page.getByTestId('settings-plugins-tab-updates'));
    expect(document.querySelector('[data-testid="updates-none"]')).toBeNull();

    await userEvent.click(page.getByTestId('updates-check'));

    await expect.element(page.getByTestId('updates-none')).toBeInTheDocument();
    view.unmount();
  });

  it('отказ реестра объясняется словами, а не пустым списком', async () => {
    const market = fakeMarketplace({
      catalog: () => Promise.resolve({ ok: false as const, message: 'реестр недоступен' }),
    });
    const view = await mount(fakeCatalog([entry({ id: 'hello' })]), null, market.port);

    await userEvent.click(page.getByTestId('settings-plugins-tab-marketplace'));

    await expect
      .element(page.getByTestId('marketplace-problem'))
      .toHaveTextContent('реестр недоступен');
    view.unmount();
  });
});

describe('карточка установленного из npm', () => {
  const installedRow = (id: string) =>
    entry({ id, name: id, state: 'enabled', layer: 'installed' });

  it('слой и перекрытие видны в строке', async () => {
    const view = await mount(
      fakeCatalog([
        installedRow('acme'),
        entry({ id: 'hello', name: 'hello', layer: 'project', shadowed: 'installed' }),
      ]),
      null,
      fakeMarketplace().port
    );

    await expect.element(page.getByText('из npm')).toBeInTheDocument();
    await expect.element(page.getByText('перекрывает установленный')).toBeInTheDocument();
    view.unmount();
  });

  it('удаление и откат — только у приехавшего из npm', async () => {
    const market = fakeMarketplace();
    const view = await mount(
      fakeCatalog([installedRow('acme'), entry({ id: 'hello', name: 'hello', layer: 'project' })]),
      null,
      market.port
    );

    await userEvent.click(page.getByTestId('settings-plugin-hello-configure'));
    // У плагина проекта и то и другое означало бы правку чужой папки.
    expect(document.querySelector('[data-testid="settings-plugin-hello-uninstall"]')).toBeNull();

    await userEvent.click(page.getByTestId('settings-plugin-acme-configure'));
    await userEvent.click(page.getByTestId('settings-plugin-acme-uninstall'));

    expect(market.calls).toContain('uninstall:acme');
    view.unmount();
  });

  it('откат предлагается, только если на диске есть вторая версия', async () => {
    const market = fakeMarketplace({
      installed: () =>
        Promise.resolve([
          { id: 'acme', package: '@acme/plugin', version: '1.0.0', versions: ['1.0.0'] },
          { id: 'two', package: '@acme/two', version: '2.0.0', versions: ['1.0.0', '2.0.0'] },
        ]),
    });
    const view = await mount(
      fakeCatalog([installedRow('acme'), installedRow('two')]),
      null,
      market.port
    );

    await userEvent.click(page.getByTestId('settings-plugin-acme-configure'));
    await expect.element(page.getByTestId('settings-plugin-acme-rollback')).toBeDisabled();

    await userEvent.click(page.getByTestId('settings-plugin-two-configure'));
    await userEvent.click(page.getByTestId('settings-plugin-two-rollback'));

    expect(market.calls).toContain('rollback:two');
    view.unmount();
  });
});
