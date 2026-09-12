/**
 * Единственное место со списком встроенных плагинов — КАРТОЙ, а не двумя списками.
 *
 * Место это — в `application/`, а не в оболочке, и разница не в адресе файла. Состав приложения
 * оболочке НЕИЗВЕСТЕН: она объявляет форму композиции (`shell/boot/composition`) и получает её
 * параметром, а «какие плагины образуют ReFormer Builder» отвечают отсюда. Поэтому и тип опций
 * импортируется из оболочки, а не объявляется здесь: опции — это то, что `boot` умеет ДАТЬ,
 * а список — то, что он получает.
 *
 * ## Почему карта, а не две функции «создай статических» и «загрузи ленивых»
 *
 * Состав задаётся ДАННЫМИ — профиль перечисляет плагины именами (`application/profiles`),
 * а резолвер отдаёт разрешённый список (`application/resolver`). Собрать по такому списку
 * можно только то, что адресуется ИМЕНЕМ: две функции, перечисляющие плагины телом, отдают
 * либо всех, либо никого, и «минимальный профиль» означал бы третью такую функцию.
 *
 * Ценой идёт то, что запись обязана назвать идентификатор сама. У статических он берётся
 * КОНСТАНТОЙ плагина — их барели и так в стартовом графе, поэтому расхождение невыразимо.
 * У ленивых он написан СТРОКОЙ: константа лежит в барели, и её импорт вернул бы плагин
 * в стартовый граф целиком — ровно то, что стережёт храповик в тесте рядом. Совпадение
 * строки с настоящим `plugin.id` проверяется составом (`builtin-plugins.test`), а совпадение
 * с каталогом `@/plugins/<id>` — тем, что этой же строкой написан литерал `import()`.
 *
 * Порядок записей на поведение не влияет — рантайм плагинов не строит графа зависимостей
 * (см. `shell/platform/plugin/registry`) и проверяет это тестом «порядок активации ничего
 * не значит». Держать его читаемым стоит только ради вывода диагностики; фактический порядок
 * сборки задаёт профиль, а не эта карта.
 *
 * ## Две фазы, и почему граница проходит именно здесь
 *
 * Плагины делятся на СТАТИЧЕСКИХ и ЛЕНИВЫХ, и это деление про СБОРКУ, а не про поведение:
 * оба набора встают до первой отрисовки, потому что ленивые дожидаются внутри `ready`
 * (см. `boot`). Контракт «набор вкладов полон и детерминирован к моменту отрисовки»
 * (plugin-and-shell, «Последовательность запуска», шаги 5-6) остаётся в силе дословно.
 *
 * Смысл деления — в том, что иначе весь код плагинов лежит внутри entry одним файлом.
 * Отдельный файл даёт только динамический импорт: попытка добиться того же через
 * `manualChunks` измерена и отвергнута (см. `vite.config.ts` — ручной чанк стягивает
 * в себя общий вендор и утяжеляет стартовый граф на полмегабайта).
 *
 * Причина, по которой каждый из пятерых статических остался статическим, записана
 * У ЕГО ЗАПИСИ: она про конкретный плагин, а не про набор.
 *
 * @module application/composer/builtin-plugins
 */

import type { CatalogEntry } from '@/lib/catalog/types';
import type { BuiltinPluginsOptions } from '@/shell/boot/composition';
import type { CapabilityDeclaration } from '@/shell/platform/primitives/capability';
import type { Plugin } from '@/shell/platform/plugin/types';
import { EditorPoint } from '@/shell/platform/ui/contributions/editors';
import { PanelPoint } from '@/shell/platform/ui/slots';
import { DocumentModelPoint } from '@/shell/platform/workspace/model/provider';

