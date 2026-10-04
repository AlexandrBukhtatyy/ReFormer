/**
 * Двойники платформы для тестов редактора RJSF: ручка модели, рабочая область, кит, настройки
 * и порт живой формы.
 *
 * Плагин не видит оболочку (`@/shell/*` закрыт линтером), поэтому её вещи здесь воспроизведены —
 * в объёме, которым редактор пользуется. Двойник ручки повторяет правила настоящей: операция
 * переносит выделение на `focus`, смена выделения в историю не пишется, отмена возвращает
 * выделение из снимка. Что настоящая ручка ведёт себя так же, сверяет сквозной тест композиции
 * (`shell/boot/integration/rjsf-profile.test`).
 *
 * @module plugins/rjsf/editor/testing
 */

import {
  applyRjsfOp,
  isRjsfForm,
  printRjsfForm,
  RJSF_PROVIDER_ID,
  type RjsfApplyResult,
  type RjsfForm,
  type RjsfOp,
} from '../../core';
import type {
  CatalogJson,
  Disposable,
  DocumentModelsService,
  DocumentsService,
  KitsService,
  LiveSurfaceContext,
  ModelChange,
  ModelChangeReason,
  ModelDocumentHandle,
  PreviewLiveService,
  ResourceId,
  ResourceRef,
  WorkspaceFilesService,
} from '@reformer/builder-plugin-api';
import type { RjsfServices } from './commands';
import type { RjsfViewSettings } from './view';

const NOOP: Disposable = { dispose: () => {} };

export function fakeRef(name: string, mediaType = 'application/json'): ResourceRef {
  return { id: `mem:${name}`, sourceId: 'mem', path: name, name, kind: 'file', mediaType };
}

/** Проба редактора с текстом, положенным синхронно, — как её отдаёт оболочка. */
export function fakeProbe(text: string) {
  return { text: () => Promise.resolve(text), peek: () => text };
}

export interface FakeRjsfHandle {
  readonly handle: ModelDocumentHandle<RjsfForm>;
  readonly id: ResourceId;
  model(): RjsfForm;
  selection(): readonly string[];
}

interface Snapshot {
  readonly model: RjsfForm;
  readonly selection: readonly string[];
}

