/**
 * Тесты плагина журнала.
 *
 * Порт здесь подставной — настоящий плагин собирает его сам из служб оболочки
 * (`./host-from-context`), и проверен он отдельно. Проверяется то, чем владеет плагин: состав
 * вкладов, место панели и что отказ быстрого исправления оставляет запись в журнале.
 *
 * @module plugins/base/journal/plugin.test
 */

import { describe, expect, it, vi } from 'vitest';

import { DiagnosticsServiceToken, LogServiceToken, PanelPoint } from '@reformer/builder-plugin-api';
import type {
  LogEntry,
  LogEntryRequest,
  LogService,
  PanelContribution,
  PluginContext,
} from '@reformer/builder-plugin-api';
import type { JournalHost } from './host';
import { JOURNAL_MESSAGES } from './messages';
import { createJournalPlugin, journalPanel, JOURNAL_PANEL_ID, JOURNAL_PLUGIN_ID } from './plugin';
import { createJournalViewState } from './view-state';

/**
 * Двойник службы журнала — вторая реализация контракта, и это цена границы слоёв: `plugins/**`
 * не видит `@/shell`. Проверяется не хранение (его проверяет оболочка), а то, что плагин пишет.
 */
function fakeLog(): LogService & { readonly written: LogEntryRequest[] } {
  const written: LogEntryRequest[] = [];
  return {
    written,
    append(request) {
      written.push(request);
      return {
        ...request,
        id: `l${String(written.length)}`,
        level: request.level ?? 'info',
        time: 0,
      };
    },
    entries: (): readonly LogEntry[] => [],
    clear: () => {},
    observe: () => ({ dispose: () => {} }),
  };
}

function fakeHost(): JournalHost {
  return {
    useTranslate: () => (key: string) => key,
    useFormatTime: () => () => '00:00:00',
    nameOf: () => null,
  };
}

function fakeContext(options: { withServices?: boolean; failing?: boolean } = {}) {
  const { withServices = true, failing = false } = options;
  const contributed: { point: string; id: string | undefined; value: unknown }[] = [];
  const log = fakeLog();
  const dictionary = new Map<string, Readonly<Record<string, string>>>();
  const execute = vi.fn(() =>
    failing ? Promise.reject(new Error('исправление сломалось')) : Promise.resolve(undefined)
  );
  const ctx = {
    id: JOURNAL_PLUGIN_ID,
    subscriptions: [],
    i18n: {
      contribute: (locale: string, messages: Readonly<Record<string, string>>) => {
        dictionary.set(locale, messages);
      },
    },
    services: {
      get: (token: unknown) => {
        if (!withServices) return undefined;
        if (token === LogServiceToken) return log;
        if (token === DiagnosticsServiceToken) return undefined;
        return undefined;
      },
    },
    extensions: {
      contribute: (point: { id: string }, value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, id: meta?.id, value });
        return { dispose: () => undefined };
      },
    },
    commands: {
      get: () => ({ id: 'schema.set-component' }),
      execute,
    },
  } as unknown as PluginContext;
  return { ctx, contributed, log, dictionary, execute };
}

describe('панель журнала', () => {
  const panel = journalPanel({
    host: fakeHost(),
    diagnostics: null,
    log: null,
    view: createJournalViewState(),
  });

  it('стоит в нижнем доке: находки и события читают вместе с текстом, а не вместо него', () => {
    expect(panel).toMatchObject({ id: JOURNAL_PANEL_ID, slot: 'panel.bottom' });
  });

  it('заголовок — ключ в пространстве имён плагина, а не готовая строка', () => {
    expect(panel.titleKey).toBe('panel.title');
    expect(JOURNAL_MESSAGES.ru?.['panel.title']).toBe('Журнал');
  });

  it('тело само ведёт прокрутку: строка переключателя не уезжает со списком', () => {
    expect(panel.fill).toBe(true);
  });

  it('значок на вкладке есть: он виден и в свёрнутом доке', () => {
    expect(panel.Badge).toBeDefined();
  });
});

describe('активация', () => {
  it('вносит одну панель журнала и словарь, всё — в подписках', () => {
    const { ctx, contributed, dictionary } = fakeContext();

    createJournalPlugin({ host: fakeHost() }).activate(ctx);

    expect(contributed.map((entry) => `${entry.point}:${entry.id ?? ''}`)).toEqual([
      `${PanelPoint.id}:${JOURNAL_PANEL_ID}`,
    ]);
    expect(dictionary.get('ru')).toEqual(JOURNAL_MESSAGES.ru);
    expect(dictionary.get('en')).toEqual(JOURNAL_MESSAGES.en);
    expect(ctx.subscriptions).toHaveLength(contributed.length);
  });

  it('вносится и без служб: журнал без находок и без ленты — пустой, а не сломанный', () => {
    const { ctx, contributed } = fakeContext({ withServices: false });

    createJournalPlugin({ host: fakeHost() }).activate(ctx);

    expect(contributed.map((entry) => entry.id)).toEqual([JOURNAL_PANEL_ID]);
  });

  it('идентификатор плагина — пространство имён во всех реестрах', () => {
    expect(createJournalPlugin({ host: fakeHost() }).id).toBe(JOURNAL_PLUGIN_ID);
  });
});

describe('быстрые исправления', () => {
  /** Реестр команд, который плагин передал телу панели. */
  function commandsOf(contributed: { value: unknown }[]) {
    // Тело — функция-фабрика элемента; реестр уходит в его пропсы. Контракт объявляет тело
    // любым компонентом, поэтому вызов — через сужение до функции.
    const body = (contributed[0]?.value as PanelContribution).Body as (props: {
      panelId: string;
    }) => { props: { commands: { run(id: string, args?: unknown): void } } };
    return body({ panelId: JOURNAL_PANEL_ID }).props.commands;
  }

  it('отказ исправления — запись в журнале с подробностями, а не только консоль', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { ctx, contributed, log, execute } = fakeContext({ failing: true });
    createJournalPlugin({ host: fakeHost() }).activate(ctx);

    commandsOf(contributed).run('schema.set-component', { nodeId: 'ab12cd34' });
    await vi.waitFor(() => {
      expect(log.written).toHaveLength(1);
    });

    expect(execute).toHaveBeenCalledWith('schema.set-component', { nodeId: 'ab12cd34' });
    expect(log.written[0]).toMatchObject({
      level: 'error',
      source: JOURNAL_PLUGIN_ID,
      messageKey: `${JOURNAL_PLUGIN_ID}:fix.failed`,
      params: { commandId: 'schema.set-component' },
    });
    expect(log.written[0]?.detail).toContain('исправление сломалось');
    error.mockRestore();
  });
});
