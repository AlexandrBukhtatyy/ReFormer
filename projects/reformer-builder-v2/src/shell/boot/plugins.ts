/**
 * Единственное место со списком встроенных плагинов.
 *
 * Список собирается ФУНКЦИЕЙ, а не лежит константой: плагин файлов получает порт платформы,
 * а валидатор — каталог активного кита, и оба зависят от того, что создано в `boot`. Константа
 * заставила бы плагины дотягиваться до композиции самим — то есть ровно наоборот тому, ради
 * чего композиция существует.
 *
 * Порядок в массиве на поведение не влияет — рантайм плагинов не строит графа зависимостей
 * (см. `host/plugin/registry`) и проверяет это тестом «порядок активации ничего не значит».
 * Держать его читаемым стоит только ради вывода диагностики.
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
 * СТАТИЧЕСКИМИ остаются пятеро, и у каждого причина в композиции, а не в предпочтении:
 *
 * - `files` — его словарь регистрирует сама композиция ЗНАЧЕНИЕМ (`FILES_MESSAGES`) до того,
 *   как что-либо активировано;
 * - `editor-monaco` — `boot` синхронно вычисляет тело редактора и раздаёт ОДНУ ссылку троим
 *   (вкладка кода, режим «рядом» у markdown, исходник схемы); новая ссылка означала бы
 *   перемонтирование Monaco на каждую перерисовку родителя;
 * - `kits` — `KitsServiceToken` импортируется значением пятью портами композиции;
 * - `preview` — композиция сама создаёт реестр состояний и вешает на него жизненный цикл;
 * - `validator-schema` — его `activate` ЗАКАЗЫВАЕТ тяжёлую проверку (`renderer-json/validate`
 *   плюс ajv), чтобы она ехала параллельно оболочке; ленивость сделала бы из одного
 *   параллельного запроса цепочку из двух ради десяти килобайт.
 *
 * @module shell/boot/plugins
 */

import type { CatalogEntry } from '@/lib/catalog/types';
import type { Plugin } from '@/shell/platform/plugin/types';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import { EditorPoint } from '@/shell/platform/ui/contributions/editors';
import { PanelPoint } from '@/shell/platform/ui/slots';
import { DocumentModelPoint } from '@/shell/platform/workspace/model/provider';

// Статические: их значения нужны композиции или их отделение стоит дороже, чем даёт.
import type { FilesHost } from '@/plugins/files';
import { createFilesPlugin } from '@/plugins/files';
import type { ViewStateRegistry } from '@/plugins/editor-monaco';
import {
  createMonacoEditorPlugin,
  MONACO_PLUGIN_ID,
  type MonacoFocusRegistry,
  type MonacoHost,
} from '@/plugins/editor-monaco';
import { createKitsPlugin, KITS_PLUGIN_ID } from '@/plugins/kits';
import type { KitsPluginOptions } from '@/plugins/kits';
import { createPreviewPlugin, PREVIEW_PLUGIN_ID } from '@/plugins/preview';
import type { PreviewHost } from '@/plugins/preview';
import { createSchemaValidatorPlugin } from '@/plugins/validator-schema';

// Ленивые: только ТИПЫ. `verbatimModuleSyntax` стирает такой импорт целиком, графа он
// не создаёт — значения приезжают динамическим импортом в `loadLazyBuiltinPlugins`.
import type { PluginManagerPluginOptions } from '@/plugins/plugin-manager';
import type { MarkdownHost } from '@/plugins/editor-markdown';
import type { SchemaEditorHost } from '@/plugins/editor-schema';
import type { AiHost } from '@/plugins/ai';
import type { CodegenHost } from '@/plugins/codegen';
import type { ModulePrinter, TemplatesHost } from '@/plugins/templates';

