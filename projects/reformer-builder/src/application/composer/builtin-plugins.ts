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
 * ## Запись не объявляет плагин — она его СОЗДАЁТ
 *
 * Всё объявленное (идентификатор, имя, `provides`, `requires`, способ доставки) живёт
 * в `plugins/<каталог>/manifest.json` — том же файле и том же формате, что у плагина каталога
 * проекта, и проходит ТОТ ЖЕ разбор (`parsePluginManifestValue`). Здесь остаётся ровно то,
 * чего в JSON быть не может: фабрика с её аргументами и `import()` ленивого.
 *
 * Манифест приезжает статическим импортом JSON, и это лист: он не тянет за собой ни строчки
 * кода плагина. Иначе объявление ленивого было бы нечитаемо до его загрузки, а отвечать
 * «собирается ли состав» надо раньше.
 *
 * Каталогу идентификатор НЕ равен: плагин зовётся `reformer.ai`, а лежит в `plugins/ai`.
 * Пространство имён (`BUILTIN_PLUGIN_NAMESPACE`) разводит встроенных с плагинами каталога
 * проекта, у которых имя — имя папки в `.ui_builder/plugins`; каталог поэтому пишется отдельно,
 * литералом `import()`, и выводится из идентификатора {@link builtinPluginDirectory}.
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
 * В ЕГО МАНИФЕСТЕ полем `builtin.reason`, и разбор требует её у каждого `eager`: ленивость —
 * умолчание, объяснять надо отступление от него.
 *
 * @module application/composer/builtin-plugins
 */

import type { BuiltinPluginsOptions } from '@/shell/boot/composition';
import {
  parsePluginManifestValue,
  type BuiltinPluginManifest,
} from '@/shell/platform/plugin/manifest';
import type { Plugin } from '@reformer/builder-plugin-api/internal';
import { EditorPoint } from '@reformer/builder-plugin-api/internal';
import { PanelPoint } from '@reformer/builder-plugin-api/internal';
import { DocumentModelPoint } from '@reformer/builder-plugin-api/internal';

// Манифесты — ВСЕХ одиннадцати, включая ленивых: JSON это лист, кода плагина за ним нет.
import aiManifest from '@/plugins/ai/manifest.json';
import codegenManifest from '@/plugins/codegen/manifest.json';
import filesManifest from '@/plugins/files/manifest.json';
import kitsManifest from '@/plugins/kits/manifest.json';
import markdownManifest from '@/plugins/editor-markdown/manifest.json';
import monacoManifest from '@/plugins/editor-monaco/manifest.json';
import pluginManagerManifest from '@/plugins/plugin-manager/manifest.json';
import previewManifest from '@/plugins/preview/manifest.json';
import schemaEditorManifest from '@/plugins/editor-schema/manifest.json';
import templatesManifest from '@/plugins/templates/manifest.json';
import validatorManifest from '@/plugins/validator-schema/manifest.json';

// Код — только статических: их значения нужны композиции, и довод у каждого в его манифесте.
// Ленивых здесь нет ВОВСЕ — ни значением, ни типом: их код приезжает литеральными `import()`
// внутри их же записей, а типы нужны только опциям, то есть оболочке.
import { createFilesPlugin } from '@/plugins/files';
import { createMonacoEditorPlugin } from '@/plugins/editor-monaco';
import { createKitsPlugin } from '@/plugins/kits';
import { createPreviewPlugin } from '@/plugins/preview';
import { createSchemaValidatorPlugin } from '@/plugins/validator-schema';

/**
 * Общее у всех записей — манифест плагина.
 *
 * Объявления в записи НЕТ ни одного: `provides`, `requires`, имя и способ доставки читаются
 * из манифеста, и другого их места не существует. До этой фазы они жили здесь, и довод был
 * тот же, что у манифеста плагина каталога («объявление обязано читаться до того, как код
 * исполнится»), — а значит, вторым форматом ради того же довода. Теперь формат один.
 */
