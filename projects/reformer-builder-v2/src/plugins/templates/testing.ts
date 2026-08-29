/**
 * Двойники порта и локального хранилища для тестов шаблонов.
 *
 * Отдельным модулем, а не в файле теста: порт проверяют и хранилища, и операции, и панель.
 *
 * @module plugins/templates/testing
 */

import { builtinKit } from '@/lib/codegen/__fixtures__/kit';
import type { CatalogEntry } from '@/lib/catalog/types';
import type { KitDescriptor } from '@/lib/kits/types';
import type { Disposable, ResourceId, ResourceRef } from '@/sdk';
import type { TemplateKeyValue, TemplatesHost } from './host';

const noop: Disposable = { dispose: () => {} };

/** Хранилище «ключ-значение» в памяти. */
export function createMemoryStorage(seed?: Record<string, unknown>): TemplateKeyValue {
  const data = new Map<string, unknown>(Object.entries(seed ?? {}));
  return {
    keys: async () => [...data.keys()],
    get: async (key) => data.get(key),
    put: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
  };
}

export interface FakeTemplatesHostOptions {
  /** Плоская карта «адрес → текст». Каталоги выводятся из адресов. */
  readonly files?: Record<string, string>;
  readonly projectRoot?: string | null;
  readonly write?: boolean;
  readonly kit?: KitDescriptor | null;
  readonly catalog?: readonly CatalogEntry[];
  readonly local?: TemplateKeyValue;
  readonly withRemove?: boolean;
}

export interface FakeTemplatesHost extends TemplatesHost {
  readonly files: Map<string, string>;
  readonly opened: ResourceId[];
}

function refOf(id: string, kind: 'file' | 'directory'): ResourceRef {
  const name = id.slice(id.lastIndexOf('/') + 1);
  return {
    id: id as ResourceId,
    sourceId: 'fake',
    path: id,
    name,
    kind,
    mediaType: name.endsWith('.json') ? 'application/json' : 'text/plain',
  };
}

/** Порт-двойник: плоская карта адресов, каталоги выводятся из префиксов. */
export function createFakeTemplatesHost(options: FakeTemplatesHostOptions = {}): FakeTemplatesHost {
  const view = builtinKit();
  const files = new Map<string, string>(Object.entries(options.files ?? {}));
  const opened: ResourceId[] = [];

  const host: FakeTemplatesHost = {
    files,
    opened,
    useTranslate: () => (key) => key,
    useActiveDocument: () => null,
    refOf: (id) => (files.has(id) ? refOf(id, 'file') : null),
    projectRoot: () =>
      options.projectRoot === undefined
        ? ('project' as ResourceId)
        : (options.projectRoot as ResourceId | null),
    parentOf: (id) => id.slice(0, id.lastIndexOf('/')) as ResourceId,
    resolve: (dir, ...segments) =>
      [dir, ...segments].filter((s) => s !== '').join('/') as ResourceId,
    list: async (dir) => {
      const prefix = `${dir}/`;
      const names = new Map<string, 'file' | 'directory'>();
      for (const path of files.keys()) {
        if (!path.startsWith(prefix)) continue;
        const rest = path.slice(prefix.length);
        const slash = rest.indexOf('/');
        if (slash === -1) names.set(rest, 'file');
        else names.set(rest.slice(0, slash), 'directory');
      }
      return [...names].map(([name, kind]) => refOf(`${prefix}${name}`, kind));
    },
    exists: async (id) => files.has(id) || [...files.keys()].some((p) => p.startsWith(`${id}/`)),
    readText: async (id) => files.get(id) ?? null,
    writeText: async (id, text) => {
      files.set(id, text);
    },
    sourceOf: () => ({ write: options.write ?? true }),
    openResource: (id) => opened.push(id),
    catalog: () => options.catalog ?? view.catalog,
    kit: () => (options.kit === undefined ? view.kit : options.kit),
    onDidChangeKit: () => noop,
    ...(options.local === undefined ? {} : { local: options.local }),
  };

  if (options.withRemove === true) {
    host.remove = async (id) => {
      for (const path of [...files.keys()]) {
        if (path === id || path.startsWith(`${id}/`)) files.delete(path);
      }
    };
  }
  return host;
}