/** Ручка модели в объёме редактора: модель, выделение, `apply` операциями домена, история. */
export function createFakeRjsfHandle(
  initial: RjsfForm,
  name = 'contact.rjsf.json'
): FakeRjsfHandle {
  const ref = fakeRef(name);
  let model = initial;
  let selection: readonly string[] = [];
  const past: Snapshot[] = [];
  const future: Snapshot[] = [];
  const listeners = new Set<(change: ModelChange<RjsfForm>) => void>();

  const notify = (reason: ModelChangeReason): void => {
    for (const listener of [...listeners]) {
      listener({ model, selection, syncState: 'synced', reason });
    }
  };
  const restore = (snapshot: Snapshot, reason: ModelChangeReason): void => {
    model = snapshot.model;
    selection = snapshot.selection;
    notify(reason);
  };

  const handle = {
    document: {
      kind: 'model',
      providerId: RJSF_PROVIDER_ID,
      id: ref.id,
      ref,
      getText: () => printRjsfForm(model),
      isDirty: () => past.length > 0,
      onDidChangeContent: () => NOOP,
      getModel: () => model,
      getSyncState: () => 'synced',
      getParseFailure: () => undefined,
      getSelection: () => selection,
      isStructurallyEditable: () => true,
      onDidChangeModel(cb: (change: ModelChange<RjsfForm>) => void): Disposable {
        listeners.add(cb);
        return { dispose: () => listeners.delete(cb) };
      },
    },
    apply(op: RjsfOp) {
      let result: RjsfApplyResult;
      try {
        result = applyRjsfOp(model, op);
      } catch (error) {
        return { status: 'rejected', reason: 'provider-error', error };
      }
      past.push({ model, selection });
      future.length = 0;
      model = result.model;
      if (result.focus !== undefined) selection = [result.focus];
      notify('apply');
      return { status: 'applied', ...result };
    },
    setSelection(next: readonly string[]) {
      const same =
        next.length === selection.length && next.every((id, index) => id === selection[index]);
      if (same) return;
      selection = [...next];
      notify('selection');
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    undo() {
      const previous = past.pop();
      if (previous === undefined) return false;
      future.push({ model, selection });
      restore(previous, 'undo');
      return true;
    },
    redo() {
      const next = future.pop();
      if (next === undefined) return false;
      past.push({ model, selection });
      restore(next, 'redo');
      return true;
    },
    breakUndoMerge: () => {},
    flush: () => Promise.resolve(),
    hasPendingSync: () => false,
  };

  return {
    handle: handle as unknown as ModelDocumentHandle<RjsfForm>,
    id: ref.id,
    model: () => model,
    selection: () => selection,
  };
}

export interface FakeRjsfWorkspaceOptions {
  /** Открытые формы домена; активной считается первая. */
  readonly handles?: readonly ModelDocumentHandle<RjsfForm>[];
  /** Файлы, которые «уже лежат» в проекте: новая форма ищет свободное имя мимо них. */
  readonly existing?: readonly ResourceId[];
}

export interface FakeRjsfWorkspace {
  readonly services: RjsfServices;
  /** Что записано в рабочую копию. */
  readonly written: Map<ResourceId, string>;
  /** Что открыто вкладкой. */
  readonly opened: ResourceId[];
  /** Что ушло привилегированной службе сохранения — по вызовам. */
  readonly saved: (readonly ResourceId[])[];
  /** Сменить активную вкладку и сообщить подписчикам службы документов. */
  setActive(id: ResourceId | null): void;
}

/** Службы оболочки в объёме редактора: вкладки, файлы, ручки моделей и сохранение. */
export function createFakeRjsfWorkspace(options: FakeRjsfWorkspaceOptions = {}): FakeRjsfWorkspace {
  const handles = new Map<ResourceId, ModelDocumentHandle<RjsfForm>>(
    (options.handles ?? []).map((handle) => [handle.document.id, handle])
  );
  const existing = new Set<ResourceId>(options.existing ?? ['mem:contact.rjsf.json']);
  const written = new Map<ResourceId, string>();
  const opened: ResourceId[] = [];
  const saved: (readonly ResourceId[])[] = [];
  const listeners = new Set<() => void>();
  let active: ResourceId | null = options.handles?.[0]?.document.id ?? null;

  const documents = {
    hasProject: () => true,
    activeResource: () => active,
    openDocuments: () => [...handles.keys()],
    documentOf: (id: ResourceId) => handles.get(id)?.document ?? null,
    writeText: (id: ResourceId, text: string) => {
      written.set(id, text);
      return Promise.resolve();
    },
    open: (id: ResourceId) => {
      opened.push(id);
      return Promise.resolve();
    },
    onDidChange(cb: () => void): Disposable {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
  } as unknown as DocumentsService;
  const files = {
    projectRoot: () => 'mem:',
    parentOf: () => 'mem:',
    resolve: (dir: string, name: string) => `${dir}${name}`,
    exists: (id: ResourceId) => Promise.resolve(existing.has(id)),
    canWrite: () => true,
    refresh: () => Promise.resolve(),
  } as unknown as WorkspaceFilesService;
  const models = {
    handleOf: (id: ResourceId) => handles.get(id) ?? null,
  } as unknown as DocumentModelsService;

  return {
    services: {
      documents: () => documents,
      files: () => files,
      models: () => models,
      save: () => ({
        save: (ids: readonly ResourceId[]) => {
          saved.push(ids);
          return Promise.resolve(true);
        },
      }),
    },
    written,
    opened,
    saved,
    setActive(id) {
      active = id;
      for (const listener of [...listeners]) listener();
    },
  };
}

/** Служба китов в объёме редактора: каталог и подписка на смену. */
export function createFakeKits(components: CatalogJson['components']) {
  const listeners = new Set<() => void>();
  let catalog: CatalogJson = { version: '2.1', components };
  const kits = {
    catalogJson: () => catalog,
    onDidChange: (cb: () => void) => {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
  } as unknown as KitsService;
  return {
    kits,
    load(next: CatalogJson['components']): void {
      catalog = { version: '2.1', components: next };
      for (const cb of listeners) cb();
    },
  };
}

/** Запись каталога кита: поле по умолчанию. */
export function fakeKitRecord(name: string, role = 'field'): CatalogJson['components'][number] {
  return { name, role, propsSchema: {} } as CatalogJson['components'][number];
}

/** Настройки в памяти — с доступом к тому, что в них записано. */
export function createFakeViewSettings(
  initial: Readonly<Record<string, unknown>> = {}
): RjsfViewSettings & { readonly values: Map<string, unknown> } {
  const values = new Map<string, unknown>(Object.entries(initial));
  return {
    values,
    get: <T>(key: string) => values.get(key) as T | undefined,
    set: (key: string, value: unknown) => {
      values.set(key, value);
    },
  };
}

export interface FakeLive extends PreviewLiveService {
  /** Сколько раз поверхность монтировали. */
  mounts(): number;
  /** Контекст последнего монтирования: тест дёргает его так, как это делала бы поверхность. */
  ctx(): LiveSurfaceContext | null;
  /** Убрать или вернуть поверхности — так выглядит выключение плагина рендера на ходу. */
  setEmpty(empty: boolean): void;
}

/**
 * Двойник порта живой формы: рисует по узлу на поле и перерисовывает по `onDidChangeSchema`.
 *
 * Та же форма, что у настоящего хоста превью: одна поверхность без хит-теста, как `rjsf.preview`.
 */
export function createFakeLive(options: { readonly empty?: boolean } = {}): FakeLive {
  let empty = options.empty === true;
  const listeners = new Set<() => void>();
  let mounts = 0;
  let ctx: LiveSurfaceContext | null = null;

  const draw = (element: HTMLElement, model: unknown): void => {
    element.replaceChildren();
    if (!isRjsfForm(model)) return;
    const root = element.ownerDocument.createElement('div');
    root.dataset.testid = 'fake-surface';
    for (const [name, field] of Object.entries(model.schema.properties)) {
      const node = element.ownerDocument.createElement('div');
      node.dataset.field = name;
      node.textContent = field.title ?? name;
      root.append(node);
    }
    element.append(root);
  };

  return {
    available: () => !empty,

    chosen: () =>
      empty
        ? null
        : {
            id: 'fake.surface',
            title: 'двойник',
            hitTest: false,
            sameRealm: true,
            executesCode: false,
            notice: null,
          },

    mount(_documentId, element, next) {
      if (empty) return null;
      mounts += 1;
      ctx = next;
      draw(element, next.schema());
      const subscription = next.onDidChangeSchema(() => {
        draw(element, next.schema());
      });
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

    formOf: () => null,
    onDidChangeForm: () => NOOP,

    mounts: () => mounts,
    ctx: () => ctx,
    setEmpty(next) {
      empty = next;
      for (const listener of [...listeners]) listener();
    },
  };
}
