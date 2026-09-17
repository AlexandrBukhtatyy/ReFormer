/**
 * Вход для ИНСТРУМЕНТОВ автора плагина: сборщика, валидатора, упаковщика.
 *
 * Не для кода плагина — тому хватает `.`. Здесь то, что нужно тем, кто плагин проверяет
 * и собирает ДО оболочки, и что обязано совпадать с оболочкой буквально:
 *
 * - **разбор манифеста** — тот же, которым оболочка решает, грузить ли плагин;
 * - **список модулей рантайма** — те же спецификаторы, которые оболочка подставляет своими
 *   объектами и которые сборка обязана держать внешними;
 * - **нормализация пути модуля** — та же, которой линковщик ищет точку входа.
 *
 * В отличие от `./internal`, это контракт: он версионируется вместе с пакетом, потому что
 * инструмент, собранный против одной версии, проверяет плагины для оболочек этой версии.
 *
 * @module @reformer/builder-plugin-api/tooling
 */

export { parsePluginManifest, parsePluginManifestValue } from './plugin/manifest-parser';
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
  type PluginStyles,
  type ProjectPluginManifest,
} from './plugin/manifest';
export { PLUGIN_RUNTIME_MODULES } from './plugin/runtime-modules';
export { normalizeModulePath } from './primitives/module-path';
