/**
 * Рабочая сессия: рабочая область, дерево, вкладки и наблюдение валидации — как одно целое.
 *
 * **Почему сессия, а не набор полей в `boot`.** Всё перечисленное рождается и умирает вместе:
 * закрыли проект — исчезли и вкладки, и дерево, и наблюдения валидации по его документам.
 * Разложенное по полям композиции, это превратилось бы в четыре независимых времени жизни,
 * из которых рано или поздно одно переживёт остальные (классическая утечка «панель показывает
 * дерево закрытого проекта»).
 *
 * **Чего здесь нет: выбора каталога и восстановления.** Сессия строится над УЖЕ поднятым
 * источником. Откуда он взялся — выбрал человек или подняла фабрика по дескриптору — знает
 * `boot`, и сессии это знание не нужно ни для чего.
 *
 * @module shell/boot/project/workspace-session
 */

import { toDisposable, type Disposable } from '@/shell/platform/primitives/disposable';
import type { EventBus } from '@/shell/platform/primitives/event';
import type { ExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { makeResourceId, type ResourceId } from '@/shell/platform/primitives/resource';
import type { Source } from '@/shell/platform/source/types';
import type { ValidationOrchestrator } from '@/shell/platform/validation/orchestrator';
import {
  createResourceTreeStore,
  type ResourceTreeStore,
} from '@/shell/platform/ui/state/resource-tree';
import {
  createResourceOperations,
  type ResourceOperations,
} from '@/shell/platform/workspace/resource-ops';
import type {
  WorkspaceStatusSnapshot,
  WorkspaceStatusSource,
} from '@/shell/platform/ui/state/status';
import {
  createDocumentTabsStore,
  type DocumentTabsStore,
  type TabsWorkspace,
} from '@/shell/platform/ui/state/tabs';
import type { WhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import type { DiagnosticsSink, Workspace } from '@/shell/platform/workspace/workspace';
import { createJournal, type Journal } from '@/shell/platform/workspace/journal/journal';
import { createDivergenceWatch } from '@/shell/platform/workspace/merge/divergence';
import type { DivergenceWatch } from '@/shell/platform/workspace/merge/divergence';
import { createWorkspace } from '@/shell/platform/workspace/workspace';
import type { WorkspaceFileStore } from '@/shell/platform/workspace/storage/opfs';
import type { WorkspaceMetaStore } from '@/shell/platform/workspace/storage/idb';
import { createDocumentModels, type DocumentModels } from './document-models';
import { watchOpenedTabs } from './opened-tabs';

/**
 * Рабочая область в объёме, нужном строке состояния.
 *
 * `Pick`, а не свой порт, по той же причине, что у вкладок: форма обязана совпадать
 * с настоящей рабочей областью буква в букву, иначе расхождение вскроется на композиции,
 * а не на типах.
 */
export type StatusWorkspace = Pick<Workspace, 'isDirty' | 'openedResources' | 'onDidChange'>;

/** Источник итога, который умеет отписаться от рабочей области при закрытии проекта. */
export interface DisposableStatusSource extends WorkspaceStatusSource, Disposable {}

/**
 * Итог по рабочей области для строки состояния.
 *
 * `externallyChangedCount` берётся из наблюдения за расхождением, а не из рабочей области:
 * сама она узнаёт о внешнем изменении только в момент сохранения (отказ `conflict`), то есть
 * слишком поздно, чтобы предупредить. Наблюдение спрашивает источник в четырёх моментах
 * (сохранение, возврат фокуса, переоткрытие проекта, явная команда) и опроса по таймеру
 * не ведёт.
 *
 * Наблюдение НЕОБЯЗАТЕЛЬНО: без него счётчик ноль — не «расхождений нет», а «никто не смотрел».
 * Разница видна человеку одинаково, но второе честнее, и потому умолчание именно такое.
 *
 * Снимок пересчитывается на каждый пакет изменений, но ССЫЛКА меняется только вместе
 * со значением: `useSyncExternalStore` сравнивает снимки по ссылке, а пакет приходит и на
 * материализацию соседей по импорту, которая для строки состояния не значит ничего.
 */
export function createWorkspaceStatusSource(
  workspace: StatusWorkspace,
  divergence?: Pick<DivergenceWatch, 'get' | 'subscribe'>
): DisposableStatusSource {
  const compute = (): WorkspaceStatusSnapshot => ({
    hasWorkspace: true,
    dirtyCount: workspace.openedResources().filter((id) => workspace.isDirty(id)).length,
    externallyChangedCount: divergence?.get().count ?? 0,
  });

  let snapshot: WorkspaceStatusSnapshot = Object.freeze(compute());
  const listeners = new Set<() => void>();

  // Пакет изменений рабочей области про расхождение не знает: его порождает наша запись,
  // а расхождение — чужая. Поэтому подписок две, и они независимы.
  const onChange = (): void => {
    const next = compute();
    if (
      next.dirtyCount === snapshot.dirtyCount &&
      next.externallyChangedCount === snapshot.externallyChangedCount
    ) {
      return;
    }
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) listener();
  };
  const divergenceSubscription = divergence?.subscribe(onChange);

  const subscription = workspace.onDidChange(() => {
    const next = compute();
    if (
      next.dirtyCount === snapshot.dirtyCount &&
      next.externallyChangedCount === snapshot.externallyChangedCount
    ) {
      return;
    }
    snapshot = Object.freeze(next);
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        // Политика всех хранилищ оболочки: упавший подписчик не мешает остальным.
        console.error('[app] подписчик строки состояния упал', error);
      }
    }
  });

  return {
    get: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },
    dispose() {
      subscription.dispose();
      divergenceSubscription?.dispose();
      listeners.clear();
    },
  };
}

