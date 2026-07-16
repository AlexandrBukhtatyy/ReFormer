import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Spinner } from './index';

describe('Spinner (base)', () => {
  it('рендерит <svg> с data-slot и spin-анимацией', () => {
    const html = renderToStaticMarkup(<Spinner />);
    expect(html).toContain('<svg');
    expect(html).toContain('data-slot="spinner"');
    expect(html).toContain('animate-spin');
    expect(html).toContain('size-4');
  });

  it('доступность: role="status" + aria-label="Loading"', () => {
    const html = renderToStaticMarkup(<Spinner />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Loading"');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Spinner className="size-8 text-primary" />);
    expect(html).toContain('size-8');
    expect(html).toContain('text-primary');
    // size-4 перекрывается size-8
    expect(html).not.toMatch(/class="[^"]*\bsize-4\b/);
    // spin сохраняется
    expect(html).toContain('animate-spin');
  });

  it('прокидывает произвольные svg-атрибуты', () => {
    const html = renderToStaticMarkup(
      <Spinner data-testid="page-spinner" aria-label="Загрузка данных" />
    );
    expect(html).toContain('data-testid="page-spinner"');
    // caller-aria-label перекрывает дефолтный
    expect(html).toContain('aria-label="Загрузка данных"');
  });
});