// Статические: их значения нужны композиции или их отделение стоит дороже, чем даёт.
import { createFilesPlugin, FILES_PLUGIN_ID } from '@/plugins/files';
import { createMonacoEditorPlugin, MONACO_PLUGIN_ID } from '@/plugins/editor-monaco';
import { createKitsPlugin, KITS_PLUGIN_ID, KitsCapability } from '@/plugins/kits';
import { createPreviewPlugin, PREVIEW_PLUGIN_ID } from '@/plugins/preview';
import {
  createSchemaValidatorPlugin,
  SCHEMA_VALIDATOR_PLUGIN_ID,
} from '@/plugins/validator-schema';

// Ленивых здесь нет ВОВСЕ — ни значением, ни типом: их значения приезжают литеральными
// `import()` внутри их же записей, а типы нужны только опциям, то есть оболочке.

/** Пустой каталог: одна замороженная ссылка вместо нового массива на каждый вызов. */
const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/**
 * Общее у всех записей: имя и то, что плагин ОБЕЩАЕТ дать остальным.
 *
 * `provides` живёт в карте, а не в коде плагина, по той же причине, по которой у плагина
 * каталога он живёт в манифесте: объявление обязано читаться ДО того, как код исполнится.
 * Резолвер (`../resolver/capability-resolver`) собирает его отсюда и отвечает «хватает ли
 * этого приложению» раньше первой активации; для ленивого плагина иначе и нельзя — его файла
 * в стартовом графе нет вовсе.
 *
 * Заполнено оно пока у одного плагина — китов, и это честнее пустых списков у остальных:
 * возможность объявляется тогда, когда на неё кто-то ссылается, а не «на будущее». Остальные
 * четыре разделяемых состояния (фокус редактора, снимки вида, сессии превью, рабочая область)
 * станут возможностями фазой 4, вместе с переездом портов.
 */
interface BuiltinPluginBase {
  readonly id: string;
  /** Возможности, которые плагин обязан зарегистрировать в `activate`. */
  readonly provides?: readonly CapabilityDeclaration[];
}

/**
 * Плагин, приезжающий в стартовом графе вместе с оболочкой.
 *
 * Фабрика синхронна намеренно: значение такого плагина композиции уже нужно, ждать нечего.
 */
export interface EagerBuiltinPlugin extends BuiltinPluginBase {
  readonly loading: 'eager';
  readonly create: (options: BuiltinPluginsOptions) => Plugin;
}

/**
 * Плагин, приезжающий своим файлом.
 *
 * Фабрика начинает `import()` в тот же миг, когда её позвали (тело `async`-функции выполняется
 * синхронно до первого `await`), — поэтому вызов всех ленивых фабрик подряд даёт столько же
 * параллельных запросов, сколько давал общий `Promise.all` до появления карты, а не цепочку.
 */
export interface LazyBuiltinPlugin extends BuiltinPluginBase {
  readonly loading: 'lazy';
  readonly create: (options: BuiltinPluginsOptions) => Promise<Plugin>;
}

/** Запись карты: кто, каким файлом приезжает и как создаётся. */
export type BuiltinPluginEntry = EagerBuiltinPlugin | LazyBuiltinPlugin;

