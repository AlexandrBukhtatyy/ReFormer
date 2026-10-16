/**
 * Заглушка клиента для прод-сборки приложения: тот же публичный API, рисует только детей.
 *
 * Кнопка, рамка и стенд формы — код dev-режима: билдер открывается только там, где его отдаёт
 * плагин dev-сервера. В прод-сборке клиенту делать нечего, и плагин (`vite/plugin.mjs`)
 * в `vite build` подменяет им `@reformer/builder` псевдонимом — так в бандл приложения
 * не попадает ни кнопка, ни рамка, ни чтение `sessionStorage` при импорте.
 *
 * `.ts`, а не `.tsx`: `createElement` вместо JSX, чтобы модуль не зависел от `react/jsx-runtime`.
 * Типы реэкспортированы type-only: в сборке от настоящего клиента не остаётся ни байта.
 *
 * @module client/noop
 */

import { createElement, Fragment, type ReactElement } from 'react';
import type { ReformerBuilderProps } from './ReformerBuilder';

export type { ReformerBuilderLabels, ReformerBuilderProps } from './ReformerBuilder';
export type { FormModuleLoader } from './FormStand';

/** Рисует детей и ничего больше — сигнатура та же, что у настоящего компонента. */
export function ReformerBuilder(props: ReformerBuilderProps): ReactElement {
  return createElement(Fragment, null, props.children);
}
