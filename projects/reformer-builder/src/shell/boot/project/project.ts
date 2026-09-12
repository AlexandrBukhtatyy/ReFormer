/**
 * Открытый проект: выбор каталога, восстановление последнего и время жизни сессии.
 *
 * ## Почему это отдельный слой, а не часть `boot`
 *
 * `boot` синхронен по контракту запуска, а всё здесь — асинхронно: выбор каталога ждёт
 * человека, восстановление ждёт IndexedDB, подъём источника ждёт разрешения. Держатель
 * проекта позволяет `boot` остаться синхронным и отдать оболочке ЗНАЧЕНИЕ («проект ещё
 * не открыт»), а не отсутствие: оболочка рисуется шагом 6, а восстановление идёт шагом 7 —
 * после отрисовки.
 *
 * ## Дескриптор в метаданных, хэндл — в хранилище хэндлов
 *
 * Переоткрытие держится на разведении, объявленном в `host/source/registry`: сериализуемый
 * {@link SourceDescriptor} едет в запись рабочей области, а живой хэндл каталога — в свою базу
 * по ключу (`platform/source/fs-handles`). Поэтому «восстановить последний проект» — это прочитать самую
 * свежую запись и отдать её дескриптор реестру источников; ничего про File System Access
 * этот код не знает и знать не должен.
 *
 * ## Повторный выбор того же каталога не плодит рабочих областей
 *
 * Иначе каждое «Открыть проект» на одной и той же папке создавало бы новую рабочую копию
 * в OPFS, а несохранённые правки прошлой оставались бы в области, к которой больше нет пути.
 * Совпадение проверяется `isSameEntry` — единственным, что File System Access даёт вместо
 * устойчивого идентификатора каталога.
 *
 * @module shell/boot/project/project
 */

