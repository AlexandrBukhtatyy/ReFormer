/**
 * Платформенные примитивы ЦЕЛИКОМ — вход для оболочки билдера, а не для плагина.
 *
 * Контрактом плагина остаётся `.` (см. `./index`), и он обязан оставаться КУРИРОВАННЫМ:
 * попади сюда путевая арифметика, `toDisposable` и генератор неповторяющихся имён, свойство
 * «цена платформы для плагина видна в одном файле» перестало бы что-либо значить. Но модули
 * от этого не делятся надвое: `makeResourceId` живёт там же, где `ResourceId`, потому что
 * это его конструктор, и растащить их значило бы завести два места для одного понятия.
 *
 * Отсюда второй вход. Обещаний совместимости у него нет: он существует ради того, чтобы
 * оболочка билдера пользовалась ТЕМИ ЖЕ модулями, а не своей копией, и меняется вместе с ней.
 *
 * @module @reformer/builder-plugin-api/internal
 */

export * from './plugin/layout.js';
export * from './plugin/manifest.js';
export * from './plugin/manifest-parser.js';
export * from './plugin/messages-bundle.js';
export * from './plugin/permissions.js';
export * from './plugin/plugin-exports.js';
export * from './plugin/runtime-modules.js';
export * from './plugin/storage.js';
export * from './plugin/types.js';
export * from './primitives/capability.js';
export * from './primitives/command.js';
export * from './primitives/disposable.js';
export * from './primitives/event.js';
export * from './primitives/extension-point.js';
export * from './primitives/module-path.js';
export * from './primitives/resource.js';
export * from './primitives/semver.js';
export * from './primitives/service.js';
export * from './primitives/when-context.js';
export * from './primitives/when-expr.js';
export * from './services/context-keys.js';
export * from './services/diagnostics/fixes.js';
export * from './services/diagnostics/service.js';
export * from './services/diagnostics/types.js';
export * from './services/documents.js';
export * from './services/i18n.js';
export * from './services/notifications.js';
export * from './services/plugin-settings.js';
export * from './services/prompt.js';
export * from './services/resource-clipboard.js';
export * from './services/selection.js';
export * from './services/settings.js';
export * from './services/theme.js';
export * from './services/validation/types.js';
export * from './services/workspace-files.js';
export * from './services/plugins-catalog.js';
export * from './services/workspace-resources.js';
export * from './services/workspace-save.js';
export * from './services/preview.js';
export * from './services/document-models.js';
export * from './services/modules.js';
export * from './services/host-messages.js';
export * from './kits/catalog.js';
export * from './kits/descriptor.js';
export * from './kits/field-frame.js';
export * from './kits/service.js';
export * from './kits/source.js';
export * from './kits/validator.js';
export * from './ui/contributions/decorations.js';
export * from './ui/contributions/editors.js';
export * from './ui/contributions/plugin-settings.js';
export * from './ui/keyboard/keybinding-rules.js';
export * from './ui/keyboard/keybindings.js';
export * from './ui/keyboard/keymap.js';
export * from './ui/keyboard/scope.js';
export * from './ui/menu/editor-menu.js';
export * from './ui/menu/menu.js';
export * from './ui/menu/palette.js';
export * from './ui/menu/resource-menu.js';
export * from './ui/slots.js';
export * from './ui/useActiveDocument.js';
export * from './ui/plugin-scope.js';
export * from './ui/useLocale.js';
export * from './ui/useTranslate.js';
export * from './workspace/document.js';
export * from './workspace/model/editor-view-states.js';
export * from './workspace/model/provider.js';
export * from './workspace/model/model-document.js';
export * from './workspace/model/text-editor-focus.js';
export * from './workspace/resource-names.js';
export * from './workspace/write-options.js';
