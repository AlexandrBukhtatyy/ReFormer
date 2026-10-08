/**
 * Плагин «Превью приложением»: панель есть только там, где рядом есть приложение.
 *
 * @module plugins/base/app-preview/plugin.test
 */

import { describe, expect, it } from 'vitest';
import {
  AppPreviewCapability,
  DocumentsServiceToken,
  PanelPoint,
  WorkspaceFilesServiceToken,
  type AppPreviewService,
  type PanelContribution,
  type PluginContext,
} from '@reformer/builder-plugin-api';
import { APP_PREVIEW_PANEL_ID, APP_PREVIEW_PLUGIN_ID, createAppPreviewPlugin } from './plugin';

const appPreview: AppPreviewService = {
  pageUrl: () => 'http://localhost:5173/contacts',
  formUrl: (modulePath) => `http://localhost:5173/contacts?form=${modulePath}`,
  onDidWriteSource: () => ({ dispose: () => {} }),
};

/** Службы рабочей области в объёме, который плагин проверяет: само их наличие. */
const workspaceServices: ReadonlyArray<readonly [{ readonly id: string }, unknown]> = [
  [DocumentsServiceToken, {}],
  [WorkspaceFilesServiceToken, {}],
];

/** Контекст плагина в объёме активации: службы, вклады, словарь и список подписок. */
function fakeContext(provided: ReadonlyArray<readonly [{ readonly id: string }, unknown]>) {
  const services = new Map(provided.map(([token, impl]) => [token.id, impl]));
  const contributed: { point: string; id: string | undefined; value: unknown }[] = [];
  const locales: string[] = [];
  const ctx = {
    id: APP_PREVIEW_PLUGIN_ID,
    subscriptions: [],
    i18n: {
      contribute: (locale: string) => {
        locales.push(locale);
      },
    },
    services: { get: (token: { id: string }) => services.get(token.id) },
    extensions: {
      contribute: (point: { id: string }, value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, id: meta?.id, value });
        return { dispose: () => {} };
      },
    },
  } as unknown as PluginContext;
  return { ctx, contributed, locales };
}

describe('плагин «Превью приложением»', () => {
  it('в билдере, встроенном в приложение, вносит панель превью в правый док', () => {
    const { ctx, contributed } = fakeContext([
      [AppPreviewCapability, appPreview],
      ...workspaceServices,
    ]);

    createAppPreviewPlugin().activate(ctx);

    expect(contributed).toHaveLength(1);
    expect(contributed[0]).toMatchObject({ point: PanelPoint.id, id: APP_PREVIEW_PANEL_ID });
    const panel = contributed[0]?.value as PanelContribution;
    expect(panel.slot).toBe('panel.right');
    expect(panel.titleKey).toBe('panel.title');
    // Переключатель режима — действие панели: оболочка рисует его в шапке дока.
    expect(panel.Actions).toBeTypeOf('function');
    // Вклад снимается вместе с плагином: подписка обязана попасть в его список.
    expect(ctx.subscriptions).toHaveLength(1);
  });

  it('в самостоятельном билдере не вносит ничего: приложения рядом нет', () => {
    const { ctx, contributed } = fakeContext(workspaceServices);

    createAppPreviewPlugin().activate(ctx);

    expect(contributed).toEqual([]);
    expect(ctx.subscriptions).toEqual([]);
  });

  it('без служб рабочей области панели нет: она не узнала бы, какую форму показывать', () => {
    const { ctx, contributed } = fakeContext([[AppPreviewCapability, appPreview]]);

    createAppPreviewPlugin().activate(ctx);

    expect(contributed).toEqual([]);
  });

  it('словарь вносит на обеих локалях — даже когда панели нет', () => {
    const { ctx, locales } = fakeContext([]);

    createAppPreviewPlugin().activate(ctx);

    expect(locales.sort()).toEqual(['en', 'ru']);
  });
});
