/**
 * Публичная поверхность плагина: то, что берёт композиция, и ничего больше.
 *
 * Всё остальное — связь с буфером, разметка, состояние вида, настройка Monaco — внутреннее
 * и меняется без согласования. Композиции нужно ровно три вещи:
 *
 * ```ts
 * const monacoFocus = createFocusRegistry();
 *
 * createMonacoEditorPlugin({
 *   host: monacoHost,       // порт платформы: рабочая область, диагностики, перевод
 *   focus: monacoFocus,     // тот же реестр уходит в createModelDocument
 *   i18n: i18n.forPlugin('editor-monaco'), // пока в PluginContext нет своего i18n
 * });
 *
 * // и там, где рабочая область надстраивает модель над буфером:
 * createModelDocument({ …, isTextEditorFocused: () => monacoFocus.isFocused(id) });
 * ```
 *
 * **Реестр фокуса обязан быть общим.** Это не удобство подключения, а условие правильности:
 * перерисовка буфера из `print(model)` откладывается, пока человек печатает, и «печатает ли
 * он» знает только редактор. Свой реестр у плагина и свой у рабочей области означали бы,
 * что ход ассистента затирает набранное на полуслове.
 *
 * @module plugins/editor-monaco/index
 */

export { createMonacoEditorPlugin, monacoEditorContribution } from './plugin';
export { MONACO_EDITOR_ID, MONACO_PLUGIN_ID, type MonacoEditorPluginOptions } from './plugin';
export { MONACO_EDITOR_PRIORITY } from './language';
export { createFocusRegistry, type MonacoFocusRegistry } from './focus';
export { createViewStateRegistry, type ViewStateRegistry } from './view-state';
export type { MessageSink, MonacoDiagnostics, MonacoDocument, MonacoHost, Translate } from './host';
