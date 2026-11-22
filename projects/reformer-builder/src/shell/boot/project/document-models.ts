/**
 * Надстройка модели над открываемым документом — единственное место, где зовётся
 * `attachDocumentModel`.
 *
 * ## Почему это композиция, а не рабочая область
 *
 * Платформа умеет два вида документа, но **собрать** второй вид может только тот, у кого
 * на руках все три недостающие вещи: реестр вкладов (кто вызвался разбирать этот ресурс),
 * служба диагностик (куда уйдёт ошибка разбора) и ответ «печатает ли человек прямо сейчас»
 * (реестр фокуса текстового редактора, `workspace/model/text-editor-focus`). Ни одной из них
 * у `Workspace` нет и быть не должно: вклады принадлежат рантайму плагинов, а в реестр фокуса
 * пишут редакторы — композиция лишь сводит их с рабочей областью на одном объекте.
 *
 * ## Почему обёртка над `open`, а не пост-обработка
 *
 * Вид документа обязан быть известен ТОМУ ЖЕ вызову, который его открыл. Хранилище вкладок
 * кладёт полученный документ к себе и по нему же отвечает `documentOf` и `activeResourceKind`
 * (у модельного это `providerId`, у текстового — медиатип). Надстрой мы модель после открытия —
 * у вкладок остался бы текстовый документ, а предикаты панелей и валидатор схемы, которые
 * спрашивают именно вид, никогда бы не сработали.
 *
 * Отсюда форма: {@link DocumentModels.open} подставляется вкладкам вместо `workspace.open`,
 * а сами вкладки про модель по-прежнему не знают ничего.
 *
 * ## Три исхода надстройки, и все три нормальные
 *
 * ```text
 * провайдера нет                → документ текстовый, ручки нет
 * провайдер есть, разбор удался → модельный документ и ручка к нему
 * провайдер есть, разбор упал   → документ ТЕКСТОВЫЙ + диагностика разбора
 * ```
 *
 * Третий случай — не авария: у документа с моделью обязана быть «последняя валидная модель»
 * с первой секунды, а у файла, который не разобрался ни разу, её нет.
 *
 * ## Вид документа следует составу провайдеров
 *
 * Провайдеры вносят плагины, а плагины перезагружают (наблюдатель «в разработке» по возврату
 * фокуса, выключение и включение в менеджере). Модель, разобранная прежним провайдером, у
 * открытого документа расходилась бы с соседями, которые уже исполняют новый код: так превью
 * мастера показывало несобранные ссылки на шаги. Поэтому состав точки `document.model`
 * наблюдается, и документ, за который теперь берётся ДРУГОЙ провайдер (или впервые взялся
 * хоть один), надстраивается заново — так, как если бы вкладку закрыли и открыли:
 *
 * - буфер не теряется: отложенная перерисовка выполняется до снятия прежней модели, а документ,
 *   который догнать нельзя (текстовый редактор в фокусе), ждёт следующего изменения;
 * - выделение переезжает, если провайдер тот же по идентификатору (адреса узлов — его формат);
 * - части, выпавшие из составного документа, остаются обещанными к удалению;
 * - история отмены НЕ переезжает: её снимки — модели прежнего провайдера, и отмена вернула бы
 *   документ к модели, которую новый код не строит.
 *
 * Провайдер, ушедший без замены, снимается не сразу, а через выдержку: перезагрузка плагина —
 * это снятие вкладов, чтение файлов и активация заново, и без выдержки документ на эти мгновения
 * стал бы текстом, чтобы тут же снова стать моделью.
 *
 * @module shell/boot/project/document-models
 */

import type { Disposable } from '@reformer/builder-plugin-api/internal';
import type { ResourceId } from '@reformer/builder-plugin-api/internal';
import type { ExtensionRegistry } from '@reformer/builder-plugin-api/internal';
import type { Document } from '@reformer/builder-plugin-api/internal';
import {
  dirname,
  joinPath,
  makeResourceId,
  parseResourceId,
} from '@reformer/builder-plugin-api/internal';
import {
  attachDocumentModel,
  preloadParts,
  type ModelDocumentHandle,
  type PartsAccess,
} from '@/shell/platform/workspace/model/model-document';
import type { DiagnosticsSink, Workspace } from '@/shell/platform/workspace/workspace';
import { createEditorProbe, resolveModelProvider } from '@/shell/platform/workspace/model/provider';
import { toDisposable } from '@reformer/builder-plugin-api/internal';
import { DocumentModelPoint } from '@reformer/builder-plugin-api/internal';
import type { DocumentModelProvider, NodeId } from '@reformer/builder-plugin-api/internal';

