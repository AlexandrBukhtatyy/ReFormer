/**
 * Каталог плагинов проекта: что найдено, что включено, что упало.
 *
 * Загрузчик (`./loader`) отвечает на вопрос «что лежит в каталоге и как это превратить
 * в объект плагина», рантайм (`./registry`) — на вопрос «как плагин живёт». Между ними
 * остаётся третий, и он про человека: **какие плагины включены прямо сейчас, и по чьему
 * решению.** Этот модуль — ответ на него.
 *
 * ## Каждый плагин включается явно
 *
 * Найденный в каталоге плагин НЕ запускается сам: он появляется в списке выключенным
 * (plugin-and-shell.md, «Уровень доверия называется явно»). Это единственная граница, которая
 * у нас есть: плагин исполняется в том же realm, где живут дескрипторы файлов и секреты,
 * поэтому решение «пусть этот код работает» обязано быть решением человека. Автоматически
 * поднимается только то, что человек уже включал — и ровно поэтому список включённых
 * сохраняется ({@link EnabledPluginsStore}), а не выводится из содержимого каталога.
 *
 * ## Упавший при активации выключается и показывается
 *
 * Открытый вопрос №2 контракта закрыт так: активация, бросившая исключение, снимает плагин
 * с включённых и оставляет причину в списке. Автоповтора нет — он вернул бы плагин, который
 * роняет запуск снова и снова, а вместе с ним и невозможность открыть проект, чтобы этот
 * плагин выключить. Повторная попытка — действие человека: {@link ProjectPluginCatalog.enable}
 * или {@link ProjectPluginCatalog.reload}.
 *
 * ## Выключение снимает вклады
 *
 * Целиком и без исключений: `deactivate` рантайма освобождает `subscriptions` контекста,
 * то есть панели, команды, вклады и подписки уходят вместе с плагином. Именно поэтому
 * динамические плагины сделали `deactivate` необходимостью, а не удобством для тестов.
 *
 * ## Перезагрузка — команда, а не автоматика
 *
 * Наблюдения за файлами нет (File System Access его не даёт), поэтому цикл разработки
 * в каталоге замыкается вручную: {@link ProjectPluginCatalog.reload} снимает вклады,
 * перечитывает манифест и файлы, поднимает плагин заново. Порядок именно такой — сначала
 * снять, потом читать: он же гарантирует, что после неудачной перезагрузки в системе
 * не останется вкладов от прошлой версии кода.
 *
 * @module host/plugin/catalog
 */

import { toDisposable, type Disposable } from '../primitives/disposable';
import type { DiscoveredPlugin, PluginLoader } from './loader';
import type { PluginManifest, PluginProblem } from './manifest';
import { normalizeChord } from '../primitives/command';
import { compileWhen, WHEN_TRUE } from '../primitives/when-expr';
import type { KeymapService } from '../ui/keymap';
import type { PluginRegistry } from './registry';

/**
 * Состояние строки в списке плагинов.
 *
 * - `disabled` — найден, разобран, выключен. Ровно то, в чём плагин появляется впервые;
 * - `enabled` — работает, вклады на месте;
 * - `failed` — не грузится или упал при активации; причина в `problem`.
 */
export type ProjectPluginState = 'disabled' | 'enabled' | 'failed';

/** Строка списка плагинов — всё, что нужно показать человеку. */
export interface ProjectPluginEntry {
  readonly id: string;
  /** Имя из манифеста; у неразобранного — идентификатор каталога. */
  readonly name: string;
  readonly version?: string;
  readonly state: ProjectPluginState;
  readonly manifest?: PluginManifest;
  /** Почему `failed`. У остальных состояний отсутствует. */
  readonly problem?: PluginProblem;
}

/**
 * Где живёт список включённых плагинов.
 *
 * Отдельный контракт, а не сервис настроек: каталогу нужны две операции, и подстановка
 * памяти в тестах не должна тащить за собой хранилище. Композиция кладёт его в настройки
 * рабочей области — список принадлежит проекту, а не оболочке.
 */
