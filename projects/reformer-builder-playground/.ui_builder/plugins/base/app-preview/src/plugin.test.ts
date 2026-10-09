/**
 * Плагин «Превью приложением»: вклады есть только там, где рядом есть приложение.
 *
 * @module plugins/base/app-preview/plugin.test
 */

import { describe, expect, it } from 'vitest';
import {
  AppPreviewCapability,
  PanelPoint,
  PreviewSurfacePoint,
  WorkspaceFilesServiceToken,
  type AppPreviewService,
  type PanelContribution,
  type PluginContext,
  type PreviewSurface,
} from '@reformer/builder-plugin-api';
import { APP_FORM_SURFACE_ID } from './form-surface';
import manifest from './manifest.json';
import { APP_PREVIEW_PANEL_ID, APP_PREVIEW_PLUGIN_ID, createAppPreviewPlugin } from './plugin';

const appPreview: AppPreviewService = {
  pageUrl: () => 'http://localhost:5173/contacts',
  formUrl: (modulePath) => `http://localhost:5173/contacts?form=${modulePath}`,
  onDidWriteSource: () => ({ dispose: () => {} }),
};

/** Рабочая область в объёме, который плагин проверяет: само её наличие. */
const workspaceFiles = [WorkspaceFilesServiceToken, {}] as const;

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
      t: (key: string) => key,
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
  it('в билдере, встроенном в приложение, вносит панель приложения и поверхность формы', () => {
    const { ctx, contributed } = fakeContext([[AppPreviewCapability, appPreview], workspaceFiles]);

    createAppPreviewPlugin().activate(ctx);

    expect(contributed.map(({ point, id }) => ({ point, id }))).toEqual([
      { point: PanelPoint.id, id: APP_PREVIEW_PANEL_ID },
      { point: PreviewSurfacePoint.id, id: APP_FORM_SURFACE_ID },
    ]);
    // Вклады снимаются вместе с плагином: обе подписки обязаны попасть в его список.
    expect(ctx.subscriptions).toHaveLength(2);
  });

  it('панель — страница приложения в правом доке, без переключателя в шапке', () => {
    const { ctx, contributed } = fakeContext([[AppPreviewCapability, appPreview], workspaceFiles]);

    createAppPreviewPlugin().activate(ctx);

    const panel = contributed[0]?.value as PanelContribution;
    expect(panel.slot).toBe('panel.right');
    expect(panel.titleKey).toBe('panel.title');
    // Форму показывает вид вкладки, и выбирать в панели между формой и приложением нечего.
    expect(panel.Actions).toBeUndefined();
    // Шапки дока у панели нет: её называет адресная строка, а область нужна приложению.
    expect(panel.headless).toBe(true);
    expect(panel.fill).toBe(true);
  });

  it('поверхность называет себя той же, что внесена: по имени её находят находки и выбор', () => {
    const { ctx, contributed } = fakeContext([[AppPreviewCapability, appPreview], workspaceFiles]);

    createAppPreviewPlugin().activate(ctx);

    const surface = contributed[1]?.value as PreviewSurface;
    expect(surface.id).toBe(APP_FORM_SURFACE_ID);
  });

  it('объявляет право сохранять: им пользуется кнопка полосы о несохранённых правках', () => {
    // Оболочка отдаёт сохранение только тому, кто объявил право. Потеряй манифест эту строку —
    // полоса останется, а кнопка из неё молча исчезнет.
    expect(manifest.permissions).toContain('workspace.save');
  });

  it('в самостоятельном билдере не вносит ничего: приложения рядом нет', () => {
    const { ctx, contributed } = fakeContext([workspaceFiles]);

    createAppPreviewPlugin().activate(ctx);

    expect(contributed).toEqual([]);
    expect(ctx.subscriptions).toEqual([]);
  });

  it('без рабочей области остаётся панель приложения: форму показывать не у чего', () => {
    const { ctx, contributed } = fakeContext([[AppPreviewCapability, appPreview]]);

    createAppPreviewPlugin().activate(ctx);

    expect(contributed.map(({ point }) => point)).toEqual([PanelPoint.id]);
  });

  it('словарь вносит на обеих локалях — даже когда вкладов нет', () => {
    const { ctx, locales } = fakeContext([]);

    createAppPreviewPlugin().activate(ctx);

    expect(locales.sort()).toEqual(['en', 'ru']);
  });
});