import { toDisposable, type Disposable } from '@reformer/builder-plugin-api/internal';
import type { EventBus } from '@/shell/platform/primitives/event';
import type { ExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ResourceId } from '@reformer/builder-plugin-api/internal';
import {
  fsAccessSupported,
  pickFsDirectory,
  FS_SOURCE_KIND,
  type FsDirectoryHandle,
} from '@/shell/platform/source/fs-access';
import { isSourceDescriptor, type SourceRegistry } from '@/shell/platform/source/registry';
import {
  isSourceUnavailable,
  type Source,
  type SourceDescriptor,
  type SourceUnavailableReason,
} from '@/shell/platform/source/types';
import type { ValidationOrchestrator } from '@/shell/platform/services/validation/orchestrator';
import type { WhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import type { WorkspaceMetaStore, WorkspaceRecord } from '@/shell/platform/workspace/storage/idb';
import type { Journal } from '@/shell/platform/workspace/journal/journal';
import {
  createWorkspaceFileStore,
  type WorkspaceFileStore,
} from '@/shell/platform/workspace/storage/opfs';
import type { DiagnosticsSink } from '@/shell/platform/workspace/workspace';
import type { DirectoryHandleStore } from '@/shell/platform/source/fs-handles';
import { restoreOpenedTabs } from './opened-tabs';
import { createRecentProjects, type RecentProjects } from './recent';
import { createWorkspaceSession, type WorkspaceSession } from './workspace-session';

/**
 * Сколько прошлых каталогов сверяется с выбранным.
 *
 * Сверка стоит по обращению к хранилищу хэндлов на запись, поэтому она ограничена: смысл
 * в том, чтобы не плодить копий при обычной работе с двумя-тремя проектами, а не в том,
 * чтобы найти каталог, открывавшийся год назад.
 */
const SAME_ENTRY_LOOKUP_LIMIT = 20;

/** То, чем File System Access отвечает на вопрос «это тот же каталог». */
interface SameEntryCapable {
  isSameEntry?: (other: FsDirectoryHandle) => Promise<boolean>;
}

/** Почему проект не открылся. Различать обязательно: ответы человеку разные. */
export type ProjectFailureKind =
  /** Человек закрыл диалог выбора каталога. Не ошибка вовсе. */
  | 'cancelled'
  /** Движок не умеет File System Access. */
  | 'unsupported'
  /** Источник не поднялся. ЧЕМ именно — в {@link ProjectFailure.reason}. */
  | 'unavailable'
  /** Всё остальное: отказ хранилища, отказ источника. */
  | 'failed';

export interface ProjectFailure {
  readonly kind: ProjectFailureKind;
  /**
   * Уточнение к `unavailable`: источника больше нет (`missing`) или доступ не подтверждён
   * (`denied`).
   *
   * Отдельным полем, а не двумя видами неудачи, и это не робость: `kind` отвечает на вопрос
   * «что случилось с ОТКРЫТИЕМ проекта» и служит уровнем сообщения (отмена молчит,
   * неподдержка предупреждает, отказ ругается), а `reason` — на вопрос «какую кнопку
   * показать». Разложив второе по первому, мы заставили бы каждого, кому нужен только
   * уровень, перечислять причины источника — и переписывать этот перечень при появлении
   * третьей.
   *
   * Кому она нужна целиком: «источника нет» лечится ТОЛЬКО новым выбором каталога,
   * «доступ не подтверждён» — одним нажатием «разрешить», после которого `restoreLast()`
   * из обработчика этого нажатия уже сможет спросить разрешение (браузер отдаёт его только
   * по жесту, а восстановление на старте жестом не располагает).
   */
  readonly reason?: SourceUnavailableReason;
  readonly error?: unknown;
  /**
   * Какую рабочую область не удалось поднять — у переоткрытия по записи.
   *
   * По нему уведомление предлагает действие: «разрешить доступ» переоткрывает ИМЕННО эту
   * область (из обработчика щелчка, то есть по жесту), «убрать из недавних» — убирает её.
   * У выбора каталога его нет: записи там ещё нет, и предложить по ней нечего.
   */
  readonly workspaceId?: string;
}

export interface ProjectHostOptions {
  /**
   * Реестр журналов, куда сессия кладёт свой при создании.
   *
   * Необязателен: без него журнал живёт, но разгружать его при нехватке места будет некому —
   * поиск по реестру и есть тот отложенный шаг, которым разорван цикл «журналу нужно
   * хранилище, хранилищу нужен журнал».
   */
  readonly journals?: Map<string, Journal>;
  readonly sources: SourceRegistry;
  readonly handles: DirectoryHandleStore;
  readonly meta: WorkspaceMetaStore;
  readonly whenContext: Pick<WhenContextStore, 'set'>;
  /** Реестр вкладов приложения: из него сессия берёт провайдеров модели документа. */
  readonly extensions?: Pick<ExtensionRegistry, 'get'>;
  /** В фокусе ли текстовый редактор документа — см. {@link WorkspaceSessionOptions}. */
  readonly isTextEditorFocused?: (id: ResourceId) => boolean;
  readonly events?: EventBus;
  readonly diagnostics?: DiagnosticsSink;
  readonly validation?: ValidationOrchestrator;
  /** Куда сообщать о неудаче. Показать её человеку — дело того, кто собирает продукт. */
  readonly onFailure?: (failure: ProjectFailure) => void;
  /** Порождение ключа хэндла. Параметр ради тестов: ключ обязан быть предсказуемым. */
  readonly newKey?: () => string;
  readonly now?: () => number;
  /**
   * Выбор каталога. Точка подмены — там же, где она у фабрики источника (`ensureAccess`):
   * настоящий выбор требует окна, а проверять надо и ветку отказа, и ветку успеха.
   */
  readonly pick?: () => Promise<FsDirectoryHandle>;
  /** Умеет ли движок выбирать каталог. Идёт в паре с {@link pick} и подменяется вместе с ним. */
  readonly supported?: () => boolean;
  /** Создание хранилища содержимого. Подменяется в окружении без OPFS — то есть в тестах. */
  readonly createFiles?: (workspaceId: string) => WorkspaceFileStore;
}

/**
 * Держатель открытого проекта.
 *
 * Форма та же, что у хранилищ оболочки (`get`/`subscribe`), и по той же причине: снимок
 * читают и компоненты через `useSyncExternalStore`, и код вне React.
 */
export interface ProjectHost extends Disposable {
  /** Текущая сессия или `null`. Ссылка стабильна, пока проект не сменился. */
  get(): WorkspaceSession | null;
  subscribe(listener: () => void): Disposable;
  /** Умеет ли этот движок выбрать каталог вообще. */
  canOpen(): boolean;
  /** Показывает выбор каталога и открывает проект. `false` — не открыли. */
  open(): Promise<boolean>;
  /**
   * Поднимает последний проект по дескриптору из метаданных. `false` — поднимать нечего.
   *
   * Убранный человеком из недавних не поднимается и на старте: «убрать» значит «больше
   * не предлагать», а восстановление — то же предложение, только без спроса.
   */
  restoreLast(): Promise<boolean>;
  /**
   * Поднимает проект по записи рабочей области — «Недавно открытые». `false` — не открыли.
   *
   * Зовётся из щелчка или Enter, то есть по жесту, поэтому источник вправе спросить
   * разрешение: перед `requestPermission` здесь только чтения IndexedDB, и окно активации
   * ещё не истекло. Уже открытая область не пересоздаётся — второй сессии над ней не бывает.
   */
  openWorkspace(id: string): Promise<boolean>;
  /** Недавние проекты: свежий первым, без открытого сейчас и без убранных человеком. */
  readonly recent: RecentProjects;
  /** Закрывает проект. Содержимое рабочей копии остаётся в OPFS. */
  close(): void;
}

/** Ключ хэндла по умолчанию: `randomUUID`, а где его нет — время и случайное число. */
function defaultKey(): string {
  const crypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (typeof crypto?.randomUUID === 'function') return crypto.randomUUID();
  return `fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Отказ выбора каталога человеком. Браузер отвечает на это `AbortError`. */
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function createProjectHost(options: ProjectHostOptions): ProjectHost {
  const { sources, handles, meta, whenContext } = options;
  const newKey = options.newKey ?? defaultKey;
  const pick = options.pick ?? ((): Promise<FsDirectoryHandle> => pickFsDirectory('readwrite'));
  const createFiles = options.createFiles ?? createWorkspaceFileStore;
  const supported = options.supported ?? fsAccessSupported;
  const now = options.now ?? ((): number => Date.now());
  const onFailure =
    options.onFailure ??
    ((failure: ProjectFailure): void => {
      if (failure.kind === 'cancelled') return;
      console.error(`[app] проект не открыт: ${failure.kind}`, failure.error);
    });

  let session: WorkspaceSession | null = null;
  const listeners = new Set<() => void>();
  // Список недавних спрашивает открытую сессию на каждом пересчёте: открытый проект в нём
  // не показывается, и «какой открыт» обязано быть ответом на сейчас, а не на момент создания.
  const recent = createRecentProjects({ meta, currentId: () => session?.workspaceId ?? null });
  void recent.refresh();

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[app] подписчик открытого проекта упал', error);
      }
    }
  };

  const setSession = (next: WorkspaceSession | null): void => {
    if (session === next) return;
    session?.dispose();
    session = next;
    // Контекст применимости чистится здесь, а не вкладками: их хранилище уже уничтожено,
    // а `activeEditorId` закрытого проекта оставлял бы команды доступными над пустотой.
    if (next === null) whenContext.set({ activeEditorId: null, activeResourceKind: null });
    notify();
    // Сменился открытый проект — сменилось и то, кого список недавних не показывает.
    void recent.refresh();
  };

  /**
   * Строит сессию над источником и записывает её в метаданные.
   *
   * Запись идёт ПОСЛЕ создания сессии: рабочая область, которая не построилась, не должна
   * стать «последним открытым проектом» и восстанавливаться при каждом следующем запуске.
   */
  const start = async (workspaceId: string, source: Source, label?: string): Promise<void> => {
    const files = createFiles(workspaceId);
    const created = createWorkspaceSession({
      journals: options.journals,
      workspaceId,
      source,
      files,
      meta,
      whenContext,
      extensions: options.extensions,
      isTextEditorFocused: options.isTextEditorFocused,
      events: options.events,
      diagnostics: options.diagnostics,
      validation: options.validation,
    });
    setSession(created);

    const existing = await meta.getWorkspace(workspaceId);
    // Запись пишется заново, и `hiddenFromRecent` в неё НЕ переносится намеренно: открытие
    // возвращает проект в список недавних — так VS Code возвращает текущую область при старте.
    await meta.putWorkspace({
      id: workspaceId,
      sourceId: source.id,
      descriptor: { ...source.descriptor },
      label: label ?? existing?.label,
      createdAt: existing?.createdAt ?? now(),
      lastOpenedAt: now(),
      settings: existing?.settings,
    });
    // Недавние — проекция этих записей: свежий `lastOpenedAt` меняет в них порядок.
    await recent.refresh();

    // Ряд вкладок прошлого сеанса. ПОСЛЕ `setSession`: восстановление открывает документы
    // через сессию, и до неё открывать было бы нечем. Отказ не отменяет открытия проекта —
    // проект без вкладок работает, а проект, не открывшийся из-за вкладок, не работает вовсе.
    await restoreOpenedTabs({ workspaceId, documents: created.documents, meta });
  };

  /** Ключ уже известного хэндла, указывающего на тот же каталог, или `null`. */
  const findKnownKey = async (picked: FsDirectoryHandle): Promise<string | null> => {
    const probe = picked as SameEntryCapable;
    if (typeof probe.isSameEntry !== 'function') return null;
    for (const key of (await handles.keys()).slice(0, SAME_ENTRY_LOOKUP_LIMIT)) {
      const stored = await handles.open(key);
      if (stored === null) continue;
      try {
        if (await probe.isSameEntry(stored)) return key;
      } catch {
        // Сравнение отказало — считаем каталоги разными: лишняя рабочая область лучше,
        // чем чужая, принятая за свою.
        continue;
      }
    }
    return null;
  };

  /**
   * Поднимает источник по сохранённому дескриптору и строит над ним сессию.
   *
   * Общее у восстановления на старте и у «Недавно открытых»: разница между ними только в том,
   * КАКУЮ запись поднимать. Отказ называет область — по ней уведомление предложит действие.
   */
  const reopen = async (
    workspaceId: string,
    descriptor: SourceDescriptor,
    label: string | undefined
  ): Promise<boolean> => {
    try {
      const source = await sources.restore(descriptor);
      if (isSourceUnavailable(source)) {
        // Обычный ход событий: источника больше нет либо доступ не подтверждён. Приложение
        // обязано остаться рабочим — но сказать об этом надо РАЗНОЕ: в первом случае человеку
        // остаётся выбрать проект заново, во втором хватит нажатия «разрешить», из обработчика
        // которого переоткрытие спросит разрешение уже по жесту.
        onFailure({ kind: 'unavailable', reason: source.unavailable, workspaceId });
        return false;
      }
      await start(workspaceId, source, label);
      return true;
    } catch (error) {
      onFailure({ kind: 'failed', error, workspaceId });
      return false;
    }
  };

  return {
    get: () => session,

    subscribe(listener) {
      listeners.add(listener);
      return toDisposable(() => {
        listeners.delete(listener);
      });
    },

    canOpen: () => supported(),

    async open() {
      if (!supported()) {
        onFailure({ kind: 'unsupported' });
        return false;
      }

      let picked: FsDirectoryHandle;
      try {
        // Вызывается ПЕРВЫМ и синхронно относительно жеста: выбор каталога требует
        // подтверждённого действия пользователя, и `await` перед ним его теряет.
        picked = await pick();
      } catch (error) {
        onFailure({ kind: isAbort(error) ? 'cancelled' : 'failed', error });
        return false;
      }

      try {
        const known = await findKnownKey(picked);
        const key = known ?? newKey();
        // Хэндл перезаписывается и для известного ключа: разрешение выдано вот этому
        // объекту, и хранить прежний значило бы восстанавливать проект без прав.
        await handles.put(key, picked);

        const descriptor: SourceDescriptor = { kind: FS_SOURCE_KIND, handleKey: key };
        const source = await sources.restore(descriptor);
        if (isSourceUnavailable(source)) {
          // Каталог только что выбрали руками, поэтому `denied` здесь означает отказ в самом
          // диалоге разрешения, а `missing` — что хэндл не пережил запись в хранилище.
          // Ни то, ни другое не выдумывается: причину называет фабрика.
          onFailure({ kind: 'unavailable', reason: source.unavailable });
          return false;
        }
        await start(key, source, picked.name);
        return true;
      } catch (error) {
        onFailure({ kind: 'failed', error });
        return false;
      }
    },

    async restoreLast() {
      let record: WorkspaceRecord | undefined;
      try {
        // Список отсортирован по свежести, поэтому «последний проект» — это первая запись,
        // а не отдельная настройка, которая рано или поздно разойдётся со списком.
        [record] = await meta.listWorkspaces();
      } catch (error) {
        onFailure({ kind: 'failed', error });
        return false;
      }
      if (record === undefined) return false;
      // Убранную из недавних не поднимаем и на старте — см. контракт `restoreLast`. Следующая
      // по свежести на её место не встаёт: «последний проект» один, и подменить его другим
      // значило бы открыть не то, с чем человек работал.
      if (record.hiddenFromRecent === true) return false;
      if (!isSourceDescriptor(record.descriptor)) return false;
      return reopen(record.id, record.descriptor, record.label);
    },

    async openWorkspace(id) {
      if (session?.workspaceId === id) return true;
      let record: WorkspaceRecord | null;
      try {
        record = await meta.getWorkspace(id);
      } catch (error) {
        onFailure({ kind: 'failed', error, workspaceId: id });
        return false;
      }
      if (record === null || !isSourceDescriptor(record.descriptor)) {
        // Записи нет (хранилище почистили в другой вкладке) или дескриптор чужого вида:
        // поднимать нечего — то же, что пропавший хэндл, и предложить можно то же.
        onFailure({ kind: 'unavailable', reason: 'missing', workspaceId: id });
        return false;
      }
      return reopen(record.id, record.descriptor, record.label);
    },

    recent,

    close() {
      setSession(null);
    },

    dispose() {
      setSession(null);
      listeners.clear();
      recent.dispose();
    },
  };
}