export interface EnabledPluginsStore {
  read(): Promise<readonly string[]>;
  write(ids: readonly string[]): Promise<void>;
}

export interface ProjectPluginCatalogDeps {
  /**
   * Установка таблицы стилей плагина. Возвращает, как её снять, либо описание отказа.
   *
   * ФУНКЦИЕЙ, а не документом, и это выяснилось проверкой: настоящая установка требует
   * `CSSStyleSheet`, которого в окружении `node` не существует вовсе. Передай мы документ —
   * жизненный цикл (поставили на включении, сняли на выключении, заменили на перезагрузке)
   * проверялся бы только в браузере, вместе с разбором CSS. А это разные вещи: разбор
   * проверяется браузерным прогоном, жизненный цикл — здесь.
   *
   * Отсутствие означает «стили не ставим»: плагин работает, просто выглядит как оболочка.
   * Деградация, а не отказ — код плагина важнее его вида.
   */
  readonly installStyles?: (
    css: string,
    pluginId: string
  ) => { ok: true; subscription: Disposable } | { ok: false; problem: PluginProblem };
  /**
   * Раскладка клавиш. Необязательна: без неё манифестные сочетания не публикуются,
   * а всё остальное в каталоге работает как прежде.
   */
  readonly keymap?: Pick<KeymapService, 'registerRules'>;
  readonly loader: PluginLoader;
  /** Тот же рантайм, в котором живут встроенные плагины: контракт у них один. */
  readonly plugins: PluginRegistry;
  /** Без него включённые не переживают перезагрузку вкладки — но каталог работает. */
  readonly enabled?: EnabledPluginsStore;
  /** Куда сообщать об отказе плагина. По умолчанию — `console.error`. */
  readonly onProblem?: (id: string, problem: PluginProblem) => void;
}

export interface ProjectPluginCatalog extends Disposable {
  /** Снимок списка. Порядок — как в каталоге, то есть по имени папки. */
  list(): readonly ProjectPluginEntry[];
  /** Подписка на изменения списка. Форма та же, что у хранилищ оболочки. */
  subscribe(listener: () => void): Disposable;
  /**
   * Перечитывает каталог проекта. Код не исполняется, включённые продолжают работать.
   *
   * Плагин, исчезнувший из каталога, выключается: его файлов больше нет, и оставлять его
   * вклады значило бы иметь панель, за которой ничего не стоит.
   */
  refresh(): Promise<readonly ProjectPluginEntry[]>;
  /** Загружает и активирует плагин. `true` — работает. */
  enable(id: string): Promise<boolean>;
  /** Снимает вклады и убирает плагин из включённых. Для выключенного — ничего не делает. */
  disable(id: string): void;
  /**
   * Снимает вклады, перечитывает манифест и файлы, поднимает заново.
   *
   * Выключенный плагин перезагрузкой не включается — только обновляется его манифест:
   * «перезагрузить» не должно быть вторым способом сказать «включить».
   */
  reload(id: string): Promise<boolean>;
  /**
   * Восстанавливает включённые: читает сохранённый список и поднимает то, что нашлось.
   *
   * Это восьмой шаг запуска. Возвращает идентификаторы тех, кто действительно поднялся, —
   * упавший при активации сюда не попадает и из сохранённого списка вычёркивается.
   */
  restoreEnabled(): Promise<readonly string[]>;
  /**
   * Выключает все работающие плагины, НЕ трогая сохранённый список.
   *
   * Ровно то, что нужно при смене проекта: плагины прежнего каталога обязаны уйти вместе
   * с ним, а память о том, что человек их включал, — остаться.
   */
  deactivateAll(): void;
}

interface CatalogRecord {
  found: DiscoveredPlugin;
  /** Отказ загрузки или активации. Отказ разбора живёт в `found.problem` — он неустраним. */
  problem?: PluginProblem;
}

/** Имя источника манифестных клавиш в раскладке. Одно на каталог: он публикует их разом. */
export const CATALOG_KEYBINDINGS_SOURCE = 'plugin-catalog';

