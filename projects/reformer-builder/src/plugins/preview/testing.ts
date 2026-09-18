/**
 * Помощники тестов превью-хоста: адрес ресурса, двойник канала выделения и двойник порта.
 *
 * Двойник порта поверхностей (кит, загрузчик модулей, соседние файлы) уехал вместе
 * с поверхностями в `plugins/preview-runtime`: хосту от документа нужен только адрес.
 *
 * @module plugins/preview/testing
 */

import type {
  Disposable,
  DocumentKind,
  NodeId,
  ResourceId,
  ResourceRef,
} from '@reformer/builder-plugin-api';
import type { LiveDocument, PreviewHostPort, PreviewSourceCapabilities } from './host';

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

export interface FakeHostPortOptions {
  readonly kind?: DocumentKind;
  readonly providerId?: string;
  readonly mediaType?: string;
  readonly source?: PreviewSourceCapabilities | null;
}

/**
 * Двойник порта хоста: любой адрес — открытый документ с заданным видом и провайдером.
 *
 * Источник по умолчанию исполнять код НЕ разрешает — худший из штатных случаев, и выбор
 * поверхности в нём самый интересный: так выглядит проект, открытый по сети.
 */
export function createFakeHostPort(options: FakeHostPortOptions = {}): PreviewHostPort {
  const document = (id: ResourceId): LiveDocument => ({
    id,
    ref: fakeRef(id, { mediaType: options.mediaType ?? 'application/json' }),
    kind: options.kind ?? 'model',
    ...(options.providerId === undefined && options.kind === 'text'
      ? {}
      : { providerId: options.providerId ?? 'form.schema' }),
  });
  return {
    documentOf: (id) => document(id),
    sourceOf: () => (options.source === undefined ? { executesCode: false } : options.source),
  };
}

/** Заглушка подписки: отписываться не от чего. */
export const NOOP: Disposable = Object.freeze({ dispose: () => undefined });

/** Вклад в точку — структурно тот же, что у реестра оболочки (`Contribution`). */
export interface FakeContribution<T> {
  readonly id: string;
  readonly pluginId: string;
  readonly order: number;
  readonly value: T;
}

/** Двойник реестра вкладов в объёме, который читает живой вид: вносить, читать, следить. */
export interface FakeExtensions {
  contribute<T>(
    point: { readonly id: string },
    value: T,
    meta?: { readonly id?: string }
  ): Disposable;
  get<T>(point: { readonly id: string }): readonly FakeContribution<T>[];
  observe(point: { readonly id: string }, cb: () => void): Disposable;
}

/**
 * Реестр вкладов с настоящей семантикой в той части, что нужна живому виду: порядок внесения,
 * снятие вклада и уведомление ОБ ЭТОЙ ТОЧКЕ, а не обо всех. Настоящий реестр живёт в оболочке,
 * а плагину её импортировать нельзя — правило проверяется линтером.
 */
export function createFakeExtensions(pluginId = 'reformer.preview-runtime'): FakeExtensions {
  const items = new Map<string, FakeContribution<unknown>[]>();
  const watchers = new Map<string, Set<() => void>>();
  const notify = (point: string): void => {
    for (const cb of [...(watchers.get(point) ?? [])]) cb();
  };
  let order = 0;
  return {
    contribute(point, value, meta) {
      const list = items.get(point.id) ?? [];
      const entry: FakeContribution<unknown> = Object.freeze({
        id: meta?.id ?? `${point.id}#${order}`,
        pluginId,
        order: order++,
        value,
      });
      items.set(point.id, [...list, entry]);
      notify(point.id);
      return {
        dispose(): void {
          items.set(
            point.id,
            (items.get(point.id) ?? []).filter((item) => item !== entry)
          );
          notify(point.id);
        },
      };
    },
    get: <T>(point: { readonly id: string }) =>
      (items.get(point.id) ?? []) as readonly FakeContribution<T>[],
    observe(point, cb) {
      const set = watchers.get(point.id) ?? new Set();
      set.add(cb);
      watchers.set(point.id, set);
      return {
        dispose(): void {
          set.delete(cb);
        },
      };
    },
  };
}
