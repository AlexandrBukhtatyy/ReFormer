/**
 * Вкладки документов: правила и хранилище.
 *
 * **Вкладка — это открытый ресурс, а открытые ресурсы принадлежат рабочей области**, поэтому
 * вкладки держит Host, а не плагин, и слота под них в наборе нет. Отсюда же следует, чего
 * здесь нет: вкладка не решает, чем рисовать документ (это `./editors`) и что означает его
 * содержимое (это провайдер модели).
 *
 * ## Две истины и одно правило их сведения
 *
 * Множество открытых ресурсов знает рабочая область, а порядок вкладок, режим предпросмотра
 * и активную вкладку — только это хранилище: рабочей области про них знать незачем.
 * Сводит их {@link syncTabs}: ресурс, открытый мимо вкладок (командой, ассистентом,
 * восстановлением сессии), получает вкладку в конце, а вкладка исчезнувшего ресурса
 * пропадает. Порядок и предпросмотр при этом сохраняются — они не выводятся из списка
 * открытых и не должны им перетираться.
 *
 * ## Режим предпросмотра
 *
 * Один клик в дереве открывает файл **временной** вкладкой; открытие следующего файла
 * заменяет её на месте, а не добавляет соседа. Двойной клик закрепляет. Без этого просмотр
 * десяти файлов оставляет десять вкладок, из которых нужна одна, — дефект, который в v1
 * решался закрыванием руками.
 *
 * ## Кто обновляет `WhenContext`
 *
 * Это хранилище, и только оно: `activeEditorId` и `activeResourceKind` — поля владельца
 * открытых вкладок (см. `./when-context-store`, раздел «Кто обновляет какое поле»).
 * Обновление идёт при каждом изменении состояния, включая момент, когда документ уже открыт,
 * но вид его ресурса стал известен только после разбора.
 *
 * @module host/ui/tabs
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import {
  basename,
  mediaTypeFor,
  parseResourceId,
  type ResourceId,
  type ResourceRef,
} from '@/shell/platform/primitives/resource';
import type { Document } from '@/shell/platform/workspace/document';
import { isModelDocument } from '@/shell/platform/workspace/model/model-document';
import type { Workspace } from '@/shell/platform/workspace/workspace';
import type { WhenContextStore } from './when-context-store';

/** Одна вкладка. Ссылка на ресурс, а не идентификатор: строке нужны имя, путь и медиатип. */
export interface Tab {
  readonly ref: ResourceRef;
  /**
   * Временная вкладка: следующее открытие заменит её на месте.
   *
   * Признак вкладки, а не отдельный «слот предпросмотра»: предпросмотровая вкладка одна,
   * но её позиция в ряду произвольна, и хранить её отдельно значило бы держать порядок
   * в двух местах.
   */
  readonly preview: boolean;
  /**
   * Есть ли несохранённые правки. Копия ответа рабочей области, а не вторая истина:
   * пересчитывается из неё в {@link withDirtyFlags} и никогда не выставляется вручную.
   *
   * Копия нужна затем, что снимок для `useSyncExternalStore` обязан меняться по ссылке,
   * когда меняется то, что нарисовано; `isDirty(id)` — метод, и его изменение ссылку не двигает.
   */
  readonly dirty: boolean;
}

/** Снимок состояния вкладок. Ссылка стабильна между изменениями — условие `useSyncExternalStore`. */
export interface TabsState {
  readonly tabs: readonly Tab[];
  readonly activeId: ResourceId | null;
}

/** Пусто. Заморожено — им можно делиться. */
export const EMPTY_TABS: TabsState = Object.freeze({
  tabs: Object.freeze([]) as readonly Tab[],
  activeId: null,
});

/** Индекс вкладки или `-1`. */
export function tabIndex(state: TabsState, id: ResourceId): number {
  return state.tabs.findIndex((tab) => tab.ref.id === id);
}

/** Вкладка по идентификатору ресурса или `null`. */
export function findTab(state: TabsState, id: ResourceId): Tab | null {
  return state.tabs.find((tab) => tab.ref.id === id) ?? null;
}

/** Активная вкладка или `null`. */
export function activeTab(state: TabsState): Tab | null {
  return state.activeId === null ? null : findTab(state, state.activeId);
}

/** Как открывать: временной вкладкой (по умолчанию) или сразу закреплённой. */
export interface OpenTabOptions {
  readonly preview?: boolean;
}