/**
 * Рабочая область в объёме, нужном надстройке.
 *
 * `Pick`, а не свой порт, по той же причине, что у вкладок и у строки состояния: форма обязана
 * совпадать с настоящей рабочей областью буква в букву, иначе расхождение вскроется
 * на композиции, а не на типах.
 */
export type ModelsWorkspace = Pick<
  Workspace,
  'open' | 'close' | 'writeText' | 'readText' | 'openedResources' | 'onDidChange'
>;

export interface DocumentModelsOptions {
  readonly workspace: ModelsWorkspace;
  /**
   * Реестр вкладов: в нём лежат провайдеры модели, внесённые плагинами. С `observe` документы
   * следуют составу провайдеров (см. шапку); без него вид решается один раз, при открытии.
   */
  readonly extensions: Pick<ExtensionRegistry, 'get'> & Partial<Pick<ExtensionRegistry, 'observe'>>;
  /** Куда уходит ошибка разбора. Без него надстройка работает, но молча. */
  readonly diagnostics?: DiagnosticsSink;
  /**
   * В фокусе ли текстовый редактор этого документа.
   *
   * Функция, а не флаг: фокус меняется чаще, чем документ, и спрашивать его надо в момент
   * решения «перерисовывать буфер сейчас или отложить». Про конкретный редактор здесь не знает
   * никто — ответ даёт платформенный реестр фокуса, который композиция регистрирует службой
   * `TextEditorFocusToken`: в него пишет каждый текстовый редактор, включая внешний.
   */
  readonly isTextEditorFocused?: (id: ResourceId) => boolean;
  /**
   * Дождаться, пока состав провайдеров модели сложится.
   *
   * Провайдеры вносят и плагины ПРОЕКТА, а они поднимаются после открытия проекта, отдельной
   * цепочкой. Вид документа решается один раз, при открытии: вкладка, восстановленная раньше
   * (или файл, по которому щёлкнули в первые мгновения), осталась бы текстовой до закрытия —
   * форма без своего редактора. Поэтому открытие ждёт этот сигнал. Отказ ожидания открытия
   * не отменяет: документ откроется с теми провайдерами, что есть.
   */
  readonly providersReady?: () => Promise<void>;
  readonly historyLimit?: number;
  /**
   * Выдержка, мс: столько ждёт документ, чей провайдер ушёл без замены, прежде чем стать
   * текстовым. Перезагрузка плагина укладывается в неё, и документ меняет вид один раз.
   */
  readonly providerGraceMs?: number;
}

/** Выдержка по умолчанию: перезагрузка плагина из каталога проекта укладывается с запасом. */
const DEFAULT_PROVIDER_GRACE_MS = 3000;

/** Держатель модельных документов рабочей сессии. */
export interface DocumentModels extends Disposable {
  /**
   * Открывает ресурс и надстраивает над ним модель, если кто-то за него взялся.
   *
   * Подставляется хранилищу вкладок вместо `workspace.open` и обязан сохранять его гарантию:
   * повторное открытие отдаёт ТОТ ЖЕ документ. Поэтому ручка кэшируется по ресурсу —
   * вторая надстройка над тем же буфером означала бы две модели, две истории и две записи
   * на каждую правку.
   */
  open(id: ResourceId): Promise<Document>;
  /**
   * Закрывает ресурс и снимает надстроенную над ним модель.
   *
   * Пара к {@link open} и подставляется вкладкам вместе с ним. Снятие идёт ЗДЕСЬ, а не
   * по событию рабочей области: закрытие ресурса не порождает изменений содержимого,
   * то есть пакета изменений может не быть вовсе, — а ручка держит подписку на буфер
   * и историю модели, и оставить её значило бы утечку на каждую закрытую вкладку.
   */
  close(id: ResourceId): Promise<void>;
  /**
   * Ручка модельного документа или `null`, если документ текстовый.
   *
   * Отдельно от `documentOf` вкладок намеренно. `Document` — читающее лицо, его держат все:
   * вкладки, дерево, строка состояния, валидация. Ручка — пишущее: она правит модель, ведёт
   * историю и перерисовывает буфер. Разведение `Document`/`DocumentHandle` в платформе
   * заведено ровно затем, чтобы править мог только владелец; слей мы их обратно в один ответ —
   * право на правку получил бы каждый, кто попросил документ вкладки.
   */
  handleOf(id: ResourceId): ModelDocumentHandle<unknown> | null;
  /** Открытые модельные документы по ресурсу: сохранение ищет среди них части и удалённое. */
  opened(): ReadonlyMap<ResourceId, ModelDocumentHandle<unknown>>;
  /**
   * Документ ресурса надстроен заново: сменился провайдер, который за него берётся (см. шапку).
   * Новый документ — модельный либо текстовый; держатель вкладок обязан подменить им прежний.
   */
  onDidReattach(cb: (id: ResourceId, document: Document) => void): Disposable;
  /** Сверить открытые документы с составом провайдеров сейчас, не дожидаясь событий реестра. */
  reconcile(): Promise<void>;
}

