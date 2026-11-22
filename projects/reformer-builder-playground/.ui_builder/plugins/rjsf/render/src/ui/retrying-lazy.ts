/**
 * `React.lazy`, который не запоминает отказ навсегда.
 *
 * Отложенный компонент плагина оболочка дочитывает по сети в момент первого показа. Сеть может
 * отказать — и обычный `lazy` запоминает этот отказ в самом объекте компонента: он бросает
 * его на каждой отрисовке до перезагрузки страницы, хотя сеть давно вернулась. Здесь объект
 * `lazy` после отказа заменяется свежим, и следующая попытка показать компонент — форму
 * открыли заново — читает файл ещё раз.
 *
 * Свежий объект появляется не на первой же отрисовке, а спустя короткое время: сразу после
 * отказа React отрисовывает компонент повторно, чтобы донести ошибку, и замена в этот момент
 * дала бы бесконечные запросы при выключенной сети.
 *
 * Та же обёртка лежит у предпросмотра markdown (`base/markdown-editor`), там же её тесты:
 * общего исполняемого кода у пакетов двух доменов нет, а в контракт плагинов двадцать строк
 * выносить незачем.
 *
 * @module plugins/rjsf/render/ui/retrying-lazy
 */

import { createElement, lazy, type ComponentType, type ReactElement } from 'react';

/** Сколько отказавший компонент остаётся отказавшим, мс. */
export const RETRY_AFTER_MS = 1500;

export function retryingLazy<Props extends object>(
  load: () => Promise<{ default: ComponentType<Props> }>,
  retryAfterMs: number = RETRY_AFTER_MS
): (props: Props) => ReactElement {
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