/**
 * Открывает ресурс вкладкой и делает её активной.
 *
 * Три случая:
 *
 * - вкладка уже есть — она активируется; закрепление возможно (`preview: false`), обратное —
 *   нет: открытый и закреплённый документ не должен снова стать временным, иначе следующий
 *   клик в дереве закрыл бы то, что человек оставил открытым намеренно;
 * - новая временная — **заменяет прежнюю временную на её месте**, а не добавляется рядом;
 * - новая закреплённая — добавляется в конец.
 */
export function openTab(
  state: TabsState,
  ref: ResourceRef,
  options: OpenTabOptions = {}
): TabsState {
  const preview = options.preview ?? true;
  const existing = tabIndex(state, ref.id);

  if (existing >= 0) {
    const tab = state.tabs[existing];
    const pinned = !preview && tab.preview;
    if (!pinned) return activateTab(state, ref.id);
    const tabs = [...state.tabs];
    tabs[existing] = { ...tab, preview: false };
    return { tabs, activeId: ref.id };
  }

  const fresh: Tab = { ref, preview, dirty: false };
  const previewAt = preview ? state.tabs.findIndex((tab) => tab.preview) : -1;
  if (previewAt >= 0) {
    const tabs = [...state.tabs];
    tabs[previewAt] = fresh;
    return { tabs, activeId: ref.id };
  }
  return { tabs: [...state.tabs, fresh], activeId: ref.id };
}

/** Закрепляет временную вкладку. Двойной клик, правка содержимого, перетаскивание. */
export function pinTab(state: TabsState, id: ResourceId): TabsState {
  const at = tabIndex(state, id);
  if (at < 0 || !state.tabs[at].preview) return state;
  const tabs = [...state.tabs];
  tabs[at] = { ...tabs[at], preview: false };
  return { tabs, activeId: state.activeId };
}

/** Делает вкладку активной. Неизвестная вкладка и повторная активация ничего не меняют. */
export function activateTab(state: TabsState, id: ResourceId): TabsState {
  if (state.activeId === id || tabIndex(state, id) < 0) return state;
  return { tabs: state.tabs, activeId: id };
}

/**
 * Переставляет вкладку. Индекс за пределами ряда прижимается к краю.
 *
 * Порядок — состояние вкладок, а не рабочей области: она про открытые ресурсы и об их
 * расположении на экране ничего не знает.
 */
export function moveTab(state: TabsState, id: ResourceId, toIndex: number): TabsState {
  const from = tabIndex(state, id);
  if (from < 0) return state;
  const to = Math.min(Math.max(Math.trunc(toIndex), 0), state.tabs.length - 1);
  if (to === from) return state;
  const tabs = [...state.tabs];
  const [moved] = tabs.splice(from, 1);
  tabs.splice(to, 0, moved);
  return { tabs, activeId: state.activeId };
}

/**
 * Закрывает вкладку без единого вопроса — проверку несохранённого делает
 * {@link requestCloseTab}, и разделение намеренное: «закрыть» обязано существовать
 * и как безусловная операция (после того, как человек ответил, и при закрытии всего).
 *
 * Активной становится соседняя справа, а при её отсутствии — слева. Правило одно на все
 * случаи: возврат к «предыдущей активной» требовал бы журнала переключений, а он расходится
 * с порядком ряда после первой же перестановки.
 */
export function closeTab(state: TabsState, id: ResourceId): TabsState {
  const at = tabIndex(state, id);
  if (at < 0) return state;
  const tabs = state.tabs.filter((_, index) => index !== at);
  if (state.activeId !== id) return { tabs, activeId: state.activeId };
  const next = tabs[at] ?? tabs[at - 1] ?? null;
  return { tabs, activeId: next === null ? null : next.ref.id };
}

/** Что делать с запросом на закрытие. */
export type CloseDecision =
  /** Такой вкладки нет: закрывать нечего, спрашивать не о чем. */
  | { readonly status: 'missing' }
  /** Можно закрывать; состояние уже посчитано. */
  | { readonly status: 'close'; readonly state: TabsState }
  /** Есть несохранённые правки: решение за человеком. */
  | { readonly status: 'unsaved'; readonly tab: Tab };

/**
 * Решение о закрытии вкладки.
 *
 * Функция ничего не спрашивает и ничего не рисует — она отвечает, **надо ли спросить**.
 * Диалог живёт в отрисовке, правило — здесь, и поэтому «закрытие изменённого документа
 * требует подтверждения» проверяется без браузера.
 */
export function requestCloseTab(
  state: TabsState,
  id: ResourceId,
  isDirty: (id: ResourceId) => boolean
): CloseDecision {
  const tab = findTab(state, id);
  if (tab === null) return { status: 'missing' };
  if (isDirty(id)) return { status: 'unsaved', tab };
  return { status: 'close', state: closeTab(state, id) };
}

