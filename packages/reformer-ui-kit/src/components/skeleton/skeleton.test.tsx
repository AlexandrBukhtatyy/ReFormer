import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Skeleton } from './index';

describe('Skeleton (base)', () => {
  it('рендерит <div> с data-slot и pulse-анимацией', () => {
    const html = renderToStaticMarkup(<Skeleton />);
    expect(html).toContain('<div');
    expect(html).toContain('data-slot="skeleton"');
    expect(html).toContain('animate-pulse');
    expect(html).toContain('rounded-md');
    expect(html).toContain('bg-accent');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Skeleton className="h-4 w-32 rounded-full" />);
    expect(html).toContain('h-4');
    expect(html).toContain('w-32');
    // rounded-full перекрывает базовый rounded-md
    expect(html).toContain('rounded-full');
    expect(html).not.toMatch(/class="[^"]*\brounded-md\b/);
    // pulse сохраняется
    expect(html).toContain('animate-pulse');
  });

  it('прокидывает произвольные div-атрибуты', () => {
    const html = renderToStaticMarkup(
      <Skeleton data-testid="avatar-skeleton" aria-hidden="true" />
    );
    expect(html).toContain('data-testid="avatar-skeleton"');
    expect(html).toContain('aria-hidden="true"');
  });
});
