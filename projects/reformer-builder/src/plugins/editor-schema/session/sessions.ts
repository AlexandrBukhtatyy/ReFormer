/**
 * Сеансы правки: тонкий вид на ручку модельного документа плюс указатель на активный.
 *
 * ## Что здесь больше НЕ живёт
 *
 * Раньше рядом лежал `session.ts` — плагинная копия механики модельного документа поверх
 * текстового буфера: история снимков, выделение в снимке, отсев собственного эха, коалесинг
 * записи. Она появилась не от хорошей жизни: платформа умела модельный документ, но композиция
 * его не собирала, и все документы открывались текстовыми. Теперь собирает
 * (`app/document-models`), и копия снята целиком — разбор, печать и операции при этом
 * не изменились ни на строку, потому что и тогда, и сейчас их делает один и тот же провайдер.
 *
 * Осталось ровно то, чего у платформы нет:
 *
 * - **снимок для `useSyncExternalStore`** — стабильный по ссылке, пока ничего не менялось;
 *   платформа отдаёт состояние методами, а React сравнивает ссылки;
 * - **чистка выделения от исчезнувших адресов** — платформа держит выделение, но для неё
 *   `NodeId` непрозрачная строка, и «есть ли ещё такой узел» знает только домен.
 *
 * ## Общий канал выделения подключается ЗДЕСЬ
 *
 * Щелчок по превью обязан доехать до канваса, а выбранный на канвасе узел — подсветиться
 * в превью. Плагины друг друга не видят, мост между ними — служба выделения платформы,
 * и подключается он к реестру по той же причине, по которой у превью подключён к реестру
 * состояний: реестр — единственное место, которое знает и адрес документа, и его выделение.
 * У канваса адрес есть, но он размонтирован, как только человек ушёл на другую вкладку,
 * а сделанный до ухода выбор обязан остаться прочитанным.
 *
 * ## Зачем реестр
 *
 * Строение оболочки: тело редактора получает `documentId`, а панели — только `panelId`.
 * Значит, палитра и инспектор не могут получить сеанс пропом; общий адрес у них ровно один —
 * плагин, который их внёс. Реестр и есть этот адрес.
 *
 * ## Активный сеанс, а не «сеанс активной вкладки»
 *
 * Оболочка рисует тело редактора только для активной вкладки, поэтому активным считается тот
 * сеанс, чьё тело смонтировано. Спрашивать вкладки самому плагин не может и не должен: это
 * знание рабочей области, а вопрос у него другой — «чем сейчас правят».
 *
 * ## Переживание ухода с вкладки теперь бесплатно
 *
 * История и выделение живут в ручке платформы, а она живёт, пока открыт документ. Поэтому
 * сеанс — производная величина: его можно уронить и собрать заново, ничего не потеряв.
 * Реестр всё равно держит запись до закрытия документа, но лишь ради подписки и снимка,
 * а не ради состояния.
 *
 * @module plugins/editor-schema/session/sessions
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { Disposable, ResourceId, SelectionService } from '@/sdk';
import { indexNodes } from '../model/node-index';
import { mergeKeyOf } from '../model/ops';
import { pruneSelection as keepAlive } from './selection';
import type {
  EditOp,
  NodeId,
  SchemaApplyOutcome,
  SchemaEditorHost,
  SchemaModelHandle,
  SyncState,
} from '../host';

export type { SchemaApplyOutcome as ApplyOutcome, SyncState } from '../host';

/** Снимок состояния сеанса. Стабилен по ссылке, пока ничего не менялось. */
export interface SchemaEditorState {
  /**
   * Последняя разобранная модель.
   *
   * Не бывает `null`: документ с моделью существует только там, где первый разбор удался, —
   * файл, не разобравшийся с открытия, остаётся текстовым, и сеанса у него нет вовсе.
   */
  readonly model: JsonFormSchema;
  readonly selection: readonly NodeId[];
  readonly syncState: SyncState;
  /** Сообщение об ошибке разбора в состоянии расхождения. */
  readonly parseError: string | null;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

/** Вид на ручку документа: то, чем пользуются канвас, палитра, инспектор и команды. */
export interface SchemaSession {
  readonly documentId: ResourceId;
  /** Снимок для `useSyncExternalStore`: та же ссылка, пока состояние не менялось. */
  get(): SchemaEditorState;
  apply(op: EditOp): SchemaApplyOutcome;
  setSelection(selection: readonly NodeId[]): void;
  undo(): boolean;
  redo(): boolean;
}

export interface SessionRegistry {
  /** Открыть сеанс документа и сделать его активным. `null` — модели по этому адресу нет. */
  open(documentId: ResourceId): SchemaSession | null;
  /** Уйти с документа: активного больше нет, сам сеанс остаётся — см. шапку модуля. */
  close(documentId: ResourceId): void;
  get(documentId: ResourceId): SchemaSession | null;
  /** Сеанс, тело которого сейчас на экране. */
  active(): SchemaSession | null;
  /**
   * Версия состояния — снимок для `useSyncExternalStore`.
   *
   * Число, а не объект: снимок обязан быть стабильным по ссылке, а собирать объект на каждый
   * вызов значило бы перерисовывать панели вечно. Читатели берут данные у сеанса напрямую.
   */
  version(): number;
  /**
   * Связывает выделение сеансов с общим каналом платформы — в ОБЕ стороны.
   *
   * Зовётся из `activate`, потому что раньше службы просто нет: реестр создаётся вместе
   * с плагином, а сервисы приходят с контекстом. Возвращённый `Disposable` кладут
   * в `ctx.subscriptions`: выключенный плагин обязан перестать и писать в чужой канал,
   * и слушать его.
   *
   * Подключение задним числом покрывает уже открытые сеансы — вкладку могли открыть раньше,
   * чем композиция дошла до регистрации службы.
   */
  connectSelection(channel: SelectionChannel): Disposable;
  subscribe(listener: () => void): Disposable;
  dispose(): void;
}

/**
 * Общий канал выделения в объёме, которым пользуется редактор схемы: читать, писать, следить.
 *
 * Все три половины нужны и каждая по своему поводу: `get` — потому что канвас может
 * смонтироваться ПОСЛЕ клика по превью и обязан прочитать текущее значение, а не ждать
 * следующего щелчка; `set` — потому что превью подсвечивает узел, выбранный на канвасе;
 * `onDidChange` — потому что обе панели живут одновременно.
 */
export type SelectionChannel = Pick<SelectionService, 'get' | 'set' | 'onDidChange'>;

interface Entry {
  readonly session: SchemaSession;
  readonly subscription: Disposable;
}

export interface SessionRegistryDeps {
  readonly host: SchemaEditorHost;
}

/**
 * Собирает вид на ручку вместе с его подпиской.
 *
 * Подписка одна и держит её сеанс: изменение модели приходит и от собственной правки,
 * и снаружи (Monaco, откат, ход ассистента), и в обоих случаях делать надо одно и то же —
 * сбросить снимок и разослать версию реестра. Собственных подписчиков у сеанса нет: вторая
 * подписка означала бы две перерисовки на одну правку.
 */
function createSession(
  documentId: ResourceId,
  handle: SchemaModelHandle,
  notify: () => void,
  publish: () => void
): Entry {
  let snapshot: SchemaEditorState | null = null;

  const refresh = (): void => {
    snapshot = null;
    notify();
  };

  const subscription = handle.document.onDidChangeModel((change) => {
    // Правка модели могла унести узлы, на которые смотрело выделение. По щелчку чистить
    // нечего — тогда обход дерева не делается.
    if (change.reason !== 'selection') pruneSelection(handle);
    refresh();
    // Публикация ПОСЛЕ чистки и сброса снимка: наружу обязано уйти то же выделение, что
    // видит канвас, а не то, что было мгновение назад.
    publish();
  });

  const session: SchemaSession = {
    documentId,

    get(): SchemaEditorState {
      snapshot ??= Object.freeze({
        model: handle.document.getModel(),
        selection: handle.document.getSelection(),
        syncState: handle.document.getSyncState(),
        parseError: handle.document.getParseFailure()?.message ?? null,
        canUndo: handle.canUndo(),
        canRedo: handle.canRedo(),
      });
      return snapshot;
    },

    // Правка, выделение и отмена только ПЕРЕСЫЛАЮТСЯ: снимок сбросит подписка на модель —
    // тем же путём, каким он сбрасывается на чужую правку буфера.
    apply: (op) =>
      // Ключ схлопывания знает домен: набор в поле инспектора — одна запись истории,
      // а не запись на символ. Платформа его только переносит.
      handle.apply(op, { mergeKey: mergeKeyOf(op) }),
    setSelection: (selection) => {
      handle.setSelection(selection);
    },
    undo: () => handle.undo(),
    redo: () => handle.redo(),
  };

  return { session, subscription };
}

/**
 * Адреса, которые ещё есть в модели. Та же ссылка, если убирать нечего.
 *
 * Платформа этого не умеет и не может: для неё `NodeId` — непрозрачная строка, а «жив ли
 * ещё такой узел» отвечает разбор конкретного формата. Поэтому чистка плагинная — и та же
 * самая, что применяется к выделению, пришедшему из общего канала: чужая сторона (превью)
 * тоже адресует узлы, и её выбор мог устареть ровно так же, как собственный.
 */
function aliveInModel(model: JsonFormSchema, selection: readonly NodeId[]): readonly NodeId[] {
  if (selection.length === 0) return selection;
  const index = indexNodes(model);
  return keepAlive(selection, (id) => index.find(id) !== undefined);
}

/** Убирает из выделения документа адреса, которых в модели больше нет. */
function pruneSelection(handle: SchemaModelHandle): void {
  const selection = handle.document.getSelection();
  const kept = aliveInModel(handle.document.getModel(), selection);
  if (kept !== selection) handle.setSelection(kept);
}

export function createSessionRegistry(deps: SessionRegistryDeps): SessionRegistry {
  const { host } = deps;
  const entries = new Map<ResourceId, Entry>();
  const listeners = new Set<() => void>();
  let channel: SelectionChannel | null = null;
  let watching: Disposable | null = null;
  let activeId: ResourceId | null = null;
  let version = 0;

  const notify = (): void => {
    version += 1;
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[editor-schema] подписчик реестра сеансов упал', error);
      }
    }
  };

  /**
   * Отдаёт выделение сеанса в общий канал.
   *
   * Гашение эха — на стороне службы: совпадающее по содержимому значение не порождает
   * уведомления, поэтому «своя» запись не возвращается сюда вторым кругом. Обходить эту
   * защиту своим сравнением нельзя — она и есть то, что не даёт двум отражающим друг друга
   * подписчикам крутиться вечно.
   */
  const publish = (documentId: ResourceId): void => {
    const entry = entries.get(documentId);
    if (channel === null || entry === undefined) return;
    channel.set(documentId, entry.session.get().selection);
  };

  /**
   * Принимает выделение, пришедшее в канал снаружи (щелчок по превью).
   *
   * Чистит от мёртвых адресов ЗДЕСЬ, а не в службе: платформе `NodeId` непрозрачен, и
   * «жив ли узел» отвечает только разбор формата. Очищенное уходит обратно в канал следующей
   * же публикацией — то есть чужая сторона узнаёт, что часть её выбора больше ни на что
   * не указывает.
   */
  const adopt = (documentId: ResourceId): void => {
    const entry = entries.get(documentId);
    if (channel === null || entry === undefined) return;
    const incoming = channel.get(documentId);
    entry.session.setSelection(aliveInModel(entry.session.get().model, incoming));
  };

  /**
   * Согласование при появлении сеанса или канала.
   *
   * Направление решает наличие записи: есть чужой выбор — он старше (человек только что
   * щёлкнул по превью, а вкладку редактора открыл после); нет — наружу уходит своё.
   */
  const reconcile = (documentId: ResourceId): void => {
    if (channel === null) return;
    if (channel.get(documentId).length > 0) adopt(documentId);
    else publish(documentId);
  };

  const drop = (documentId: ResourceId): void => {
    const entry = entries.get(documentId);
    if (!entry) return;
    entry.subscription.dispose();
    entries.delete(documentId);
    if (activeId === documentId) activeId = null;
  };

  /** Убирает сеансы документов, у которых модели в рабочей области больше нет. */
  const evictClosed = (): void => {
    for (const documentId of [...entries.keys()]) {
      if (host.modelOf(documentId) === null) drop(documentId);
    }
  };

  return {
    open(documentId) {
      evictClosed();

      const existing = entries.get(documentId);
      if (existing) {
        activeId = documentId;
        notify();
        return existing.session;
      }

      const handle = host.modelOf(documentId);
      if (handle === null) return null;

      const entry = createSession(documentId, handle, notify, () => {
        publish(documentId);
      });
      entries.set(documentId, entry);
      activeId = documentId;
      // Согласование до уведомления: подписчики обязаны увидеть уже согласованное выделение,
      // а не своё, которое сменится в следующем такте.
      reconcile(documentId);
      notify();
      return entry.session;
    },

    close(documentId) {
      if (activeId !== documentId) return;
      activeId = null;
      notify();
    },

    get: (documentId) => entries.get(documentId)?.session ?? null,
    active: () => (activeId === null ? null : (entries.get(activeId)?.session ?? null)),
    version: () => version,

    connectSelection(next) {
      watching?.dispose();
      channel = next;
      watching = next.onDidChange((resource) => {
        adopt(resource);
      });
      for (const documentId of [...entries.keys()]) reconcile(documentId);
      return {
        dispose: () => {
          // Сверяем значение, а не факт подключения: снятие устаревшей подписки не должно
          // уносить канал, подключённый после неё.
          if (channel !== next) return;
          watching?.dispose();
          watching = null;
          channel = null;
        },
      };
    },

    subscribe(listener) {
      listeners.add(listener);
      return {
        dispose: () => {
          listeners.delete(listener);
        },
      };
    },

    dispose() {
      watching?.dispose();
      watching = null;
      channel = null;
      for (const documentId of [...entries.keys()]) drop(documentId);
      listeners.clear();
      activeId = null;
    },
  };
}
