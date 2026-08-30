/**
 * Подставной порт платформы для тестов плагина.
 *
 * Настоящий собирается композицией и требует рабочей области; проверять на нём поведение
 * плагина значило бы проверять их обоих сразу. Плагину при этом импортировать `@/host`
 * нельзя (проверяется линтером), поэтому ручка модельного документа здесь — **второй
 * реализацией контракта**, тем же приёмом, каким `host/source/memory` реализует источник:
 * двойник обязан вести себя как настоящий там, где его спрашивают.
 *
 * Границы двойника названы честно:
 *
 * - разбор, печать и правку делает НАСТОЯЩИЙ провайдер (`./provider`) — иначе тесты плагина
 *   проверяли бы выдуманную модель;
 * - история — простой стек снимков без схлопывания по ключу: схлопывание принадлежит
 *   платформе и проверено у неё (`host/workspace/model/model-document.test`), а здесь оно
 *   означало бы третью копию того же правила;
 * - записи в буфер видны в {@link FakeSchemaHost.written} — по ним тест проверяет, что
 *   правка модели вообще доходит до текста.
 *
 * @module plugins/editor-schema/testing
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { CatalogEntry } from '@/lib/catalog/types';
import type { Disposable, ResourceId, ResourceRef } from '@/sdk';
import { createSchemaModelProvider } from './provider';
import { NODE_CLASS_PREFIX } from '@/lib/form-model/node-token';
import type {
  EditOp,
  LivePreviewPort,
  LiveSurfaceContext,
  NodeId,
  SchemaApplyOutcome,
  SchemaEditorHost,
  SchemaModelChangeReason,
  SchemaModelHandle,
  SyncState,
  Translate,
} from './host';

/** Подставной порт вместе с тем, что тест про него хочет знать. */
export interface FakeSchemaHost extends SchemaEditorHost {
  /** Тексты, ушедшие в рабочую копию, по порядку. */
  readonly written: string[];
  /** Чужая правка буфера: так выглядит Monaco, откат или ход ассистента. */
  setText(text: string): void;
  /** Вкладку закрыли: рабочая область больше не отдаёт по этому адресу ни модели, ни буфера. */
  closeDocument(): void;
  /**
   * Сообщить подписчикам, что каталог сменился: кит переключили либо ленивый каталог
   * догрузился. Без этого проверить реакцию палитры было бы нечем — а это ровно та дыра,
   * ради которой подписка и заводилась.
   */
  notifyCatalogChange(): void;
}

export interface FakeSchemaHostOptions {
  readonly documentId?: ResourceId;
  readonly text: string;
  readonly catalog?: readonly CatalogEntry[];
}

const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/** Ссылка на ресурс — ровно те поля, которые читает редактор. */
export function fakeRef(id: ResourceId, mediaType = 'application/json'): ResourceRef {
  const path = id.includes(':') ? id.slice(id.indexOf(':') + 1) : id;
  return { id, sourceId: 'fake', path, name: path, kind: 'file', mediaType };
}

/** Снимок отмены: модель И выделение — выделение едет вместе с ней, а не «заодно». */
interface Snapshot {
  readonly model: JsonFormSchema;
  readonly selection: readonly NodeId[];
}

/** Двойник ручки вместе с рычагом «буфер изменил кто-то другой». */
interface FakeHandle extends SchemaModelHandle {
  setText(text: string): void;
}

/**
 * Двойник ручки модельного документа над настоящим провайдером.
 *
 * @throws если начальный текст не разбирается: документ с моделью обязан иметь последнюю
 *   валидную модель с первой секунды — файл, не разобравшийся с открытия, остаётся текстовым
 *   и ручки не получает вовсе.
 */
function createFakeModelHandle(
  ref: ResourceRef,
  text: string,
  writeText: (next: string) => void
): FakeHandle {
  const provider = createSchemaModelProvider();
  const listeners = new Set<(change: { readonly reason: SchemaModelChangeReason }) => void>();

  let model = provider.parse(text);
  let selection: readonly NodeId[] = [];
  let parseError: string | null = null;
  const past: Snapshot[] = [];
  const future: Snapshot[] = [];

  const notify = (reason: SchemaModelChangeReason): void => {
    for (const listener of [...listeners]) listener({ reason });
  };

  const syncState = (): SyncState => (parseError === null ? 'synced' : 'diverged');
  const snapshot = (): Snapshot => ({ model, selection });

  return {
    document: {
      ref,
      getModel: () => model,
      getSyncState: syncState,
      getParseFailure: () => (parseError === null ? undefined : { message: parseError }),
      getSelection: () => selection,
      onDidChangeModel(cb): Disposable {
        listeners.add(cb);
        return {
          dispose: () => {
            listeners.delete(cb);
          },
        };
      },
    },

    apply(op: EditOp): SchemaApplyOutcome {
      if (parseError !== null) return { status: 'rejected', reason: 'diverged' };
      let result;
      try {
        result = provider.apply(model, op);
      } catch (error) {
        return { status: 'rejected', reason: 'provider-error', error };
      }
      past.push(snapshot());
      future.length = 0;
      model = result.model;
      if (result.focus !== undefined) selection = [result.focus];
      notify('apply');
      writeText(provider.print(model));
      return { status: 'applied', inverse: result.inverse, focus: result.focus };
    },

    setSelection(next) {
      const same = next.length === selection.length && next.every((id, i) => id === selection[i]);
      if (same) return;
      selection = [...next];
      notify('selection');
    },

    undo() {
      if (parseError !== null) return false;
      const entry = past.pop();
      if (entry === undefined) return false;
      future.push(snapshot());
      model = entry.model;
      selection = entry.selection;
      notify('undo');
      writeText(provider.print(model));
      return true;
    },

    redo() {
      if (parseError !== null) return false;
      const entry = future.pop();
      if (entry === undefined) return false;
      past.push(snapshot());
      model = entry.model;
      selection = entry.selection;
      notify('redo');
      writeText(provider.print(model));
      return true;
    },

    canUndo: () => parseError === null && past.length > 0,
    canRedo: () => parseError === null && future.length > 0,

    setText(next) {
      try {
        model = provider.parse(next);
        parseError = null;
      } catch (error) {
        // Модель НЕ трогаем: она держит последнее валидное состояние — то же правило,
        // что и у платформы.
        parseError = error instanceof Error ? error.message : String(error);
      }
      notify('parse');
    },
  };
}