export function createDocumentModels(options: DocumentModelsOptions): DocumentModels {
  const { workspace, extensions } = options;
  const focused = options.isTextEditorFocused ?? ((): boolean => false);
  const grace = options.providerGraceMs ?? DEFAULT_PROVIDER_GRACE_MS;
  const handles = new Map<ResourceId, ModelDocumentHandle<unknown>>();
  /** Чей разбор у ручки: по нему видно, что за ресурс теперь берётся другой провайдер. */
  const providers = new Map<ResourceId, DocumentModelProvider<unknown>>();
  /** Документы, чей провайдер ушёл без замены: таймер выдержки до снятия модели. */
  const orphans = new Map<ResourceId, ReturnType<typeof setTimeout>>();
  /** Документы, которые надстроить заново пока нельзя: модель впереди буфера, а буфер в фокусе. */
  const deferred = new Set<ResourceId>();
  const reattached = new Set<(id: ResourceId, document: Document) => void>();
  let disposed = false;

  const clearOrphan = (id: ResourceId): void => {
    const timer = orphans.get(id);
    if (timer === undefined) return;
    clearTimeout(timer);
    orphans.delete(id);
  };

  const drop = (id: ResourceId): void => {
    clearOrphan(id);
    deferred.delete(id);
    providers.delete(id);
    const handle = handles.get(id);
    if (handle === undefined) return;
    handles.delete(id);
    handle.dispose();
  };

  /**
   * Убирает ручки ресурсов, которые рабочая область больше не держит открытыми.
   *
   * Подписка, а не снятие в `close`: вкладка исчезает не только по закрытию (ресурс могли
   * удалить, проект — сменить), а ручка держит подписку на буфер и историю модели. Пакет
   * изменений приходит на каждую такую перемену, и сверка по нему — единственное место,
   * где ни один путь исчезновения не потеряется.
   */
  const subscription = workspace.onDidChange(() => {
    // Отложенным повод попробовать снова: буфер мог догнать модель, редактор — потерять фокус.
    if (deferred.size > 0) schedule();
    if (handles.size === 0) return;
    const opened = new Set(workspace.openedResources());
    for (const id of [...handles.keys()]) {
      if (!opened.has(id)) drop(id);
    }
  });

  /**
   * Файлы частей документа `id` — рядом с ним, по спецификатору ссылки из корня.
   *
   * Изменения частей документ узнаёт тем же пакетом изменений рабочей области, что и все:
   * своя запись вернётся туда же, и документ отсеет её сам.
   */
  const partsAccess = (id: ResourceId): PartsAccess => {
    const { sourceId, path } = parseResourceId(id);
    return {
      resolve: (spec) => makeResourceId(sourceId, joinPath(dirname(path), spec)),
      // Новый файл части дерево проекта увидит само: оно сверяет состав с изменениями
      // рабочей области (`resource-tree`, `staleLevels`).
      write: (part, text, _created, mark) => workspace.writeText(part, text, mark),
      read: (part) => workspace.readText(part).catch(() => null),
      onDidChange: (cb) => workspace.onDidChange((e) => cb(e.changes.map((c) => c.id))),
    };
  };

  /** Надстроить модель над текстовым документом рабочей области и запомнить ручку. */
  const attach = (
    id: ResourceId,
    document: Document,
    parts: Awaited<ReturnType<typeof preloadParts>>,
    carry: { readonly selection?: readonly NodeId[]; readonly removed?: readonly ResourceId[] } = {}
  ): ReturnType<typeof attachDocumentModel> => {
    const attached = attachDocumentModel({
      document,
      extensions,
      writeText: (text, mark) => workspace.writeText(id, text, mark),
      isTextEditorFocused: () => focused(id),
      diagnostics: options.diagnostics,
      historyLimit: options.historyLimit,
      parts,
      ...carry,
    });
    if (attached.handle !== undefined) {
      handles.set(id, attached.handle);
      providers.set(id, attached.provider);
    }
    return attached;
  };

  /** Провайдер, который берётся за документ сейчас; `undefined` — никто. */
  const providerNow = (document: Document): DocumentModelProvider<unknown> | undefined =>
    resolveModelProvider(extensions, document.ref, createEditorProbe(document.getText()));

  /**
   * Надстроить документ заново — под тот провайдер, что берётся за него сейчас.
   *
   * Все ожидания — до снятия прежней модели: пока догоняется буфер и читаются части, документ
   * мог закрыться или открыться заново, и тогда трогать его нельзя.
   */
  const reattach = async (id: ResourceId): Promise<void> => {
    clearOrphan(id);
    const previous = handles.get(id);
    if (previous !== undefined) {
      await previous.flush().catch((error: unknown) => {
        console.error(`[document.model] модель «${id}» не догнала буфер перед переразбором`, error);
      });
      if (previous.hasPendingSync()) {
        deferred.add(id);
        return;
      }
    }
    deferred.delete(id);
    if (!workspace.openedResources().includes(id)) return;
    // Тот же текстовый документ рабочей области, над которым стояла прежняя модель.
    const document = await workspace.open(id);
    const parts = await preloadParts(document, extensions, partsAccess(id));
    if (disposed || handles.get(id) !== previous) return;
    if (!workspace.openedResources().includes(id)) return;

    const next = providerNow(document);
    const carry =
      previous === undefined
        ? {}
        : {
            // Адреса узлов — формат провайдера: переносить их можно только к нему же.
            ...(next?.id === previous.document.providerId
              ? { selection: previous.document.getSelection() }
              : {}),
            removed: previous.removedParts(),
          };
    if (previous !== undefined) {
      handles.delete(id);
      providers.delete(id);
      previous.dispose();
    }
    const attached = attach(id, document, parts, carry);
    // Текстовый остался текстовым (разбор не удался): документ тот же, подменять нечего.
    if (previous === undefined && attached.handle === undefined) return;
    for (const cb of [...reattached]) {
      try {
        cb(id, attached.document);
      } catch (error) {
        console.error('[document.model] подписчик переразбора упал', error);
      }
    }
  };

  /** Сверка открытых документов с составом провайдеров. */
  const reconcileNow = async (): Promise<void> => {
    for (const id of workspace.openedResources()) {
      if (disposed) return;
      const handle = handles.get(id);
      const document = handle?.document ?? (await workspace.open(id));
      const next = providerNow(document);
      if (handle === undefined) {
        // Текстовый документ, за который взялся провайдер: включили плагин формата.
        if (next !== undefined) await reattach(id);
        continue;
      }
      if (next === providers.get(id) && !deferred.has(id)) {
        clearOrphan(id);
        continue;
      }
      if (next !== undefined) {
        await reattach(id);
        continue;
      }
      // Провайдер ушёл без замены: вернётся ли он (перезагрузка) — решит выдержка.
      if (!orphans.has(id)) {
        orphans.set(
          id,
          setTimeout(() => {
            orphans.delete(id);
            void enqueue(() => reattach(id));
          }, grace)
        );
      }
    }
  };

  /** Сверки идут по одной: вторая, начатая посреди первой, переразобрала бы тот же документ. */
  let chain: Promise<void> = Promise.resolve();
  const enqueue = (task: () => Promise<void>): Promise<void> => {
    chain = chain.then(task).catch((error: unknown) => {
      console.error('[document.model] сверка с составом провайдеров не удалась', error);
    });
    return chain;
  };

  /** Изменения реестра приходят парами (снятие — вклад): сверка одна на задачу. */
  let scheduled = false;
  const schedule = (): void => {
    if (scheduled || disposed) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      void enqueue(reconcileNow);
    });
  };

  const providersSubscription = extensions.observe?.(DocumentModelPoint, schedule);

  return {
    async open(id) {
      const document = await workspace.open(id);
      // Тот же документ — значит, надстройка над ним уже сделана: `attachDocumentModel`
      // второй раз завёл бы вторую модель над тем же буфером.
      const existing = handles.get(id);
      if (existing !== undefined) return existing.document;
      if (document.kind === 'model') return document;

      await options.providersReady?.().catch(() => undefined);
      const parts = await preloadParts(document, extensions, partsAccess(id));
      // Пока ждали состав и читались части, тот же ресурс мог открыться вторым вызовом —
      // надстройка одна.
      const raced = handles.get(id);
      if (raced !== undefined) return raced.document;

      return attach(id, document, parts).document;
    },

    handleOf: (id) => handles.get(id) ?? null,

    opened: () => handles,

    onDidReattach(cb) {
      reattached.add(cb);
      return toDisposable(() => {
        reattached.delete(cb);
      });
    },

    reconcile: () => enqueue(reconcileNow),

    close(id) {
      drop(id);
      return workspace.close(id);
    },

    dispose() {
      disposed = true;
      subscription.dispose();
      providersSubscription?.dispose();
      for (const timer of orphans.values()) clearTimeout(timer);
      orphans.clear();
      reattached.clear();
      for (const id of [...handles.keys()]) drop(id);
    },
  };
}
