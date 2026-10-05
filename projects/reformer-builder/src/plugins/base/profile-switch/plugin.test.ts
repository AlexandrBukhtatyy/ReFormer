/**
 * Плагин выбора профиля: что он вносит при активации.
 *
 * Логика списка и переключения проверена в соседних тестах — здесь шов: службы берутся из
 * реестра контекста, вклады уходят в настоящие точки, а пункты палитры показывают тот же
 * список, что и ячейка. И граница, ради которой плагин выделен: о китах он не знает ничего.
 *
 * @module plugins/base/profile-switch/plugin.test
 */

import { describe, expect, it, vi } from 'vitest';
import {
  ApplicationProfilesServiceToken,
  PaletteItemsPoint,
  PanelPoint,
  PromptServiceToken,
  type ApplicationProfileInfo,
  type Disposable,
  type PaletteItem,
  type PanelContribution,
  type PluginContext,
  type WhenContext,
} from '@reformer/builder-plugin-api';
import {
  PROFILE_SWITCH_CELL_ID,
  PROFILE_SWITCH_PALETTE_PROVIDER_ID,
  PROFILE_SWITCH_PLUGIN_ID,
} from './contract';
import { PROFILE_SWITCH_MESSAGES } from './messages';
import { createProfileSwitchPlugin } from './plugin';

const NEUTRAL: WhenContext = {
  focus: 'none',
  activeEditorId: null,
  activeResourceKind: null,
  hasSelection: false,
  previewMode: null,
};

const BUILDER: ApplicationProfileInfo = { id: 'builder', name: 'Конструктор' };
const MINIMAL: ApplicationProfileInfo = { id: 'minimal', name: 'Минимальный' };

interface Provider {
  provide(query: string, context: WhenContext): PaletteItem[];
}

/** Контекст плагина в объёме активации: службы, вклады и подписки. */
function fakeContext(
  options: { offered?: readonly ApplicationProfileInfo[]; profiles?: boolean } = {}
) {
  const dictionary = new Map<string, Readonly<Record<string, string>>>();
  const contributed: { point: string; id: string | undefined; value: unknown }[] = [];
  const select = vi.fn(() => Promise.resolve());
  const asked: string[] = [];
  const noop = (): Disposable => ({ dispose: () => {} });

  const services = new Map<string, unknown>();
  if (options.profiles !== false) {
    services.set(ApplicationProfilesServiceToken.id, {
      current: () => BUILDER,
      launch: () => BUILDER,
      offered: () => options.offered ?? [BUILDER, MINIMAL],
      select,
    });
  }
  services.set(PromptServiceToken.id, { confirm: () => Promise.resolve(true) });

  const ctx = {
    id: PROFILE_SWITCH_PLUGIN_ID,
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
    services: {
      get: (token: { id: string }) => {
        asked.push(token.id);
        return services.get(token.id);
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
  return { ctx, contributed, dictionary, provider, select, asked };
}

describe('плагин выбора профиля', () => {
  it('вносит ячейку в слот statusbar и поставщика пунктов палитры', () => {
    const { ctx, contributed } = fakeContext();

    createProfileSwitchPlugin().activate(ctx);

    expect(contributed.map(({ point, id }) => ({ point, id }))).toEqual([
      { point: PanelPoint.id, id: PROFILE_SWITCH_CELL_ID },
      { point: PaletteItemsPoint.id, id: PROFILE_SWITCH_PALETTE_PROVIDER_ID },
    ]);
    const panel = contributed[0]?.value as PanelContribution;
    expect(panel.slot).toBe('statusbar');
  });

  it('регистрирует словарь, и заголовок ячейки в нём есть', () => {
    const { ctx, contributed, dictionary } = fakeContext();

    createProfileSwitchPlugin().activate(ctx);

    expect(dictionary.get('ru')).toEqual(PROFILE_SWITCH_MESSAGES.ru);
    expect(dictionary.get('en')).toEqual(PROFILE_SWITCH_MESSAGES.en);
    const panel = contributed[0]?.value as PanelContribution;
    expect(PROFILE_SWITCH_MESSAGES.ru[panel.titleKey]).toBeDefined();
  });

  it('пункты палитры — те же профили: действующий подписан, другой предупреждает', () => {
    const { ctx, provider } = fakeContext();
    createProfileSwitchPlugin().activate(ctx);

    const items = provider().provide('', NEUTRAL);

    expect(items.map((item) => [item.title, item.detail])).toEqual([
      ['Профиль: Конструктор', 'Активен'],
      ['Профиль: Минимальный', 'Перезагрузит приложение'],
      // Возврат к конфигу — последним и без пометки: собран профиль запуска, перезагрузки нет.
      ['Профиль: как в конфиге запуска', undefined],
    ]);
    expect(new Set(items.map((item) => item.id)).size).toBe(3);
  });

  it('пункт другого профиля выбирает его, пункт возврата — профиль запуска', async () => {
    const { ctx, provider, select } = fakeContext();
    createProfileSwitchPlugin().activate(ctx);
    const items = provider().provide('', NEUTRAL);

    await items[1]?.run();
    expect(select).toHaveBeenLastCalledWith('minimal');

    await items.at(-1)?.run();
    expect(select).toHaveBeenLastCalledWith('builder');
  });

  it('профиль один — пунктов в палитре нет: выбирать не из чего', () => {
    const { ctx, provider } = fakeContext({ offered: [] });
    createProfileSwitchPlugin().activate(ctx);

    expect(provider().provide('', NEUTRAL)).toEqual([]);
  });

  it('службы профилей нет — плагин активируется и молчит', () => {
    const { ctx, provider } = fakeContext({ profiles: false });

    createProfileSwitchPlugin().activate(ctx);

    expect(provider().provide('', NEUTRAL)).toEqual([]);
  });

  it('о китах плагин не спрашивает: выбор кита — у плагина китов', async () => {
    const { ctx, provider, asked } = fakeContext();
    createProfileSwitchPlugin().activate(ctx);
    await provider().provide('', NEUTRAL)[1]?.run();

    expect(asked.filter((id) => id.includes('kit'))).toEqual([]);
  });
});
