/**
 * `SchemaErrorBoundary`: выбор между кастомным `fallback` и дефолтной панелью.
 *
 * Проверяется ветвление в `render()`, а не механика ловли ошибок React'ом:
 * `renderToString` error boundary НЕ задействует (в legacy-серверном рендерере ошибка
 * пробрасывается — boundary работают только на клиенте), а тащить jsdom ради этого
 * в пакет незачем. Ловля ошибок — ответственность React и покрывается им самим;
 * наша логика здесь ровно одна: `fallback?.(error) ?? <SchemaErrorPanel/>`.
 */
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import type { ReactNode } from 'react';
import { SchemaErrorBoundary, type SchemaErrorBoundaryProps } from './schema-error-boundary';

const ERROR = new Error('resolveComponent failed: Component "Input" not found in registry');

/** Рендерит ветку `render()` boundary при заданной ошибке. */
function renderBranch(props: SchemaErrorBoundaryProps, error: Error | null): string {
  const boundary = new SchemaErrorBoundary(props);
  boundary.state = { error };
  return renderToString(<>{boundary.render() as ReactNode}</>);
}

describe('SchemaErrorBoundary', () => {
  it('без fallback рисует дефолтную панель с текстом ошибки', () => {
    const html = renderBranch({ children: <span>форма</span> }, ERROR);
    expect(html).toContain('not found in registry');
    expect(html).not.toContain('форма');
  });

  it('fallback получает ошибку и полностью заменяет панель', () => {
    const html = renderBranch(
      { children: <span>форма</span>, fallback: (e) => <p>форма недоступна: {e.message}</p> },
      ERROR
    );
    expect(html).toContain('форма недоступна');
    expect(html).toContain('not found in registry');
  });

  it('без ошибки отдаёт children как есть, fallback не зовётся', () => {
    let called = false;
    const html = renderBranch(
      {
        children: <span>ok</span>,
        fallback: () => {
          called = true;
          return <p>не должно появиться</p>;
        },
      },
      null
    );
    expect(html).toContain('ok');
    expect(called).toBe(false);
  });

  it('getDerivedStateFromError кладёт ошибку в state', () => {
    expect(SchemaErrorBoundary.getDerivedStateFromError(ERROR)).toEqual({ error: ERROR });
  });
});
