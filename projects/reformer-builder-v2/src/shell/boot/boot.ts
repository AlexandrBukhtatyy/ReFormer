/**
 * Композиция приложения: какие сервисы, какие реестры, какие плагины, чем открывается проект.
 *
 * Единственный слой, которому можно всё. Host не знает, из чего он собран, плагины не знают
 * друг о друге, а решения «настройки лежат в IndexedDB, источники бывают такие-то, список
 * плагинов вот такой» принимаются здесь и только здесь.
 *
 * ## Последовательность запуска
 *
 * Порядок взят из plugin-and-shell.md, «Последовательность запуска», и он несущий:
 *
 * ```text
 * 1. сервисы Host          синхронно, без сети и без источника
 * 2. настройки и словари   асинхронно — это и есть `ready`
 * 3. плагины активируются  синхронно, набор вкладов после этого полон
 * 4. оболочка рисуется     по определённому состоянию, а не по тому, что успело встать
 * 5. рабочая область       восстанавливается ПОСЛЕ отрисовки — это `restore`
 * 6. плагины каталога      после источника: их файлы лежат в открытом проекте
 * ```
 *
 * Шаг 6 — восьмой шаг контракта, и он отделён от шага 3 не по стилю, а по необходимости:
 * плагины каталога физически лежат в проекте, поэтому до появления источника их прочитать
 * неоткуда. Следствие принимается сознательно: **оболочка успевает отрисоваться раньше, чем
 * появятся их вклады** — так же, как при включении плагина руками.
 *
 * Шаги 2 и 3 стоят до отрисовки не ради красоты. Раскладка читается из настроек **один раз**
 * при монтировании (`defaultLayout` библиотеки панелей), поэтому отрисовка до загрузки
 * настроек означала бы, что сохранённые ширины не применяются никогда. А `t()` до загрузки
 * словаря отдаёт маркер промаха — по замыслу i18n, и показывать его пользователю не за что.
 *
 * Шаг 5 стоит ПОСЛЕ отрисовки по обратной причине: он ждёт IndexedDB и, возможно, разрешения
 * на каталог, и держать ради этого белый экран нельзя. «Проект не открыт» — нормальное
 * состояние интерфейса, а не отсутствие интерфейса.
 *
 * ## Кто кого держит
 *
 * ```text
 * boot ──┬── сервисы Host           settings, i18n, theme, notifications, diagnostics
 *        ├── реестр источников      + фабрика `fs` над хранилищем хэндлов
 *        ├── держатель проекта      сессия: рабочая область, дерево, вкладки, статус
 *        ├── оркестратор валидации  общий на приложение, наблюдает открытые документы
 *        ├── рантайм плагинов       files (панель, редактор, команды), validator-schema
 *        └── каталог плагинов       `.ui_builder/plugins/` открытого проекта: список,
 *                                   включение, выключение, перезагрузка
 * ```
 *
 * @module shell/boot/boot
 */

