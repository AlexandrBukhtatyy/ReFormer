/**
 * Двойники порта, стека и локального хранилища для тестов шаблонов.
 *
 * Отдельным модулем, а не в файле теста: порт проверяют и хранилища, и операции, и панель.
 *
 * @module plugins/reformer/templates/testing
 */

import type {
  Disposable,
  ResourceId,
  ResourceRef,
  TemplateStack,
} from '@reformer/builder-plugin-api';
import type { TemplateFile } from './contract';
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

/** Имя документа формы у двойника стека. */
export const FAKE_DOCUMENT = 'form.json';

/**
 * Двойник стека: документ формы — файл `form.json` в любом каталоге набора. Остальные ответы
 * (токены модуля, пустая форма, место модуля и фикстуры, вид, перевод формата) тест дописывает
 * сам — у двойника их нет, и хозяин обязан жить без них.
 */
export function createFakeTemplateStack(patch: Partial<TemplateStack> = {}): TemplateStack {
  const documentOf = (files: readonly TemplateFile[]): TemplateFile | null =>
    files.find((file) => file.path.split('/').pop() === FAKE_DOCUMENT) ?? null;
  return {
    id: 'fake',
    owns: (files) => documentOf(files) !== null,
    documentOf,
    ...patch,
  };
}

export interface FakeTemplatesHostOptions {
  /** Плоская карта «адрес → текст». Каталоги выводятся из адресов. */
  readonly files?: Record<string, string>;
  readonly projectRoot?: string | null;
  readonly write?: boolean;
  /** Стеки шаблонов; по умолчанию — ни одного. */
  readonly stacks?: readonly TemplateStack[];
  readonly local?: TemplateKeyValue;
  readonly withRemove?: boolean;
}

export interface FakeTemplatesHost extends TemplatesHost {
  readonly files: Map<string, string>;
  readonly opened: ResourceId[];
  /** Уровни, о которых порт попросили забыть: их перечитывает дерево. */
  readonly invalidated: ResourceId[];
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
  const files = new Map<string, string>(Object.entries(options.files ?? {}));
  const opened: ResourceId[] = [];
  const invalidated: ResourceId[] = [];

  const host: FakeTemplatesHost = {
    files,
    opened,
    invalidated,
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
    invalidate: async (dir) => {
      invalidated.push(dir);
    },
    openResource: (id) => opened.push(id),
    stacks: () => options.stacks ?? [],
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
