/**
 * Вход библиотеки: билдер, встроенный в приложение.
 *
 * ```tsx
 * createRoot(container).render(
 *   <AppProviders>
 *     <ReformerBuilder pluginsUrl="/builder-plugins/">
 *       <App />
 *     </ReformerBuilder>
 *   </AppProviders>
 * );
 * ```
 *
 * Компонент оборачивает приложение: на обычной странице рисует его и кнопку «Билдер», по кнопке
 * открывает билдер оверлеем, а в рамке превью показывает приложение — либо одну форму — без
 * билдера. Об устройстве приложения билдер не знает: превью рисует само приложение.
 *
 * Модуль лёгкий намеренно. Оболочка, состав плагинов и стили приезжают отдельным чанком
 * (`./embedded-runtime`) по первому включению режима, а в прод-сборке приложения компонент
 * рисует только приложение.
 *
 * Самостоятельный билдер — другой вход, `./main`.
 *
 * @module index
 */

import { createElement, type ReactElement } from 'react';
import {
  ReformerBuilderFrame,
  type EmbeddedRuntimeLoader,
  type ReformerBuilderProps,
} from './shell/embedded/ReformerBuilderFrame';

export type { FormModuleLoader } from './shell/embedded/FormStand';
export type {
  ReformerBuilderLabels,
  ReformerBuilderProps,
} from './shell/embedded/ReformerBuilderFrame';

/** Одна ссылка на всю страницу: загрузчик стоит в зависимостях эффекта запуска. */
const loadRuntime: EmbeddedRuntimeLoader = (request) =>
  import('./embedded-runtime').then((module) => module.start(request));

export function ReformerBuilder(props: ReformerBuilderProps): ReactElement {
  return createElement(ReformerBuilderFrame, { ...props, loadRuntime });
}
