/**
 * Встроенные плагины приложения — картой «идентификатор → запись», собранной ПО ПАПКАМ.
 *
 * Место это — в `application/`, а не в оболочке, и разница не в адресе файла. Состав приложения
 * оболочке НЕИЗВЕСТЕН: она объявляет форму композиции (`shell/boot/composition`) и получает её
 * параметром, а «какие плагины образуют ReFormer Builder» отвечают отсюда. Поэтому и тип опций
 * импортируется из оболочки, а не объявляется здесь: опции — это то, что `boot` умеет ДАТЬ,
 * а список — то, что он получает.
 *
 * ## Списка плагинов здесь нет — есть правило, как их найти
 *
 * Встроенный плагин — папка `plugins/<домен>/<плагин>` с `manifest.json` и барелем `index.ts`.
 * Карта собирается обходом этих папок (`import.meta.glob`), а не перечислением: новый плагин —
 * новая папка и его имя в профиле, без правки этого файла. Прежде каждый плагин был записан
 * здесь трижды — импорт манифеста, запись с фабрикой, строка в таблице каталогов, — и три списка
 * обязаны были совпасть.
 *
 * Шаблон обхода — литерал, и это требование сборки: по нему Vite заранее знает, какие файлы
 * станут отдельными чанками. Собрать состав по имени из конфига можно, а взять по имени КОД
 * нельзя — код упакован заранее.
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
 * проекта, и проходит ТОТ ЖЕ разбор (`parsePluginManifestValue`). Манифесты приезжают статически,
 * и это листы: JSON не тянет за собой ни строчки кода плагина. Иначе объявление ленивого было бы
 * нечитаемо до его загрузки, а отвечать «собирается ли состав» надо раньше.
 *
 * Создаёт плагин его ФАБРИКА СОСТАВА — `export default` бареля. Контракт у всех один: функция
 * от набора портов ({@link BuiltinPluginPorts}), из которого плагин берёт своё по имени. Раньше
 * фабрики звались по-разному и аргументы каждой собирались здесь — поэтому найти плагин по папке
 * было нельзя: надо было знать, как его создать.
 *
 * Каталогу идентификатор НЕ равен: плагин зовётся `reformer.ai`, а лежит в `plugins/reformer/ai`.
 * Пространство имён (`BUILTIN_PLUGIN_NAMESPACE`) разводит встроенных с плагинами каталога
 * проекта, у которых имя — имя папки в `.ui_builder/plugins`. Идентификатор берётся из
 * манифеста, каталог — из пути, по которому манифест найден ({@link builtinPluginDirectory}).
 *
 * Порядок записей на поведение не влияет — рантайм плагинов не строит графа зависимостей
 * (см. `shell/platform/plugin/registry`) и проверяет это тестом «порядок активации ничего
 * не значит». Фактический порядок сборки задаёт профиль, а не эта карта.
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
 * Ленивость — умолчание: плагин, найденный обходом, приезжает своим файлом. Статических двое,
 * и только они записаны руками ({@link EAGER_FACTORIES}): статический импорт шаблоном не
 * выразить, не затащив в стартовый граф всех. Причина у каждого — В ЕГО МАНИФЕСТЕ, полем
 * `builtin.reason`, и разбор требует её у каждого `eager`.
 *
 * @module application/composer/builtin-plugins
 */

import type { BuiltinPluginsOptions } from '@/shell/boot/composition';
import { parsePluginManifestValue } from '@reformer/builder-plugin-api/internal';
import { type BuiltinPluginManifest } from '@reformer/builder-plugin-api/internal';
import type { Plugin } from '@reformer/builder-plugin-api/internal';
import { EditorPoint } from '@reformer/builder-plugin-api/internal';
import { PanelPoint } from '@reformer/builder-plugin-api/internal';
import { DocumentModelPoint } from '@reformer/builder-plugin-api/internal';
import { BUILDER_VERSION } from '@/shell/platform/version';

// Код — только статических: их значения нужны композиции при сборке, и довод у каждого в его
// манифесте. Ленивых здесь нет ВОВСЕ — ни значением, ни типом: их код приезжает обходом ниже.
import createKitsPlugin from '@/plugins/kits/registry';
import createSchemaValidatorPlugin from '@/plugins/reformer/validator';

