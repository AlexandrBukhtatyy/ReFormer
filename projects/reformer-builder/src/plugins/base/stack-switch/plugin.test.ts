/**
 * Плагин переключателя: что он вносит при активации и что остаётся после снятия.
 *
 * Логика списка и переключения проверена в соседних тестах — здесь шов: службы берутся из
 * реестра контекста, вклады уходят в настоящие точки, а пункты палитры показывают тот же
 * список, что и ячейка.
 *
 * @module plugins/base/stack-switch/plugin.test
 */

import { describe, expect, it, vi } from 'vitest';
import {
  ApplicationProfilesServiceToken,
  KitsCapability,
  PaletteItemsPoint,
  PanelPoint,
  PromptServiceToken,
  type Disposable,
  type KitSummary,
  type PaletteItem,
  type PanelContribution,
  type PluginContext,
  type WhenContext,
} from '@reformer/builder-plugin-api';
import {
  STACK_SWITCH_CELL_ID,
  STACK_SWITCH_PALETTE_PROVIDER_ID,
  STACK_SWITCH_PLUGIN_ID,
} from './contract';
import { STACK_SWITCH_MESSAGES } from './messages';
import { createStackSwitchPlugin } from './plugin';

const NEUTRAL: WhenContext = {
  focus: 'none',
  activeEditorId: null,
  activeResourceKind: null,
  hasSelection: false,
  previewMode: null,
};

const REFORMER = { id: 'reformer.builder', name: 'ReFormer' };
const RJSF = { id: 'rjsf.builder', name: 'RJSF' };

const summary = (id: string, label: string, active: boolean): KitSummary => ({
  id,
  label,
  package: `@vendor/${id}`,
  version: '1.0.0',
  active,
  origin: { kind: 'builtin' },
});

interface Provider {
  provide(query: string, context: WhenContext): PaletteItem[];
}

/** Контекст плагина в объёме активации: службы, возможности, вклады и подписки. */
function fakeContext(options: { kits?: KitSummary[]; profiles?: boolean; confirm?: boolean } = {}) {
  const dictionary = new Map<string, Readonly<Record<string, string>>>();
  const contributed: { point: string; id: string | undefined; value: unknown }[] = [];
  const activate = vi.fn(() => Promise.resolve());
  const select = vi.fn(() => Promise.resolve());
  const resetChoice = vi.fn(() => Promise.resolve());
  const observeDisposed = vi.fn();
  const noop = (): Disposable => ({ dispose: () => {} });

  const services = new Map<string, unknown>();
  const kits =
    options.kits === undefined
      ? undefined
      : {
          available: () => options.kits ?? [],
          activate,
          resetChoice,
          onDidChange: noop,
          onDidChangeAvailable: noop,
        };
  if (kits !== undefined) services.set(KitsCapability.id, kits);
  if (options.profiles !== false) {
    services.set(ApplicationProfilesServiceToken.id, {
      current: () => REFORMER,
      launch: () => REFORMER,
      offered: () => [REFORMER, RJSF],
      select,
    });
  }
  services.set(PromptServiceToken.id, {
    confirm: () => Promise.resolve(options.confirm ?? true),
  });

  const ctx = {
    id: STACK_SWITCH_PLUGIN_ID,
    subscriptions: [] as Disposable[],
    i18n: {
      locale: 'ru',
      onDidChangeLocale: noop,
      contribute: (locale: string, messages: Readonly<Record<string, string>>) => {
        dictionary.set(locale, { ...dictionary.get(locale), ...messages });
      },
      t: (key: string, params?: Record<string, unknown>) =>
        (dictionary.get('ru')?.[key] ?? `⟦${key}⟧`).replace(/\{(\w+)\}/g, (_match, name: string) =>
          String(params?.[name] ?? '')
        ),
    },
    services: { get: (token: { id: string }) => services.get(token.id) },
    capabilities: {
      observe: (_cap: unknown, listener: (impl: unknown) => void): Disposable => {
        listener(kits);
        return { dispose: observeDisposed };
      },
    },
    extensions: {
      contribute: (point: { id: string }, value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, id: meta?.id, value });
        return { dispose: () => {} };
      },
    },
  } as unknown as PluginContext;

  const provider = (): Provider =>
    contributed.find((entry) => entry.point === PaletteItemsPoint.id)?.value as Provider;
  return {
    ctx,
    contributed,
    dictionary,
    provider,
    activate,
    select,
    resetChoice,
    observeDisposed,
  };
}

