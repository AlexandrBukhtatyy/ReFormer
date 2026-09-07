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
 * @module plugins/preview/testing
 */

import { toDescriptor } from '@/lib/kits/descriptor';
import type { CatalogEntry } from '@/lib/catalog/types';
import type { KitDescriptor, KitNamespace } from '@/lib/kits/types';
import type { Disposable, DocumentKind, NodeId, ResourceId, ResourceRef } from '@/sdk';
import type {
  PreviewDocument,
  PreviewHost,
  PreviewModules,
  PreviewSourceCapabilities,
} from './host';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });

export interface FakeHostOptions {
  readonly text?: string;
  readonly model?: unknown;
  readonly kind?: DocumentKind;
  readonly mediaType?: string;
  readonly catalog?: readonly CatalogEntry[];
  readonly descriptor?: KitDescriptor;
  readonly namespace?: KitNamespace | null;
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

/**
 * Двойник общего канала выделения.
 *
 * Не мок службы, а её ПОВЕДЕНИЕ в трёх свойствах, на которых стоит отражение: запись
 * замещает выделение ресурса, пустой список снимает запись, а совпадающее по содержимому
 * значение НЕ уведомляет. Третье здесь главное: именно оно гасит эхо между двумя
 * отражающими друг друга сторонами, и двойник без него показал бы бесконечный цикл там,
 * где настоящая служба его не допускает, — то есть проверял бы не то.
 *
 * Уведомление рассылается СИНХРОННО, изнутри записи, как и у настоящей: цикл, если он есть,
 * обязан проявиться переполнением стека, а не тихо разъехаться по тактам.
 *
 * Копия у каждого плагина своя, и это не небрежность: `src/plugins/**` не видит ни `@/shell`,
 * ни соседний плагин — правило проверяется линтером.
 */
export interface FakeSelectionChannel {
  get(resource: ResourceId): readonly NodeId[];
  set(resource: ResourceId, ids: readonly NodeId[]): void;
  onDidChange(cb: (resource: ResourceId) => void): Disposable;
  /** Все записи по порядку: что и под каким адресом ушло в канал. */
  readonly writes: { resource: ResourceId; ids: readonly NodeId[] }[];
  /** Сколько уведомлений разослано. По нему видно, что эхо затухает, а не крутится. */
  notifications(): number;
}

const NO_IDS: readonly NodeId[] = Object.freeze([]);

export function createFakeSelectionChannel(): FakeSelectionChannel {
  const byResource = new Map<ResourceId, readonly NodeId[]>();
  const listeners = new Set<(resource: ResourceId) => void>();
  const writes: { resource: ResourceId; ids: readonly NodeId[] }[] = [];
  let notified = 0;

  const same = (a: readonly NodeId[], b: readonly NodeId[]): boolean =>
    a.length === b.length && a.every((id, index) => id === b[index]);

  const emit = (resource: ResourceId): void => {
    notified += 1;
    for (const listener of [...listeners]) listener(resource);
  };

  return {
    writes,
    notifications: () => notified,
    get: (resource) => byResource.get(resource) ?? NO_IDS,

    set(resource, ids) {
      writes.push({ resource, ids: [...ids] });
      const current = byResource.get(resource);
      if (ids.length === 0) {
        if (current === undefined) return;
        byResource.delete(resource);
        emit(resource);
        return;
      }
      if (current !== undefined && same(current, ids)) return;
      byResource.set(resource, Object.freeze([...ids]));
      emit(resource);
    },

    onDidChange(cb) {
      listeners.add(cb);
      return {
        dispose: () => {
          listeners.delete(cb);
        },
      };
    },
  };
}
