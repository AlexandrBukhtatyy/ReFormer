/**
 * Активный кит — состояние, которое обязано быть одним на всё приложение.
 *
 * ## Почему служба, а не значение
 *
 * Редактор рисует палитру активного кита, превью резолвит его компоненты, валидатор сверяет
 * `$component(...)` с его каталогом, тема RJSF строится по нему же — и если у каждого свой ответ,
 * валидатор ругается на компонент, который человек только что поставил из палитры. Поэтому ответ
 * держит одна служба, а остальные находят её по возможности `reformer.kit.catalog` (SDK).
 *
 * ## Служба нейтральна
 *
 * Она отдаёт кит так, как его поставил кит: сырой каталог и дескриптор. Записи палитры с узлами
 * по умолчанию — это ReFormer, тема RJSF — это RJSF, и выводит их каждый стек сам. Знай служба
 * хоть один стек, второй пришлось бы вносить её правкой.
 *
 * ## Откуда киты
 *
 * Встроенные — параметром (`sources`); остальные вносят плагины в точку `reformer.kit.source`,
 * и плагин передаёт их службе при каждом изменении точки ({@link OwnedKitsService.syncContributed}).
 * Кит плагина — данные извне, поэтому он проходит проверки, которых у встроенного нет: он обязан
 * себя назвать, не может занять чужой идентификатор, и его каталог сверяется с контрактом. Отказ
 * не роняет ничего: кит просто не появляется в списке, а о причине служба сообщает.
 *
 * ## Каталог может приехать ПОЗЖЕ самого кита
 *
 * Каталог встроенного кита весит 864 кБ, и статический импорт клал их в главный чанк. Поэтому
 * источник отдаёт каталог значением или загрузчиком, а асинхронность НЕ протекает в контракт:
 * читатели синхронны (их зовут из отрисовки) и до загрузки видят каталог без записей — шапку
 * кита. Переход «пусто → загружено» приходит тем же `onDidChange`, что и смена кита.
 *
 * ## Стабильность снимков
 *
 * Читателей зовёт `useSyncExternalStore`, который сравнивает снимок ПО ССЫЛКЕ. Поэтому между
 * сменами все читатели возвращают те же объекты, а новые — только после смены.
 *
 * @module plugins/kits/registry/service
 */

import {
  CATALOG_CONTRACT_VERSION,
  declaredKitId,
  toDescriptor,
  type CatalogJson,
  type Disposable,
  type KitDescriptor,
  type KitDescriptorJson,
  type KitFrameProps,
  type KitOrigin,
  type KitSource,
  type KitsService,
  type KitSummary,
} from '@reformer/builder-plugin-api';
import { loadCatalogValidator, type CatalogValidator } from '@reformer/builder-plugin-api/tooling';
import type { ComponentType } from 'react';
import { createKitFrame } from './frame';
import type { KitsSettings } from './host';
import { createKitNamespaceLoader, type KitNamespaceLoader } from './namespace';

/**
 * Ключ настройки выбора. Область — `user`: кит выбирает человек, и выбор переживает смену
 * проекта (см. `scopeForKey` в службе настроек: всё, что не `workspace.*`, — глобальное).
 */
export const KIT_SETTINGS_KEY = 'plugin.kits.active';

/** Кит, внесённый плагином: источник и тот, кто его внёс. */
export interface ContributedKit {
  readonly source: KitSource;
  readonly pluginId: string;
}

/**
 * Отказ принять кит плагина. Служба сообщает о нём, а показывает — плагин китов, своим словарём.
 *
 * - `no-id` — кит себя не назвал: ни шапки, ни блока `kit` с `id` у каталога-значения;
 * - `duplicate` — идентификатор занят встроенным китом или китом, внесённым раньше;
 * - `invalid-catalog` — каталог не прошёл контракт `component-catalog.schema.json`;
 * - `mismatch` — загруженный каталог назвал себя иначе, чем объявила шапка;
 * - `load-failed` — каталог не загрузился.
 */
