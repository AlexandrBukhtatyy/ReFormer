/**
 * Публичная поверхность плагина: то, что берёт композиция, и ничего больше.
 *
 * Всё остальное — связь с буфером, разметка, состояние вида, настройка Monaco — внутреннее
 * и меняется без согласования. Композиции нужно ровно три вещи:
 *
 * ```ts
 * // реестр фокуса — платформенный: композиция регистрирует его службой и отдаёт
 * // рабочей области (`createDocumentModels({ isTextEditorFocused })`)
 * const focus = createTextEditorFocusRegistry();
 * services.register(TextEditorFocusToken, focus);
 *
 * createMonacoEditorPlugin({
 *   host: monacoHost,       // порт платформы: рабочая область, диагностики, перевод
 *   focus,                  // тот же объект, что в службе; без опции плагин возьмёт службу
 *   i18n: i18n.forPlugin('editor-monaco'), // пока в PluginContext нет своего i18n
 * });
 * ```
 *
 * **Реестр фокуса обязан быть общим — и он не наш.** Перерисовка буфера из `print(model)`
 * откладывается, пока человек печатает, и «печатает ли он» знает только редактор — любой,
 * а не только этот. Поэтому реестр живёт в платформе (`TextEditorFocusToken` в `@reformer/builder-plugin-api`),
 * а плагин в него только пишет: свой реестр означал бы, что ход ассистента затирает
 * набранное на полуслове.
 *
 * @module plugins/editor-monaco/index
 */

export { createMonacoEditorPlugin, monacoEditorContribution } from './plugin';
export { MONACO_EDITOR_ID, MONACO_PLUGIN_ID, type MonacoEditorPluginOptions } from './plugin';
export { MONACO_EDITOR_PRIORITY } from './runtime/language';
export { viewStatesOver, type ViewStateRegistry } from './sync/view-state';

// Тело редактора наружу — возможностью: его показывают соседи (markdown «рядом», исходник
// схемы), а плагины друг друга не импортируют.
export { TextEditorCapability, type TextEditorProvider } from './plugin';
export type { MessageSink, MonacoDiagnostics, MonacoDocument, MonacoHost, Translate } from './host';