export interface BuiltinPluginsOptions {
  /**
   * Служба словарей.
   *
   * Композиция передаёт КОРЕНЬ, а не готовые виды `forPlugin(id)` по одному на плагин, — иначе
   * `boot` обязан знать идентификатор каждого плагина ЗНАЧЕНИЕМ, а идентификаторы объявлены
   * в барелях. Один такой импорт возвращает ленивый плагин в стартовый граф целиком.
   */
  readonly i18n: Pick<RootI18nService, 'forPlugin'>;
  /** Порт платформы для плагина файлов. */
  readonly files: FilesHost;
  /** Порт платформы для редактора Monaco. */
  readonly monaco: MonacoHost;
  /**
   * Общий реестр фокуса Monaco.
   *
   * **Обязан быть тем же объектом**, что уходит в `createModelDocument({ isTextEditorFocused })`.
   * Это условие правильности, а не удобство подключения: перерисовка буфера по модели
   * откладывается, пока человек печатает, и «печатает ли он» знает только редактор. Два реестра
   * означали бы, что ход ассистента затирает набранное на полуслове.
   */
  readonly monacoFocus: MonacoFocusRegistry;
  /**
   * Реестр снимков вида Monaco.
   *
   * Приходит от композиции, потому что его делят двое: сам редактор и предпросмотр
   * markdown, одалживающий тело редактора для режима «рядом». Два реестра означали бы
   * потерянную позицию курсора при каждом переключении режима.
   */
  readonly monacoViewStates?: ViewStateRegistry;
  /**
   * Порт предпросмотра markdown.
   *
   * Отдельный плагин, а не режим редактора Monaco: «этот файл показывают рендером» —
   * предметное знание о формате, и держать его внутри редактора кода значило бы, что
   * выключение markdown требует правки чужого плагина.
   */
  readonly markdown: MarkdownHost;
  /** Порт платформы для визуального редактора схемы. */
  readonly schema: SchemaEditorHost;
  /**
   * Настройки плагина китов.
   *
   * Киты вносятся плагином, а не композицией, потому что «какой кит активен» — это
   * состояние, которое читают трое: валидатор (с чем сверять), палитра (что предлагать)
   * и инспектор (какие свойства у компонента). Сервис — единственный способ отдать одно
   * состояние троим, не заводя его копию у каждого.
   */
  readonly kits: Pick<KitsPluginOptions, 'settings' | 'sources'>;
  /**
   * Порт управления плагинами каталога.
   *
   * Порт удовлетворяется каталогом плагинов КАК ЕСТЬ — `ProjectPluginCatalog` структурно
   * шире `PluginManagerHost`, и это ровно то место, где их совместимость проверяется
   * компиляцией. Управление — вклад плагина, а не действие композиции, потому что точки
   * расширения заполняются только плагинами (см. `primitives/extension-point`).
   */
  readonly pluginManager: Omit<PluginManagerPluginOptions, 'translate'>;
  /** Порт платформы для ассистента. */
  readonly ai: AiHost;
  /** Порт платформы для превью. */
  readonly preview: PreviewHost;
  /**
   * Реестр состояний превью.
   *
   * Создаётся композицией, а не плагином, потому что показывающих поверхности стало двое:
   * панель превью и живой вид редактора схемы. Общий реестр — то, из-за чего выбор поверхности,
   * находки сборки и введённые значения у них ОДНИ, а не две похожие копии. Тот же приём и та же
   * причина, что у реестров Monaco, делимых на троих.
   */
  readonly previewSessions?: Parameters<typeof createPreviewPlugin>[0]['sessions'];
  /** Порт платформы для генерации кода. */
  readonly codegen: CodegenHost;
  /** Порт платформы для шаблонов форм. */
  readonly templates: TemplatesHost;
  /**
   * Печатник встроенных шаблонов.
   *
   * Шаблоны печатает САМ генератор — тот же, что экспортирует форму. Иначе встроенный
   * шаблон и результат экспорта разошлись бы: в v1 они и разошлись, потому что шаблоны
   * были ~900 строк готового текста, который никто не пересобирал при правке эмиттеров.
   * Переходник живёт здесь, потому что плагины не видят друг друга.
   */
  readonly printTemplate: ModulePrinter;
  /**
   * Каталог активного кита.
   *
   * Функция, а не список: кит переключают, и валидатор обязан сравнивать с тем каталогом,
   * который действует СЕЙЧАС. Композиция читает его из сервиса китов `services.get(KitsServiceToken)`,
   * то есть ЛЕНИВО: сервис появляется при активации плагина китов, а список плагинов
   * собирается до неё. Захвати мы каталог здесь значением — получили бы снимок пустого.
   */
  readonly catalog?: () => readonly CatalogEntry[];
}