export function createFakeSchemaHost(options: FakeSchemaHostOptions): FakeSchemaHost {
  const documentId = options.documentId ?? 'fake:form.json';
  const written: string[] = [];
  const handle = createFakeModelHandle(fakeRef(documentId), options.text, (text) => {
    written.push(text);
  });

  const translate: Translate = (key) => key;
  let open = true;
  // Подписчики каталога: двойник обязан уметь СООБЩИТЬ о смене кита, иначе проверить,
  // что палитра на неё реагирует, было бы нечем — а ровно эта дыра и чинилась.
  const catalogListeners = new Set<() => void>();

  return {
    written,
    onCatalogChange: (cb: () => void) => {
      catalogListeners.add(cb);
      return {
        dispose: () => {
          catalogListeners.delete(cb);
        },
      };
    },
    /** Сообщить подписчикам, что каталог сменился (кит переключили или он догрузился). */
    notifyCatalogChange: () => {
      for (const cb of catalogListeners) cb();
    },
    setText: (text) => {
      handle.setText(text);
    },
    closeDocument: () => {
      open = false;
    },
    // Хук без React: тесты плагина живут в `node`, а перевод им нужен только как функция.
    useTranslate: () => translate,
    modelOf: (id) => (open && id === documentId ? handle : null),
    catalog: () => options.catalog ?? NO_CATALOG,
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
 * Копия у каждого плагина своя, и это не небрежность: `src/plugins/**` не видит ни `@/host`,
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

/**
 * Двойник порта живого рендера — вместе с тем, что тест про него хочет знать.
 *
 * Рисует «форму» вложенными `div` с классами-токенами и перерисовывает её по
 * `onDidChangeSchema`. Это не подделка: живой вид опирается ровно на это обещание контракта —
 * «в моём DOM стоят токены аннотированной схемы», — и настоящая рантайм-поверхность в тестовом
 * окружении даёт то же самое, только через подписанные стабы и втрое медленнее.
 */
export interface FakeLivePort extends LivePreviewPort {
  /** Сколько раз поверхность монтировали. Инвариант живого вида: ровно один на документ. */
  mounts(): number;
  /** Контекст последнего монтирования: тест дёргает его так, как это делала бы поверхность. */
  ctx(): LiveSurfaceContext | null;
}

export interface FakeLivePortOptions {
  /** Нет ни одной поверхности: кнопки вида «форма» не существует. */
  readonly empty?: boolean;
  readonly hitTest?: boolean;
  readonly executesCode?: boolean;
  /** Уже переведённая причина отката; `null` — выбор без отката. */
  readonly notice?: string | null;
}

export function createFakeLivePort(options: FakeLivePortOptions = {}): FakeLivePort {
  const empty = options.empty === true;
  const listeners = new Set<() => void>();
  let mounts = 0;
  let ctx: LiveSurfaceContext | null = null;

  /** Плоский обход схемы: каждому узлу с адресом — свой элемент с токеном. */
  const draw = (element: HTMLElement, schema: JsonFormSchema | null): void => {
    element.replaceChildren();
    if (schema === null) return;
    const visit = (node: unknown, parent: HTMLElement): void => {
      if (typeof node !== 'object' || node === null) return;
      const record = node as Record<string, unknown>;
      const id = record.$nodeId;
      const box = element.ownerDocument.createElement('div');
      // Размеры настоящие: зона броска считается по `getBoundingClientRect`, и на коробках
      // нулевой высоты любая точка попадала бы в середину — то есть проверялось бы не то.
      box.style.cssText = 'min-height:32px;padding:4px;box-sizing:border-box;';
      if (typeof id === 'string') box.className = `${NODE_CLASS_PREFIX}${id}`;
      parent.append(box);
      for (const value of Object.values(record)) {
        if (Array.isArray(value)) for (const item of value) visit(item, box);
        else visit(value, box);
      }
    };
    visit(schema.root, element);
  };

  return {
    available: () => !empty,

    chosen: () =>
      empty
        ? null
        : {
            id: 'fake.surface',
            title: 'двойник',
            hitTest: options.hitTest ?? true,
            sameRealm: true,
            executesCode: options.executesCode ?? false,
            notice: options.notice ?? null,
          },

    mount(_documentId, element, next) {
      if (empty) return null;
      mounts += 1;
      ctx = next;
      draw(element, next.schema());
      // Правка схемы обязана доходить перерисовкой, а не пересозданием поверхности: тем же
      // способом ведёт себя настоящая, и именно это проверяет инвариант монтирования.
      const subscription = next.onDidChangeSchema(() => draw(element, next.schema()));
      return {
        dispose(): void {
          subscription.dispose();
          element.replaceChildren();
        },
      };
    },

    onDidChange(_documentId, cb) {
      listeners.add(cb);
      return {
        dispose(): void {
          listeners.delete(cb);
        },
      };
    },

    mounts: () => mounts,
    ctx: () => ctx,
  };
}
