/**
 * Публичная поверхность плагина: то, что берут стенды и тесты, и ничего больше.
 *
 * Всё остальное — связь с буфером, разметка, состояние вида, настройка Monaco — внутреннее
 * и меняется без согласования. В приложении плагин создаёт `main.ts`, без аргументов: рабочую
 * область, свод находок, реестр фокуса и хранилище снимков вида он берёт из контекста сам.
 *
 * **Реестр фокуса обязан быть общим — и он не наш.** Перерисовка буфера из `print(model)`
 * откладывается, пока человек печатает, и «печатает ли он» знает только редактор — любой,
 * а не только этот. Поэтому реестр живёт в платформе (`TextEditorFocusToken` в `@reformer/builder-plugin-api`),
 * а плагин в него только пишет: свой реестр означал бы, что ход ассистента затирает
 * набранное на полуслове.
 *
 * @module plugins/base/monaco-editor/index
 */

export { createMonacoEditorPlugin, monacoEditorContribution } from './plugin';
export { MONACO_EDITOR_ID, MONACO_PLUGIN_ID, type MonacoEditorPluginOptions } from './plugin';
export { MONACO_EDITOR_PRIORITY } from './runtime/language';
export { viewStatesOver, type ViewStateRegistry } from './sync/view-state';

// Тело редактора наружу — возможностью: его показывают соседи (markdown «рядом», исходник
// схемы), а плагины друг друга не импортируют.
export { TextEditorCapability, type TextEditorProvider } from './plugin';
export type { MessageSink, MonacoDiagnostics, MonacoDocument, MonacoHost, Translate } from './host';
