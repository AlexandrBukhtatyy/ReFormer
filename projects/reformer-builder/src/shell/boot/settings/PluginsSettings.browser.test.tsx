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
import { toDisposable } from '@/shell/platform/primitives/disposable';
import { renderReact } from '@/testing/render';
import hostRu from '@/shell/platform/services/i18n/locales/ru.json';
import { createPluginsSettingsBody } from './PluginsSettings';
import type { PluginCatalogEntry, PluginSettingsHost, PluginsSettingsPort } from './plugins-list';

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
  settingsHost: PluginSettingsHost | null = null
): Promise<{ unmount: () => void }> {
  const i18n = createI18nService({
    loadHostMessages: () => Promise.resolve(hostRu as Record<string, string>),
    dev: false,
  });
  await i18n.setLocale('ru');
  const Body = createPluginsSettingsBody(catalog.port, settingsHost);
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
