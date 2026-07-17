// Дословный порт ReFormer-специфичного (не shadcn) v6-компонента AsyncBoundary.
// Правок логики нет — контейнер трёх состояний (loading/error/ready). Слоты loading/error —
// ComponentType без props; в состоянии ready рендерит children. Не Suspense-boundary.

/**
 * AsyncBoundary - контейнер с тремя состояниями (loading/error/ready)
 *
 * Принимает status и два фабричных компонента для loading/error.
 * В состоянии ready отображает children. Слоты — ComponentType, без props.
 * Для кастомизации props слота передайте тонкую обёртку.
 *
 * @module reformer/ui-kit/components/async-boundary
 */

import type { ComponentType, ReactNode } from 'react';

/** Состояние асинхронной операции, ожидаемое {@link AsyncBoundary}. */
export type AsyncStatus = 'loading' | 'error' | 'ready';

/** Props компонента {@link AsyncBoundary}. */
export interface AsyncBoundaryProps {
  /** Текущее состояние асинхронной операции. Управляется снаружи. */
  status: AsyncStatus;
  /** Компонент, рендерящийся при `status === 'loading'`. Без props. Если не передан — `null`. */
  LoadingComponent?: ComponentType;
  /** Компонент, рендерящийся при `status === 'error'`. Без props. Если не передан — `null`. */
  ErrorComponent?: ComponentType;
  /** Контент, рендерящийся при `status === 'ready'`. */
  children?: ReactNode;
}

/**
 * Контейнер с тремя состояниями (`loading`/`error`/`ready`). В состоянии `ready`
 * отображает `children`. Для loading/error используются переданные slot-компоненты
 * (`ComponentType`, без props — для кастомизации передай тонкую обёртку).
 *
 * Это не Suspense-boundary: ничего не throw'ится, состоянием управляешь сам.
 *
 * @example Загрузка списка с обработкой ошибки
 * ```tsx
 * import { useEffect, useState } from 'react';
 * import { AsyncBoundary, type AsyncStatus } from '@reformer/ui-kit';
 *
 * function CountriesPage() {
 *   const [status, setStatus] = useState<AsyncStatus>('loading');
 *   const [countries, setCountries] = useState<string[]>([]);
 *
 *   useEffect(() => {
 *     fetch('/api/countries')
 *       .then((r) => r.json())
 *       .then((d) => { setCountries(d); setStatus('ready'); })
 *       .catch(() => setStatus('error'));
 *   }, []);
 *
 *   return (
 *     <AsyncBoundary
 *       status={status}
 *       LoadingComponent={() => <p>Загружаем страны...</p>}
 *       ErrorComponent={() => <p>Ошибка загрузки</p>}
 *     >
 *       <ul>{countries.map((c) => <li key={c}>{c}</li>)}</ul>
 *     </AsyncBoundary>
 *   );
 * }
 * ```
 *
 * @example Внутри RenderSchema (статус подставляется через `patchProps`)
 * ```tsx
 * import { createRenderSchema } from '@reformer/renderer-react';
 * import { AsyncBoundary } from '@reformer/ui-kit';
 *
 * // M1: функция схемы не принимает аргументов — привязка к данным идёт через сигналы модели.
 * const schema = createRenderSchema(() => ({
 *   selector: 'data-boundary',
 *   component: AsyncBoundary,
 *   componentProps: { status: 'loading', LoadingComponent: Spinner },
 *   children: [{ value: model.$.email, component: Input }],
 * }));
 * // позже: schema.node('data-boundary').patchProps({ status: 'ready' });
 * ```
 */
export function AsyncBoundary({
  status,
  LoadingComponent,
  ErrorComponent,
  children,
}: AsyncBoundaryProps): ReactNode {
  if (status === 'loading') return LoadingComponent ? <LoadingComponent /> : null;
  if (status === 'error') return ErrorComponent ? <ErrorComponent /> : null;
  return <>{children}</>;
}
