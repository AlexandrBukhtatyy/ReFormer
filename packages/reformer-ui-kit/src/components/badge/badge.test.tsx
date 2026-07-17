import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Badge, badgeVariants } from './index';

describe('Badge (base)', () => {
  it('рендерит <span> с data-slot и дефолтным data-variant', () => {
    const html = renderToStaticMarkup(<Badge>New</Badge>);
    expect(html).toContain('data-slot="badge"');
    expect(html).toContain('data-variant="default"');
    expect(html).toContain('>New</span>');
  });

  it('прокидывает variant в data-атрибут и классы', () => {
    const html = renderToStaticMarkup(<Badge variant="secondary">Beta</Badge>);
    expect(html).toContain('data-variant="secondary"');
    expect(html).toContain('bg-secondary');
  });

  it('asChild рендерит дочерний элемент (напр. <a>) вместо <span>', () => {
    const html = renderToStaticMarkup(
      <Badge asChild variant="outline">
        <a href="/x">Link</a>
      </Badge>
    );
    expect(html).toContain('<a');
    expect(html).toContain('href="/x"');
    expect(html).not.toContain('<span');
    expect(html).toContain('data-slot="badge"');
  });

  it('badgeVariants экспортируется и генерирует классы', () => {
    const cls = badgeVariants({ variant: 'destructive' });
    expect(cls).toContain('bg-destructive');
    expect(cls).toContain('rounded-full');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Badge className="bg-red-500">X</Badge>);
    expect(html).toContain('bg-red-500');
  });
});