function defaultOnProblem(id: string, problem: PluginProblem): void {
  console.error(`[plugins] «${id}»: ${problem.code} — ${problem.message}`, problem.cause);
}

export function createProjectPluginCatalog(deps: ProjectPluginCatalogDeps): ProjectPluginCatalog {
  const onProblem = deps.onProblem ?? defaultOnProblem;
  const records = new Map<string, CatalogRecord>();
  /** Что человек включил. Это и есть содержимое {@link EnabledPluginsStore}. */
  const enabled = new Set<string>();
  /**
   * Кого этот каталог уже зарегистрировал в рантайме.
   *
   * Отдельный набор, а не поле записи, потому что живёт он ДОЛЬШЕ записи: плагин, исчезнувший
   * из каталога и вернувшийся, в рантайме всё это время оставался зарегистрированным. Поле
   * записи обнулилось бы вместе с ней, и повторное включение пошло бы через `register` —
   * то есть уткнулось бы в «уже зарегистрирован» вместо подмены экземпляра.
   */
  const registered = new Set<string>();
  const listeners = new Set<() => void>();

  const notify = (): void => {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        console.error('[plugins] подписчик списка плагинов упал', error);
      }
    }
  };

  const persist = (): void => {
    if (deps.enabled === undefined) return;
    // Запись не ждём: список плагинов уже изменился, и держать интерфейс ради подтверждения
    // хранилища не за что. Отказ записи сообщаем — тихо потерянный выбор человека хуже.
    void deps.enabled.write([...enabled]).catch((error: unknown) => {
      console.error('[plugins] список включённых плагинов не сохранён', error);
    });
  };

  const entryOf = (record: CatalogRecord): ProjectPluginEntry => {
    const problem = record.found.problem ?? record.problem;
    const manifest = record.found.manifest;
    const state: ProjectPluginState =
      problem !== undefined ? 'failed' : enabled.has(record.found.id) ? 'enabled' : 'disabled';
    return {
      id: record.found.id,
      name: manifest?.name ?? record.found.id,
      version: manifest?.version,
      state,
      manifest,
      problem,
    };
  };

  const report = (id: string, problem: PluginProblem): void => {
    try {
      onProblem(id, problem);
    } catch {
      /* отказ канала диагностики не должен превращаться в отказ каталога */
    }
  };

  /** Снимает вклады, если плагин действительно зарегистрирован в рантайме. */
  /**
   * Установленные таблицы стилей: идентификатор плагина → как её снять.
   *
   * Карта, а не список: перезагрузка плагина обязана снять ПРЕЖНЮЮ таблицу, иначе после
   * нескольких перезагрузок на странице лежало бы несколько её поколений, и побеждало бы
   * последнее по порядку, а не последнее по времени.
   */
  const styles = new Map<string, Disposable>();

  const uninstallStyles = (id: string): void => {
    styles.get(id)?.dispose();
    styles.delete(id);
  };

  const installStyles = (id: string, sheet?: { readonly css: string }): void => {
    uninstallStyles(id);
    if (sheet === undefined || deps.installStyles === undefined) return;
    const result = deps.installStyles(sheet.css, id);
    if (result.ok) {
      styles.set(id, result.subscription);
      return;
    }
    // Отказ уже несёт готовую проблему с кодом — свою не выдумываем, иначе тот же случай
    // назывался бы двумя разными кодами в зависимости от того, кто его заметил.
    report(id, result.problem);
  };

  const deactivate = (id: string): void => {
    uninstallStyles(id);
    if (registered.has(id)) deps.plugins.deactivate(id);
  };

  /** Подписка на манифестные клавиши: одна на весь каталог, замещается целиком. */
  let keybindingsSubscription: Disposable | null = null;

  const rediscover = async (): Promise<void> => {
    const found = await deps.loader.discover();
    const seen = new Set<string>();

    for (const item of found) {
      seen.add(item.id);
      const previous = records.get(item.id);
      if (previous === undefined) {
        records.set(item.id, { found: item });
      } else {
        previous.found = item;
      }
    }

    for (const id of [...records.keys()]) {
      if (seen.has(id)) continue;
      // Каталога больше нет: снимаем вклады, но включённость помним — плагин может вернуться
      // вместе с проектом, и заново включать его руками человеку незачем.
      deactivate(id);
      records.delete(id);
    }

    publishKeybindings();
  };

  /**
   * Публикует клавиши, объявленные манифестами, — на ОБНАРУЖЕНИИ, а не на включении.
   *
   * Это и есть смысл декларации: сочетание видно в таблице клавиш и переназначаемо до того,
   * как плагин включён. Публикуй мы их при активации — человек узнавал бы о занятой клавише
   * ровно в тот момент, когда она перестала делать привычное.
   *
   * Правило, ссылающееся на команду выключенного плагина, просто не срабатывает: диспетчер
   * пропускает кандидата, у которого нет команды в реестре.
   */
  function publishKeybindings(): void {
    if (deps.keymap === undefined) return;

    const declared = [...records.values()].flatMap((record) => {
      const keybindings = record.found.manifest?.contributes?.keybindings ?? [];
      return keybindings.map((item) => ({ pluginId: record.found.id, item }));
    });

    keybindingsSubscription?.dispose();
    keybindingsSubscription =
      declared.length === 0
        ? null
        : deps.keymap.registerRules(
            CATALOG_KEYBINDINGS_SOURCE,
            'catalog-plugin',
            declared.flatMap(({ pluginId, item }) => {
              // Манифест уже проверен разбором: сюда попадает только разбираемое сочетание
              // и разбираемое условие. Отказ здесь означал бы, что проверка разошлась
              // с применением, поэтому запись просто пропускается.
              try {
                return [
                  {
                    chord: normalizeChord(item.key),
                    commandId: item.command,
                    when: item.when === undefined ? WHEN_TRUE : compileWhen(item.when),
                    ...(item.args === undefined ? {} : { args: item.args }),
                    ...(item.allowInEditable === undefined
                      ? {}
                      : { allowInEditable: item.allowInEditable }),
                    pluginId,
                  },
                ];
              } catch {
                return [];
              }
            })
          );
  }

  const enablePlugin = async (id: string): Promise<boolean> => {
    const record = records.get(id);
    if (record === undefined) return false;
    if (record.found.problem !== undefined) {
      // Манифеста нет или он чужой мажор — грузить нечего, и это не изменится до `refresh`.
      report(id, record.found.problem);
      return false;
    }
    if (deps.plugins.isActive(id) && registered.has(id)) {
      enabled.add(id);
      return true;
    }

    const result = await deps.loader.load(record.found);
    if (!result.ok) {
      record.problem = result.problem;
      enabled.delete(id);
      persist();
      report(id, result.problem);
      notify();
      return false;
    }

    if (!registered.has(id)) {
      // Занятый идентификатор — почти всегда столкновение со встроенным плагином. Регистрация
      // бросила бы, а нам нужна строка в списке с внятной причиной, а не отказ включения.
      if (deps.plugins.status(id) !== undefined) {
        const problem: PluginProblem = {
          code: 'id-taken',
          message:
            `идентификатор «${id}» уже занят другим плагином оболочки. ` +
            'Переименуйте каталог и поле «id» в манифесте',
        };
        record.problem = problem;
        enabled.delete(id);
        persist();
        report(id, problem);
        notify();
        return false;
      }
      deps.plugins.register(result.loaded.plugin);
      registered.add(id);
      deps.plugins.activate(id);
    } else {
      // Уже зарегистрирован — значит это повторное включение или перезагрузка: подменяем
      // экземпляр под тем же идентификатором, для чего `reload` и существует.
      deps.plugins.reload(id, result.loaded.plugin);
    }

    const status = deps.plugins.status(id);
    if (status?.state !== 'active') {
      const failure = status?.failure;
      const problem: PluginProblem = {
        code: 'activate-failed',
        message: failure?.message ?? 'плагин не активировался',
        cause: failure?.error,
      };
      record.problem = problem;
      // Выключается и показывается: автоповтора при следующем запуске не будет.
      enabled.delete(id);
      persist();
      report(id, problem);
      notify();
      return false;
    }

    // Стили ставятся ПОСЛЕ активации: упавший при активации плагин своих таблиц
    // на странице не оставляет. Отказ разбора CSS плагин не роняет — он записывается
    // в отчёт и виден человеком, а сам плагин продолжает работать без оформления.
    installStyles(id, result.loaded.styles);

    record.problem = undefined;
    enabled.add(id);
    persist();
    notify();
    return true;
  };

  const disablePlugin = (id: string): void => {
    const record = records.get(id);
    if (record === undefined) return;
    deactivate(id);
    // Отказ загрузки снимается вместе с выключением: он был про попытку включить, а её больше
    // нет. Отказ разбора (`found.problem`) остаётся — он про сам каталог.
    record.problem = undefined;
    const wasEnabled = enabled.delete(id);
    if (wasEnabled) persist();
    notify();
  };

  return {
    list(): readonly ProjectPluginEntry[] {
      return [...records.values()].map(entryOf);
    },

    subscribe(listener: () => void): Disposable {
      listeners.add(listener);
      return toDisposable(() => listeners.delete(listener));
    },

    async refresh(): Promise<readonly ProjectPluginEntry[]> {
      await rediscover();
      notify();
      return [...records.values()].map(entryOf);
    },

    enable: enablePlugin,
    disable: disablePlugin,

    async reload(id: string): Promise<boolean> {
      const record = records.get(id);
      if (record === undefined) return false;

      const wasEnabled = enabled.has(id);
      // Сначала снять вклады, потом читать: иначе неудачная перезагрузка оставила бы
      // в системе панели и команды кода, которого уже нет на диске.
      deactivate(id);
      record.problem = undefined;
      await rediscover();
      if (records.get(id) === undefined) {
        notify();
        return false;
      }
      if (!wasEnabled) {
        notify();
        return true;
      }
      return enablePlugin(id);
    },

    async restoreEnabled(): Promise<readonly string[]> {
      if (deps.enabled !== undefined) {
        try {
          // Читаем КАЖДЫЙ раз и берём хранилище за истину, а не дополняем им память.
          // Восстановление зовётся ещё и при смене проекта, а список включённых принадлежит
          // проекту: перенести в новый каталог выбор, сделанный в прежнем, было бы способом
          // включить чужой код без спроса. Гонки с записью тут нет — она идёт через тот же
          // список, и её значение видно сразу, не дожидаясь подтверждения хранилища.
          const stored = new Set(await deps.enabled.read());
          // Тот, кого в списке больше нет, обязан и работать перестать: иначе строка
          // сказала бы «выключен», а вклады остались бы на месте.
          for (const id of enabled) if (!stored.has(id)) deactivate(id);
          enabled.clear();
          for (const id of stored) enabled.add(id);
        } catch (error) {
          console.error('[plugins] список включённых плагинов не прочитан', error);
        }
      }

      const started: string[] = [];
      // Порядок обхода — по каталогу, а не по сохранённому списку: он ничего не значит,
      // как и порядок активации вообще (см. `./registry`).
      for (const id of [...records.keys()]) {
        if (!enabled.has(id)) continue;
        if (await enablePlugin(id)) started.push(id);
      }
      notify();
      return started;
    },

    deactivateAll(): void {
      for (const id of records.keys()) deactivate(id);
      notify();
    },

    dispose(): void {
      for (const id of records.keys()) deactivate(id);
      // Клавиши манифестов уходят вместе с каталогом: правило, ссылающееся на плагин
      // закрытого проекта, показывалось бы в таблице как действующее.
      keybindingsSubscription?.dispose();
      keybindingsSubscription = null;
      records.clear();
      listeners.clear();
    },
  };
}