/** Пустой каталог: одна замороженная ссылка вместо нового массива на каждый вызов. */
const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/**
 * Плагины, приезжающие отдельным файлом.
 *
 * Список объявлен ДЛЯ ПРОВЕРОК, а не для загрузки: грузятся они литеральными `import()`
 * ниже, потому что сборщику нужен литерал, а не переменная. Расхождение между этим списком
 * и телом `loadLazyBuiltinPlugins` ловит тест состава, а статический импорт любого из этих
 * барелей из `shell/**` — храповик в том же файле.
 */
export const LAZY_PLUGIN_IDS: readonly string[] = Object.freeze([
  'ai',
  'codegen',
  'editor-markdown',
  'editor-schema',
  'plugin-manager',
  'templates',
]);

/**
 * Плагины, которые едут в стартовом графе вместе с оболочкой.
 *
 * Синхронна намеренно: их значения композиции уже нужны, ждать нечего. Причины, по которым
 * каждый из пятерых остался здесь, перечислены в шапке модуля.
 */
export function createEagerBuiltinPlugins(options: BuiltinPluginsOptions): readonly Plugin[] {
  const catalog = options.catalog ?? ((): readonly CatalogEntry[] => NO_CATALOG);
  return Object.freeze([
    // Точки расширения подставляются ЗДЕСЬ: плагин объявил их структурно (`plugins/files/host`),
    // потому что `@/sdk` панелей и редакторов не отдаёт, а импортировать `@/shell` ему нельзя.
    createFilesPlugin({ host: options.files, panelPoint: PanelPoint, editorPoint: EditorPoint }),
    createSchemaValidatorPlugin({ catalog }),
    // Приоритет 10 против 1 у временного `textarea` в плагине файлов: Monaco его
    // вытесняет, но уступает структурному редактору схемы (100). Сам `TextEditor.tsx`
    // при этом остаётся запасным путём — на случай, когда движок не загрузился.
    createMonacoEditorPlugin({
      host: options.monaco,
      focus: options.monacoFocus,
      viewStates: options.monacoViewStates,
      i18n: options.i18n.forPlugin(MONACO_PLUGIN_ID),
    }),
    createKitsPlugin({
      ...options.kits,
      // Перевод плагина китов НЕ реактивный: пункты палитры строятся провайдером, а не
      // компонентом, и хука там быть не может. Смена локали перестроит их на следующем
      // открытии палитры — это и есть та цена, которую платит не-компонентный вклад.
      translate: (key, params) => options.i18n.forPlugin(KITS_PLUGIN_ID).t(key, params),
    }),
    // Точку поверхностей плагин объявляет структурно — `@/sdk` её пока не отдаёт, как и
    // `defineExtensionPoint`, которым чужой плагин мог бы объявить свою. Пока поверхности
    // вносит только сам преьвю, это ничего не стоит; появится вторая — точку надо вынести.
    createPreviewPlugin({
      host: options.preview,
      i18n: options.i18n.forPlugin(PREVIEW_PLUGIN_ID),
      sessions: options.previewSessions,
    }),
  ]);
}

