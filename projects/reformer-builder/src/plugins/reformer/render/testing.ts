/**
 * Подставной порт платформы — для тестов плагина.
 *
 * Настоящий порт собирается композицией и требует рабочей области, сервиса китов и загрузчика
 * модулей. Проверять на нём то, чем владеет плагин, значило бы поднимать половину приложения
 * ради ответа на вопрос «в какую точку ушёл вклад».
 *
 * Двойник намеренно БЕДЕН: `modules` по умолчанию нет, namespace кита пуст, источник исполнять
 * код не разрешает. Это худший из штатных случаев, и поведение плагина в нём — самое интересное:
 * именно так выглядит проект, открытый по сети.
 *
 * @module plugins/reformer/render/testing
 */

import type { ComponentType } from 'react';
import { toDescriptor } from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '@/plugins/reformer/core/catalog';
import type {
  KitDescriptor,
  KitFrameProps,
  KitNamespace,
  KitOrigin,
} from '@reformer/builder-plugin-api';
import type {
  Disposable,
  DocumentKind,
  ResourceId,
  ResourceRef,
} from '@reformer/builder-plugin-api';
import type {
  PreviewDocument,
  PreviewHost,
  PreviewModules,
  PreviewSourceCapabilities,
} from './host';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });
const BUILTIN: KitOrigin = Object.freeze({ kind: 'builtin' });

export interface FakeHostOptions {
  readonly text?: string;
  readonly model?: unknown;
  readonly kind?: DocumentKind;
  readonly mediaType?: string;
  readonly catalog?: readonly CatalogEntry[];
  readonly descriptor?: KitDescriptor;
  readonly namespace?: KitNamespace | null;
  /** Происхождение кита; по умолчанию — встроенный. */
  readonly origin?: KitOrigin | null;
  /** Рамка кита; по умолчанию её нет — форма рисуется как есть. */
  readonly frame?: ComponentType<KitFrameProps> | null;
  readonly source?: PreviewSourceCapabilities | null;
  readonly modules?: PreviewModules;
  /** Соседние файлы каталога формы: имя → текст. */
  readonly siblings?: Readonly<Record<string, string>>;
}

/** Ссылка на ресурс с разумными умолчаниями. */
export function fakeRef(id: ResourceId, overrides: Partial<ResourceRef> = {}): ResourceRef {
  const path = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return {
    id,
    sourceId: 'fake',
    path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    mediaType: 'application/json',
    ...overrides,
  };
}

export function createFakeHost(options: FakeHostOptions = {}): PreviewHost {
  const text = options.text ?? '{}';
  const siblings = options.siblings ?? {};

  const document = (id: ResourceId): PreviewDocument => ({
    id,
    ref: fakeRef(id, { mediaType: options.mediaType ?? 'application/json' }),
    kind: options.kind ?? 'text',
    getText: () => text,
    model: () => options.model,
    onDidChangeContent: () => NOOP,
  });

  return {
    useTranslate: () => (key) => key,
    documentOf: (id) => document(id),
    useActiveDocument: () => null,
    sourceOf: () => options.source ?? { executesCode: false },
    catalog: () => options.catalog ?? [],
    kit: () => options.descriptor ?? toDescriptor({ version: '1.0', components: [] }),
    kitNamespace: () => options.namespace ?? null,
    kitOrigin: () => (options.origin === undefined ? BUILTIN : options.origin),
    kitFrame: () => options.frame ?? null,
    onDidChangeKit: () => NOOP,
    siblings: () =>
      Promise.resolve(Object.keys(siblings).map((name) => fakeRef(`fake:form/${name}`))),
    readText: (id) => {
      const name = id.slice(id.lastIndexOf('/') + 1);
      const found = siblings[name];
      return found === undefined
        ? Promise.reject(new Error(`нет файла ${id}`))
        : Promise.resolve(found);
    },
    modules: options.modules,
  };
}
