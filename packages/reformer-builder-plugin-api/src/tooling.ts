/**
 * Вход для ИНСТРУМЕНТОВ автора плагина: сборщика, валидатора, упаковщика.
 *
 * Не для кода плагина — тому хватает `.`. Здесь то, что нужно тем, кто плагин проверяет
 * и собирает ДО оболочки, и что обязано совпадать с оболочкой буквально:
 *
 * - **разбор манифеста** — тот же, которым оболочка решает, грузить ли плагин;
 * - **список модулей рантайма** — те же спецификаторы, которые оболочка подставляет своими
 *   объектами и которые сборка обязана держать внешними;
 * - **нормализация пути модуля** — та же, которой линковщик ищет точку входа;
 * - **раскладка каталога и разбор словаря** — те же потолок файлов, расширения кода и форма
 *   `locales/*.json`, по которым загрузчик оболочки отказывает плагину;
 * - **узнавание плагина в экспортах** точки входа — то же, что у загрузчика (`not-a-plugin`).
 *
 * В отличие от `./internal`, это контракт: он версионируется вместе с пакетом, потому что
 * инструмент, собранный против одной версии, проверяет плагины для оболочек этой версии.
 *
 * @module @reformer/builder-plugin-api/tooling
 */

export {
  isPluginCodeFile,
  PLUGIN_CATALOG_DIR,
  PLUGIN_CODE_EXTENSIONS,
  PLUGIN_FILE_LIMIT,
  PLUGIN_SKIPPED_DIRS,
} from './plugin/layout.js';
export {
  parsePluginManifest,
  parsePluginManifestValue,
  parsePluginSourceManifest,
} from './plugin/manifest-parser.js';
export { parseMessagesBundle } from './plugin/messages-bundle.js';
export {
  isPluginPermission,
  PLUGIN_PERMISSIONS,
  type PluginPermission,
} from './plugin/permissions.js';
export { pluginFromExports } from './plugin/plugin-exports.js';
export {
  BUILDER_API_VERSION,
  PLUGIN_MANIFEST_FILE,
  type BuiltinDelivery,
  type BuiltinPluginManifest,
  type DeclaredKeybinding,
  type ManifestOf,
  type ManifestParseResult,
  type PluginContributes,
  type PluginManifest,
  type PluginManifestBase,
  type PluginProblem,
  type PluginProblemCode,
  type PluginRequirements,
  type PluginSource,
  type PluginSourceManifest,
  type PluginStyles,
  type ProjectPluginManifest,
} from './plugin/manifest.js';
export { PLUGIN_RUNTIME_MODULES } from './plugin/runtime-modules.js';
export {
  isBundledPluginModule,
  packageNameOf,
  PLUGIN_BUNDLED_PACKAGES,
} from './plugin/bundled-modules.js';
export { normalizeModulePath } from './primitives/module-path.js';