/**
 * Плагины, приезжающие своим файлом.

 * Импорты идут ОДНИМ `Promise.all`: шесть запросов параллельно, а не цепочкой. Ждёт их
 * `boot` внутри `ready`, до первой отрисовки, — поэтому «ленивый» здесь означает «отдельный
 * файл», а не «вклад появится позже».
 *
 * Словарь `plugin-manager` регистрируется ЗДЕСЬ, а не в `boot`: он единственный из ленивых,
 * чей словарь ставит композиция (вклад в словарь не снимается вместе с плагином, значит
 * и частью его подписок быть не может), а взять его значением в `boot` нельзя — этот импорт
 * вернул бы плагин в стартовый граф.
 */
export async function loadLazyBuiltinPlugins(
  options: BuiltinPluginsOptions
): Promise<readonly Plugin[]> {
  const [markdown, schemaEditor, pluginManager, ai, codegen, templates] = await Promise.all([
    import('@/plugins/editor-markdown'),
    import('@/plugins/editor-schema'),
    import('@/plugins/plugin-manager'),
    import('@/plugins/ai'),
    import('@/plugins/codegen'),
    import('@/plugins/templates'),
  ]);

  const pluginManagerI18n = options.i18n.forPlugin(pluginManager.PLUGIN_MANAGER_PLUGIN_ID);
  for (const [locale, messages] of Object.entries(pluginManager.PLUGIN_MANAGER_MESSAGES)) {
    pluginManagerI18n.contribute(locale, messages);
  }

  return Object.freeze([
    // Приоритет 50: markdown забирает свои файлы у Monaco (10), потому что рендер — это то,
    // зачем .md открывают чаще всего. Порядок в этом списке на исход не влияет и влиять
    // не должен: при РАВНОМ приоритете победил бы зарегистрированный раньше, то есть Monaco,
    // и предметный редактор не получил бы ни одного файла.
    markdown.createMarkdownPlugin({
      host: options.markdown,
      i18n: options.i18n.forPlugin(markdown.MARKDOWN_PLUGIN_ID),
    }),
    // Приоритет 100: структурный редактор забирает файл формы у Monaco, а Monaco остаётся
    // для всего остального текста. Оба отвечают `canOpen` по содержимому пробы, а не по
    // расширению, — потому и уживаются на одном `.json` без ветвления по имени файла.
    schemaEditor.createSchemaEditorPlugin({
      host: options.schema,
      modelPoint: DocumentModelPoint,
      i18n: options.i18n.forPlugin(schemaEditor.SCHEMA_EDITOR_PLUGIN_ID),
    }),
    pluginManager.createPluginManagerPlugin({
      ...options.pluginManager,
      translate: (key, params) => pluginManagerI18n.t(key, params),
    }),
    // Панель встаёт в правый слот без предиката: настройки провайдера и ключ должны быть
    // доступны и до того, как открыта форма, — иначе первый же запуск требует сначала
    // найти файл, а потом обнаружить, что ключа нет.
    ai.createAiPlugin({ host: options.ai, i18n: options.i18n.forPlugin(ai.AI_PLUGIN_ID) }),
    codegen.createCodegenPlugin({
      host: options.codegen,
      i18n: options.i18n.forPlugin(codegen.CODEGEN_PLUGIN_ID),
    }),
    templates.createTemplatesPlugin({
      host: options.templates,
      i18n: options.i18n.forPlugin(templates.TEMPLATES_PLUGIN_ID),
      print: options.printTemplate,
    }),
  ]);
}

/**
 * Весь встроенный набор одним вызовом.
 *
 * Нужна тем, кому важен СОСТАВ, а не порядок загрузки, — прежде всего проверкам состава.
 * `boot` ею не пользуется: ему нужны именно две фазы, потому что статических он регистрирует
 * синхронно, а ленивых — внутри `ready`.
 */
export async function createBuiltinPlugins(
  options: BuiltinPluginsOptions
): Promise<readonly Plugin[]> {
  const lazy = await loadLazyBuiltinPlugins(options);
  return Object.freeze([...createEagerBuiltinPlugins(options), ...lazy]);
}
