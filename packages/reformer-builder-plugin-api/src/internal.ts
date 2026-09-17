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

export * from './plugin/layout';
export * from './plugin/manifest';
export * from './plugin/manifest-parser';
export * from './plugin/messages-bundle';
export * from './plugin/permissions';
export * from './plugin/plugin-exports';
export * from './plugin/runtime-modules';
export * from './plugin/storage';
export * from './plugin/types';
export * from './primitives/capability';
export * from './primitives/command';
export * from './primitives/disposable';
export * from './primitives/event';
export * from './primitives/extension-point';
export * from './primitives/module-path';
export * from './primitives/resource';
export * from './primitives/semver';
export * from './primitives/service';
export * from './primitives/when-context';
export * from './primitives/when-expr';
export * from './services/context-keys';
export * from './services/diagnostics/fixes';
export * from './services/diagnostics/service';
export * from './services/diagnostics/types';
export * from './services/documents';
export * from './services/i18n';
export * from './services/notifications';
export * from './services/plugin-settings';
export * from './services/prompt';
export * from './services/resource-clipboard';
export * from './services/selection';
export * from './services/settings';
export * from './services/theme';
export * from './services/validation/types';
export * from './services/workspace-files';
export * from './services/workspace-save';
export * from './ui/contributions/decorations';
export * from './ui/contributions/editors';
export * from './ui/contributions/plugin-settings';
export * from './ui/keyboard/keybinding-rules';
export * from './ui/keyboard/keybindings';
export * from './ui/keyboard/keymap';
export * from './ui/keyboard/scope';
export * from './ui/menu/editor-menu';
export * from './ui/menu/menu';
export * from './ui/menu/palette';
export * from './ui/menu/resource-menu';
export * from './ui/slots';
export * from './ui/useActiveDocument';
export * from './ui/useLocale';
export * from './ui/useTranslate';
export * from './workspace/document';
export * from './workspace/model/editor-view-states';
export * from './workspace/model/provider';
export * from './workspace/model/text-editor-focus';
export * from './workspace/resource-names';
export * from './workspace/write-options';