/**
 * Держит наблюдение валидации ровно за открытыми вкладками.
 *
 * Подписка идёт на ВКЛАДКИ, а не на рабочую область: наблюдение нужно тому, что человек
 * открыл (`opened`), а не всему, что материализовано ради импортов. Документ появляется
 * позже своей вкладки — его читает `workspace.open`, — поэтому сведение зовётся на каждое
 * изменение состояния вкладок, а не один раз.
 *
 * Возвращает снятие всех наблюдений: сессия кладёт его в свои подписки.
 */
export function watchOpenDocuments(
  documents: DocumentTabsStore,
  validation: ValidationOrchestrator
): Disposable {
  const watches = new Map<ResourceId, Disposable>();

  const sync = (): void => {
    const open = new Set(documents.get().tabs.map((tab) => tab.ref.id));
    for (const [id, watch] of [...watches]) {
      if (open.has(id)) continue;
      // `dispose` наблюдения убирает и опубликованное им: находки, которые никто больше
      // не обновляет, — это ровно тот случай «исправленная ошибка висит».
      watch.dispose();
      watches.delete(id);
    }
    for (const id of open) {
      if (watches.has(id)) continue;
      const document = documents.documentOf(id);
      if (document === null) continue;
      watches.set(id, validation.watch(document));
    }
  };

  const subscription = documents.subscribe(sync);
  sync();

  return toDisposable(() => {
    subscription.dispose();
    for (const watch of watches.values()) watch.dispose();
    watches.clear();
  });
}

/** Всё, что живёт, пока открыт проект. */
export interface WorkspaceSession extends Disposable {
  /** Идентификатор рабочей области — им же адресуются её файлы в OPFS и записи в IndexedDB. */
  readonly workspaceId: string;
  /** Источник, над которым построена сессия. Интерфейсу нужны его имя и возможности. */
  readonly source: Source;
  readonly workspace: Workspace;
  readonly documents: DocumentTabsStore;
  /**
   * Модельная половина открытых документов: ручки правки моделью.
   *
   * Рядом с `documents`, а не внутри них: вкладки отвечают «что открыто и чем оно
   * является», а ручка — «кто вправе это править». См. `./document-models`.
   */
  readonly models: DocumentModels;
  /**
   * Наблюдение за расхождением с источником.
   *
   * Живёт и умирает вместе с рабочей областью: расхождение — это утверждение о КОНКРЕТНЫХ
   * ресурсах конкретного источника, и переживать смену проекта ему нечем. Опроса по таймеру
   * в нём нет намеренно — со знанием о расхождении можно сделать только одно, показать,
   * а человек либо в окне (команда рядом), либо вне его (узнает при возврате фокуса).
   */
  readonly divergence: DivergenceWatch;
  readonly tree: ResourceTreeStore;
  /**
   * Операции над записями проекта: создать, переименовать, удалить, скопировать.
   *
   * В сессии, а не в композиции, по той же причине, что дерево и вкладки: они пишут
   * в источник ЭТОГО проекта и чинят ЕГО дерево, поэтому переживать его закрытие им нечем.
   */
  readonly resources: ResourceOperations;
  readonly status: WorkspaceStatusSource;
}

export interface WorkspaceSessionOptions {
  /**
   * Реестр журналов, куда сессия кладёт свой при создании.
   *
   * Необязателен: без него журнал живёт, но разгружать его при нехватке места будет некому —
   * поиск по реестру и есть тот отложенный шаг, которым разорван цикл «журналу нужно
   * хранилище, хранилищу нужен журнал».
   */
  readonly journals?: Map<string, Journal>;
  readonly workspaceId: string;
  readonly source: Source;
  readonly files: WorkspaceFileStore;
  readonly meta: WorkspaceMetaStore;
  /** Куда вкладки пишут `activeEditorId` и `activeResourceKind`. */
  readonly whenContext: Pick<WhenContextStore, 'set'>;
  /**
   * Реестр вкладов приложения: из него берутся провайдеры модели документа.
   *
   * Без него сессия работает, но все документы открываются текстовыми — то есть ровно так,
   * как если бы провайдера не внёс никто. Это законное состояние (см. `./document-models`),
   * поэтому параметр необязателен, а тесты, которым модель не нужна, его не передают.
   */
  readonly extensions?: Pick<ExtensionRegistry, 'get'>;
  /**
   * В фокусе ли текстовый редактор этого документа.
   *
   * Ответ даёт реестр фокуса Monaco, который создаёт композиция и отдаёт его же плагину.
   * Объект обязан быть ОДНИМ: перерисовка буфера по модели откладывается, пока человек
   * печатает, и два разных ответа на этот вопрос означали бы, что ход ассистента затирает
   * набранное на полуслове.
   */
  readonly isTextEditorFocused?: (id: ResourceId) => boolean;
  readonly events?: EventBus;
  readonly diagnostics?: DiagnosticsSink;
  /** Оркестратор валидации приложения. Без него сессия работает, но находок не будет. */
  readonly validation?: ValidationOrchestrator;
}