/**
 * Что получает фабрика состава: порты оболочки и точки расширения.
 *
 * Порты — то, что `boot` умеет дать ({@link BuiltinPluginsOptions}). Точки подставляются ЗДЕСЬ:
 * плагин объявляет их структурно, потому что публичный SDK панелей, редакторов и моделей
 * документов не отдаёт, а импортировать `@/shell` плагину нельзя.
 *
 * Плагин берёт из набора своё ПО ИМЕНИ и объявляет нужное сам, типом параметра фабрики. Набор
 * один на всех — поэтому фабрику можно позвать, не зная, какой это плагин.
 */
export interface BuiltinPluginPorts extends BuiltinPluginsOptions {
  readonly panelPoint: typeof PanelPoint;
  readonly editorPoint: typeof EditorPoint;
  readonly modelPoint: typeof DocumentModelPoint;
}

/** Набор портов для фабрик состава из опций, собранных оболочкой. */
export function builtinPluginPorts(options: BuiltinPluginsOptions): BuiltinPluginPorts {
  return {
    files: options.files,
    monaco: options.monaco,
    markdown: options.markdown,
    panelPoint: PanelPoint,
    editorPoint: EditorPoint,
    modelPoint: DocumentModelPoint,
  };
}

/** Фабрика состава — `export default` бареля встроенного плагина. */
type BuiltinPluginFactory = (ports: BuiltinPluginPorts) => Plugin;

/**
 * Манифесты ВСЕХ встроенных, включая ленивых: JSON — лист, кода плагина за ним нет.
 * Папка с манифестом и есть плагин; ядро домена (`core/`) манифеста не имеет.
 */
const MANIFESTS = import.meta.glob<unknown>('../../plugins/*/*/manifest.json', {
  eager: true,
  import: 'default',
});

/**
 * Барели ленивых — отложенными импортами: каждый становится своим файлом сборки.
 *
 * Исключения — отрицательными шаблонами, и оба вида нужны. Ядра доменов — не плагины, а без
 * исключения их барели стали бы отдельными точками входа. Статические импортированы выше, и
 * отложенный импорт того же модуля ничего бы не отделил — сборка лишь предупредила бы об этом.
 */
const LAZY_MODULES = import.meta.glob<{ readonly default: BuiltinPluginFactory }>([
  '../../plugins/*/*/index.ts',
  '!../../plugins/*/core/index.ts',
  '!../../plugins/kits/registry/index.ts',
  '!../../plugins/reformer/validator/index.ts',
]);

/**
 * Фабрики статических плагинов — по каталогу.
 *
 * Единственное, что здесь записано руками, и записано дважды: каталог стоит ещё и в исключениях
 * {@link LAZY_MODULES}. Шаблон обхода обязан быть литералом, поэтому вывести одно из другого
 * нельзя; расхождение ловит сборка карты ниже — каталог, попавший в оба набора, бросает.
 */
const EAGER_FACTORIES: Readonly<Record<string, BuiltinPluginFactory>> = {
  'kits/registry': createKitsPlugin,
  'reformer/validator': createSchemaValidatorPlugin,
};

/** `…/plugins/<домен>/<плагин>/<файл>` → `<домен>/<плагин>`. */
function directoryOf(file: string): string {
  const match = /\/plugins\/([^/]+\/[^/]+)\/[^/]+$/.exec(file);
  if (match?.[1] === undefined) throw new Error(`«${file}» — не файл встроенного плагина`);
  return match[1];
}

/**
 * Общее у всех записей — манифест плагина и каталог, где он лежит.
 *
 * Объявления в записи НЕТ ни одного: `provides`, `requires`, имя и способ доставки читаются
 * из манифеста, и другого их места не существует.
 */
