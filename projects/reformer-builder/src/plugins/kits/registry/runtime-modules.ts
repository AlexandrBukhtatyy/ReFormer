/**
 * Модули кита, отдаваемые исполняемому коду: `@reformer/ui-kit`, `@reformer/cdk` и их подпути.
 *
 * Список лежит у плагина китов, а не в оболочке и не в составе приложения: какие пакеты
 * образуют кит и как они нарезаны на подпути — знание о ките. Состав находит этот файл обходом
 * папок плагинов (`application/composer/runtime-modules`) и сажает модули в реестр при его
 * создании; ни оболочка, ни состав имён этих пакетов не знают.
 *
 * Все модули здесь ЛЕНИВЫЕ: `@reformer/ui-kit` вынесен в собственный чанк осознанно,
 * `@reformer/cdk` в стартовом графе билдера отсутствует вовсе. Загрузчик — обычная функция
 * с `import()`: обернуть её в обещание реестра — дело состава, плагину `@/shell` не виден.
 *
 * ## Подпути перечисляются поимённо
 *
 * Реестр резолвит ТОЧНЫМ совпадением, поэтому подпуть, которого здесь нет, — отказ загрузки
 * («модуль недоступен»), а не выпадение в корень. До этого модуля не было ни одного подпути,
 * и форма с `import { ComboboxMulti } from '@reformer/ui-kit/combobox'` в билдере
 * не поднималась, хотя у пользователя собиралась.
 *
 * ## Два способа отдать подпуть, и выбор между ними не на глаз
 *
 * Отдавать любой подпуть БОЧКОЙ нельзя: она собрана из `export *` не по всем модулям кита,
 * и подпуть, вернувший бочку, отдал бы `undefined` вместо компонента — рендерер нарисовал бы
 * пустоту вместо отказа. Заводить каждому СВОЙ ленивый чанк тоже неверно: подпутей 77,
 * и состав сборки билдера вырос бы с 54 чанков до 147 (измерено) ради модулей, которые
 * в бочке и так лежат.
 *
 * Поэтому деление по факту: подпуть, ВСЕ экспорты которого есть в бочке, отдаётся бочкой —
 * её код форма грузит и без того. Остальные — каждый своим чанком, потому что за ними стоят
 * их зависимости (`cmdk` у `command`, `recharts` у `chart`, `embla-carousel-react`
 * у `carousel`), и общая загрузка тянула бы их все ради одного `combobox`.
 *
 * Факт покрытия держится не списком в голове, а тестом на НАСТОЯЩИХ модулях кита
 * (`./runtime-modules.test.ts`): уедь символ из бочки в отдельный модуль — и алиас стал бы тем
 * самым молчаливым `undefined`, ради предотвращения которого всё это и разделено.
 *
 * У `@reformer/cdk` та же ловушка с другой стороны: подпуть БОГАЧЕ корня (`Step`, `Slot`,
 * `FormWizardPrev` есть в `./form-wizard`, но не в бочке), поэтому его подпути перечислены
 * поимённо — их шесть, и они закрыты полностью.
 *
 * @module plugins/kits/registry/runtime-modules
 */

/** Ленивый модуль: спецификатор и то, как его достать. */
type LazyModule = readonly [specifier: string, load: () => Promise<unknown>];

/**
 * Один загрузчик бочки на все алиасы: тот же спецификатор в `import()` — тот же чанк
 * и тот же объект модуля.
 */
const kitBarrel = (): Promise<unknown> => import('@reformer/ui-kit');

