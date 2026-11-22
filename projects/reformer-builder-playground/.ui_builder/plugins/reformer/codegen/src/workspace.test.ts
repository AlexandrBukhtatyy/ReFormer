/**
 * Рабочая область стека генерации: кит ReFormer спрашивается в момент вопроса, фикстура пишет
 * той же дверью, что человек и ассистент.
 *
 * @module plugins/reformer/codegen/workspace.test
 */

import { describe, expect, it } from 'vitest';
import {
  DocumentsServiceToken,
  KitsCapability,
  WorkspaceFilesServiceToken,
  type CatalogJson,
  type PluginContext,
  type ResourceId,
} from '@reformer/builder-plugin-api';
import { codegenStackWorkspace } from './workspace';

const FORM = 'fs:forms/credit/form.json' as ResourceId;

function harness(options: { readonly kit?: boolean } = {}) {
  const calls: string[] = [];
  let catalog: CatalogJson = { version: '2.1', components: [], kit: { id: 'kit-a' } };
  const documents = {
    hasProject: () => true,
    activeResource: () => FORM,
    documentOf: () => null,
    writeText: (id: ResourceId, text: string) => {
      calls.push(`documents.writeText(${id}, ${text})`);
      return Promise.resolve();
    },
    open: () => Promise.resolve(),
  };
  const files = {
    canWrite: () => true,
    fromRoot: (anchor: ResourceId, path: string) => `${anchor}|${path}`,
    readText: () => Promise.resolve(null),
  };
  const kits = {
    catalogJson: () => catalog,
    onDidChange: () => ({ dispose: () => {} }),
  };
  const ctx = {
    id: 'reformer.codegen-schema',
    services: {
      get: (token: { id: string }) =>
        token.id === KitsCapability.id && options.kit !== false ? kits : undefined,
      require: (token: { id: string }) => {
        if (token.id === DocumentsServiceToken.id) return documents;
        if (token.id === WorkspaceFilesServiceToken.id) return files;
        throw new Error(`сервис «${token.id}» не зарегистрирован`);
      },
    },
  } as unknown as PluginContext;
  return {
    ctx,
    calls,
    arrive: (next: CatalogJson) => {
      catalog = next;
    },
  };
}

describe('кит спрашивается в момент вопроса', () => {
  it('каталог читается НА КАЖДЫЙ вызов: кит переключают и поднимают позже', () => {
    const h = harness();
    const w = codegenStackWorkspace(h.ctx);

    expect(w.catalog()).toEqual([]);
    h.arrive({
      version: '2.1',
      kit: { id: 'kit-a' },
      components: [{ name: 'Text', role: 'container', propsSchema: {} }],
    });

    // Записи — ReFormer-проекция: запись кита плюс синтетика билдера.
    expect(w.catalog().map((entry) => entry.name)).toContain('Text');
    expect(w.kit()?.id).toBe('kit-a');
  });

  it('без плагина китов: пустой каталог, дескриптора нет, подписка безвредна', () => {
    const w = codegenStackWorkspace(harness({ kit: false }).ctx);

    expect(w.catalog()).toEqual([]);
    expect(w.kit()).toBeNull();
    expect(() => w.onDidChangeKit(() => {}).dispose()).not.toThrow();
  });
});

describe('фикстура', () => {
  it('пишет ОДНОЙ дверью — службой документов; адрес — от корня проекта', async () => {
    const h = harness();
    const w = codegenStackWorkspace(h.ctx);

    await w.writeText(FORM, 'новый');
    expect(h.calls).toEqual([`documents.writeText(${FORM}, новый)`]);
    expect(w.resolveFromRoot?.(FORM, 'shared')).toBe(`${FORM}|shared`);
    expect(w.sourceOf(FORM)).toEqual({ write: true });
    expect(w.activeResource()).toBe(FORM);
  });
});