const UI_KIT = summary('reformer-ui-kit', 'ReFormer UI Kit', true);
const HEXA = summary('hexa-ui', 'Kaspersky HexaUI', false);

describe('плагин переключателя сочетаний', () => {
  it('вносит ячейку в слот statusbar и поставщика пунктов палитры', () => {
    const { ctx, contributed } = fakeContext({ kits: [UI_KIT] });

    createStackSwitchPlugin().activate(ctx);

    expect(contributed.map(({ point, id }) => ({ point, id }))).toEqual([
      { point: PanelPoint.id, id: STACK_SWITCH_CELL_ID },
      { point: PaletteItemsPoint.id, id: STACK_SWITCH_PALETTE_PROVIDER_ID },
    ]);
    const panel = contributed[0]?.value as PanelContribution;
    expect(panel.slot).toBe('statusbar');
  });

  it('регистрирует словарь, и заголовок ячейки в нём есть', () => {
    const { ctx, contributed, dictionary } = fakeContext({ kits: [UI_KIT] });

    createStackSwitchPlugin().activate(ctx);

    expect(dictionary.get('ru')).toEqual(STACK_SWITCH_MESSAGES.ru);
    expect(dictionary.get('en')).toEqual(STACK_SWITCH_MESSAGES.en);
    const panel = contributed[0]?.value as PanelContribution;
    expect(STACK_SWITCH_MESSAGES.ru[panel.titleKey]).toBeDefined();
  });

  it('пункты палитры — те же сочетания: действующее подписано, чужой движок предупреждает', () => {
    const { ctx, provider } = fakeContext({ kits: [UI_KIT, HEXA] });
    createStackSwitchPlugin().activate(ctx);

    const items = provider().provide('', NEUTRAL);

    expect(items.map((item) => [item.title, item.detail])).toEqual([
      ['Сочетание: ReFormer + ReFormer UI Kit', 'Активно'],
      ['Сочетание: ReFormer + Kaspersky HexaUI', undefined],
      ['Сочетание: RJSF + ReFormer UI Kit', 'Перезагрузит конструктор'],
      ['Сочетание: RJSF + Kaspersky HexaUI', 'Перезагрузит конструктор'],
      // Возврат к конфигу — последним и без пометки: собран профиль запуска, перезапуска нет.
      ['Сочетание: как в конфиге запуска', undefined],
    ]);
    expect(new Set(items.map((item) => item.id)).size).toBe(5);
  });

  it('пункт возврата к конфигу запуска снимает выбор кита и выбор профиля', async () => {
    const { ctx, provider, resetChoice, select } = fakeContext({ kits: [UI_KIT, HEXA] });
    createStackSwitchPlugin().activate(ctx);

    await provider().provide('', NEUTRAL).at(-1)?.run();

    expect(resetChoice).toHaveBeenCalledTimes(1);
    expect(select).toHaveBeenCalledWith('reformer.builder');
  });

  it('пункт с другим китом переключает кит, с другим движком — ещё и профиль', async () => {
    const { ctx, provider, activate, select } = fakeContext({ kits: [UI_KIT, HEXA] });
    createStackSwitchPlugin().activate(ctx);
    const items = provider().provide('', NEUTRAL);

    await items[1]?.run();
    expect(activate).toHaveBeenLastCalledWith('hexa-ui');
    expect(select).not.toHaveBeenCalled();

    await items[3]?.run();
    expect(select).toHaveBeenCalledWith('rjsf.builder');
  });

  it('сочетание одно — пунктов в палитре нет: выбирать не из чего', () => {
    const { ctx, provider } = fakeContext({ kits: [UI_KIT], profiles: false });
    createStackSwitchPlugin().activate(ctx);

    expect(provider().provide('', NEUTRAL)).toEqual([]);
  });

  it('китов в составе нет — пункты одних движков', () => {
    const { ctx, provider } = fakeContext();
    createStackSwitchPlugin().activate(ctx);

    expect(
      provider()
        .provide('', NEUTRAL)
        .map((item) => item.title)
    ).toEqual(['Сочетание: ReFormer', 'Сочетание: RJSF', 'Сочетание: как в конфиге запуска']);
  });

  it('всё снятое лежит в подписках: наблюдение за китами отпускается вместе с плагином', () => {
    const { ctx, observeDisposed } = fakeContext({ kits: [UI_KIT] });

    createStackSwitchPlugin().activate(ctx);
    expect(ctx.subscriptions).toHaveLength(3);

    for (const subscription of ctx.subscriptions) subscription.dispose();
    expect(observeDisposed).toHaveBeenCalledTimes(1);
  });
});