const ENTRIES: readonly BuiltinPluginEntry[] = Object.freeze<BuiltinPluginEntry[]>([
  {
    // Статический: его словарь регистрирует сама композиция ЗНАЧЕНИЕМ (`FILES_MESSAGES`)
    // до того, как что-либо активировано.
    id: FILES_PLUGIN_ID,
    loading: 'eager',
    // Точки расширения подставляются ЗДЕСЬ: плагин объявил их структурно (`plugins/files/host`),
    // потому что `@/sdk` панелей и редакторов не отдаёт, а импортировать `@/shell` ему нельзя.
    create: (options) =>
      createFilesPlugin({ host: options.files, panelPoint: PanelPoint, editorPoint: EditorPoint }),
  },
  {
    // Статический: его `activate` ЗАКАЗЫВАЕТ тяжёлую проверку (`renderer-json/validate` плюс
    // ajv), чтобы она ехала параллельно оболочке; ленивость сделала бы из одного параллельного
    // запроса цепочку из двух ради десяти килобайт.
    id: SCHEMA_VALIDATOR_PLUGIN_ID,
    loading: 'eager',
    create: (options) =>
      createSchemaValidatorPlugin({
        catalog: options.catalog ?? ((): readonly CatalogEntry[] => NO_CATALOG),
      }),
  },
  {
    // Статический: `boot` синхронно вычисляет тело редактора и раздаёт ОДНУ ссылку троим
    // (вкладка кода, режим «рядом» у markdown, исходник схемы); новая ссылка означала бы
    // перемонтирование Monaco на каждую перерисовку родителя.
    id: MONACO_PLUGIN_ID,
    loading: 'eager',
    // Приоритет 10 против 1 у временного `textarea` в плагине файлов: Monaco его
    // вытесняет, но уступает структурному редактору схемы (100). Сам `TextEditor.tsx`
    // при этом остаётся запасным путём — на случай, когда движок не загрузился.
    create: (options) =>
      createMonacoEditorPlugin({
        host: options.monaco,
        focus: options.monacoFocus,
        viewStates: options.monacoViewStates,
        i18n: options.i18n.forPlugin(MONACO_PLUGIN_ID),
      }),
  },
  {
    // Статический: `KitsServiceToken` импортируется значением пятью портами композиции.
    id: KITS_PLUGIN_ID,
    loading: 'eager',
    // Первая объявленная возможность в приложении. Идентификатор — тот же `kits.active`,
    // что у службы: переименование `id` службы означало бы миграцию сохранённых данных
    // (фаза 7 плана), и прятать её внутри задачи про версии нельзя. Объявление и токен —
    // ОДИН объект (`KitsCapability`), поэтому разойтись им нечем.
    provides: [KitsCapability],
    create: (options) =>
      createKitsPlugin({
        ...options.kits,
        // Перевод плагина китов НЕ реактивный: пункты палитры строятся провайдером, а не
        // компонентом, и хука там быть не может. Смена локали перестроит их на следующем
        // открытии палитры — это и есть та цена, которую платит не-компонентный вклад.
        translate: (key, params) => options.i18n.forPlugin(KITS_PLUGIN_ID).t(key, params),
      }),
  },
  {
    // Статический: композиция сама создаёт реестр состояний и вешает на него жизненный цикл.
    id: PREVIEW_PLUGIN_ID,
    loading: 'eager',
    // Точку поверхностей плагин объявляет структурно — `@/sdk` её пока не отдаёт, как и
    // `defineExtensionPoint`, которым чужой плагин мог бы объявить свою. Пока поверхности
    // вносит только сам превью, это ничего не стоит; появится вторая — точку надо вынести.
    create: (options) =>
      createPreviewPlugin({
        host: options.preview,
        i18n: options.i18n.forPlugin(PREVIEW_PLUGIN_ID),
        sessions: options.previewSessions,
      }),
  },
  {
    id: 'editor-markdown',
    loading: 'lazy',
    // Приоритет 50: markdown забирает свои файлы у Monaco (10), потому что рендер — это то,
    // зачем .md открывают чаще всего. Порядок сборки на исход не влияет и влиять не должен:
    // при РАВНОМ приоритете победил бы зарегистрированный раньше, то есть Monaco, и предметный
    // редактор не получил бы ни одного файла.
    create: async (options) => {
      const markdown = await import('@/plugins/editor-markdown');
      return markdown.createMarkdownPlugin({
        host: options.markdown,
        i18n: options.i18n.forPlugin(markdown.MARKDOWN_PLUGIN_ID),
      });
    },
  },
  {
    id: 'editor-schema',
    loading: 'lazy',
    // Приоритет 100: структурный редактор забирает файл формы у Monaco, а Monaco остаётся
    // для всего остального текста. Оба отвечают `canOpen` по содержимому пробы, а не по
    // расширению, — потому и уживаются на одном `.json` без ветвления по имени файла.
    create: async (options) => {
      const schemaEditor = await import('@/plugins/editor-schema');
      return schemaEditor.createSchemaEditorPlugin({
        host: options.schema,
        modelPoint: DocumentModelPoint,
        i18n: options.i18n.forPlugin(schemaEditor.SCHEMA_EDITOR_PLUGIN_ID),
      });
    },
  },
  {
    id: 'plugin-manager',
    loading: 'lazy',
    create: async (options) => {
      const pluginManager = await import('@/plugins/plugin-manager');
      // Словарь регистрируется ЗДЕСЬ, а не в `boot`: он единственный из ленивых, чей словарь
      // ставит композиция (вклад в словарь не снимается вместе с плагином, значит и частью
      // его подписок быть не может), а взять его значением в `boot` нельзя — тот импорт
      // вернул бы плагин в стартовый граф.
      const i18n = options.i18n.forPlugin(pluginManager.PLUGIN_MANAGER_PLUGIN_ID);
      for (const [locale, messages] of Object.entries(pluginManager.PLUGIN_MANAGER_MESSAGES)) {
        i18n.contribute(locale, messages);
      }
      return pluginManager.createPluginManagerPlugin({
        ...options.pluginManager,
        translate: (key, params) => i18n.t(key, params),
      });
    },
  },
  {
    id: 'ai',
    loading: 'lazy',
    // Панель встаёт в правый слот без предиката: настройки провайдера и ключ должны быть
    // доступны и до того, как открыта форма, — иначе первый же запуск требует сначала
    // найти файл, а потом обнаружить, что ключа нет.
    create: async (options) => {
      const ai = await import('@/plugins/ai');
      return ai.createAiPlugin({
        host: options.ai,
        i18n: options.i18n.forPlugin(ai.AI_PLUGIN_ID),
      });
    },
  },
  {
    id: 'codegen',
    loading: 'lazy',
    create: async (options) => {
      const codegen = await import('@/plugins/codegen');
      return codegen.createCodegenPlugin({
        host: options.codegen,
        i18n: options.i18n.forPlugin(codegen.CODEGEN_PLUGIN_ID),
      });
    },
  },
  {
    id: 'templates',
    loading: 'lazy',
    create: async (options) => {
      const templates = await import('@/plugins/templates');
      return templates.createTemplatesPlugin({
        host: options.templates,
        i18n: options.i18n.forPlugin(templates.TEMPLATES_PLUGIN_ID),
        print: options.printTemplate,
      });
    },
  },
]);