export interface KitProblem {
  readonly code: 'no-id' | 'duplicate' | 'invalid-catalog' | 'mismatch' | 'load-failed';
  readonly pluginId?: string;
  readonly kitId?: string;
  readonly detail?: string;
}

/**
 * Служба вместе с тем, что принадлежит её владельцу — плагину китов.
 *
 * Ничего из этого нет в {@link KitsService}: умолчание объявляет тот, кто вносит настройку,
 * «когда грузить» решает владелец, а киты плагинов приходят к службе из его точки расширения.
 */
export interface OwnedKitsService extends KitsService, Disposable {
  /** Кит, на котором инструмент открывается, пока не выбрано иное, — первый встроенный. */
  readonly defaultId: string;
  /**
   * Дождаться каталога активного кита. Вызов её же и ЗАПУСКАЕТ. Не отвергается никогда: отказ
   * загрузки — это пустой каталог плюс отчёт, а не исключение у того, кто просто ждал.
   */
  whenReady(): Promise<void>;
  /**
   * Состав китов плагинов — текущее содержимое точки `reformer.kit.source` в её порядке.
   * Зовётся на каждое изменение точки; кит, которого в составе больше нет, снимается.
   */
  syncContributed(kits: readonly ContributedKit[]): void;
}

export interface KitsServiceOptions {
  /** Встроенные киты. Первый — умолчание. Нужен хотя бы один. */
  readonly sources: readonly KitSource[];
  /** Где живёт выбор. Без настроек служба работает, но выбор не переживёт перезагрузку. */
  readonly settings?: KitsSettings;
  /**
   * Проверка каталога кита из плагина. По умолчанию — проверка контракта из SDK; параметр — для
   * тестов, которым не нужен настоящий ajv.
   */
  readonly validator?: () => Promise<CatalogValidator>;
  /** Кит плагина отвергнут. Без обработчика отказ пишется в консоль. */
  readonly onProblem?: (problem: KitProblem) => void;
}

/** Кит в службе: источник, откуда он, и что о нём известно сейчас. */
interface KitEntry {
  readonly id: string;
  readonly source: KitSource;
  readonly origin: KitOrigin;
  /** Шапка без записей: чем кит представляется, пока каталога нет. */
  readonly header: CatalogJson;
  readonly summary: Omit<KitSummary, 'active'>;
  /** Каталог после загрузки и проверки; до них — `undefined`. */
  loaded: CatalogJson | undefined;
  /** Загрузка каталога. Одна попытка за жизнь записи — даже после отказа. */
  loading: Promise<void> | undefined;
  readonly namespace: KitNamespaceLoader | undefined;
}

/** Шапка кита как каталог без записей. Заморожена: снимок обязан быть стабилен. */
function headerCatalog(id: string, kit: KitDescriptorJson | undefined): CatalogJson {
  return Object.freeze({
    version: CATALOG_CONTRACT_VERSION,
    components: [],
    kit: { ...kit, id },
  });
}