/**
 * Ссылка на ресурс, восстановленная из его идентификатора.
 *
 * Нужна ровно в одном месте — {@link syncTabs}, где ресурс открыт кем-то другим и документа
 * под рукой нет. Вид всегда `file`: каталог открыть вкладкой нельзя, `workspace.open`
 * такого не отдаёт. Медиатип берётся из таблицы расширений, то есть без подсказки источника:
 * подсказка живёт в документе, и как только он появится, вкладка перерисуется по его `ref`.
 */
export function refFromResourceId(id: ResourceId): ResourceRef {
  const { sourceId, path } = parseResourceId(id);
  return {
    id,
    sourceId,
    path,
    name: basename(path),
    kind: 'file',
    mediaType: mediaTypeFor(path),
  };
}

/**
 * Сводит ряд вкладок со списком открытых ресурсов.
 *
 * Вкладка ресурса, который больше не открыт, исчезает; ресурс без вкладки получает её
 * в конце и **закреплённой** — временная вкладка бывает только у того, кто её открыл
 * предпросмотром, а про чужое открытие этого не известно.
 *
 * Возвращает ТУ ЖЕ ссылку, если сводить нечего: функция зовётся на каждый пакет изменений
 * рабочей области, а он приходит и на материализацию соседей по импорту.
 */
export function syncTabs(state: TabsState, opened: readonly ResourceId[]): TabsState {
  const openedSet = new Set(opened);
  const kept = state.tabs.filter((tab) => openedSet.has(tab.ref.id));
  const known = new Set(kept.map((tab) => tab.ref.id));
  const added = opened
    .filter((id) => !known.has(id))
    .map((id): Tab => ({ ref: refFromResourceId(id), preview: false, dirty: false }));

  if (kept.length === state.tabs.length && added.length === 0) return state;

  const tabs = [...kept, ...added];
  const activeId =
    state.activeId !== null && tabs.some((tab) => tab.ref.id === state.activeId)
      ? state.activeId
      : (tabs[0]?.ref.id ?? null);
  return { tabs, activeId };
}

/**
 * Пересчитывает признак изменённости у всех вкладок.
 *
 * Возвращает ТУ ЖЕ ссылку, если ничего не изменилось: правка документа порождает пакет
 * изменений на каждое нажатие клавиши, и новый снимок на каждый из них перерисовывал бы
 * весь ряд вкладок вместо одной точки в одной из них.
 */
export function withDirtyFlags(state: TabsState, isDirty: (id: ResourceId) => boolean): TabsState {
  let changed = false;
  const tabs = state.tabs.map((tab) => {
    const dirty = isDirty(tab.ref.id);
    if (dirty === tab.dirty) return tab;
    changed = true;
    return { ...tab, dirty };
  });
  return changed ? { tabs, activeId: state.activeId } : state;
}

/**
 * Вид активного ресурса для {@link WhenContext}: непрозрачная строка, которую Host
 * переносит, но не толкует.
 *
 * Берётся у того, кто про формат знает: у документа с моделью это идентификатор провайдера
 * (`form.schema`), у текстового — медиатип (`text/markdown`). Второе — не догадка о смысле,
 * а честный предел знания Host: провайдера нет, значит формат никем не объявлен.
 */
export function resourceKindOf(document: Document | null): string | null {
  if (document === null) return null;
  return isModelDocument(document) ? document.providerId : document.ref.mediaType;
}

/**
 * Рабочая область в объёме, нужном вкладкам.
 *
 * `Pick`, а не свой порт: форма обязана совпадать с настоящей рабочей областью буква
 * в букву, иначе расхождение вскроется на композиции, а не на типах.
 */
export type TabsWorkspace = Pick<
  Workspace,
  'open' | 'close' | 'save' | 'openedResources' | 'isDirty' | 'onDidChange'
>;

export interface DocumentTabsStoreOptions {
  readonly workspace: TabsWorkspace;
  /**
   * Куда писать `activeEditorId` и `activeResourceKind`.
   *
   * Сужено до `set`: вкладки контекст пишут, а читают его команды и панели, и право чтения
   * им здесь ни к чему.
   */
  readonly whenContext: Pick<WhenContextStore, 'set'>;
  /** Куда сообщать о неудачном закрытии и о падении подписчика. */
  readonly onError?: (error: unknown) => void;
}