/** Подпути, чьи экспорты целиком есть в бочке. */
export const KIT_BARREL_SUBPATHS: readonly string[] = [
  '@reformer/ui-kit/accordion',
  '@reformer/ui-kit/alert',
  '@reformer/ui-kit/alert-dialog',
  '@reformer/ui-kit/aspect-ratio',
  '@reformer/ui-kit/async-boundary',
  '@reformer/ui-kit/attachment',
  '@reformer/ui-kit/avatar',
  '@reformer/ui-kit/badge',
  '@reformer/ui-kit/box',
  '@reformer/ui-kit/breadcrumb',
  '@reformer/ui-kit/bubble',
  '@reformer/ui-kit/button',
  '@reformer/ui-kit/button-group',
  '@reformer/ui-kit/card',
  '@reformer/ui-kit/checkbox',
  '@reformer/ui-kit/collapsible',
  '@reformer/ui-kit/context-menu',
  '@reformer/ui-kit/dialog',
  '@reformer/ui-kit/direction',
  '@reformer/ui-kit/dropdown-menu',
  '@reformer/ui-kit/empty',
  '@reformer/ui-kit/example-card',
  '@reformer/ui-kit/field',
  '@reformer/ui-kit/file-upload',
  '@reformer/ui-kit/form-array',
  '@reformer/ui-kit/form-field',
  '@reformer/ui-kit/form-wizard',
  '@reformer/ui-kit/hover-card',
  '@reformer/ui-kit/icon',
  '@reformer/ui-kit/info-hint',
  '@reformer/ui-kit/input',
  '@reformer/ui-kit/input-group',
  '@reformer/ui-kit/input-mask',
  '@reformer/ui-kit/input-password',
  '@reformer/ui-kit/item',
  '@reformer/ui-kit/kbd',
  '@reformer/ui-kit/label',
  '@reformer/ui-kit/list',
  '@reformer/ui-kit/marker',
  '@reformer/ui-kit/menubar',
  '@reformer/ui-kit/message',
  '@reformer/ui-kit/native-select',
  '@reformer/ui-kit/navigation-menu',
  '@reformer/ui-kit/pagination',
  '@reformer/ui-kit/popover',
  '@reformer/ui-kit/progress',
  '@reformer/ui-kit/radio-group',
  '@reformer/ui-kit/scroll-area',
  '@reformer/ui-kit/section',
  '@reformer/ui-kit/select',
  '@reformer/ui-kit/separator',
  '@reformer/ui-kit/sheet',
  '@reformer/ui-kit/skeleton',
  '@reformer/ui-kit/slider',
  '@reformer/ui-kit/spinner',
  '@reformer/ui-kit/switch',
  '@reformer/ui-kit/tabs',
  '@reformer/ui-kit/textarea',
  '@reformer/ui-kit/toggle',
  '@reformer/ui-kit/toggle-group',
  '@reformer/ui-kit/tooltip',
  '@reformer/ui-kit/tree',
  '@reformer/ui-kit/typography',
];

/** Подпути со своим чанком: в бочке их нет, и за ними тянутся их зависимости. */
const KIT_OWN_MODULES: readonly LazyModule[] = [
  ['@reformer/ui-kit/calendar', () => import('@reformer/ui-kit/calendar')],
  ['@reformer/ui-kit/carousel', () => import('@reformer/ui-kit/carousel')],
  ['@reformer/ui-kit/chart', () => import('@reformer/ui-kit/chart')],
  ['@reformer/ui-kit/combobox', () => import('@reformer/ui-kit/combobox')],
  ['@reformer/ui-kit/command', () => import('@reformer/ui-kit/command')],
  ['@reformer/ui-kit/date-picker', () => import('@reformer/ui-kit/date-picker')],
  ['@reformer/ui-kit/drawer', () => import('@reformer/ui-kit/drawer')],
  ['@reformer/ui-kit/fields', () => import('@reformer/ui-kit/fields')],
  ['@reformer/ui-kit/input-otp', () => import('@reformer/ui-kit/input-otp')],
  ['@reformer/ui-kit/message-scroller', () => import('@reformer/ui-kit/message-scroller')],
  ['@reformer/ui-kit/meta', () => import('@reformer/ui-kit/meta')],
  ['@reformer/ui-kit/resizable', () => import('@reformer/ui-kit/resizable')],
  ['@reformer/ui-kit/sidebar', () => import('@reformer/ui-kit/sidebar')],
  ['@reformer/ui-kit/sonner', () => import('@reformer/ui-kit/sonner')],
  ['@reformer/ui-kit/table', () => import('@reformer/ui-kit/table')],
];

/** Подпути кита: спецификатор → загрузчик. */
export const KIT_SUBPATH_MODULES: readonly LazyModule[] = [
  ...KIT_BARREL_SUBPATHS.map((specifier) => [specifier, kitBarrel] as const),
  ...KIT_OWN_MODULES,
];

/**
 * Что плагин отдаёт исполняемому коду. Имя экспорта — соглашение обхода папок.
 * Порядок не значим: реестр строит из этого карту.
 */
export const lazyModules: readonly LazyModule[] = [
  ['@reformer/ui-kit', kitBarrel],
  ['@reformer/cdk', () => import('@reformer/cdk')],
  ['@reformer/cdk/async-boundary', () => import('@reformer/cdk/async-boundary')],
  ['@reformer/cdk/file-upload', () => import('@reformer/cdk/file-upload')],
  ['@reformer/cdk/form-array', () => import('@reformer/cdk/form-array')],
  ['@reformer/cdk/form-field', () => import('@reformer/cdk/form-field')],
  ['@reformer/cdk/form-wizard', () => import('@reformer/cdk/form-wizard')],
  ['@reformer/cdk/list', () => import('@reformer/cdk/list')],
  ...KIT_SUBPATH_MODULES,
];