import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import {
  createProjectPluginCatalog,
  type EnabledPluginsStore,
  type ProjectPluginCatalog,
} from '@/shell/platform/plugin/catalog';
import { createPluginDevWatch } from '@/shell/platform/plugin/dev-watch';
import { createPluginLoader } from '@/shell/platform/plugin/loader';
import {
  mergeRuntimeConfig,
  readProjectRuntimeConfig,
  type ParsedRuntimeConfig,
  type RuntimeConfig,
} from './runtime-config';
import { createPluginRegistry, type PluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import {
  createDiagnosticsService,
  DiagnosticsServiceToken,
} from '@/shell/platform/services/diagnostics/service';
import { createSelectionService, SelectionServiceToken } from '@/shell/platform/services/selection';
import { createFsSourceFactory } from '@/shell/platform/source/fs-access';
import { createSourceRegistry } from '@/shell/platform/source/registry';
import type { Source } from '@/shell/platform/source/types';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { createPromptService, PromptServiceToken } from '@/shell/platform/services/prompt';
import {
  createResourceClipboardService,
  ResourceClipboardServiceToken,
} from '@/shell/platform/services/resource-clipboard';
import {
  createNotificationsService,
  NotificationsServiceToken,
  type NotificationsService,
} from '@/shell/platform/services/notifications';
import { createIdbSettingsBackend } from '@/shell/platform/services/settings-idb';
import {
  createSettingsService,
  SettingsServiceToken,
  type SettingsService,
} from '@/shell/platform/services/settings';
import {
  createBrowserSystemTheme,
  createThemeService,
  ThemeServiceToken,
} from '@/shell/platform/services/theme';
import { dockSettingsKey } from '@/shell/platform/ui/chrome/layout-settings';
import type { ShellHost } from '@/shell/platform/ui/Shell';
import { createValidationOrchestrator } from '@/shell/platform/services/validation/orchestrator';
import {
  ContextKeyServiceToken,
  createContextKeyService,
} from '@/shell/platform/services/context-keys';
import { createChordState } from '@/shell/platform/ui/keyboard/chords';
import { createKeymapService, KeymapServiceToken } from '@/shell/platform/ui/keyboard/keymap';
import { createScopeStack, ScopeStackServiceToken } from '@/shell/platform/ui/keyboard/scope';
import { createWhenContextStore } from '@/shell/platform/ui/state/when-context-store';
import {
  createWorkspaceMetaStore,
  WORKSPACE_DB_NAME,
} from '@/shell/platform/workspace/storage/idb';
import {
  browserPurgeEnvironment,
  purgeOriginStorage,
} from '@/shell/platform/workspace/storage/purge';
import { createJournalRelief } from '@/shell/platform/workspace/journal/journal';
import type { Journal } from '@/shell/platform/workspace/journal/journal';
import { FILES_MESSAGES } from '@/plugins/files';
import { FILES_PLUGIN_ID } from '@/plugins/files';
import { createFilesHost } from '@/shell/boot/ports/files';
import { createMarkdownHost } from '@/shell/boot/ports/markdown';
import { createMonacoHost } from '@/shell/boot/ports/monaco';
import { createSchemaHost } from '@/shell/boot/ports/schema';
import { createAiHost } from '@/shell/boot/ports/ai';
import { attachPreviewLifecycle, createPreviewHost } from '@/shell/boot/ports/preview';
import { createLiveSurfacePort } from '@/shell/boot/ports/live-surface';
import { createCodegenHost } from '@/shell/boot/ports/codegen';
import { createTemplatesHost } from '@/shell/boot/ports/templates';
import { attachFocusChecks } from '@/shell/platform/workspace/merge/divergence';
import { installPluginStyles } from '@/shell/platform/plugin/styles';
import {
  toDisposable,
  type Disposable as HostDisposable,
} from '@/shell/platform/primitives/disposable';
import { createPreviewSessions } from '@/plugins/preview';
import {
  createFocusRegistry,
  createViewStateRegistry,
  monacoEditorContribution,
} from '@/plugins/editor-monaco';
import { KitsServiceToken } from '@/plugins/kits';
import type { CatalogEntry } from '@/lib/catalog/types';
import { createDirectoryHandleStore, HANDLES_DB_NAME } from '@/shell/platform/source/fs-handles';
import { createCompileCache, type CompileCache } from '@/shell/platform/modules/compile-cache';
import {
  TYPESCRIPT_ENGINE_VERSION,
  TYPESCRIPT_OPTIONS_SIGNATURE,
  TYPESCRIPT_TRANSPILER_ID,
} from '@/shell/platform/plugin/typescript-transpiler';
import { createBuildCacheStore } from '@/shell/platform/workspace/storage/build-cache';
import { createPluginModules } from './plugin-modules';
import { createEagerBuiltinPlugins, loadLazyBuiltinPlugins } from './plugins';
import { CatalogPluginSettingsPoint } from '@/shell/platform/ui/contributions/plugin-settings';
import { createPluginSettings } from '@/shell/platform/services/plugin-settings';
import { asFormSchema } from './settings/schema-guard';
import type { BuiltinPluginsOptions } from './plugins';
import {
  createProjectHost,
  type ProjectFailure,
  type ProjectHost,
} from '@/shell/boot/project/project';
import { createProjectStatusSource } from '@/shell/boot/project/project-status';
import { createSettingsSections, LOCALE_SETTINGS_KEY } from './settings-sections';

/** Ключ настройки локали. Объявлен рядом с полем, которое его пишет. */
export { LOCALE_SETTINGS_KEY } from './settings-sections';

/**
 * Ключ списка включённых плагинов каталога. Область — `workspace`: плагины лежат В ПРОЕКТЕ,
 * и «какие из них включены» принадлежит проекту, а не оболочке.
 */
export const ENABLED_PLUGINS_SETTINGS_KEY = 'workspace.plugins.enabled';

/** Локаль, на которой инструмент открывается, пока не выбрано иное. */
const DEFAULT_LOCALE = 'ru';

/**
 * Потолок кэша транспиляции на рабочую область.
 *
 * Транспилированный сайдкар — единицы килобайт, форма целиком — десятки, поэтому 16 МБ хватает
 * на сотни форм со всей их историей правок. Величина выбрана с запасом намеренно: кэш вытесняется
 * браузером и без нас, а слишком тесный бюджет означал бы уборку, выбрасывающую то, что вот-вот
 * понадобится снова.
 */
const BUILD_CACHE_BUDGET_BYTES = 16 * 1024 * 1024;

/** Пустой каталог: одна замороженная ссылка вместо нового массива на каждый вызов. */
const EMPTY_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/**
 * Список включённых плагинов поверх настроек.
 *
 * Значение валидируется на чтении: в настройках лежит то, что туда положили прошлые версии
 * приложения, а тут из него получается список кода, который будет исполнен. Мусор трактуется
 * как «ничего не включено» — это то же правило, по которому испорченная запись настроек
 * не мешает инструменту открыться.
 */
export function createSettingsEnabledPlugins(settings: SettingsService): EnabledPluginsStore {
  return createSettingsPluginSet(settings, ENABLED_PLUGINS_SETTINGS_KEY);
}

/**
 * Ключ пометок «в разработке». Область та же, что у включённых, и по той же причине:
 * наблюдаемый плагин лежит в проекте, и намерение работать над ним принадлежит проекту.
 */
export const DEV_PLUGINS_SETTINGS_KEY = 'workspace.plugins.dev';

/** Пометки «в разработке» поверх настроек — контракт хранилища у обоих списков один. */
export function createSettingsDevPlugins(settings: SettingsService): EnabledPluginsStore {
  return createSettingsPluginSet(settings, DEV_PLUGINS_SETTINGS_KEY);
}

function createSettingsPluginSet(settings: SettingsService, key: string): EnabledPluginsStore {
  return {
    read(): Promise<readonly string[]> {
      const raw = settings.get<unknown>(key);
      if (!Array.isArray(raw)) return Promise.resolve([]);
      return Promise.resolve(raw.filter((id): id is string => typeof id === 'string'));
    },
    write(ids: readonly string[]): Promise<void> {
      return settings.set(key, [...ids], 'workspace');
    },
  };
}

/**
 * Что сказать человеку о неудаче открытия проекта.
 *
 * Отмена выбора — не событие вовсе: человек передумал, и уведомление об этом было бы
 * сообщением о его собственном действии. Остальные три различаются причиной, и склеивать
 * их в одно «не удалось» значит отнимать у человека единственную подсказку, что делать.
 */
/**
 * Ключ сообщения об отказе открытия.
 *
 * Принимает отказ ЦЕЛИКОМ, а не только его вид: у недоступного источника есть причина,
 * и она решает, какую кнопку показать. «Источника больше нет» требует выбрать проект
 * заново, «доступ не дан» — одного нажатия «разрешить». Показывать их одинаково значит
 * посылать человека делать лишнюю работу в половине случаев.
 *
 * Причина отдельным полем, а не вторым видом отказа: вид отвечает «что случилось
 * с открытием» и выбирает уровень уведомления, причина — «что делать». Разложи мы второе
 * по первому, каждый, кому нужен только уровень, был бы обязан перечислять причины.
 */
export function projectFailureMessageKey(failure: ProjectFailure): string | null {
  switch (failure.kind) {
    case 'cancelled':
      return null;
    case 'unsupported':
      return 'files.notify.unsupported';
    case 'unavailable':
      return failure.reason === undefined
        ? 'files.notify.unavailable'
        : `files.notify.unavailable.${failure.reason}`;
    case 'failed':
      return 'files.notify.failed';
  }
}

/** Показывает отказ открытия проекта и не более того. */
function reportProjectFailure(notifications: NotificationsService, failure: ProjectFailure): void {
  const messageKey = projectFailureMessageKey(failure);
  if (messageKey === null) return;
  if (failure.kind === 'failed') console.error('[boot] проект не открыт', failure.error);
  if (failure.kind === 'unavailable') notifications.info(messageKey);
  else if (failure.kind === 'unsupported') notifications.warning(messageKey);
  else notifications.error(messageKey);
}

/**
 * Собранное приложение.
 *
 * Расширяет {@link ShellHost}: оболочке нужна часть этого, и она получает именно её — чтобы
 * «оболочка дотягивается до рантайма плагинов» было невыразимо, а не запрещено правилом.
 */
export interface BuilderApp extends ShellHost {
  readonly plugins: PluginRegistry;
  /**
   * Плагины из каталога открытого проекта: список, включение, выключение, перезагрузка.
   *
   * Отдельно от {@link plugins} потому, что вопросы разные: рантайм отвечает «как плагин
   * живёт», каталог — «какие плагины лежат в проекте и какие из них человек включил».
   */
  readonly projectPlugins: ProjectPluginCatalog;
  /** Открытый проект. Оболочка берёт отсюда вкладки, а панель проекта — дерево. */
  readonly project: ProjectHost;
  /**
   * Шаги 2–3 запуска: настройки загружены, словари загружены, плагины активированы.
   *
   * Отказ сюда не пробрасывается — он уже сообщён в консоль: инструмент обязан открыться
   * и с недогруженными настройками, иначе испорченная запись в хранилище означала бы
   * белый экран без единого способа её починить.
   */
  readonly ready: Promise<void>;
  /**
   * Шаг 5: восстановление последнего проекта. Зовётся ПОСЛЕ отрисовки.
   *
   * Отказ не пробрасывается по той же причине, что и у `ready`: не открывшийся проект —
   * это состояние интерфейса, а не сбой запуска.
   */
  restore(): Promise<void>;
  /** Освобождает всё, что держит приложение. Нужен тестам и переинициализации. */
  dispose(): void;
}

/**
 * Создаёт приложение. Вызывается один раз из `main.tsx`.
 *
 * Синхронна: всё, что требует ожидания, живёт в {@link BuilderApp.ready} и
 * {@link BuilderApp.restore}. Это то же правило, по которому синхронен `activate` плагина, —
 * набор вкладов и состав сервисов не должны зависеть от того, что успело загрузиться.
 */
export interface BootOptions {
  /**
   * Конфиг уровня запуска от лаунчера, уже разобранный ({@link fetchRuntimeConfig} в main).
   * `null`/отсутствие — лаунчера нет (vite dev, чужой сервер): работа на вшитых дефолтах.
   */
  readonly runtime?: ParsedRuntimeConfig | null;
}

export function boot(options: BootOptions = {}): BuilderApp {
  /** Конфиг уровня запуска. Проектный уровень читается позже, на каждое открытие проекта. */
  const launchConfig: RuntimeConfig = options.runtime?.config ?? {};
  /** Титул до конфига — то, что написано в index.html; к нему возвращаемся без конфига. */
  const builtinTitle = typeof document === 'undefined' ? '' : document.title;
  const applyTitle = (config: RuntimeConfig): void => {
    if (typeof document === 'undefined') return;
    document.title = config.branding?.title ?? builtinTitle;
  };
  applyTitle(launchConfig);

  // 1. Примитивы и сервисы. Порядок здесь значит только одно: у службы темы в зависимостях
  //    настройки, поэтому настройки создаются раньше.
  const services = createServiceRegistry();
  const extensions = createExtensionRegistry();
  const events = createEventBus();
  const whenContext = createWhenContextStore();
  const commands = createCommandRegistry({ getContext: () => whenContext.get() });
  // Читатель условий `when`. Пять полей контекста остаются единственной истиной — служба
  // их не копирует, а делегирует стору; своё у неё только то, что объявили плагины.
  // Стек областей: какое окно сейчас сверху. Читается условиями как ключи scope и scopes.
  const scopes = createScopeStack();
  // Ожидание второй ступени аккорда — одно на приложение: строка состояния и диспетчер
  // обязаны видеть одно и то же ожидание.
  const chords = createChordState();
  services.register(ScopeStackServiceToken, scopes);
  const contextKeys = createContextKeyService({ whenContext, scopes });
  services.register(ContextKeyServiceToken, contextKeys);

  // Метаданные рабочих областей подняты СЮДА, выше настроек: это одно соединение на всё
  // приложение (см. шаг 3), а хранилище настроек живёт над ним — область `user` отдельной
  // записью, область `workspace` полем открытого проекта. Второе соединение ради настроек
  // означало бы вторую базу с той же историей жизни.
  /**
   * Журналы рабочих областей: идентификатор области → её журнал.
   *
   * Карта, а не поле, по причине из контракта журнала: разгрузка при нехватке места
   * задаётся хранилищу МЕТАДАННЫХ, а журналу это самое хранилище и нужно. Передать готовый
   * журнал в его настройки нельзя — яйцо и курица. Отложенный поиск разрывает цикл
   * и заодно обслуживает несколько областей над одним хранилищем.
   */
  const journals = new Map<string, Journal>();
  const meta = createWorkspaceMetaStore({
    onQuotaPressure: createJournalRelief((id) => journals.get(id)),
  });
  const settingsStore = createIdbSettingsBackend(meta);
  const settings = createSettingsService(settingsStore);
  const i18n = createI18nService();
  const theme = createThemeService({
    settings,
    system: createBrowserSystemTheme(),
    root: typeof document === 'undefined' ? null : document.documentElement,
    // Дефолт из конфига запуска. Именно здесь, а не позже: умолчание объявляется один раз.
    defaultPreference: launchConfig.defaults?.theme,
  });
  const notifications = createNotificationsService();
  const diagnostics = createDiagnosticsService();
  // Выделение — состояние, а не событие: панель превью и редактор схемы монтируются
  // в произвольном порядке, и пришедший позже обязан прочитать текущее, а не ждать
  // следующего щелчка.
  const selection = createSelectionService();
  // Запросы к человеку и буфер записей дерева. Обе службы платформенные и обе нужны
  // не только файлам: шаблон формы точно так же спросит имя, а вклад чужого плагина
  // точно так же положит в буфер свои записи.
  const prompt = createPromptService();
  const clipboard = createResourceClipboardService();

  services.register(SettingsServiceToken, settings);
  services.register(ThemeServiceToken, theme);
  services.register(NotificationsServiceToken, notifications);
  services.register(DiagnosticsServiceToken, diagnostics);
  services.register(SelectionServiceToken, selection);
  services.register(PromptServiceToken, prompt);
  services.register(ResourceClipboardServiceToken, clipboard);

  // Умолчания настроек оболочки. Объявляет их тот, кто настройку вносит, — иначе каждый
  // потребитель дописывал бы свой `?? true`, и они бы разъехались. Локаль может задать
  // конфиг запуска; выбор человека в настройках всё равно сильнее умолчания.
  settings.registerDefault(LOCALE_SETTINGS_KEY, launchConfig.defaults?.locale ?? DEFAULT_LOCALE);
  settings.registerDefault(dockSettingsKey('panel.left', 'open'), true);
  // Правый док при первом запуске закрыт. Открытым он показывает ассистента — первую свою
  // панель без условия видимости, — то есть встречает человека формой ключа API, за которой
  // он не приходил; инспектор рядом до выделения тоже пуст. Рейл справа остаётся на месте,
  // поэтому вернуть панель — один щелчок, и с этого щелчка выбор живёт в настройках.
  settings.registerDefault(dockSettingsKey('panel.right', 'open'), 'hidden');

  // 2. Источники. Вид `fs` заводит композиция, а не плагин: реестра источников в
  //    `PluginContext` нет, и до появления плагинов источников это единственное место,
  //    где вид может быть объявлен. Хэндлы каталогов живут в своей базе — см. `./fs-handles`.
  const handles = createDirectoryHandleStore();
  const sources = createSourceRegistry();
  sources.register(createFsSourceFactory(handles));

  // 3. Рабочая область. Метаданные общие на приложение: рабочих областей может быть много,
  //    а база у них одна, и открывать её на каждую было бы четырьмя соединениями вместо одного.
  //    Само хранилище создано выше — его же делят настройки.
  const validation = createValidationOrchestrator({ extensions, diagnostics });
  // Реестр фокуса Monaco создаётся ЗДЕСЬ, потому что читателей у него двое: сам редактор
  // («перерисовывать ли буфер прямо сейчас») и надстройка модели над открываемым документом
  // (`attachDocumentModel({ isTextEditorFocused })`). Два реестра означали бы, что ход
  // ассистента затирает набранное на полуслове, поэтому объект обязан быть одним — и он
  // уходит и в сессию, и в плагин.
  const monacoFocus = createFocusRegistry();
  // Снимки вида создаются здесь, а не внутри плагина: их делит с ним предпросмотр markdown,
  // и два реестра означали бы потерю позиции курсора при каждом переключении режима.
  const monacoViewStates = createViewStateRegistry();
  const project = createProjectHost({
    journals,
    sources,
    handles,
    meta,
    whenContext,
    // Провайдеры модели документа живут в реестре вкладов: без него сессия открывала бы
    // всё текстом, а структурный редактор не получил бы ни модели, ни истории.
    extensions,
    isTextEditorFocused: (id) => monacoFocus.isFocused(id),
    events,
    diagnostics,
    validation,
    onFailure: (failure) => {
      reportProjectFailure(notifications, failure);
    },
  });
  // Строка состояния получает ОДИН источник на всё время жизни приложения: смена проекта
  // для неё — смена содержимого, а не смена источника.
  const status = createProjectStatusSource(project);

  const plugins = createPluginRegistry({
    services,
    extensions,
    commands,
    events,
    // Память сессии: постоянное хранилище плагинов — часть рабочей области (Э2), и до неё
    // плагину лучше не иметь хранилища вовсе, чем иметь исчезающее незаметно.
    storage: createMemoryStorageBackend(),
  });
  // Каталог активного кита читается ЛЕНИВО из сервиса: сервис появляется при активации
  // плагина китов, а список плагинов собирается до неё. Захвати мы каталог значением —
  // получили бы снимок пустого, и палитра осталась бы пустой навсегда.
  const activeCatalog = (): readonly CatalogEntry[] =>
    services.get(KitsServiceToken)?.catalog() ?? EMPTY_CATALOG;

  /**
   * Кэш транспиляции текущей рабочей области.
   *
   * Функция, а не значение: модули живут дольше проекта и переживают его смену, а кэш
   * принадлежит области — захватив его в замыкание, после смены проекта мы писали бы
   * транспиляцию в каталог прежнего. Запоминается ровно один, чтобы не строить хранилище
   * на каждую компиляцию; при смене области он заменяется, а прежний уходит вместе с ней.
   *
   * Уборка запускается один раз на область и в фоне: она обходит дерево кэша, а держать
   * из-за этого открытие проекта незачем — промах кэша не ошибка.
   */
  let compileCache: { readonly workspaceId: string; readonly cache: CompileCache } | null = null;
  const buildCacheOf = (): CompileCache | null => {
    const workspaceId = project.get()?.workspaceId ?? null;
    if (workspaceId === null) return null;
    if (compileCache?.workspaceId !== workspaceId) {
      const store = createBuildCacheStore(workspaceId);
      compileCache = {
        workspaceId,
        cache: createCompileCache(store, {
          engineId: TYPESCRIPT_TRANSPILER_ID,
          engineVersion: TYPESCRIPT_ENGINE_VERSION,
          optionsVersion: TYPESCRIPT_OPTIONS_SIGNATURE,
        }),
      };
      void store.sweep(BUILD_CACHE_BUDGET_BYTES).catch((error: unknown) => {
        console.warn('[boot] уборка кэша сборки не прошла', error);
      });
    }
    return compileCache.cache;
  };

  // Реестр модулей поднят СЮДА, выше регистрации плагинов: движок нужен двоим — загрузчику
  // плагинов каталога (шаг 3а) и компилирующей поверхности превью, которая собирается прямо
  // здесь. Второй экземпляр означал бы второй чанк TypeScript на 3.5 МБ.
  const pluginModules = createPluginModules({ cache: buildCacheOf });

  // 3a. Плагины каталога проекта. Реестр модулей с настоящим `@builder/sdk` собирает
  //     композиция — только она вправе занять защищённые слоты (см. `./plugin-modules`).
  //     Сам каталог здесь только СОЗДАЁТСЯ: читать его до открытия проекта неоткуда,
  //     поэтому обход каталога — шаг 8, ниже. Стоит он ВЫШЕ встроенных плагинов, потому
  //     что один из них — управление плагинами — получает каталог своим портом.
  const projectPlugins = createProjectPluginCatalog({
    // Раскладка объявлена НИЖЕ: её слой зависит от состава каталога, а состав каталога —
    // от неё нет. Ссылка через замыкание, потому что каталог зовёт публикацию только
    // на обходе проекта (шаг 8), то есть заведомо позже сборки композиции.
    keymap: {
      registerRules: (source, layer, rules) => keymap.registerRules(source, layer, rules),
    },
    // Настоящую установку подставляет композиция: она требует `CSSStyleSheet`, которого
    // в окружении тестов нет, а каталог обязан оставаться проверяемым.
    installStyles: (css, pluginId) => installPluginStyles(css, pluginId, document),
    loader: createPluginLoader({
      source: () => project.get()?.source ?? null,
      modules: pluginModules.modules,
      prepare: pluginModules.prepare,
    }),
    plugins,
    enabled: createSettingsEnabledPlugins(settings),
    dev: createSettingsDevPlugins(settings),
    // Отказ плагина — событие для человека, а не для консоли: тост говорит, ЧТО сломалось,
    // подробности (код, файл) остаются в списке плагинов и в консоли.
    onProblem: (id, problem) => {
      console.error(`[plugins] «${id}»: ${problem.code} — ${problem.message}`, problem.cause);
      notifications.error('plugins.problem', { params: { id, message: problem.message } });
    },
  });

  // Один порт Monaco на двоих: сам редактор и предпросмотр markdown, который одалживает
  // его тело для режима «рядом».
  const monacoHost = createMonacoHost({ project, i18n, diagnostics });
  /**
   * Тело редактора кода как компонент.
   *
   * Берётся ОДИН раз, и это не оптимизация: React сравнивает тип элемента по ссылке, поэтому
   * новая функция на каждой отрисовке — это размонтирование Monaco и монтирование заново.
   * Здесь стояла обёртка, вызывавшая `monacoEditorContribution(...)` внутри себя: сама она
   * создавалась один раз, а `Body` — на каждый вызов. Любая перерисовка родителя (клик,
   * пришедшая диагностика, смена фокуса) роняла позицию курсора и набранное, то есть
   * редактировать исходник схемы было нельзя вовсе.
   *
   * Тело берут двое — предпросмотр markdown (режим «рядом») и редактор схемы (режим
   * исходника), — и оба обязаны получить ОДНУ ссылку.
   */
  const monacoTextEditor = monacoEditorContribution({
    host: monacoHost,
    focus: monacoFocus,
    viewStates: monacoViewStates,
  }).Body;

  // Порт превью и реестр его состояний создаются ЗДЕСЬ, потому что их берут двое: панель
  // превью и живой вид редактора схемы. Общий реестр — то, из-за чего выбор поверхности,
  // находки сборки и введённые в форму значения у них одни, а не две расходящиеся копии.
  const previewHost = createPreviewHost({
    project,
    i18n,
    services,
    // Загрузчик модулей — ТОТ ЖЕ, что у плагинов каталога: движок TypeScript один на
    // приложение, и второй экземпляр означал бы второй чанк на 3.5 МБ.
    //
    // Прогрев здесь ШИРЕ, чем у загрузчика плагинов, и это решение композиции: сайдкары формы
    // тянут кит почти всегда (его печатает `registry.ts`), а превью грузит кит и без того —
    // ленивым namespace. Плагину каталога кит обычно не нужен, поэтому ему прогрев ленивых
    // не достаётся.
    modules: {
      load: pluginModules.modules.load,
      prepare: async (files) => {
        const [primed] = await Promise.all([
          pluginModules.prepareCached(files),
          pluginModules.warm(),
        ]);
        return primed;
      },
    },
  });
  const previewSessions = createPreviewSessions();
  // Состояния превью живут не дольше вкладок: закрытая вкладка забывает и режим, и находки
  // сборки — иначе те висели бы в своде диагностик, а обновлять их было бы некому.
  const previewLifecycle = attachPreviewLifecycle(project, previewSessions);

  /**
   * Опции встроенного набора — ОДИН объект на обе фазы.
   *
   * Статические плагины регистрируются здесь же, синхронно; ленивые доезжают внутри `ready`
   * (шаг 3 ниже) и получают ровно эти опции. Две копии объекта означали бы два порта у одного
   * плагина — а порты держат разделяемые реестры, и второй экземпляр ломает ровно то, ради
   * чего они разделяются.
   */
  const builtinOptions: BuiltinPluginsOptions = {
    i18n,
    files: createFilesHost({ project, extensions, i18n, commands, whenContext }),
    monaco: monacoHost,
    markdown: createMarkdownHost({
      project,
      i18n,
      // Тот же порт и те же реестры, что у обычной code-вкладки: режим «рядом» показывает
      // ровно тот редактор, в котором файл правится, а не его копию.
      monaco: { host: monacoHost, focus: monacoFocus, viewStates: monacoViewStates },
    }),
    monacoFocus,
    monacoViewStates,
    schema: createSchemaHost({
      project,
      i18n,
      services,
      // Один и тот же редактор кода на троих: обычная вкладка, «рядом» у markdown
      // и исходник схемы. Общие реестры фокуса и снимков вида — условие того, что
      // позиция курсора переживает переключение вида.
      TextEditor: monacoTextEditor,
      // И та же поверхность, что рисует форму в панели превью: «чем нарисована эта форма» —
      // один вопрос с одним ответом, где бы её ни показывали.
      live: createLiveSurfacePort({
        host: previewHost,
        sessions: previewSessions,
        extensions,
        i18n,
      }),
    }),
    kits: {
      // `settings` НЕ передаются намеренно: плагин берёт их из реестра сервисов —
      // единственным путём, доступным плагину из каталога. Передай мы параметром,
      // этот путь остался бы непроверенным, а другого у внешнего плагина нет.
    },
    pluginManager: {
      // Порт — сам каталог: `ProjectPluginCatalog` структурно шире `PluginManagerHost`,
      // и эта строка — то единственное место, где их совместимость проверяется компиляцией.
      host: projectPlugins,
    },
    ai: createAiHost({ project, i18n, services }),
    preview: previewHost,
    previewSessions,
    codegen: createCodegenHost({ project, i18n, services }),
    templates: createTemplatesHost({ project, i18n, services }),
    // Кита нет — встроенных шаблонов нет: печатать их нечем, а умолчание напечатало бы
    // импорты чужого пакета. Пустой список честнее неверного кода.
    printTemplate: async (schema, formName, seed) => {
      const kits = services.get(KitsServiceToken);
      const kit = kits?.descriptor() ?? null;
      if (kit === null || kits === undefined) return [];
      // Генератор берётся динамическим импортом, и это не оптимизация, а условие: статический
      // импорт вернул бы плагин кодогена в стартовый граф целиком, ради функции, которая
      // нужна только когда шаблон действительно печатают. Модуль уже загружен — печатник
      // зовут после активации, — поэтому ожидание здесь нулевое.
      const { BUILTIN_TARGETS, generateModule } = await import('@/plugins/codegen');
      // Правила затравки доезжают до эмиттеров: из них печатаются НАСТОЯЩИЕ
      // и  (мост к билдерам MCP), а не заглушки. Без них шаблон давал
      // структуру модуля, в которой нечего проверять.
      const built = await generateModule(BUILTIN_TARGETS, {
        schema,
        formName,
        rules: seed?.rules,
        mock: seed?.mock,
        kit: { kit, catalog: kits.catalog() },
      });
      return built.files.map(({ path, content }) => ({ path, content }));
    },
    catalog: activeCatalog,
  };

  plugins.registerAll(createEagerBuiltinPlugins(builtinOptions));

  /**
   * Шаг 8: плагины каталога. Зовётся после того, как источник появился, — и повторно
   * на каждую смену проекта.
   *
   * Следствие, которое принято сознательно: оболочка успевает отрисоваться раньше, чем
   * появятся их вклады. Их панели и команды возникают позже — так же, как при включении
   * плагина руками, и тем же механизмом.
   */
  // Начальное состояние — «проекта нет»: пока источник не появился, синхронизировать нечего,
  // и первый же вызов без проекта обязан быть бесплатным.
  let syncedSource: Source | null = null;
  let syncing: Promise<void> = Promise.resolve();
  /**
   * Догнал ли каталог текущий проект.
   *
   * Нужен разделу настроек: между сменой проекта и перечитыванием каталога список ещё содержит
   * плагины ПРЕЖНЕГО, и показывать их как действующие — врать. Признак не выводится из
   * `syncedSource`: тот меняется в начале цепочки, а верным ответ становится в её конце.
   */
  let pluginsSynced = true;
  const syncProjectPlugins = (): Promise<void> => {
    const source = project.get()?.source ?? null;
    if (source === syncedSource) return syncing;
    syncedSource = source;
    pluginsSynced = false;
    // Цепочкой, а не параллельно: две смены проекта подряд не должны включать плагины
    // прежнего каталога поверх нового.
    syncing = syncing
      .then(() => {
        // Плагины закрытого проекта уходят вместе с ним, а память о том, что человек их
        // включал, остаётся: вернётся проект — вернутся и они.
        projectPlugins.deactivateAll();
        // Настройки ОБЛАСТИ принадлежат проекту, поэтому запись переключается вместе с ним,
        // и делается это ЗДЕСЬ, в той же цепочке, а не отдельной подпиской: список включённых
        // плагинов — настройка области, и `restoreEnabled` ниже обязан читать уже настройки
        // нового проекта. Отдельная подписка не дала бы порядка — только совпадение.
        //
        // `forget` обязателен: без него запись, сделанная в прежнем проекте, считалась бы
        // «своей, более новой» и переехала бы в новый.
        settingsStore.useWorkspace(project.get()?.workspaceId ?? null);
        return settings.hydrate({ forget: ['workspace'] });
      })
      .then(async () => {
        // Конфиг уровня ПРОЕКТА: перекрывает конфиг запуска по полю. Дефолты темы/локали
        // проектный уровень задать не может — умолчания настроек объявлены при сборке,
        // и это говорится человеку словами, а не глотается.
        const parsed = source === null ? null : await readProjectRuntimeConfig(source);
        applyTitle(mergeRuntimeConfig(launchConfig, parsed?.config ?? {}));
        const problems = [
          ...(parsed?.problems ?? []),
          ...(parsed?.config.defaults !== undefined
            ? ['«defaults» действуют только на уровне запуска — задайте их в конфиге лаунчера']
            : []),
        ];
        if (problems.length > 0) {
          notifications.warning('config.problem.project', {
            params: { message: problems.join('; ') },
          });
        }
      })
      .then(() => (source === null ? undefined : projectPlugins.refresh()))
      .then(() => (source === null ? undefined : projectPlugins.restoreEnabled()))
      .then(() => undefined)
      .catch((error: unknown) => {
        console.error('[boot] плагины каталога проекта не загрузились', error);
      })
      .finally(() => {
        // В `finally`, а не в `then`: отказ обхода тоже завершает синхронизацию. Иначе раздел
        // настроек навсегда остался бы на «читаю каталог» вместо того, чтобы показать пустоту.
        // Проверка источника — на случай, если проект успели сменить ещё раз: тогда признак
        // поднимет уже следующая цепочка.
        if (syncedSource === source) pluginsSynced = true;
      });
    return syncing;
  };
  const projectPluginsSubscription = project.subscribe(() => void syncProjectPlugins());

  // Раскладка создаётся ЗДЕСЬ, ниже каталога проекта: слой правила зависит от того, откуда
  // пришёл плагин, а «какие плагины лежат в проекте» знает только каталог. Оболочке этот
  // вопрос не задать — она не знает, из чего собрана.
  const keymap = createKeymapService({
    commands,
    settings,
    layerOf: (pluginId) => {
      if (pluginId === undefined) return 'host';
      return projectPlugins.list().some((entry) => entry.id === pluginId)
        ? 'catalog-plugin'
        : 'builtin-plugin';
    },
  });
  // Раскладку читают и плагины: подсказка «нажмите X» обязана показывать действующее
  // сочетание, а не объявленное.
  services.register(KeymapServiceToken, keymap);

  /**
   * Проверка источника при возврате фокуса в окно.
   *
   * Подписка на ОКНО одна на приложение, а наблюдение живёт в сессии и умирает вместе
   * с проектом — поэтому слушатель перевешивается на смену проекта, а не заводится по
   * одному на сессию. Без проекта слушателя нет вовсе: спрашивать нечего и не у кого.
   */
  let focusChecks: HostDisposable | null = null;
  const rebindFocusChecks = (): void => {
    focusChecks?.dispose();
    const session = project.get();
    focusChecks =
      session === null ? null : attachFocusChecks(session.divergence, { window, document });
  };
  const focusSubscription = project.subscribe(rebindFocusChecks);
  rebindFocusChecks();

  /**
   * Наблюдатель плагинов «в разработке» — второй потребитель тех же двух жестов: сохранение
   * из встроенного редактора (шина `events`) и возврат фокуса (окно). Живёт один на приложение,
   * а не пересоздаётся на смену проекта: без dev-плагинов каждый его шаг — дешёвый холостой,
   * а снимки сами привязаны к источнику и не переживают его смену.
   */
  const devWatch = createPluginDevWatch({
    catalog: projectPlugins,
    source: () => project.get()?.source ?? null,
    events,
    window,
    document,
  });

  // 4. Настройки, словари, активация. Одна цепочка: локаль читается из настроек, поэтому
  //    её загрузка обязана идти после `hydrate`.
  const ready = settings
    .hydrate()
    .then(() => i18n.setLocale(settings.get<string>(LOCALE_SETTINGS_KEY) ?? DEFAULT_LOCALE))
    .then(() => {
      // Словарь плагина регистрирует композиция: сервиса локализации в `PluginContext` нет,
      // и это не упущение — вклад в словарь не снимается вместе с плагином, значит и частью
      // его подписок быть не может.
      const filesI18n = i18n.forPlugin(FILES_PLUGIN_ID);
      for (const [locale, messages] of Object.entries(FILES_MESSAGES)) {
        filesI18n.contribute(locale, messages);
      }
    })
    // Ленивые плагины доезжают ЗДЕСЬ — до активации и, значит, до отрисовки: `main` рисует
    // по `ready`. Контракт «набор вкладов полон и детерминирован к моменту отрисовки»
    // соблюдён дословно; ленивость касается только того, каким файлом приезжает код.
    //
    // Отказ загрузки не проглатывается тихо, но и не отменяет запуск: без ассистента или
    // кодогена билдер работает, а вот без оболочки — нет. Общий `catch` ниже поймал бы
    // отказ вместе с остальным шагом и снял бы активацию СТАТИЧЕСКИХ плагинов заодно.
    .then(async () => {
      try {
        plugins.registerAll(await loadLazyBuiltinPlugins(builtinOptions));
      } catch (error) {
        console.error('[boot] ленивые плагины не загрузились', error);
        notifications.error('plugins.lazy-failed');
      }
    })
    .then(() => {
      // Отчёт не разбирается: отказавшие уже сообщены каналом диагностики рантайма плагинов,
      // а показать их человеку пока нечем — вклада в строку состояния на это нет.
      plugins.activateAll();
      // Проблемы конфига запуска показываются ПОСЛЕ словарей: тост переводится при показе.
      const configProblems = options.runtime?.problems ?? [];
      if (configProblems.length > 0) {
        notifications.warning('config.problem.launch', {
          params: { message: configProblems.join('; ') },
        });
      }
    })
    .catch((error: unknown) => {
      console.error('[boot] запуск прошёл не полностью', error);
    });

  return {
    extensions,
    whenContext,
    contextKeys,
    keymap,
    scopes,
    chords,
    settings,
    commands,
    status,
    i18n,
    // Разделы настроек: их состав знает композиция — тему применяет служба темы,
    // язык — служба локализации, и обе собраны здесь.
    settingsSections: createSettingsSections({
      settings,
      i18n,
      theme,
      /**
       * Порт раздела «Плагины» — перечислением, а не самим каталогом.
       *
       * Каталог структурно шире, и передай мы его целиком, раздел получил бы `deactivateAll`
       * и `restoreEnabled` — операции жизненного цикла, которыми окно настроек распоряжаться
       * не должно. Шесть строк ниже и есть граница: что в списке нет, то разделу недоступно.
       */
      plugins: {
        list: () => projectPlugins.list(),
        subscribe: (listener) => projectPlugins.subscribe(listener),
        enable: (id) => projectPlugins.enable(id),
        disable: (id) => {
          projectPlugins.disable(id);
        },
        setDev: (id, on) => {
          projectPlugins.setDev(id, on);
        },
        reload: (id) => projectPlugins.reload(id),
        synced: () => pluginsSynced,
        hasProject: () => project.get() !== null,
      },
      /**
       * Настройки самих плагинов: схемы из вкладов, значения из службы настроек.
       *
       * Схема здесь ПРОВЕРЯЕТСЯ — раздел получает либо пригодную, либо `null`. Проверка стоит
       * в композиции, а не в платформе и не в теле раздела: платформа не знает про формы,
       * а тело не должно решать, доверять ли чужому вкладу.
       */
      pluginSettings: {
        schemaOf: (pluginId) => {
          const contribution = extensions
            .get(CatalogPluginSettingsPoint)
            // Идентификатор вклада проставляет реестр, а не вносящий, поэтому сверка с ним —
            // это и есть запрет «плагин настраивает соседа».
            .find(
              ({ pluginId: owner, value }) => owner === pluginId && value.pluginId === pluginId
            );
          return contribution === undefined ? null : asFormSchema(contribution.value.schema);
        },
        read: (pluginId) => createPluginSettings(settings, pluginId).read(),
        write: (pluginId, values) => createPluginSettings(settings, pluginId).write(values),
        subscribe: (listener) => {
          // Двое меняют показанное мимо окна: состав вкладов (плагин включили, перезагрузили)
          // и значения (второе окно, сам плагин). Подписка одна на обоих.
          const contributions = extensions.observe(CatalogPluginSettingsPoint, listener);
          const values = settings.onDidChange((key) => {
            if (key.startsWith('workspace.plugin.')) listener();
          });
          return toDisposable(() => {
            contributions.dispose();
            values.dispose();
          });
        },
      },
    }),
    // Обе службы уходят в оболочку, а не только в реестр: тосты и диалоги рисует она,
    // и без этих двух полей отказ операции виден только в консоли, а запрос имени —
    // нигде вовсе.
    notifications,
    prompt,
    // Обслуживание хранилища: ЧТО именно приложение держит на источнике, знает только
    // композиция — она эти хранилища и завела. Оболочке уходит порт из двух глаголов,
    // а не список баз: перечисление, протёкшее в оболочку, разошлось бы с составом
    // хранилищ при первом же новом кэше.
    storage: {
      // Известные базы — запасной путь на движки без `indexedDB.databases()`; там, где
      // перечисление есть, оно полнее любого списка (см. шапку `storage/purge`).
      purge: () =>
        purgeOriginStorage(
          browserPurgeEnvironment({ knownDatabases: [WORKSPACE_DB_NAME, HANDLES_DB_NAME] })
        ),
      // Перезапуск, а не `dispose` с пересборкой: после очистки в памяти остаётся
      // приложение поверх снесённого хранилища, и половину удалённого оно создаст заново
      // первой же записью. Заодно закрытие страницы доводит до конца отложенные
      // (`blocked`) удаления баз.
      reload: () => {
        window.location.reload();
      },
    },
    plugins,
    projectPlugins,
    project,
    ready,

    async restore() {
      await project.restoreLast();
      // Проверка источника при переоткрытии: ревизии в хранилище — из прошлой сессии,
      // между ними могла пройти неделя. Механизм тот же, что у проверки по фокусу.
      void project.get()?.divergence.check('reopen');
      // Шаг 8 идёт ПОСЛЕ восстановления источника: файлы плагинов лежат в открытом проекте,
      // до его появления их прочитать неоткуда.
      await syncProjectPlugins();
    },

    dispose() {
      projectPluginsSubscription.dispose();
      devWatch.dispose();
      focusSubscription.dispose();
      focusChecks?.dispose();
      projectPlugins.dispose();
      pluginModules.dispose();
      plugins.deactivateAll();
      previewLifecycle.dispose();
      project.dispose();
      status.dispose();
      validation.dispose();
      meta.dispose();
      handles.dispose();
    },
  };
}
