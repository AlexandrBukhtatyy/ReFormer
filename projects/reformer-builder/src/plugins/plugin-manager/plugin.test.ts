/**
 * Пункты палитры управления плагинами: состав по состоянию, действия по адресу.
 *
 * @module plugins/plugin-manager/plugin.test
 */

import { describe, expect, it } from 'vitest';

import type { PluginContext } from '@/sdk';
import type { ManagedPlugin, PluginManagerHost } from './host';
import {
  createPluginManagerPaletteProvider,
  createPluginManagerPlugin,
  PLUGIN_MANAGER_PALETTE_PROVIDER_ID,
  PLUGIN_MANAGER_PLUGIN_ID,
} from './plugin';

/** Перевод-заглушка: ключ и параметры видны в результате, словарь для этого не нужен. */
const translate = (key: string, params?: Record<string, unknown>): string =>
  params === undefined ? key : `${key}(${Object.values(params).join(' ')})`;

function managed(id: string, state: ManagedPlugin['state'], dev = false): ManagedPlugin {
  return {
    id,
    name: id,
    state,
    dev,
    ...(state === 'failed' ? { problem: { message: 'нет точки входа' } } : {}),
  };
}

/** Хост-двойник: список подставляется, вызовы записываются. */
function fakeHost(entries: readonly ManagedPlugin[]): {
  host: PluginManagerHost;
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    host: {
      list: () => entries,
      enable: (id) => {
        calls.push(`enable:${id}`);
        return Promise.resolve(true);
      },
      disable: (id) => calls.push(`disable:${id}`),
      reload: (id) => {
        calls.push(`reload:${id}`);
        return Promise.resolve(true);
      },
      setDev: (id, on) => calls.push(`dev:${id}:${on}`),
      refresh: () => {
        calls.push('refresh');
        return Promise.resolve([]);
      },
    },
  };
}

describe('поставщик пунктов', () => {
  it('включённый: выключить и перезагрузить; выключенный: включить; у всех — пометка', () => {
    const { host } = fakeHost([managed('on', 'enabled', true), managed('off', 'disabled')]);
    const provider = createPluginManagerPaletteProvider(host, translate);

    const ids = provider.provide('', {} as never);
    expect((ids as { id: string }[]).map((item) => item.id)).toEqual([
      'plugin-manager.refresh',
      'plugin-manager.disable.on',
      'plugin-manager.reload.on',
      'plugin-manager.dev.on',
      'plugin-manager.enable.off',
      'plugin-manager.dev.off',
    ]);
  });

  it('упавшему предлагается «включить» — это и есть повторная попытка, причина в detail', () => {
    const { host, calls } = fakeHost([managed('boom', 'failed', true)]);
    const items = createPluginManagerPaletteProvider(host, translate).provide('', {} as never);
    const enable = (items as { id: string; detail?: string; run: () => unknown }[]).find(
      (item) => item.id === 'plugin-manager.enable.boom'
    );

    expect(enable?.detail).toBe('detail.failed(нет точки входа)');
    enable?.run();
    expect(calls).toEqual(['enable:boom']);
  });

  it('пометка «в разработке» переключается в противоположное состояние', () => {
    const { host, calls } = fakeHost([managed('a', 'enabled', true), managed('b', 'disabled')]);
    const items = createPluginManagerPaletteProvider(host, translate).provide('', {} as never) as {
      id: string;
      title?: string;
      run: () => unknown;
    }[];

    const devA = items.find((item) => item.id === 'plugin-manager.dev.a');
    const devB = items.find((item) => item.id === 'plugin-manager.dev.b');
    expect(devA?.title).toBe('palette.dev-off(a)');
    expect(devB?.title).toBe('palette.dev-on(b)');

    devA?.run();
    devB?.run();
    expect(calls).toEqual(['dev:a:false', 'dev:b:true']);
  });
});

describe('плагин', () => {
  it('вносит поставщика в точку палитры и снимает его через subscriptions', () => {
    const { host } = fakeHost([]);
    const contributed: { point: string; id: string | undefined }[] = [];
    const subscriptions: { dispose(): void }[] = [];
    const ctx = {
      id: PLUGIN_MANAGER_PLUGIN_ID,
      subscriptions,
      extensions: {
        contribute: (point: { id: string }, _value: unknown, meta?: { id?: string }) => {
          contributed.push({ point: point.id, id: meta?.id });
          return { dispose: (): void => {} };
        },
      },
    } as unknown as PluginContext;

    createPluginManagerPlugin({ host, translate }).activate(ctx);

    expect(contributed).toEqual([
      { point: 'palette.items', id: PLUGIN_MANAGER_PALETTE_PROVIDER_ID },
    ]);
    expect(subscriptions).toHaveLength(1);
  });
});