interface BuiltinPluginBase {
  readonly manifest: BuiltinPluginManifest;
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

/** Запись карты: чей манифест, каким файлом приезжает и как создаётся. */
export type BuiltinPluginEntry = EagerBuiltinPlugin | LazyBuiltinPlugin;

/**
 * Разбирает манифест встроенного ТЕМ ЖЕ разбором, что и манифест плагина каталога.
 *
 * Не проверка «на всякий случай»: «встроенные и внешние — один контракт» — утверждение,
 * и держится оно только на том, что манифест встроенного проходит те же правила целиком.
 * Своя, облегчённая проверка сделала бы из одного контракта два похожих.
 *
 * Отказ — исключение, а не `PluginProblem`, и это единственное место, где разбор манифеста
 * бросает. У каталога испорченный манифест — обычное состояние папки, которую человек правит
 * руками; здесь это НАША сборка, и «плагин из состава не разобрался» означает не плохие
 * данные, а сломанное приложение. Падает оно при загрузке модуля, то есть в первом же тесте.
 */
function builtinManifest(raw: unknown): BuiltinPluginManifest {
  const parsed = parsePluginManifestValue(raw, { kind: 'builtin' });
  if (!parsed.ok) {
    const id = (raw as { id?: unknown }).id;
    throw new Error(
      `манифест встроенного плагина «${typeof id === 'string' ? id : '?'}» не разбирается: ` +
        parsed.problem.message
    );
  }
  return parsed.manifest;
}

/**
 * Собирает запись статического плагина, сверив способ доставки с манифестом.
 *
 * Конструктор, а не литерал, ровно ради этой сверки: синхронность фабрики и слово `eager`
 * в манифесте — одно и то же утверждение, и разойдись они, состав получил бы либо промис
 * там, где его не ждут, либо обещание отдельного файла, которого нет. Компилятор связать их
 * не может: `builtin.loading` приезжает из JSON строкой.
 */
function eagerBuiltin(
  raw: unknown,
  create: (options: BuiltinPluginsOptions) => Plugin
): EagerBuiltinPlugin {
  const manifest = builtinManifest(raw);
  if (manifest.builtin.loading !== 'eager') {
    throw new Error(`«${manifest.id}»: манифест объявляет «lazy», а запись создаёт синхронно`);
  }
  return { manifest, loading: 'eager', create };
}

/** То же для ленивого: фабрика обязана быть асинхронной, манифест — говорить `lazy`. */
function lazyBuiltin(
  raw: unknown,
  create: (options: BuiltinPluginsOptions) => Promise<Plugin>
): LazyBuiltinPlugin {
  const manifest = builtinManifest(raw);
  if (manifest.builtin.loading !== 'lazy') {
    throw new Error(`«${manifest.id}»: манифест объявляет «eager», а запись грузит файлом`);
  }
  return { manifest, loading: 'lazy', create };
}

const ENTRIES: readonly BuiltinPluginEntry[] = Object.freeze<BuiltinPluginEntry[]>([
  // Точки расширения подставляются ЗДЕСЬ: плагин объявил их структурно (`plugins/files/host`),
  // потому что `@/sdk` панелей и редакторов не отдаёт, а импортировать `@/shell` ему нельзя.
  eagerBuiltin(filesManifest, (options) =>
    createFilesPlugin({ host: options.files, panelPoint: PanelPoint, editorPoint: EditorPoint })
  ),
  // Каталог кита плагин берёт из реестра служб сам; параметров здесь не осталось вовсе.
  eagerBuiltin(validatorManifest, () => createSchemaValidatorPlugin({})),
  // Приоритет 10 против 1 у временного `textarea` в плагине файлов: Monaco его вытесняет,
  // но уступает структурному редактору схемы (100). Сам `TextEditor.tsx` при этом остаётся
  // запасным путём — на случай, когда движок не загрузился. Ни реестра фокуса, ни хранилища
  // снимков вида здесь нет: оба — возможности оболочки, и плагин берёт их из `ctx.services`.
  eagerBuiltin(monacoManifest, (options) => createMonacoEditorPlugin({ host: options.monaco })),
  eagerBuiltin(kitsManifest, (options) => createKitsPlugin({ ...options.kits })),
  // Точку поверхностей плагин объявляет структурно — `@/sdk` её пока не отдаёт, как и
  // `defineExtensionPoint`, которым чужой плагин мог бы объявить свою. Пока поверхности
  // вносит только сам превью, это ничего не стоит; появится вторая — точку надо вынести.
  eagerBuiltin(previewManifest, (options) => createPreviewPlugin({ host: options.preview })),
  // Приоритет 50: markdown забирает свои файлы у Monaco (10), потому что рендер — это то,
  // зачем .md открывают чаще всего. Порядок сборки на исход не влияет и влиять не должен:
  // при РАВНОМ приоритете победил бы зарегистрированный раньше, то есть Monaco, и предметный
  // редактор не получил бы ни одного файла.
  lazyBuiltin(markdownManifest, async (options) => {
    const markdown = await import('@/plugins/editor-markdown');
    return markdown.createMarkdownPlugin({ host: options.markdown });
  }),
  // Приоритет 100: структурный редактор забирает файл формы у Monaco, а Monaco остаётся
  // для всего остального текста. Оба отвечают `canOpen` по содержимому пробы, а не по
  // расширению, — потому и уживаются на одном `.json` без ветвления по имени файла.
  lazyBuiltin(schemaEditorManifest, async (options) => {
    const schemaEditor = await import('@/plugins/editor-schema');
    return schemaEditor.createSchemaEditorPlugin({
      host: options.schema,
      modelPoint: DocumentModelPoint,
    });
  }),
  lazyBuiltin(pluginManagerManifest, async (options) => {
    const pluginManager = await import('@/plugins/plugin-manager');
    return pluginManager.createPluginManagerPlugin({ ...options.pluginManager });
  }),
  // Опций нет ВОВСЕ: рабочую область ассистент собирает из возможностей сам, и порта
  // у него не осталось ни одного члена.
  lazyBuiltin(aiManifest, async () => {
    const ai = await import('@/plugins/ai');
    return ai.createAiPlugin();
  }),
  lazyBuiltin(codegenManifest, async (options) => {
    const codegen = await import('@/plugins/codegen');
    return codegen.createCodegenPlugin({ gaps: options.codegen });
  }),
  lazyBuiltin(templatesManifest, async (options) => {
    const templates = await import('@/plugins/templates');
    return templates.createTemplatesPlugin({ gaps: options.templates });
  }),
]);

/**
 * Встроенный набор, адресуемый ИМЕНЕМ: из него собирает состав `compose.fromProfile`.
 *
 * Карта, а не массив, потому что обращение к ней всегда одно и то же — «дай запись по
 * идентификатору из профиля». Массив заставил бы каждого потребителя писать свой `find`,
 * и первый же из них сделал бы ненайденное `undefined` вместо отказа.
 */
export const BUILTIN_PLUGINS: ReadonlyMap<string, BuiltinPluginEntry> = new Map(
  ENTRIES.map((entry) => [entry.manifest.id, entry])
);

/**
 * Манифесты состава — каталог встроенных, каким его видит всё, что не создаёт плагины.
 *
 * Резолвер возможностей берёт части отсюда: {@link BuiltinPluginManifest} и есть часть —
 * идентификатор, `provides`, `requires`, — и переходника между ними не нужно. Тем же списком
 * отвечает на вопрос «что вообще есть встроенного» тот, кто показывает плагины человеку:
 * у каждого манифеста `source.kind === 'builtin'`, и от манифеста плагина каталога проекта
 * он отличается только этим.
 */
export const BUILTIN_MANIFESTS: readonly BuiltinPluginManifest[] = Object.freeze(
  ENTRIES.map((entry) => entry.manifest)
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
  ENTRIES.filter((entry) => entry.loading === 'lazy').map((entry) => entry.manifest.id)
);

/**
 * Пространство имён встроенных плагинов.
 *
 * Префикс нужен ровно затем, зачем он нужен службам: плагин каталога проекта зовётся именем
 * своего КАТАЛОГА, и `.ui_builder/plugins/ai/` без пространства имён столкнулся бы со встроенным
 * ассистентом в одном реестре. Столкновение это неразрешимо изнутри — оба имени законны, —
 * поэтому разводятся они заранее.
 */
export const BUILTIN_PLUGIN_NAMESPACE = 'reformer.';

/**
 * Каталог плагина по его идентификатору: `reformer.ai` → `ai`.
 *
 * С пространством имён эти две строки разошлись, и всё, что адресует ПАПКУ — словарь локали,
 * храповик стартового графа, — обязано снимать префикс. Функция здесь, а не копией у каждого
 * зовущего: правило одно, и вторая его запись отстала бы от первой на следующем переименовании.
 *
 * Имя без префикса возвращается как есть: у плагина каталога проекта идентификатор и папка
 * совпадают, и снимать с него нечего.
 */
export function builtinPluginDirectory(id: string): string {
  return id.startsWith(BUILTIN_PLUGIN_NAMESPACE) ? id.slice(BUILTIN_PLUGIN_NAMESPACE.length) : id;
}

/**
 * Прежние имена встроенных плагинов → нынешние.
 *
 * ВЫВОДИТСЯ из карты, а не перечисляется руками, и это то же решение, что у {@link LAZY_PLUGIN_IDS}:
 * переименование было механическим (`ai` → `reformer.ai`), значит второй, написанный от руки
 * список разошёлся бы с первым молча — а «молча» здесь означает состав, собранный не тот,
 * который человек описал в конфиге.
 *
 * Что все встроенные живут в пространстве имён — утверждение ТЕСТА рядом, а не догадка,
 * поэтому пересечься с нынешним именем псевдоним не может. Отбор по префиксу тут не страховка
 * от этого, а условие осмысленности `slice`: снимать нечего у имени, которое префикса не имеет.
 */
const LEGACY_PLUGIN_IDS: ReadonlyMap<string, string> = new Map(
  [...BUILTIN_PLUGINS.keys()]
    .filter((id) => id.startsWith(BUILTIN_PLUGIN_NAMESPACE))
    .map((id): readonly [string, string] => [id.slice(BUILTIN_PLUGIN_NAMESPACE.length), id])
);

/**
 * Нынешнее имя плагина по тому, которое написал человек.
 *
 * Применяется к именам, пришедшим СНАРУЖИ, — поправкам состава из конфига запуска
 * (`plugins.enable`/`plugins.disable`, файл `.ui_builder/config.json` проекта). Такой файл
 * пишет и хранит пользователь, мигрировать его нам нечем и незачем: «без ассистента» обязано
 * значить то же самое и через год после переименования.
 *
 * Незнакомое имя возвращается КАК ЕСТЬ — отказ на опечатку остаётся за резолвером профилей,
 * и подменять его здесь «похожим» именем было бы ровно тем тихим пропуском, который тот
 * резолвер и заведён ловить.
 */
export function canonicalPluginId(id: string): string {
  return LEGACY_PLUGIN_IDS.get(id) ?? id;
}