/** Хранилище вкладок. Живёт вне React — как и остальные хранилища оболочки. */
export interface DocumentTabsStore extends Disposable {
  /** Снимок. Ссылка стабильна между изменениями. */
  get(): TabsState;
  subscribe(listener: () => void): Disposable;
  /** Документ вкладки, если она открыта этим хранилищем. */
  documentOf(id: ResourceId): Document | null;
  /**
   * Открывает ресурс и делает его активной вкладкой. Повторное открытие в источник
   * не ходит — это гарантия рабочей области, а не оптимизация здесь.
   */
  open(id: ResourceId, options?: OpenTabOptions): Promise<void>;
  activate(id: ResourceId): void;
  pin(id: ResourceId): void;
  move(id: ResourceId, toIndex: number): void;
  /** Надо ли спрашивать перед закрытием. Ничего не закрывает. */
  requestClose(id: ResourceId): CloseDecision;
  /** Закрывает вкладку; `save` — сначала сохранить. Отказ сохранения отменяет закрытие. */
  close(id: ResourceId, options?: { readonly save?: boolean }): Promise<void>;
}

function defaultOnStoreError(error: unknown): void {
  console.error('[shell] вкладки документов', error);
}

export function createDocumentTabsStore(options: DocumentTabsStoreOptions): DocumentTabsStore {
  const { workspace, whenContext } = options;
  const onError = options.onError ?? defaultOnStoreError;

  let state = EMPTY_TABS;
  const listeners = new Set<() => void>();
  const documents = new Map<ResourceId, Document>();
  /** Ресурсы, открытие которых сейчас идёт: сведение не должно опередить `openTab`. */
  const opening = new Set<ResourceId>();

  const notify = (): void => {
    // Копия набора и терпимость к падению подписчика — политика всех хранилищ оболочки.
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        onError(error);
      }
    }
  };

  /**
   * Записывает состояние и синхронизирует с ним контекст применимости.
   *
   * Контекст пишется даже тогда, когда снимок не сменился: вид ресурса становится известен
   * вместе с документом, а он приходит позже самой вкладки.
   */
  const commit = (next: TabsState): void => {
    const changed = next !== state;
    state = next;
    whenContext.set({
      activeEditorId: state.activeId,
      activeResourceKind: resourceKindOf(
        state.activeId === null ? null : (documents.get(state.activeId) ?? null)
      ),
    });
    if (changed) notify();
  };

  const isDirty = (id: ResourceId): boolean => workspace.isDirty(id);

  /** Сводит вкладки с рабочей областью и пересчитывает изменённость. */
  const reconcile = (): void => {
    // Ресурс, который открывается прямо сейчас, в сведение не попадает: иначе он получил бы
    // закреплённую вкладку раньше, чем `open` успеет сделать её предпросмотровой.
    const opened = workspace
      .openedResources()
      .filter((id) => !opening.has(id) || findTab(state, id) !== null);
    const next = withDirtyFlags(syncTabs(state, opened), isDirty);
    for (const id of [...documents.keys()]) {
      if (tabIndex(next, id) < 0) documents.delete(id);
    }
    commit(next);
  };

  const subscription = workspace.onDidChange(reconcile);

  return {
    get: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },

    documentOf: (id) => documents.get(id) ?? null,

    async open(id, openOptions) {
      const existing = findTab(state, id);
      if (existing !== null) {
        commit(openTab(state, existing.ref, openOptions));
        return;
      }
      opening.add(id);
      try {
        const document = await workspace.open(id);
        documents.set(id, document);
        // Ссылка берётся у документа, а не собирается из идентификатора: у него медиатип
        // от источника, а не догадка по расширению.
        commit(withDirtyFlags(openTab(state, document.ref, openOptions), isDirty));
      } finally {
        opening.delete(id);
      }
    },

    activate(id) {
      commit(activateTab(state, id));
    },

    pin(id) {
      commit(pinTab(state, id));
    },

    move(id, toIndex) {
      commit(moveTab(state, id, toIndex));
    },

    requestClose: (id) => requestCloseTab(state, id, isDirty),

    async close(id, closeOptions) {
      if (findTab(state, id) === null) return;
      if (closeOptions?.save === true) {
        const result = await workspace.save(id);
        // Конфликт или отказ источника — не повод потерять правки: вкладка остаётся,
        // а разбираться с расхождением будет тот, кто умеет (слияние — Э11).
        if (!result.ok) {
          onError(new Error(`ресурс не сохранён, вкладка оставлена открытой: ${id}`));
          return;
        }
      }
      documents.delete(id);
      commit(closeTab(state, id));
      // Рабочая область узнаёт последней: `close` снимает закрепление, и его отказ
      // не должен возвращать вкладку, которую человек уже закрыл.
      await workspace.close(id);
    },

    dispose() {
      subscription.dispose();
      listeners.clear();
      documents.clear();
    },
  };
}
