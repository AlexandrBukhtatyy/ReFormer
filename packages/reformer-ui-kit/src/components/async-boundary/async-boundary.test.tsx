import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AsyncBoundary } from './index';

const Loading = () => <p data-slot="loading">Загрузка…</p>;
const ErrorSlot = () => <p data-slot="error">Ошибка</p>;

describe('AsyncBoundary (base)', () => {
  it('status="loading" рендерит LoadingComponent, не children/error', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary status="loading" LoadingComponent={Loading} ErrorComponent={ErrorSlot}>
        <span>content</span>
      </AsyncBoundary>
    );
    expect(html).toContain('data-slot="loading"');
    expect(html).toContain('Загрузка…');
    expect(html).not.toContain('data-slot="error"');
    expect(html).not.toContain('content');
  });

  it('status="error" рендерит ErrorComponent, не children/loading', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary status="error" LoadingComponent={Loading} ErrorComponent={ErrorSlot}>
        <span>content</span>
      </AsyncBoundary>
    );
    expect(html).toContain('data-slot="error"');
    expect(html).toContain('Ошибка');
    expect(html).not.toContain('data-slot="loading"');
    expect(html).not.toContain('content');
  });

  it('status="ready" рендерит children, не слоты', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary status="ready" LoadingComponent={Loading} ErrorComponent={ErrorSlot}>
        <span data-slot="ready">content</span>
      </AsyncBoundary>
    );
    expect(html).toContain('data-slot="ready"');
    expect(html).toContain('content');
    expect(html).not.toContain('data-slot="loading"');
    expect(html).not.toContain('data-slot="error"');
  });

  it('слот не передан → рендерит null (пустая строка)', () => {
    const loadingHtml = renderToStaticMarkup(<AsyncBoundary status="loading" />);
    expect(loadingHtml).toBe('');
    const errorHtml = renderToStaticMarkup(<AsyncBoundary status="error" />);
    expect(errorHtml).toBe('');
  });
});