/**
 * Собирает сессию над поднятым источником.
 *
 * Синхронна: обращений к хранилищу здесь нет ни одного — рабочая область материализует
 * содержимое по требованию, дерево читает уровень при первом раскрытии, вкладки открывают
 * документ при первом открытии. То же правило, по которому синхронен `boot`.
 */
export function createWorkspaceSession(options: WorkspaceSessionOptions): WorkspaceSession {
  const { workspaceId, source, files, meta, whenContext } = options;

  /**
   * Журнал правок. Необязателен по контракту — без него рабочая область работает,
   * просто ничего не помнит. До сих пор его не создавал НИКТО: механика ретенции,
   * якорных снимков и схлопывания была написана целиком и не вызывалась ни разу.
   *
   * Содержимое для якорного снимка журнал спрашивает у рабочей копии, а не хранит сам:
   * иначе каждая запись тащила бы за собой полный текст файла, и журнал весил бы больше
   * проекта. Область к моменту вызова уже создана — отсюда ленивое чтение через замыкание.
   */
  const journal = createJournal({
    store: meta,
    workspaceId,
    content: (resource) => workspace.readText(resource).catch(() => undefined),
  });
  options.journals?.set(workspaceId, journal);

  const workspace = createWorkspace({
    id: workspaceId,
    source,
    files,
    meta,
    journal,
    events: options.events,
    diagnostics: options.diagnostics,
  });

  const divergence = createDivergenceWatch({ workspace });
  const models = createDocumentModels({
    workspace,
    // Реестра вкладов нет — значит, провайдеров модели не спрашивают вовсе, и все документы
    // остаются текстовыми. Пустой ответ вместо реестра честнее, чем необязательный вызов
    // внутри надстройки: там «провайдера не нашлось» и «спрашивать было негде» слились бы.
    extensions: options.extensions ?? { get: () => [] },
    diagnostics: options.diagnostics,
    isTextEditorFocused: options.isTextEditorFocused,
  });

  /**
   * Вкладки открывают документ ЧЕРЕЗ надстройку модели.
   *
   * Иначе к ним попадал бы буфер, а вид ресурса (`activeResourceKind`) и `documentOf`
   * отвечали бы «текст» на файл, у которого модель есть. Остальные методы делегируются
   * как есть: про модель они не знают и знать не должны.
   */
  const tabsWorkspace: TabsWorkspace = {
    open: (id) => models.open(id),
    close: (id) => models.close(id),
    save: (id) => workspace.save(id),
    openedResources: () => workspace.openedResources(),
    isDirty: (id) => workspace.isDirty(id),
    onDidChange: (cb) => workspace.onDidChange(cb),
  };

  const documents = createDocumentTabsStore({ workspace: tabsWorkspace, whenContext });
  const tree = createResourceTreeStore({
    workspace,
    // Корень показа — корень источника: `<sourceId>:`. Сам он строкой в дерево не попадает.
    rootId: makeResourceId(source.id, ''),
  });
  const status = createWorkspaceStatusSource(workspace, divergence);

  // Операции над записями идут К ИСТОЧНИКУ напрямую (см. `host/workspace/resource-ops`),
  // а последствия достаются рабочей области и дереву: вкладка исчезнувшего файла
  // закрывается, прочитанный уровень забывается. Живут они ровно столько, сколько живёт
  // сессия, — поэтому создаются здесь, а не в композиции.
  const resources = createResourceOperations({
    source,
    workspace,
    invalidate: (dir) => tree.refresh(dir),
  });

  const subscriptions: Disposable[] = [];
  if (options.validation !== undefined) {
    subscriptions.push(watchOpenDocuments(documents, options.validation));
  }
  // Ряд вкладок пишется в метаданные рабочей области, чтобы пережить перезагрузку страницы;
  // обратный ход — `restoreOpenedTabs`, его зовёт открытие проекта (`./project`).
  subscriptions.push(watchOpenedTabs({ workspaceId, documents, meta }));

  return {
    workspaceId,
    source,
    workspace,
    divergence,
    documents,
    models,
    tree,
    resources,
    status,
    dispose() {
      for (const subscription of subscriptions) subscription.dispose();
      subscriptions.length = 0;
      documents.dispose();
      divergence.dispose?.();
      // После вкладок: их `dispose` не закрывает ресурсы, а ручки держат подписку на буфер
      // и историю — снимать их обязан тот, кто их завёл.
      models.dispose();
      tree.dispose();
      status.dispose();
    },
  };
}
