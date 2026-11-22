import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AspectRatio } from './index';

// AspectRatio — обёртка над Radix AspectRatio (не form-control). Рендерится инлайн:
// внешний wrapper-<div> (position:relative + padding-bottom = 1/ratio) держит пропорцию,
// внутренний Root-<div> несёт data-slot и абсолютно растягивается на wrapper.

describe('AspectRatio (base, обёртка над Radix)', () => {
  it('Root несёт собственный data-slot и рендерит children', () => {
    const html = renderToStaticMarkup(
      <AspectRatio ratio={16 / 9}>
        <div>content</div>
      </AspectRatio>
    );
    expect(html).toContain('data-slot="aspect-ratio"');
    expect(html).toContain('<div>content</div>');
  });

  it('ratio 16/9 задаёт padding-bottom 56.25% на wrapper', () => {
    const html = renderToStaticMarkup(
      <AspectRatio ratio={16 / 9}>
        <div>x</div>
      </AspectRatio>
    );
    expect(html).toContain('data-radix-aspect-ratio-wrapper');
    expect(html).toContain('padding-bottom:56.25%');
  });

  it('ratio 1/1 (квадрат) задаёт padding-bottom 100%', () => {
    const html = renderToStaticMarkup(
      <AspectRatio ratio={1}>
        <div>x</div>
      </AspectRatio>
    );
    expect(html).toContain('padding-bottom:100%');
  });

  it('className мёржится на Root', () => {
    const html = renderToStaticMarkup(
      <AspectRatio ratio={1} className="rounded-lg bg-muted">
        <div>x</div>
      </AspectRatio>
    );
    expect(html).toMatch(/data-slot="aspect-ratio"[^>]*class="[^"]*rounded-lg/);
    expect(html).toContain('bg-muted');
  });

  it('прокидывает произвольные props (напр. data-testid) на Root', () => {
    const html = renderToStaticMarkup(
      <AspectRatio ratio={4 / 3} data-testid="hero-media">
        <img src="/x.png" alt="" />
      </AspectRatio>
    );
    expect(html).toMatch(/data-slot="aspect-ratio"[^>]*data-testid="hero-media"/);
  });
});
