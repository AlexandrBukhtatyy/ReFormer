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
  type PluginPermissionsStore,
  type ProjectPluginCatalog,
} from '@/shell/platform/plugin/catalog';
import {
  isPluginPermission,
  type PluginPermission,
  type PluginProblem,
} from '@reformer/builder-plugin-api/internal';
import { createPluginDevWatch } from '@/shell/platform/plugin/dev-watch';
import { createInstalledFiles } from '@/shell/platform/plugin/installed/files';
import { installPluginFromNpm } from '@/shell/platform/plugin/installed/install';
import {
  createInstalledPluginStore,
  INSTALLED_ROOT_DIR,
} from '@/shell/platform/plugin/installed/store';
import {
  createNpmRegistryClient,
  DEFAULT_NPM_REGISTRY,
} from '@/shell/platform/plugin/npm/registry';
import { createMarketplaceClient } from '@/shell/platform/plugin/marketplace/registry';
import { updateRows } from '@/shell/boot/settings/plugins-tabs';
import { createPluginLoader, type PluginFilesSource } from '@/shell/platform/plugin/loader';
import { createApplicationPluginCatalog } from '@/shell/platform/plugin/application/catalog';
import { APPLICATION_ROOT_DIR } from '@/shell/platform/plugin/application/files';
import {
  launchOnlyProblems,
  mergeRuntimeConfig,
  readProjectRuntimeConfig,
  type ParsedRuntimeConfig,
  type RuntimeConfig,
} from './runtime-config';
import { createPluginRegistry, type PluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import { createDiagnosticsService } from '@/shell/platform/services/diagnostics/service';
import { DiagnosticsServiceToken } from '@reformer/builder-plugin-api/internal';
import { createSelectionService } from '@/shell/platform/services/selection';
import { SelectionServiceToken } from '@reformer/builder-plugin-api/internal';
import { createFsSourceFactory } from '@/shell/platform/source/fs-access';
import { createSourceRegistry } from '@/shell/platform/source/registry';
import type { Source } from '@/shell/platform/source/types';
import { createI18nService } from '@/shell/platform/services/i18n/i18n';
import { createPromptService } from '@/shell/platform/services/prompt';
import { PromptServiceToken } from '@reformer/builder-plugin-api/internal';
import { createResourceClipboardService } from '@/shell/platform/services/resource-clipboard';
import { ResourceClipboardServiceToken } from '@reformer/builder-plugin-api/internal';
import { createNotificationsService } from '@/shell/platform/services/notifications';
import {
  NotificationsServiceToken,
  type NotificationsService,
} from '@reformer/builder-plugin-api/internal';
import { createIdbSettingsBackend } from '@/shell/platform/services/settings-idb';
import { createLayeredSettingsBackend } from '@/shell/platform/services/settings-layers';
import { createProjectSettingsBackend } from '@/shell/platform/services/settings-project';
import { createSettingsService } from '@/shell/platform/services/settings';
import { SettingsServiceToken, type SettingsService } from '@reformer/builder-plugin-api/internal';
import { createBrowserSystemTheme, createThemeService } from '@/shell/platform/services/theme';
import { ThemeServiceToken } from '@reformer/builder-plugin-api/internal';
import { dockSettingsKey } from '@/shell/platform/ui/chrome/layout-settings';
import type { ShellHost } from '@/shell/platform/ui/Shell';
import { createValidationOrchestrator } from '@/shell/platform/services/validation/orchestrator';
import { createContextKeyService } from '@/shell/platform/services/context-keys';
import { ContextKeyServiceToken } from '@reformer/builder-plugin-api/internal';
import { createChordState } from '@/shell/platform/ui/keyboard/chords';
import { createKeymapService } from '@/shell/platform/ui/keyboard/keymap';
import { KeymapServiceToken } from '@reformer/builder-plugin-api/internal';
import { createScopeStack } from '@/shell/platform/ui/keyboard/scope';
import { ScopeStackServiceToken } from '@reformer/builder-plugin-api/internal';
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
import { FILES_MESSAGES } from '@/plugins/base/files/messages';
import { FILES_PLUGIN_ID } from '@/plugins/base/files/contract';
import { createFilesHost } from '@/shell/boot/ports/files';
import { createMarkdownHost } from '@/shell/boot/ports/markdown';
import { createMonacoHost } from '@/shell/boot/ports/monaco';
import { createDocumentsService } from '@/shell/boot/ports/documents';
import { createWorkspaceFilesService } from '@/shell/boot/ports/workspace-files';
import { WorkspaceFilesServiceToken } from '@reformer/builder-plugin-api/internal';
import {
  DocumentModelsCapability,
  HostMessagesCapability,
  ModuleLoaderCapability,
} from '@reformer/builder-plugin-api/internal';
import { PluginsCatalogServiceToken } from '@reformer/builder-plugin-api/internal';
import { WorkspaceResourcesServiceToken } from '@reformer/builder-plugin-api/internal';
import { WorkspaceSaveServiceToken } from '@reformer/builder-plugin-api/internal';
import { createWorkspaceSave } from '@/shell/boot/ports/workspace-save';
import { createWorkspaceResourcesService } from '@/shell/boot/ports/workspace-resources';
import { DocumentsServiceToken } from '@reformer/builder-plugin-api/internal';
import {
  projectFailureAction,
  projectFailureMessageKey,
  type ProjectFailureActions,
} from '@/shell/boot/project/project-failure';
import { attachFocusChecks } from '@/shell/platform/workspace/merge/divergence';
import { installPluginStyles } from '@/shell/platform/plugin/styles';
import {
  toDisposable,
  type Disposable as HostDisposable,
} from '@reformer/builder-plugin-api/internal';
import { createTextEditorFocusRegistry } from '@/shell/platform/workspace/model/text-editor-focus';
import { TextEditorFocusToken } from '@reformer/builder-plugin-api/internal';
import { createEditorViewStates } from '@/shell/platform/workspace/model/editor-view-states';
import { EditorViewStatesToken } from '@reformer/builder-plugin-api/internal';
import { createDirectoryHandleStore, HANDLES_DB_NAME } from '@/shell/platform/source/fs-handles';
import { createCompileCache, type CompileCache } from '@/shell/platform/modules/compile-cache';
import {
  TYPESCRIPT_ENGINE_VERSION,
  TYPESCRIPT_OPTIONS_SIGNATURE,
  TYPESCRIPT_TRANSPILER_ID,
} from '@/shell/platform/plugin/typescript-transpiler';
import { createBuildCacheStore } from '@/shell/platform/workspace/storage/build-cache';
import { createPluginModules } from './plugin-modules';
import { CatalogPluginSettingsPoint } from '@reformer/builder-plugin-api/internal';
import { createPluginSettings } from '@/shell/platform/services/plugin-settings';
import { asFormSchema } from './settings/schema-guard';
import type { ApplicationComposition, BuiltinPluginsOptions, ProfileChoices } from './composition';
import { ApplicationProfilesServiceToken } from '@reformer/builder-plugin-api/internal';
import { createApplicationProfilesService } from './ports/application-profiles';
import { readStoredPreset } from './stored-preset';
import {
  createProjectHost,
  type ProjectFailure,
  type ProjectHost,
} from '@/shell/boot/project/project';
import { createProjectStatusSource } from '@/shell/boot/project/project-status';
import { createSettingsSections, LOCALE_SETTINGS_KEY } from './settings-sections';
import { mergePluginLayers } from './settings/plugins-list';

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

/**
 * Ключ подтверждённых прав. Область та же, что у включённых: право даётся плагину В ЭТОМ
 * проекте, и переносить его на другой каталог значило бы отвечать за человека на вопрос,
 * которого ему не задавали.
 */
export const PLUGIN_PERMISSIONS_SETTINGS_KEY = 'workspace.plugins.permissions';

/**
 * Подтверждённые права поверх настроек: идентификатор → список.
 *
 * Значение валидируется на чтении, и строже, чем список включённых: здесь лежит не «что
 * запустить», а «что кому разрешено», и мусор обязан читаться как «ничего никому».
 * Незнакомое имя права отбрасывается молча — оно могло принадлежать прошлой версии оболочки,
 * и превращать это в отказ чтения значило бы потерять заодно все остальные подтверждения.
 */
export function createSettingsPluginPermissions(settings: SettingsService): PluginPermissionsStore {
  return {
    read(): Promise<Readonly<Record<string, readonly PluginPermission[]>>> {
      const raw = settings.get<unknown>(PLUGIN_PERMISSIONS_SETTINGS_KEY);
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return Promise.resolve({});
      const granted: Record<string, readonly PluginPermission[]> = {};
      for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
        if (!Array.isArray(value)) continue;
        const permissions = value.filter(
          (item): item is PluginPermission => typeof item === 'string' && isPluginPermission(item)
        );
        if (permissions.length > 0) granted[id] = permissions;
      }
      return Promise.resolve(granted);
    },
    write(granted: Readonly<Record<string, readonly PluginPermission[]>>): Promise<void> {
      return settings.set(PLUGIN_PERMISSIONS_SETTINGS_KEY, { ...granted }, 'workspace');
    },
  };
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
 * Показывает отказ открытия проекта и не более того.
 *
 * Что сказать и какую кнопку дать, решает `project/project-failure`. Кнопка есть, только когда
 * известно, какую область поднимали, — у восстановления на старте и у «Недавно открытых».
 */
function reportProjectFailure(
  notifications: NotificationsService,
  failure: ProjectFailure,
  actions: ProjectFailureActions
): void {
  const messageKey = projectFailureMessageKey(failure);
  if (messageKey === null) return;
  if (failure.kind === 'failed') console.error('[boot] проект не открыт', failure.error);
  if (failure.kind === 'unavailable') {
    const action = projectFailureAction(failure, actions);
    notifications.info(messageKey, action === undefined ? undefined : { action });
    return;
  }
  if (failure.kind === 'unsupported') notifications.warning(messageKey);
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
  /**
   * Плагины, приехавшие вместе с приложением: работают до открытия проекта и для любого
   * проекта. Пуст, если своих плагинов у приложения нет.
   */
  readonly applicationPlugins: ProjectPluginCatalog;
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
  /**
   * Состав приложения: какие встроенные плагины его образуют.
   *
   * Оболочка состава не знает и знать не должна — она объявляет его ФОРМУ
   * ({@link ApplicationComposition}) и получает значение отсюда, из `main.tsx`.
   *
   * Поле ОБЯЗАТЕЛЬНОЕ и без умолчания, и это решение: умолчание `= builderApplication` вернуло бы
   * в `boot` импорт из `@/application` — ровно ту зависимость, ради разворота которой слой заведён,
   * и притом значением, то есть со всем составом в стартовом графе. Цена — каждый вызывающий
   * называет состав сам; кроме `main.tsx` вызывают только тесты, а им это как раз и нужно.
   */
  readonly application: ApplicationComposition;
  /**
   * Между какими профилями человек может переключить состав — решение приложения, принятое
   * вместе с выбором самого состава (`application/builder-application`).
   *
   * Необязательное, и умолчание здесь — «выбора нет», а не «выбор по умолчанию»: оболочка
   * профилей не знает, и предложить ей нечего. Служба профилей при этом всё равно существует
   * и честно называет собранный профиль.
   */
  readonly profileChoices?: ProfileChoices;
  /**
   * Слой плагинов ПРИЛОЖЕНИЯ: файлы плагинов, приехавших вместе с приложением
   * (`platform/plugin/application`). `null` или отсутствие — своих плагинов у приложения нет.
   *
   * Функцией с ожиданием, потому что слой узнаётся по сети (индекс рядом со сборкой), а `boot`
   * синхронен: ответ читается внутри {@link BuilderApp.ready}, сразу за встроенными плагинами.
   * Откуда его читать, решает `main.tsx`: оболочка знает форму слоя, а не его адрес.
   */
  readonly applicationPluginFiles?: () => Promise<PluginFilesSource | null>;
}

export function boot(options: BootOptions): BuilderApp {
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
  // Настройки ПРОЕКТА живут файлом в самом проекте, а не в браузере: они про то, как настроен
  // этот проект, и обязаны ехать в git вместе с формами, которые настраивают. Прежнее место
  // (IndexedDB) остаётся читаемым, пока файла нет, и принимает запись, когда источник
  // её не принимает (см. `services/settings-layers`).
  const projectSettings = createProjectSettingsBackend();
  // Умолчания организации (`defaults.settings` конфига запуска) — слоем над умолчаниями
  // плагинов: ключ объявляет плагин, а действует слово организации, пока человек не выбрал сам.
  const settings = createSettingsService(
    createLayeredSettingsBackend({ browser: settingsStore, project: projectSettings }),
    { launchDefaults: launchConfig.defaults?.settings }
  );
  const i18n = createI18nService();
  // Словарь оболочки на чтение: коды диагностик (`errors.<code>`) и заголовки исправлений
  // переводит ОН, чтобы одна ошибка звучала одинаково в любом редакторе. Обёртка, а не сам
  // корень: `contribute` корня плагину не принадлежит.
  services.register(HostMessagesCapability, {
    get locale() {
      return i18n.locale;
    },
    t: (key, params) => i18n.t(key, params),
    onDidChangeLocale: (cb) => i18n.onDidChangeLocale(cb),
  });
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

  // Перезапуск приложения — один на оба случая, когда он нужен: очистка хранилища и смена
  // профиля состава. Оболочке звать его напрямую нельзя (в её тестах это перезапуск прогона),
  // поэтому глагол живёт здесь и уходит портом.
  const reload = (): void => {
    window.location.reload();
  };
  // Профили состава: что собрано и на что можно пересобрать. Имена приходят от того, кто
  // собрал состав; оболочка добавляет запись выбора и перезапуск.
  services.register(
    ApplicationProfilesServiceToken,
    createApplicationProfilesService({
      current: options.application.profile,
      choices: options.profileChoices,
      settings,
      reload,
      stored: readStoredPreset,
    })
  );

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
  // Разделяемые состояния редакторов — ВОЗМОЖНОСТИ оболочки, и регистрируются они здесь,
  // до первой активации: их объявляет `platform/services/host-capabilities`, а сверяет
  // объявленное с зарегистрированным интеграционный тест `integration/host-capabilities`.
  //
  // Фокус («печатает ли человек прямо сейчас») читают двое, и оба НИЖЕ любого плагина:
  // надстройка модели над открываемым документом откладывает по нему перерисовку буфера,
  // а каждый текстовый редактор в него пишет. Снимки вида («где была каретка») делят все
  // редакторы: тело Monaco одалживают markdown и редактор схемы, и позиция курсора обязана
  // пережить переключение вида. Раньше оба объекта раздавала композиция и правильность
  // держалась на «это обязан быть тот же объект»; теперь общее — хранилище в реестре служб,
  // и второй копии просто неоткуда взяться.
  services.register(TextEditorFocusToken, createTextEditorFocusRegistry());
  services.register(EditorViewStatesToken, createEditorViewStates());
  /**
   * Поднялись ли плагины каталога проекта. Подставляется ниже, когда появится их цепочка
   * (`syncProjectPlugins`): открытие документа ждёт её, иначе провайдер модели из плагина
   * проекта вносился бы уже после того, как вид документа решён.
   *
   * Ожидание не может зациклиться на самом себе: `activate` синхронный, и открыть документ
   * изнутри цепочки плагин не может.
   */
  let projectPluginsSettled = (): Promise<void> => Promise.resolve();
  const project = createProjectHost({
    journals,
    sources,
    handles,
    meta,
    whenContext,
    // Провайдеры модели документа живут в реестре вкладов: без него сессия открывала бы
    // всё текстом, а структурный редактор не получил бы ни модели, ни истории.
    extensions,
    // Через реестр, а не захваченным объектом: владелец состояния — служба, и спрашивать
    // её в момент вопроса дешевле, чем следить за тем, чтобы копия не разошлась.
    isTextEditorFocused: (id) => services.get(TextEditorFocusToken)?.isFocused(id) ?? false,
    modelProvidersReady: () => projectPluginsSettled(),
    events,
    diagnostics,
    validation,
    onFailure: (failure) => {
      reportProjectFailure(notifications, failure, {
        // Кнопка уведомления зовёт держателя, который к этой минуте уже собран: отказ
        // приходит асинхронно, после того как `project` получил значение.
        reopen: (workspaceId) => {
          void project.openWorkspace(workspaceId);
        },
        forget: (workspaceId) => {
          void project.recent.forget(workspaceId).catch((error: unknown) => {
            console.error('[boot] проект не убран из недавних', error);
          });
        },
      });
    },
  });
  // Строка состояния получает ОДИН источник на всё время жизни приложения: смена проекта
  // для неё — смена содержимого, а не смена источника.
  const status = createProjectStatusSource(project);
  // Служба документов — рабочая область по адресу, видимому через `ctx.services`. Встроенные
  // редакторы получают её портами, а плагину из каталога проекта порт никто не соберёт: без
  // этой регистрации внешний редактор кода невозможен. Стоит ПОСЛЕ держателя проекта, потому
  // что читает его на каждый вызов, и ДО плагинов, потому что они спрашивают её при активации.
  // Без проекта отвечает как порты — `null` и отказом записи.
  const documents = createDocumentsService({ project });
  services.register(DocumentsServiceToken, documents);
  // Записи рабочей области — вторая её половина: что в ней лежит и где. Отдельной службой,
  // а не методами первой, потому что права разные (см. шапку `services/workspace-files`).
  services.register(WorkspaceFilesServiceToken, createWorkspaceFilesService({ project }));
  // Ручки модельных документов — тому плагину стека, чей провайдер документ разобрал. Раньше
  // ручку отдавал порт редактора схемы, и оболочка знала, какой провайдер чей; служба отдаёт
  // ручку ЛЮБОЙ модели с `unknown`, а сужает её сам плагин по `providerId`.
  services.register(DocumentModelsCapability, {
    handleOf: (id) => project.get()?.models.handleOf(id) ?? null,
  });
  // Дверь НАРУЖУ, и единственная: раньше её раздавала композиция портом — по одному
  // на плагин, — потому что без политики прав отдавать её реестром было нельзя. Политика
  // появилась, и служба встала на общий адрес: кому её видно, решает право в манифесте.
  services.register(WorkspaceSaveServiceToken, { save: createWorkspaceSave({ project }) });
  // Правка записей проекта — вторая привилегированная служба и по той же причине, что первая:
  // действие выходит наружу, за пределы рабочей копии в браузере.
  services.register(WorkspaceResourcesServiceToken, createWorkspaceResourcesService({ project }));

  const plugins = createPluginRegistry({
    services,
    extensions,
    commands,
    events,
    // КОРЕНЬ службы локализации: вид в пространстве имён плагина делает сборка контекста,
    // и только она, — иначе плагин мог бы попросить чужое пространство имён.
    i18n,
    // Память сессии: постоянное хранилище плагинов — часть рабочей области (Э2), и до неё
    // плагину лучше не иметь хранилища вовсе, чем иметь исчезающее незаметно.
    storage: createMemoryStorageBackend(),
  });

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
  const pluginModules = createPluginModules({
    cache: buildCacheOf,
    // Модули стека — от состава: оболочка своими держит только SDK и React.
    modules: options.application.modules,
  });
  // Загрузчик модулей — возможностью, а не портом превью: компилирующую поверхность вносит
  // плагин стека, и оболочка не должна знать, какой. Движок тот же, что у загрузчика плагинов.
  //
  // Прогрев здесь ШИРЕ, чем у загрузчика плагинов: сайдкары формы тянут кит почти всегда
  // (его печатает `registry.ts`), а превью грузит кит и без того — ленивым namespace.
  // Греется то, что импортируют САМИ файлы, а не всё подряд: иначе каждая форма платила бы
  // за подпути кита с их зависимостями, которых в ней нет.
  services.register(ModuleLoaderCapability, {
    load: pluginModules.modules.load,
    prepare: async (files) => {
      const [primed] = await Promise.all([
        pluginModules.prepareCached(files),
        pluginModules.warm(files),
      ]);
      return primed;
    },
  });

  // 3a. Плагины каталога проекта. Реестр модулей с настоящим `@builder/sdk` собирает
  //     композиция — только она вправе занять защищённые слоты (см. `./plugin-modules`).
  //     Сам каталог здесь только СОЗДАЁТСЯ: читать его до открытия проекта неоткуда,
  //     поэтому обход каталога — шаг 8, ниже. Стоит он ВЫШЕ встроенных плагинов, потому
  //     что один из них — управление плагинами — получает каталог своим портом.
  // Установленные из npm живут в OPFS и НЕ принадлежат проекту: человек ставит плагин один
  // раз, а проектов у него много. Проектным остаётся запуск — включённость и права спрашивает
  // каталог, поэтому чужой код не поднимется в проекте, которого человек ещё не открывал.
  const installedStore = createInstalledPluginStore();
  /** Клиент npm — один на приложение: состояния у него нет, кроме адреса реестра. */
  const npmRegistry = createNpmRegistryClient();
  /**
   * Каталог реестра ReFormer. Адрес — из конфига ЗАПУСКА: «куда ходить за списком плагинов»
   * решает тот, кто разворачивает билдер, а не человек за экраном. Без адреса клиент честно
   * отвечает «не настроен», и раздел показывает это состоянием, а не пустотой.
   */
  const marketplace = createMarketplaceClient(
    launchConfig.marketplace?.registry === undefined
      ? {}
      : { url: launchConfig.marketplace.registry }
  );

  /**
   * Откат установленного плагина к другой скачанной версии.
   *
   * Функцией, а не двумя копиями в портах: откат зовут палитра и раздел настроек, и разойдись
   * они — одна поверхность перезагружала бы плагин после переключения, а другая нет.
   */
  const rollbackInstalled = async (id: string): Promise<void> => {
    const record = (await installedStore.list()).find((item) => item.id === id);
    if (record === undefined || record.versions.length < 2) {
      notifications.info('plugins.rollback-none', { params: { id } });
      return;
    }
    const chosen = await prompt.pick({
      titleKey: 'shell.plugins.rollback.title',
      descriptionKey: 'shell.plugins.rollback.description',
      items: record.versions.map((version) => ({
        id: version,
        label: version,
        ...(version === record.version ? { description: '—' } : {}),
      })),
    });
    if (chosen === null || chosen === record.version) return;

    await installedStore.activate(id, chosen);
    // Перечитываем И перезагружаем: версия сменилась на диске, а в системе продолжали бы
    // работать вклады прежней — ровно то, ради чего откат и делают.
    await projectPlugins.refresh();
    if (projectPlugins.list().some((item) => item.id === id && item.state === 'enabled')) {
      await projectPlugins.reload(id);
    }
  };
  const installedLoader = createPluginLoader({
    source: () =>
      createInstalledFiles({
        store: installedStore,
        // Право исполнять принадлежит ПРОЕКТУ: источник, запрещающий свой код, запрещает
        // и установленный. Иначе read-only проект стал бы местом, где чужой код всё-таки
        // исполняется, — достаточно поставить его из npm.
        executesCode: () => project.get()?.source.capabilities.executesCode ?? false,
      }),
    modules: pluginModules.modules,
    prepare: pluginModules.prepare,
    warm: pluginModules.warm,
    dir: INSTALLED_ROOT_DIR,
  });

  /** Что о плагине говорит каталог человеку: тост называет плагин, подробности — в консоли. */
  const reportPluginProblem = (id: string, problem: PluginProblem): void => {
    console.error(`[plugins] «${id}»: ${problem.code} — ${problem.message}`, problem.cause);
    notifications.error('plugins.problem', { params: { id, message: problem.message } });
  };

  // 3б. Плагины ПРИЛОЖЕНИЯ — преемники встроенных: приехали вместе с приложением и работают
  //     до открытия проекта и для любого проекта. Каталог тот же, что у проекта, политика
  //     своя (`platform/plugin/application/catalog`). Здесь он только создаётся: файлы слоя
  //     читаются по сети внутри `ready`, сразу за встроенными плагинами.
  let applicationFiles: PluginFilesSource | null = null;
  const applicationPlugins = createApplicationPluginCatalog({
    loader: createPluginLoader({
      source: () => applicationFiles,
      modules: pluginModules.modules,
      prepare: pluginModules.prepare,
      warm: pluginModules.warm,
      dir: APPLICATION_ROOT_DIR,
    }),
    plugins,
    i18n,
    keymap: {
      registerRules: (source, layer, rules) => keymap.registerRules(source, layer, rules),
    },
    installStyles: (css, pluginId) => installPluginStyles(css, pluginId, document),
    capabilities: () => options.application.capabilities,
    onProblem: reportPluginProblem,
  });

  const projectPlugins = createProjectPluginCatalog({
    installed: installedLoader,
    // Словарь плагина каталога вносит каталог — по тому же правилу, по которому словарь
    // встроенного вносит композиция (см. шаг 4): вклад в словарь не снимается вместе
    // с плагином, поэтому сервиса i18n в `PluginContext` нет. Без этого каждая команда
    // внешнего плагина показывалась бы маркером промаха.
    i18n,
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
      warm: pluginModules.warm,
    }),
    plugins,
    // Что даёт остальное приложение: объявления встроенных из состава. Реестр служб на этот
    // вопрос ответить не может — он знает занятые слоты, а не версии, — а спрашивать надо
    // ДО того, как код внешнего плагина исполнится. Функцией, потому что каталог живёт дольше
    // сборки и вправе спросить заново. Плагины приложения для плагина проекта — та же
    // «остальная часть приложения», что и встроенные.
    capabilities: () => [...options.application.capabilities, ...applicationPlugins.capabilities()],
    // Копия плагина приложения в проекте не грузится: работает экземпляр приложения.
    reserved: () => applicationPlugins.reserved(),
    enabled: createSettingsEnabledPlugins(settings),
    dev: createSettingsDevPlugins(settings),
    permissions: createSettingsPluginPermissions(settings),
    // Вопрос человеку — обычным подтверждением оболочки, тем же, каким спрашивают про очистку
    // хранилища. Права перечисляются В ТЕКСТЕ параметром: список короткий, и показать его
    // надо целиком — «плагин просит прав» без называния прав не вопрос, а формальность.
    confirmPermissions: (id, permissions) =>
      prompt.confirm({
        titleKey: 'shell.plugins.permissions.title',
        descriptionKey: 'shell.plugins.permissions.description',
        params: { id, permissions: permissions.join(', ') },
        confirmKey: 'shell.plugins.permissions.confirm',
      }),
    // Отказ плагина — событие для человека, а не для консоли: тост говорит, ЧТО сломалось,
    // подробности (код, файл) остаются в списке плагинов и в консоли.
    onProblem: reportPluginProblem,
  });

  // Один порт Monaco на двоих: сам редактор и предпросмотр markdown, который одалживает
  // его тело для режима «рядом».
  const monacoHost = createMonacoHost({ project, i18n, diagnostics, extensions });

  /**
   * Опции встроенного набора — ОДИН объект на всех.
   *
   * Плагины доезжают внутри `ready` (шаг 3 ниже) и получают ровно эти опции. Две копии
   * объекта означали бы два порта у одного плагина: порт — это адаптер над платформой, и второй
   * экземпляр ставил бы вторую подписку на те же события. Разделяемых РЕЕСТРОВ здесь больше
   * нет ни одного — фокус, снимки вида
   * и состояния превью стали возможностями и живут в реестре служб, — поэтому правильность
   * больше не держится на «это обязан быть тот же объект».
   */
  /**
   * Каталог плагинов — ПРИВИЛЕГИРОВАННАЯ служба (право `plugins.manage`).
   *
   * Сам каталог структурно шире интерфейса службы, и эта регистрация — то единственное
   * место, где их совместимость проверяется компиляцией. Установка и удаление дописываются
   * здесь: каталог о реестре npm не знает и знать не должен, а спросить имя пакета можно
   * только там, где есть служба диалогов.
   */
  services.register(PluginsCatalogServiceToken, {
    ...projectPlugins,
    // Служба управляет каталогом проекта и установленным из npm. Плагины приложения сюда
    // не попадают вовсе: их набор задаёт сборка, и управлять им из палитры нечем.
    list: () =>
      projectPlugins
        .list()
        .flatMap((entry) =>
          entry.layer === 'application' ? [] : [{ ...entry, layer: entry.layer }]
        ),
    install: async () => {
      const name = await prompt.input({
        titleKey: 'shell.plugins.install.title',
        descriptionKey: 'shell.plugins.install.description',
        labelKey: 'shell.plugins.install.label',
      });
      if (name === null || name.trim() === '') return;

      const result = await installPluginFromNpm(
        {
          registry: npmRegistry,
          store: installedStore,
          registryUrl: DEFAULT_NPM_REGISTRY,
        },
        { package: name.trim() }
      );
      if (!result.ok) {
        notifications.error('plugins.install-failed', {
          params: { package: name.trim(), message: result.problem.message },
        });
        return;
      }
      // Установка не включает: плагин появляется в списке выключенным, как и положенный
      // в каталог руками. Решение «пусть этот код работает» остаётся за человеком.
      await projectPlugins.refresh();
      notifications.info('plugins.installed', {
        params: { id: result.record.id, version: result.record.version },
      });
    },
    rollback: (id: string) => rollbackInstalled(id),
    uninstall: async (id: string) => {
      projectPlugins.disable(id);
      await installedStore.uninstall(id);
      await projectPlugins.refresh();
    },
  });

  const builtinOptions: BuiltinPluginsOptions = {
    files: createFilesHost({ project, extensions, i18n, commands, whenContext }),
    monaco: monacoHost,
    markdown: createMarkdownHost({ project }),
  };

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
  /** Когда слой плагинов приложения поднят (или стало ясно, что его нет). Задаётся ниже. */
  let applicationSettled = (): Promise<void> => Promise.resolve();
  const syncProjectPlugins = (): Promise<void> => {
    const source = project.get()?.source ?? null;
    if (source === syncedSource) return syncing;
    syncedSource = source;
    pluginsSynced = false;
    // Цепочкой, а не параллельно: две смены проекта подряд не должны включать плагины
    // прежнего каталога поверх нового.
    syncing = syncing
      // Слой приложения поднимается первым: копия его плагина в проекте обязана застать
      // идентификатор занятым, иначе она встала бы на его место раньше него.
      .then(() => applicationSettled())
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
        projectSettings.useSource(project.get()?.source ?? null);
        return settings.hydrate({ forget: ['workspace'] });
      })
      .then(async () => {
        // Конфиг уровня ПРОЕКТА: перекрывает конфиг запуска по полю. Дефолты темы/локали
        // проектный уровень задать не может — умолчания настроек объявлены при сборке.
        // Состав приложения тем более: он фиксируется ДО `boot`, при сборке композиции
        // (`application/builder-application`), а эта строка выполняется после открытия
        // проекта — когда плагины уже активированы и вклады розданы. Применить его здесь
        // означало бы перезапуск приложения на открытии папки.
        //
        // Поэтому поле уровня запуска, записанное в проекте ИНАЧЕ, чем в конфиге запуска,
        // называется человеку словами, а не глотается. Записанное так же — действует, его
        // применил запуск: так выглядит билдер, запущенный в корне проекта и открывший его же.
        const parsed = source === null ? null : await readProjectRuntimeConfig(source);
        applyTitle(mergeRuntimeConfig(launchConfig, parsed?.config ?? {}));
        const problems = [
          ...(parsed?.problems ?? []),
          ...(parsed === null ? [] : launchOnlyProblems(launchConfig, parsed.config)),
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
  projectPluginsSettled = () => syncing;
  const projectPluginsSubscription = project.subscribe(() => void syncProjectPlugins());

  // Раскладка создаётся ЗДЕСЬ, ниже каталога проекта: слой правила зависит от того, откуда
  // пришёл плагин, а «какие плагины лежат в проекте» знает только каталог. Оболочке этот
  // вопрос не задать — она не знает, из чего собрана.
  const keymap = createKeymapService({
    commands,
    settings,
    layerOf: (pluginId) => {
      if (pluginId === undefined) return 'host';
      // Плагин приложения — тоже плагин каталога: его клавиши объявлены манифестом и стоят
      // в том же слое раскладки, что и у плагина проекта.
      const fromCatalog =
        projectPlugins.list().some((entry) => entry.id === pluginId) ||
        applicationPlugins.catalog.list().some((entry) => entry.id === pluginId);
      return fromCatalog ? 'catalog-plugin' : 'builtin-plugin';
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
    // Встроенные плагины доезжают ЗДЕСЬ — до активации и, значит, до отрисовки: `main` рисует
    // по `ready`. Контракт «набор вкладов полон и детерминирован к моменту отрисовки»
    // соблюдён дословно; своим файлом приезжает только код.
    //
    // Регистрация — по одному, а не `registerAll`: вместе с плагином в реестр уходит то, что
    // он ОБЕЩАЛ дать остальным, и к концу `activate` рантайм сверит обещанное с
    // зарегистрированным. Без этой пары плагин мог бы объявить возможность в манифесте и не
    // зарегистрировать её, а резолвер продолжал бы верить объявлению.
    //
    // Отказ загрузки не проглатывается тихо, но и не отменяет запуск: оболочка поднимается
    // и говорит об отказе уведомлением. Общий `catch` ниже поймал бы отказ вместе с остальным
    // шагом и снял бы активацию плагинов каталога проекта заодно.
    .then(async () => {
      try {
        for (const composed of await options.application.load(builtinOptions)) {
          plugins.register(composed.plugin, composed.provides, composed.permissions);
        }
      } catch (error) {
        console.error('[boot] встроенные плагины не загрузились', error);
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
    // Плагины приложения — сразу за встроенными и тоже до отрисовки: это часть приложения,
    // и её вклады (дерево, редакторы) должны быть на месте к первому кадру. Отказ слоя запуск
    // не отменяет: оболочка поднимается без него, как поднялась бы без индекса.
    .then(async () => {
      try {
        applicationFiles = (await options.applicationPluginFiles?.()) ?? null;
        if (applicationFiles !== null) await applicationPlugins.start();
      } catch (error) {
        console.error('[boot] плагины приложения не загрузились', error);
        notifications.error('plugins.lazy-failed');
      }
    })
    .catch((error: unknown) => {
      console.error('[boot] запуск прошёл не полностью', error);
    });
  applicationSettled = () => ready;

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
        // Два каталога — один список: плагины приложения видны всегда, плагины проекта —
        // пока проект открыт (после его закрытия каталог ещё помнит прежние строки).
        list: () =>
          mergePluginLayers(
            applicationPlugins.catalog.list(),
            project.get() === null ? [] : projectPlugins.list()
          ),
        subscribe: (listener) => {
          const own = projectPlugins.subscribe(listener);
          const application = applicationPlugins.catalog.subscribe(listener);
          return toDisposable(() => {
            own.dispose();
            application.dispose();
          });
        },
        // Действия — только над каталогом проекта: строки приложения раздел не трогает,
        // а неизвестный идентификатор каталог пропускает.
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
        refresh: () => projectPlugins.refresh(),
      },
      /**
       * Каталог реестра и установка. Порт собирается ЗДЕСЬ, потому что склеивает три вещи,
       * которые друг о друге не знают: реестр ReFormer (что бывает), npm (какие версии есть)
       * и хранилище установленных (что стоит). Ни одна из них не должна знать про две другие.
       */
      pluginsMarketplace: {
        configured: () => marketplace.configured(),
        catalog: async () => {
          const result = await marketplace.list();
          return result.ok
            ? { ok: true as const, entries: result.entries }
            : { ok: false as const, message: result.problem.message };
        },
        installed: () => installedStore.list(),
        install: async (packageName: string) => {
          const result = await installPluginFromNpm(
            { registry: npmRegistry, store: installedStore, registryUrl: DEFAULT_NPM_REGISTRY },
            { package: packageName }
          );
          if (!result.ok) return { ok: false, message: result.problem.message };
          await projectPlugins.refresh();
          return { ok: true };
        },
        checkUpdates: async () => {
          const installed = await installedStore.list();
          const latest = new Map<string, string>();
          const names = new Map<string, string>();
          for (const record of installed) {
            names.set(record.id, record.id);
            // Спрашиваем npm, а не реестр ReFormer: какая версия есть — знает тот, кто их
            // хранит. Диапазон «любая выпущенная»: обновление предлагается, а не ставится.
            const found = await npmRegistry.resolve(record.package, '>=0.0.0');
            if (found.ok) latest.set(record.id, found.value.version);
          }
          return { ok: true as const, rows: updateRows(installed, latest, names) };
        },
        update: async (row) => {
          const result = await installPluginFromNpm(
            { registry: npmRegistry, store: installedStore, registryUrl: DEFAULT_NPM_REGISTRY },
            { package: row.package, range: row.available }
          );
          if (!result.ok) return { ok: false, message: result.problem.message };
          await projectPlugins.refresh();
          // Работающий плагин обязан перезапуститься на новой версии: иначе в системе
          // остались бы вклады прежней, а список показывал бы новую.
          if (
            projectPlugins.list().some((item) => item.id === row.id && item.state === 'enabled')
          ) {
            await projectPlugins.reload(row.id);
          }
          return { ok: true };
        },
        rollback: (id: string) => rollbackInstalled(id),
        uninstall: async (id: string) => {
          projectPlugins.disable(id);
          await installedStore.uninstall(id);
          await projectPlugins.refresh();
        },
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
      reload,
    },
    plugins,
    projectPlugins,
    applicationPlugins: applicationPlugins.catalog,
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
      applicationPlugins.catalog.dispose();
      pluginModules.dispose();
      plugins.deactivateAll();
      documents.dispose();
      project.dispose();
      status.dispose();
      validation.dispose();
      meta.dispose();
      handles.dispose();
    },
  };
}
