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

export * from './plugin/storage';
export * from './plugin/types';
export * from './primitives/capability';
export * from './primitives/command';
export * from './primitives/disposable';
export * from './primitives/event';
export * from './primitives/extension-point';
export * from './primitives/resource';
export * from './primitives/semver';
export * from './primitives/service';
export * from './primitives/when-context';
export * from './primitives/when-expr';
export * from './services/diagnostics/fixes';
export * from './services/diagnostics/types';
export * from './services/documents';
export * from './services/i18n';
export * from './services/validation/types';
export * from './services/workspace-files';
export * from './ui/contributions/decorations';
export * from './ui/contributions/editors';
export * from './ui/contributions/plugin-settings';
export * from './ui/slots';
export * from './workspace/document';
export * from './workspace/model/editor-view-states';
export * from './workspace/model/provider';
export * from './workspace/model/text-editor-focus';
export * from './workspace/resource-names';
export * from './workspace/write-options';
