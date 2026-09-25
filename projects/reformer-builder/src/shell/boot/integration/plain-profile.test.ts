/**
 * Демо-стек поверх основы (`plain.builder`) — доказательство оси стеков настоящим `boot`.
 *
 * Основа билдера плюс ОДИН плагин другого стека: свой провайдер модели, своя поверхность превью,
 * свой валидатор и редактор. Ни одного плагина стека ReFormer и ни одного порта: всё, что
 * нужно стеку от оболочки, он берёт возможностями.
 *
 * @module shell/boot/integration/plain-profile.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProfile } from '@/application/composer/compose';
import { baseProfile, plainProfile } from '@/application/profiles/builder';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import type {
  ExtensionPoint,
  PreviewLiveService,
  ResourceRef,
} from '@reformer/builder-plugin-api/internal';
import {
  definePlugin,
  DocumentModelPoint,
  EditorPoint,
  PreviewLiveCapability,
  PreviewSurfacePoint,
  ValidatorPoint,
} from '@reformer/builder-plugin-api/internal';
import { printPlainForm, sampleForm } from '@/plugins/plain/core';
import { createEditorProbe } from '@/shell/platform/workspace/model/provider';
import { resolveEditor } from '@/shell/platform/ui/contributions/editors';
import { createMemoryIndexedDb } from '@/shell/platform/workspace/storage/testing';

/** Окружение браузера в объёме, который трогает `boot` при сборке (см. `base-profile.test`). */
function stubBrowser(): void {
  const listeners = { addEventListener: () => {}, removeEventListener: () => {} };
  vi.stubGlobal('indexedDB', createMemoryIndexedDb().factory);
  vi.stubGlobal('window', { ...listeners });
  vi.stubGlobal('document', {
    ...listeners,
    title: 'reformer-builder',
    documentElement: { classList: { add: () => {}, remove: () => {} } },
  });
}

let app: BuilderApp | null = null;

afterEach(() => {
  app?.dispose();
  app = null;
  vi.unstubAllGlobals();
});

async function start(profile = plainProfile): Promise<BuilderApp> {
  stubBrowser();
  app = boot({ application: fromProfile(profile) });
  await app.ready;
  return app;
}

const PLAIN_REF: ResourceRef = {
  id: 'mem:contact.plain.json',
  sourceId: 'mem',
  path: 'contact.plain.json',
  name: 'contact.plain.json',
  kind: 'file',
  mediaType: 'application/json',
};

const probe = () => createEditorProbe(printPlainForm(sampleForm()));

describe('boot на профиле plain.builder', () => {
  it('поднимается: основа плюс плагин демо-стека, все активны', async () => {
    const started = await start();

    const statuses = started.plugins.statuses();
    expect(statuses.map((s) => s.id).sort()).toEqual([
      'reformer.editor-markdown',
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.plain',
      'reformer.plugin-manager',
      'reformer.preview',
    ]);
    expect(statuses.filter((s) => s.state !== 'active')).toEqual([]);
  });

  it('модель, поверхность и валидатор — только у демо-стека', async () => {
    const started = await start();
    const owners = <T>(point: ExtensionPoint<T>): string[] =>
      [...new Set(started.extensions.get(point).map((c) => c.pluginId))].sort();

    expect(owners(DocumentModelPoint)).toEqual(['reformer.plain']);
    expect(owners(PreviewSurfacePoint)).toEqual(['reformer.plain']);
    expect(owners(ValidatorPoint)).toEqual(['reformer.plain']);
  });

  it('форма стека открывается его редактором, а не Monaco', async () => {
    const started = await start();

    expect(resolveEditor(started.extensions.get(EditorPoint), PLAIN_REF, probe())?.value.id).toBe(
      'plain.editor'
    );
  });

  it('живой вид есть и знает поверхность стека', async () => {
    const started = await start();
    let live: PreviewLiveService | undefined;
    started.plugins.register(
      definePlugin({
        id: 'probe',
        activate(ctx) {
          live = ctx.services.get(PreviewLiveCapability);
        },
      }),
      []
    );
    expect(started.plugins.activate('probe')).toBe(true);

    // Документов без проекта нет, поэтому выбрать поверхность не для чего, — но она есть.
    expect(live?.available()).toBe(true);
  });

  it('основа БЕЗ демо-стека открывает ту же форму текстом', async () => {
    const started = await start(baseProfile);

    expect(resolveEditor(started.extensions.get(EditorPoint), PLAIN_REF, probe())?.value.id).toBe(
      'editor.monaco'
    );
  });
});