/** Шапка источника: объявленная, иначе блок `kit` каталога-значения. */
function declaredHeader(source: KitSource): KitDescriptorJson | undefined {
  return source.kit ?? (typeof source.catalog === 'function' ? undefined : source.catalog.kit);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createKitsService(options: KitsServiceOptions): OwnedKitsService {
  const { settings } = options;
  if (options.sources.length === 0) {
    throw new Error('kits: список китов пуст — службе нечего сделать активным');
  }
  const validator = options.validator ?? loadCatalogValidator;
  const report =
    options.onProblem ??
    ((problem: KitProblem): void => {
      console.error('[kits] кит плагина отвергнут', problem);
    });

  /** Все киты в порядке списка: встроенные, затем внесённые плагинами. */
  const entries = new Map<string, KitEntry>();
  /** Дескрипторы по каталогу: один каталог — один дескриптор, пока каталог тот же. */
  const descriptors = new WeakMap<CatalogJson, KitDescriptor>();
  const listeners = new Set<() => void>();
  const availableListeners = new Set<() => void>();
  /** Подписки на «пространство имён доехало» — у каждой своя по каждому загрузчику. */
  const namespaceSubscribers = new Set<Map<KitNamespaceLoader, Disposable>>();
  const namespaceCallbacks = new WeakMap<Map<KitNamespaceLoader, Disposable>, () => void>();

  const createEntry = (id: string, source: KitSource, origin: KitOrigin): KitEntry => {
    const header = headerCatalog(id, declaredHeader(source));
    const descriptor = toDescriptor(header);
    const namespace =
      source.namespace === undefined ? undefined : createKitNamespaceLoader(source.namespace);
    if (namespace !== undefined) {
      for (const subscriptions of namespaceSubscribers) {
        subscriptions.set(namespace, namespace.onDidLoad(namespaceCallbacks.get(subscriptions)!));
      }
    }
    return {
      id,
      source,
      origin,
      header,
      summary: Object.freeze({
        id,
        label: descriptor.label,
        package: descriptor.package,
        version: descriptor.version,
        origin,
      }),
      loaded: undefined,
      loading: undefined,
      namespace,
    };
  };

  const dropEntry = (entry: KitEntry): void => {
    entries.delete(entry.id);
    if (entry.namespace === undefined) return;
    for (const subscriptions of namespaceSubscribers) {
      subscriptions.get(entry.namespace)?.dispose();
      subscriptions.delete(entry.namespace);
    }
  };

  const BUILTIN: KitOrigin = Object.freeze({ kind: 'builtin' });
  for (const source of options.sources) {
    const id = declaredKitId(source);
    if (id === undefined) {
      throw new Error(
        'kits: встроенный кит себя не назвал. Идентификатор — ключ выбора: кит с ленивым ' +
          'каталогом объявляет его шапкой (`KitSource.kit.id`), с каталогом-значением — блоком `kit`'
      );
    }
    if (entries.has(id)) {
      throw new Error(
        `kits: кит «${id}» зарегистрирован дважды. Идентификатор — ключ выбора: два кита под ` +
          'одним именем означали бы, что активный зависит от порядка регистрации'
      );
    }
    const entry = createEntry(id, source, BUILTIN);
    // Встроенный кит проверен своей сборкой: каталог-значение принимается сразу.
    if (typeof source.catalog !== 'function') entry.loaded = source.catalog;
    entries.set(id, entry);
  }
  const builtinIds = new Set(entries.keys());
  const defaultId = [...entries.keys()][0]!;

  /**
   * Выбор из настроек, если такой кит сейчас есть. Незнакомый идентификатор НЕ переписывается
   * умолчанием: кит могли временно выключить (или его плагин ещё не поднялся), и затирание
   * выбора означало бы, что после его возвращения человек оказался не там, где оставил.
   */
  const stored = (): string | null => {
    const value = settings?.get<unknown>(KIT_SETTINGS_KEY);
    return typeof value === 'string' && entries.has(value) ? value : null;
  };

  /** Какой кит должен быть активен: выбор, иначе прежний, если он ещё есть, иначе умолчание. */
  const resolveActive = (current: string): string =>
    stored() ?? (entries.has(current) ? current : defaultId);

  let activeId = resolveActive(defaultId);
  /** Снимок списка доступных. Пересобирается вместе с активным китом и составом. */
  let summaries: readonly KitSummary[] | null = null;

  const notifyAll = (set: Set<() => void>, what: string): void => {
    for (const listener of [...set]) {
      try {
        listener();
      } catch (error) {
        // Политика всех хранилищ оболочки: упавший подписчик не мешает остальным.
        console.error(`[kits] подписчик «${what}» упал`, error);
      }
    }
  };
  const notify = (): void => {
    notifyAll(listeners, 'смена кита');
  };

  const setActive = (id: string): void => {
    if (id === activeId) return;
    activeId = id;
    summaries = null;
    notify();
  };

  const activeEntry = (): KitEntry => entries.get(activeId)!;

  /**
   * Каталог кита не принят — он остаётся пустым. О ките плагина сообщается как об отказе
   * (его покажет плагин китов); встроенный — ошибка сборки, и ей место в консоли.
   */
  const refuse = (entry: KitEntry, code: KitProblem['code'], detail: string): void => {
    if (entry.origin.kind === 'plugin') {
      report({ code, pluginId: entry.origin.pluginId, kitId: entry.id, detail });
      return;
    }
    console.error(`[kits] каталог встроенного кита «${entry.id}» не принят (${code}): ${detail}`);
  };

  /**
   * Принять загруженный каталог: сверить имя, проверить контракт (у кита плагина) и, если кит
   * всё ещё тот же и активен, оповестить.
   *
   * Сверка идентификатора — не церемония: под ним кит уже попал в список и, возможно,
   * в настройки. Каталог, объявляющий другой кит, означал бы, что ключ выбора поменялся после
   * того, как выбор сделан, — молча и необратимо.
   */
  const adopt = async (entry: KitEntry, json: CatalogJson): Promise<void> => {
    const named = json.kit?.id;
    if (named !== undefined && named !== entry.id) {
      refuse(entry, 'mismatch', `каталог называет себя «${named}»`);
      return;
    }
    if (entry.origin.kind === 'plugin') {
      const check = (await validator())(json);
      if (!check.valid) {
        refuse(entry, 'invalid-catalog', check.errors.slice(0, 5).join('; '));
        return;
      }
    }
    // Запись могли снять, пока каталог ехал: плагин выключили — принимать некуда.
    if (entries.get(entry.id) !== entry) return;
    // Каталог без имени получает имя шапки: ключ выбора — объявленный, иначе дескриптор
    // остался бы безымянным.
    entry.loaded = named === undefined ? { ...json, kit: { ...json.kit, id: entry.id } } : json;
    if (entry.id === activeId) notify();
  };

  const load = (entry: KitEntry): Promise<void> => {
    if (entry.loaded !== undefined) return Promise.resolve();
    if (entry.loading !== undefined) return entry.loading;
    const { catalog } = entry.source;
    // Загрузчик зовётся СИНХРОННО (тело до первого `await` идёт в том же такте): «загрузка
    // заведена» обязано стать правдой сразу после вызова, а синхронное исключение загрузчика
    // иначе улетело бы в отрисовку.
    entry.loading = (async (): Promise<void> => {
      await adopt(entry, typeof catalog === 'function' ? await catalog() : catalog);
    })().catch((error: unknown) => {
      // Отказ не роняет оболочку: каталог остаётся пустым — состояние с определённым
      // поведением (палитра пуста, проверка имён отключена).
      refuse(entry, 'load-failed', describe(error));
    });
    return entry.loading;
  };

  /** Каталог записи сейчас: загруженный, иначе шапка. Чтение заводит загрузку — страховка. */
  const catalogOf = (entry: KitEntry): CatalogJson => {
    if (entry.loaded !== undefined) return entry.loaded;
    void load(entry);
    return entry.header;
  };

  const descriptorOf = (json: CatalogJson): KitDescriptor => {
    let descriptor = descriptors.get(json);
    if (descriptor === undefined) {
      descriptor = toDescriptor(json);
      descriptors.set(json, descriptor);
    }
    return descriptor;
  };

  /** Отказы по киту — по одному на источник: состав синхронизируется на каждое изменение точки. */
  const reported = new WeakSet<KitSource>();
  const reportOnce = (source: KitSource, problem: KitProblem): void => {
    if (reported.has(source)) return;
    reported.add(source);
    report(problem);
  };

  const syncContributed = (kits: readonly ContributedKit[]): void => {
    // Кто должен быть в списке: первый по порядку точки под каждым свободным именем.
    const accepted = new Map<string, ContributedKit>();
    for (const kit of kits) {
      const id = declaredKitId(kit.source);
      if (id === undefined) {
        reportOnce(kit.source, { code: 'no-id', pluginId: kit.pluginId });
        continue;
      }
      if (builtinIds.has(id) || accepted.has(id)) {
        reportOnce(kit.source, { code: 'duplicate', pluginId: kit.pluginId, kitId: id });
        continue;
      }
      accepted.set(id, kit);
    }

    let changed = false;
    let activeReplaced = false;
    for (const entry of [...entries.values()]) {
      if (entry.origin.kind !== 'plugin') continue;
      const next = accepted.get(entry.id);
      if (next?.source === entry.source && next.pluginId === entry.origin.pluginId) continue;
      dropEntry(entry);
      changed = true;
      if (entry.id === activeId) activeReplaced = true;
    }
    for (const [id, kit] of accepted) {
      if (entries.has(id)) continue;
      entries.set(id, createEntry(id, kit.source, { kind: 'plugin', pluginId: kit.pluginId }));
      changed = true;
    }
    if (!changed) return;

    summaries = null;
    notifyAll(availableListeners, 'список китов');
    // Выбор человека появился (плагин внёс его кит) — переключиться, НЕ трогая настройку;
    // активный кит ушёл (плагин выключили) — на умолчание, и настройка цела: вернётся плагин —
    // вернётся и выбор.
    const next = resolveActive(activeId);
    if (next !== activeId) setActive(next);
    // Тот же идентификатор, но другой источник: для читателя это смена кита.
    else if (activeReplaced) notify();
    else return;
    void load(activeEntry());
  };

  // Правка настройки мимо службы (панель настроек, второе окно, умолчание организации) — такая
  // же смена кита, как нажатие в переключателе. Без подписки записанное и действующее разъехались бы.
  const subscription = settings?.onDidChange((key) => {
    if (key !== KIT_SETTINGS_KEY) return;
    setActive(stored() ?? defaultId);
  });

  const onDidChange = (cb: () => void): Disposable => {
    listeners.add(cb);
    return {
      dispose(): void {
        listeners.delete(cb);
      },
    };
  };

  const onDidLoadNamespace = (cb: () => void): Disposable => {
    const subscriptions = new Map<KitNamespaceLoader, Disposable>();
    namespaceCallbacks.set(subscriptions, cb);
    for (const entry of entries.values()) {
      if (entry.namespace !== undefined) {
        subscriptions.set(entry.namespace, entry.namespace.onDidLoad(cb));
      }
    }
    namespaceSubscribers.add(subscriptions);
    return {
      dispose(): void {
        for (const one of subscriptions.values()) one.dispose();
        subscriptions.clear();
        namespaceSubscribers.delete(subscriptions);
      },
    };
  };

  const reader = {
    activeId: (): string => activeId,
    activeOrigin: (): KitOrigin => activeEntry().origin,
    catalogJson: (): CatalogJson => catalogOf(activeEntry()),
    descriptor: (): KitDescriptor => descriptorOf(catalogOf(activeEntry())),
    namespace: () => activeEntry().namespace?.get() ?? null,
    onDidChange,
    onDidLoadNamespace,
  };
  // Одна рамка на службу: компонент обязан быть стабилен, иначе смена кита размонтировала бы форму.
  const Frame: ComponentType<KitFrameProps> = createKitFrame(reader);

  return {
    ...reader,
    defaultId,
    Frame,

    available() {
      if (summaries === null) {
        summaries = Object.freeze(
          [...entries.values()].map((entry) =>
            Object.freeze({ ...entry.summary, active: entry.id === activeId })
          )
        );
      }
      return summaries;
    },

    async activate(id) {
      const entry = entries.get(id);
      if (entry === undefined) {
        throw new Error(
          `kits: кит «${id}» не установлен. Выбирать можно только из available(): ` +
            'иначе активным оказался бы кит, каталога которого никто не поставил'
        );
      }
      setActive(id);
      // Загрузка заводится, но НЕ ожидается: промис `activate` относится к записи в настройки,
      // и добавить в него сеть значило бы, что переключатель ждёт каталог.
      void load(entry);
      await settings?.set(KIT_SETTINGS_KEY, id);
    },

    whenReady: () => load(activeEntry()),
    syncContributed,

    onDidChangeAvailable(cb) {
      availableListeners.add(cb);
      return {
        dispose(): void {
          availableListeners.delete(cb);
        },
      };
    },

    dispose() {
      subscription?.dispose();
      listeners.clear();
      availableListeners.clear();
      for (const subscriptions of namespaceSubscribers) {
        for (const one of subscriptions.values()) one.dispose();
      }
      namespaceSubscribers.clear();
    },
  };
}
