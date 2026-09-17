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
  '@reformer/cdk',
  '@reformer/cdk/async-boundary',
  '@reformer/cdk/file-upload',
  '@reformer/cdk/form-array',
  '@reformer/cdk/form-field',
  '@reformer/cdk/form-wizard',
  '@reformer/cdk/list',
]);