interface BuiltinPluginBase {
  readonly manifest: BuiltinPluginManifest;
  /** Каталог внутри `src/plugins`: `домен/плагин`. */
  readonly directory: string;
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
 * параллельных запросов, сколько плагинов, а не цепочку.
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
function builtinManifest(raw: unknown, directory: string): BuiltinPluginManifest {
  const parsed = parsePluginManifestValue(raw, { kind: 'builtin' }, { builder: BUILDER_VERSION });
  if (!parsed.ok) {
    throw new Error(
      `манифест встроенного плагина «${directory}» не разбирается: ${parsed.problem.message}`
    );
  }
  return parsed.manifest;
}

/**
 * Запись плагина по его каталогу: манифест сведён с тем, как приезжает код.
 *
 * Сверка — ради того, что компилятор связать не может: `builtin.loading` приезжает из JSON
 * строкой, а способ доставки — это то, в каком наборе оказался барель. Разойдись они, состав
 * получил бы промис там, где его не ждут, либо обещание отдельного файла, которого нет.
 */
function builtinEntry(directory: string, raw: unknown): BuiltinPluginEntry {
  const manifest = builtinManifest(raw, directory);
  const eager = EAGER_FACTORIES[directory];
  const load = LAZY_MODULES[`../../plugins/${directory}/index.ts`];
  if (eager !== undefined && load !== undefined) {
    throw new Error(`«${manifest.id}»: статический плагин не исключён из обхода ленивых`);
  }
  if (eager !== undefined) {
    if (manifest.builtin.loading !== 'eager') {
      throw new Error(
        `«${manifest.id}»: манифест объявляет «lazy», а плагин импортирован статически`
      );
    }
    return {
      manifest,
      directory,
      loading: 'eager',
      create: (options) => eager(builtinPluginPorts(options)),
    };
  }
  if (load === undefined) throw new Error(`«${manifest.id}»: в ${directory} нет бареля index.ts`);
  if (manifest.builtin.loading !== 'lazy') {
    throw new Error(`«${manifest.id}»: манифест объявляет «eager», а плагин грузится файлом`);
  }
  return {
    manifest,
    directory,
    loading: 'lazy',
    create: async (options) => {
      const module = await load();
      return module.default(builtinPluginPorts(options));
    },
  };
}

const ENTRIES: readonly BuiltinPluginEntry[] = Object.freeze(
  Object.entries(MANIFESTS)
    .map(([file, raw]) => builtinEntry(directoryOf(file), raw))
    .sort((a, b) => a.directory.localeCompare(b.directory))
);

// Обратная сверка: папка с барелем, но без манифеста, — плагин, который не попадёт в состав
// никогда и молча. Статического без манифеста ловит та же проверка.
for (const directory of [
  ...Object.keys(LAZY_MODULES).map(directoryOf),
  ...Object.keys(EAGER_FACTORIES),
]) {
  if (!ENTRIES.some((entry) => entry.directory === directory)) {
    throw new Error(`в «plugins/${directory}» есть барель плагина, но нет manifest.json`);
  }
}

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
if (BUILTIN_PLUGINS.size !== ENTRIES.length) {
  // `new Map` на повторный ключ молча перезаписывает — один плагин исчез бы из состава.
  throw new Error('два встроенных плагина объявили один идентификатор');
}

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
 * Каталог плагина по его идентификатору: `reformer.ai` → `reformer/ai`.
 *
 * Никакое преобразование строки этого не знает: `reformer.editor-schema` лежит в
 * `reformer/editor`, а `reformer.preview` — в `base/preview`. Каталог — это путь, по которому
 * найден манифест с таким идентификатором.
 *
 * Всё, что адресует ПАПКУ — словарь локали, храповик стартового графа, границу «оболочка не
 * знает стека», — берёт её здесь, а не копией у каждого зовущего.
 *
 * Незнакомое имя возвращается как есть: у плагина каталога проекта идентификатор и папка
 * совпадают.
 */
export function builtinPluginDirectory(id: string): string {
  return BUILTIN_PLUGINS.get(id)?.directory ?? id;
}

/**
 * Прежние имена встроенных плагинов → нынешние.
 *
 * ВЫВОДИТСЯ из карты, а не перечисляется руками: переименование было механическим
 * (`ai` → `reformer.ai`), значит второй, написанный от руки список разошёлся бы с первым молча —
 * а «молча» здесь означает состав, собранный не тот, который человек описал в конфиге.
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
