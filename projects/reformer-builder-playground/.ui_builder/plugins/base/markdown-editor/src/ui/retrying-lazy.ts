/**
 * `React.lazy`, который не запоминает отказ навсегда.
 *
 * Отложенный компонент плагина оболочка дочитывает по сети в момент первого показа. Сеть может
 * отказать — и обычный `lazy` запоминает этот отказ в самом объекте компонента: он бросает
 * его на каждой отрисовке до перезагрузки страницы, хотя сеть давно вернулась. Здесь объект
 * `lazy` после отказа заменяется свежим, и следующая попытка показать компонент — вкладку
 * открыли заново — читает файл ещё раз.
 *
 * ## Почему по времени, а не «на следующей отрисовке»
 *
 * Сразу после отказа React отрисовывает компонент повторно — чтобы донести ошибку до границы
 * ошибок, иногда дважды. Замени мы объект на первой же отрисовке, вместо ошибки получилось бы
 * новое ожидание, новый отказ и так по кругу: бесконечные запросы при выключенной сети.
 * Поэтому отказавший объект живёт короткое время и успевает показать ошибку; свежий появляется
 * у отрисовки, которая пришла позже, — а это уже действие человека.
 *
 * @module plugins/base/markdown-editor/ui/retrying-lazy
 */

import { createElement, lazy, type ComponentType, type ReactElement } from 'react';

/** Сколько отказавший компонент остаётся отказавшим, мс. */
export const RETRY_AFTER_MS = 1500;

export interface RetryingLazyOptions {
  /** Параметр ради тестов. */
  readonly retryAfterMs?: number;
}

export function retryingLazy<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
  options: RetryingLazyOptions = {}
): (props: Props) => ReactElement {
  const retryAfterMs = options.retryAfterMs ?? RETRY_AFTER_MS;
  let failedAt: number | undefined;

  const tracked = (): Promise<{ default: ComponentType<Props> }> =>
    load().catch((error: unknown) => {
      failedAt = Date.now();
      throw error;
    });
  let current = lazy(tracked);

  return function RetryingLazy(props: Props): ReactElement {
    if (failedAt !== undefined && Date.now() - failedAt >= retryAfterMs) {
      failedAt = undefined;
      current = lazy(tracked);
    }
    return createElement(current, props);
  };
}
