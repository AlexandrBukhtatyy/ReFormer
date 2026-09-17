/**
 * Спецификаторы, которые оболочка подставляет исполняемому коду плагина СВОИМИ объектами.
 *
 * Это обещание рантайма, а не пожелание: сборка плагина обязана держать каждый из них ВНЕШНИМ.
 * Вложи сборщик в `main.js` свою копию React или ядра форм — плагин получит второй экземпляр,
 * и поломка будет тихой: два дерева хуков, `instanceof Signal`, всегда отвечающий `false`,
 * вклады в чужой пустой реестр.
 *
 * Список — данные пакета, а не константа сборщика, по той же причине, что разбор манифеста:
 * читают его двое. Оболочка регистрирует ровно эти модули (и тестом сверяет свой реестр
 * с этим списком), инструменты автора плагина — выносят их из сборки. Разойдись два списка,
 * и плагин, собранный «правильно», падал бы на спецификаторе, которого нет в реестре.
 *
 * Подпути перечислены поимённо: реестр резолвит ТОЧНЫМ совпадением, и `@reformer/cdk` не
 * покрывает `@reformer/cdk/form-array`. Сборщику при этом годится и префикс — всё, что начинается
 * с `@reformer/`, защищено оболочкой целиком и подменить его плагин не может.
 *
 * @module @reformer/builder-plugin-api/plugin/runtime-modules
 */

/**
 * Подпути кита поимённо: оболочка отдаёт каждый из них, и сборка плагина обязана держать
 * их внешними. Часть подпутей оболочка резолвит бочкой, часть — отдельным модулем, но для
 * инструмента это разницы не имеет: и то и другое даёт ОНА, а не сборка плагина.
 */
const KIT_SUBPATHS: readonly string[] = [
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
  '@reformer/ui-kit/calendar',
  '@reformer/ui-kit/card',
  '@reformer/ui-kit/carousel',
  '@reformer/ui-kit/chart',
  '@reformer/ui-kit/checkbox',
  '@reformer/ui-kit/collapsible',
  '@reformer/ui-kit/combobox',
  '@reformer/ui-kit/command',
  '@reformer/ui-kit/context-menu',
  '@reformer/ui-kit/date-picker',
  '@reformer/ui-kit/dialog',
  '@reformer/ui-kit/direction',
  '@reformer/ui-kit/drawer',
  '@reformer/ui-kit/dropdown-menu',
  '@reformer/ui-kit/empty',
  '@reformer/ui-kit/example-card',
  '@reformer/ui-kit/field',
  '@reformer/ui-kit/fields',
  '@reformer/ui-kit/file-upload',
  '@reformer/ui-kit/form-array',
  '@reformer/ui-kit/form-field',
  '@reformer/ui-kit/form-wizard',
  '@reformer/ui-kit/hover-card',
  '@reformer/ui-kit/icon',
  '@reformer/ui-kit/input',
  '@reformer/ui-kit/input-group',
  '@reformer/ui-kit/input-mask',
  '@reformer/ui-kit/input-otp',
  '@reformer/ui-kit/input-password',
  '@reformer/ui-kit/item',
  '@reformer/ui-kit/kbd',
  '@reformer/ui-kit/label',
  '@reformer/ui-kit/list',
  '@reformer/ui-kit/marker',
  '@reformer/ui-kit/menubar',
  '@reformer/ui-kit/message',
  '@reformer/ui-kit/message-scroller',
  '@reformer/ui-kit/meta',
  '@reformer/ui-kit/native-select',
  '@reformer/ui-kit/navigation-menu',
  '@reformer/ui-kit/pagination',
  '@reformer/ui-kit/popover',
  '@reformer/ui-kit/progress',
  '@reformer/ui-kit/radio-group',
  '@reformer/ui-kit/resizable',
  '@reformer/ui-kit/scroll-area',
  '@reformer/ui-kit/section',
  '@reformer/ui-kit/select',
  '@reformer/ui-kit/separator',
  '@reformer/ui-kit/sheet',
  '@reformer/ui-kit/sidebar',
  '@reformer/ui-kit/skeleton',
  '@reformer/ui-kit/slider',
  '@reformer/ui-kit/sonner',
  '@reformer/ui-kit/spinner',
  '@reformer/ui-kit/switch',
  '@reformer/ui-kit/table',
  '@reformer/ui-kit/tabs',
  '@reformer/ui-kit/textarea',
  '@reformer/ui-kit/toggle',
  '@reformer/ui-kit/toggle-group',
  '@reformer/ui-kit/tooltip',
  '@reformer/ui-kit/tree',
  '@reformer/ui-kit/typography',
];

export const PLUGIN_RUNTIME_MODULES: readonly string[] = Object.freeze([
  '@builder/sdk',
  '@reformer/builder-plugin-api',
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@preact/signals-core',
  '@reformer/core',
  '@reformer/core/behaviors',
  '@reformer/core/model',
  '@reformer/core/signals',
  '@reformer/core/validation',
  '@reformer/core/validators',
  '@reformer/renderer-json',
  '@reformer/renderer-react',
  '@reformer/form-registry',
  '@reformer/form-registry/react',
  '@reformer/form-registry/storage',
  '@reformer/ui-kit',
  ...KIT_SUBPATHS,
  '@reformer/cdk',
  '@reformer/cdk/async-boundary',
  '@reformer/cdk/file-upload',
  '@reformer/cdk/form-array',
  '@reformer/cdk/form-field',
  '@reformer/cdk/form-wizard',
  '@reformer/cdk/list',
]);
