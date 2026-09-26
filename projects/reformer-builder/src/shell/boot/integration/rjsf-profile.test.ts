/**
 * Домен RJSF поверх основы (`rjsf.builder`) — настоящим `boot`.
 *
 * Основа, реестр китов и два плагина домена: редактор (провайдер модели, валидатор, редактор,
 * команды) и рендер (поверхность превью с темой из кита). Ни одного плагина стека ReFormer:
 * киты — платформа, и RJSF берёт тот же активный кит, что рисует формы ReFormer.
 *
 * Отдельно — совмещённый состав: ReFormer, демо-стек и RJSF в одном приложении. Три формата
 * схемы лежат в `.json`, и отличают их только пробы по содержимому; если две пробы возьмутся
 * за один документ, у него окажется два предметных редактора.
 *
 * @module shell/boot/integration/rjsf-profile.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fromProfile } from '@/application/composer/compose';
import { builderProfile, rjsfProfile } from '@/application/profiles/builder';
import { defineProfile } from '@/application/profiles/profile';
import { boot, type BuilderApp } from '@/shell/boot/boot';
import type { ExtensionPoint, ResourceRef } from '@reformer/builder-plugin-api/internal';
import {
  DocumentModelPoint,
  EditorPoint,
  PreviewSurfacePoint,
  ValidatorPoint,
} from '@reformer/builder-plugin-api/internal';
import { printPlainForm, sampleForm as samplePlainForm } from '@/plugins/plain/core';
import { printRjsfForm, sampleForm as sampleRjsfForm } from '@/plugins/rjsf/core';
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

async function start(profile = rjsfProfile): Promise<BuilderApp> {
  stubBrowser();
  app = boot({ application: fromProfile(profile) });
  await app.ready;
  return app;
}

const ref = (name: string): ResourceRef => ({
  id: `mem:${name}`,
  sourceId: 'mem',
  path: name,
  name,
  kind: 'file',
  mediaType: 'application/json',
});

/** Три формата схемы — все в `.json`. */
const FORMATS = {
  reformer: JSON.stringify({ version: '1.0', root: { component: 'Box', children: [] } }),
  plain: printPlainForm(samplePlainForm()),
  rjsf: printRjsfForm(sampleRjsfForm()),
} as const;

describe('boot на профиле rjsf.builder', () => {
  it('поднимается: основа, киты и два плагина домена — все активны', async () => {
    const started = await start();

    const statuses = started.plugins.statuses();
    expect(statuses.map((s) => s.id).sort()).toEqual([
      'reformer.editor-markdown',
      'reformer.editor-monaco',
      'reformer.files',
      'reformer.kits',
      'reformer.plugin-manager',
      'reformer.preview',
      'reformer.rjsf.editor',
      'reformer.rjsf.render',
    ]);
    expect(statuses.filter((s) => s.state !== 'active')).toEqual([]);
  });

  it('модель и валидатор — у редактора домена, поверхность — у рендера', async () => {
    const started = await start();
    const owners = <T>(point: ExtensionPoint<T>): string[] =>
      [...new Set(started.extensions.get(point).map((c) => c.pluginId))].sort();

    expect(owners(DocumentModelPoint)).toEqual(['reformer.rjsf.editor']);
    expect(owners(ValidatorPoint)).toEqual(['reformer.rjsf.editor']);
    expect(owners(PreviewSurfacePoint)).toEqual(['reformer.rjsf.render']);
  });

  it('форма RJSF открывается редактором домена, а не Monaco', async () => {
    const started = await start();

    expect(
      resolveEditor(
        started.extensions.get(EditorPoint),
        ref('contact.rjsf.json'),
        createEditorProbe(FORMATS.rjsf)
      )?.value.id
    ).toBe('rjsf.editor');
  });
});

describe('совмещённый состав: ReFormer, демо-стек и RJSF', () => {
  const combined = defineProfile({
    id: 'combined.test',
    name: 'Все стеки',
    extends: builderProfile.id,
    plugins: ['reformer.plain', 'reformer.rjsf.editor', 'reformer.rjsf.render'],
  });

  it('собирается и поднимается целиком', async () => {
    const started = await start(combined);

    expect(started.plugins.statuses().filter((s) => s.state !== 'active')).toEqual([]);
  });

  it('пробы форматов не пересекаются: у каждой схемы ровно один провайдер и свой редактор', async () => {
    const started = await start(combined);
    const providers = started.extensions.get(DocumentModelPoint);
    const editors = started.extensions.get(EditorPoint);
    const expected = {
      reformer: 'editor-schema.canvas',
      plain: 'plain.editor',
      rjsf: 'rjsf.editor',
    };

    for (const [format, text] of Object.entries(FORMATS)) {
      const name = `form.${format}.json`;
      const applying = providers
        .filter((contribution) => contribution.value.applies(ref(name), createEditorProbe(text)))
        .map((contribution) => contribution.pluginId);
      expect(applying, format).toHaveLength(1);
      expect(resolveEditor(editors, ref(name), createEditorProbe(text))?.value.id, format).toBe(
        expected[format as keyof typeof expected]
      );
    }
  });
});