/**
 * Встроенный набор, адресуемый ИМЕНЕМ: из него собирает состав `compose.fromProfile`.
 *
 * Карта, а не массив, потому что обращение к ней всегда одно и то же — «дай запись по
 * идентификатору из профиля». Массив заставил бы каждого потребителя писать свой `find`,
 * и первый же из них сделал бы ненайденное `undefined` вместо отказа.
 */
export const BUILTIN_PLUGINS: ReadonlyMap<string, BuiltinPluginEntry> = new Map(
  ENTRIES.map((entry) => [entry.id, entry])
);

/**
 * Плагины, приезжающие отдельным файлом.
 *
 * ВЫВОДИТСЯ из карты, а не перечисляется рядом: прежняя редакция держала второй список
 * руками, и разойтись он мог молча — списком пользуются проверки, а грузит плагины тело
 * фабрик. Теперь расхождение невыразимо.
 *
 * Список нужен храповику «стартовый граф не импортирует барель ленивого плагина значением»
 * (`builtin-plugins.test`): статический импорт любого из этих барелей возвращает плагин
 * в стартовый граф целиком, и заметить это можно только по составу чанков сборки.
 */
export const LAZY_PLUGIN_IDS: readonly string[] = Object.freeze(
  ENTRIES.filter((entry) => entry.loading === 'lazy').map((entry) => entry.id)
);
