/**
 * Поверхности формы ReFormer: что плагин вносит и что его поверхности умеют.
 *
 * Порт платформы здесь подставной — настоящий собирается композицией и требует рабочей области.
 * Выбор поверхности правилом превью-хоста проверяется сборкой (`shell/boot/integration`):
 * правило принадлежит другому плагину.
 *
 * @module plugins/reformer/render/plugin.test
 */

import { describe, expect, it } from 'vitest';
import type { PluginContext } from '@reformer/builder-plugin-api';
import { builtinSurfaces, createPreviewRuntimePlugin, PREVIEW_RUNTIME_PLUGIN_ID } from './plugin';
import { MODEL_PANEL_ID } from './ui/ModelPanel';
import { COMPILING_SURFACE_ID } from './compiling/surface';
import { RUNTIME_SURFACE_ID } from './runtime/surface';
import { createFakeHost, fakeRef } from './testing';

/** Реестры в объёме, который трогает `activate`. */
function fakeContext() {
  const contributed: { point: string; id?: string }[] = [];
  const locales: string[] = [];
  const ctx = {
    id: PREVIEW_RUNTIME_PLUGIN_ID,
    subscriptions: [],
    i18n: {
      locale: 'ru',
      t: (key: string) => key,
      contribute: (locale: string) => locales.push(locale),
      onDidChangeLocale: () => ({ dispose: () => undefined }),
    },
    services: {
      get: () => undefined,
      require: () => undefined,
      register: () => ({ dispose: () => undefined }),
    },
    extensions: {
      contribute: (point: { id: string }, _value: unknown, meta?: { id?: string }) => {
        contributed.push({ point: point.id, id: meta?.id });
        return { dispose: () => undefined };
      },
      get: () => [],
      observe: () => ({ dispose: () => undefined }),
    },
  } as unknown as PluginContext;
  return { ctx, contributed, locales };
}

const t = (key: string): string => key;

describe('activate', () => {
  it('вносит ОДНУ панель — модель — и две поверхности в точку превью из SDK', () => {
    const { ctx, contributed } = fakeContext();
    createPreviewRuntimePlugin({ host: createFakeHost() }).activate(ctx);
    // Панель модели показывает то, чего не видно нигде, — значения, состояние узлов
    // и производные пути; саму форму показывает представление редактора схемы.
    expect(contributed).toEqual([
      { point: 'panel', id: MODEL_PANEL_ID },
      { point: 'preview.surface', id: RUNTIME_SURFACE_ID },
      { point: 'preview.surface', id: COMPILING_SURFACE_ID },
    ]);
  });

  it('везёт словарь сам — в своё пространство имён', () => {
    const { ctx, locales } = fakeContext();
    createPreviewRuntimePlugin({ host: createFakeHost() }).activate(ctx);
    expect(locales.sort()).toEqual(['en', 'ru']);
  });
});

describe('возможности поверхностей', () => {
  it('исполняет код ровно одна — компилирующая', () => {
    const executing = builtinSurfaces(createFakeHost(), t).filter(
      (surface) => surface.capabilities.executesCode
    );
    expect(executing.map((surface) => surface.id)).toEqual([COMPILING_SURFACE_ID]);
  });

  it('исполняющая поверхность объявлена в том же realm: иначе второй экземпляр ядра', () => {
    for (const surface of builtinSurfaces(createFakeHost(), t)) {
      expect(surface.capabilities.sameRealm).toBe(true);
    }
  });

  it('выбор узла кликом умеют обе', () => {
    for (const surface of builtinSurfaces(createFakeHost(), t)) {
      expect(surface.capabilities.hitTest).toBe(true);
    }
  });

  it('имя поверхность переводит своим словарём', () => {
    const titles = builtinSurfaces(createFakeHost(), (key) => `«${key}»`).map((s) => s.title?.());
    expect(titles).toEqual(['«surface.runtime»', '«surface.compiling»']);
  });
});

describe('чей документ', () => {
  const ref = fakeRef('fake:form.json');

  it('поверхности берутся за документ провайдера схемы формы', () => {
    for (const surface of builtinSurfaces(createFakeHost(), t)) {
      expect(surface.applies({ id: ref.id, ref, kind: 'model', providerId: 'form.schema' })).toBe(
        true
      );
    }
  });

  it('за `.json` чужого стека не берутся, хотя медиатип тот же', () => {
    for (const surface of builtinSurfaces(createFakeHost(), t)) {
      expect(surface.applies({ id: ref.id, ref, kind: 'model', providerId: 'plain.form' })).toBe(
        false
      );
    }
  });
});
