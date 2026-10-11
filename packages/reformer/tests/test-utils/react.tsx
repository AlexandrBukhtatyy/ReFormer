/**
 * Помощники DOM-тестов React-хуков (happy-dom + @testing-library/react).
 *
 * Файл с DOM-тестом начинается строкой `// @vitest-environment happy-dom` и снимает отрисовку
 * сам: `afterEach(cleanup)` — глобалов vitest в пакете нет, а автоочистка testing-library
 * подключается только через глобальный `afterEach`.
 *
 * @module test-utils/react
 */

import { StrictMode, type ComponentType, type ReactNode } from 'react';
import { renderHook, type RenderHookResult } from '@testing-library/react';

export { act, cleanup, render, fireEvent, screen } from '@testing-library/react';

/** Обёртка в `StrictMode`: двойной вызов эффектов и рендеров, как в разработке. */
export function StrictWrapper({ children }: { children?: ReactNode }): ReactNode {
  return <StrictMode>{children}</StrictMode>;
}

/** Результат {@link renderHookCounting}: всё от `renderHook` плюс счётчик рендеров. */
export type CountingHookResult<R, P> = RenderHookResult<R, P> & {
  /** Сколько раз отрисовался компонент с хуком. */
  renders(): number;
};

/**
 * `renderHook` со счётчиком рендеров — для утверждений «хук перерисовывает только при нужном
 * сигнале».
 *
 * @param hook - Хук под тестом.
 * @param options - `initialProps`, своя обёртка `wrapper`, `strict` — обернуть в `StrictMode`.
 */
export function renderHookCounting<R, P = undefined>(
  hook: (props: P) => R,
  options: {
    initialProps?: P;
    wrapper?: ComponentType<{ children: ReactNode }>;
    strict?: boolean;
  } = {}
): CountingHookResult<R, P> {
  let renders = 0;
  const { wrapper: Inner, strict, initialProps } = options;
  const wrapper =
    strict || Inner
      ? ({ children }: { children: ReactNode }) => {
          const inner = Inner ? <Inner>{children}</Inner> : children;
          return strict ? <StrictMode>{inner}</StrictMode> : <>{inner}</>;
        }
      : undefined;
  const result = renderHook(
    (props: P) => {
      renders++;
      return hook(props);
    },
    { initialProps: initialProps as P, ...(wrapper ? { wrapper } : {}) }
  );
  return Object.assign(result, { renders: () => renders });
}
