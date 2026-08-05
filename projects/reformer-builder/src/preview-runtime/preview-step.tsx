/**
 * Шаг визарда для Runtime-preview. Cdk-шаг (`@reformer/cdk/form-wizard` → `<>{children}</>`)
 * собственного DOM не имеет, поэтому класс-токен узла ({@link annotateSchema}) ему некуда посадить —
 * шаг было бы не выделить кликом и не сделать целью дропа. Здесь — тот же фрагмент, но в
 * контейнере-обёртке, несущей `className`.
 *
 * Обёртка визуально нейтральна: тело шага и так лежит плоским потоком внутри
 * `data-slot="form-wizard-body"`, без раскладочных классов на родителе.
 *
 * Статику `__selfManagedChildren` НЕ выставляем — детей шага рисует сам рендерер.
 *
 * @module reformer-builder/preview-runtime/preview-step
 */

import type { ReactNode } from 'react';

/** Шаг превью: контейнер под класс-токен узла. */
export function PreviewStep({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}): ReactNode {
  return (
    <div data-slot="preview-step" className={className}>
      {children}
    </div>
  );
}
