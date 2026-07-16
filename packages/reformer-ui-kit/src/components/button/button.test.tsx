import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Button, buttonVariants } from './index';

describe('Button (base)', () => {
  it('рендерит <button> с data-slot и дефолтными data-variant/size', () => {
    const html = renderToStaticMarkup(<Button>OK</Button>);
    expect(html).toContain('data-slot="button"');
    expect(html).toContain('data-variant="default"');
    expect(html).toContain('data-size="default"');
    expect(html).toContain('>OK</button>');
  });

  it('прокидывает variant/size в data-атрибуты и классы', () => {
    const html = renderToStaticMarkup(
      <Button variant="destructive" size="lg">
        Del
      </Button>
    );
    expect(html).toContain('data-variant="destructive"');
    expect(html).toContain('data-size="lg"');
    expect(html).toContain('bg-destructive');
  });

  it('asChild рендерит дочерний элемент (напр. <a>) вместо <button>', () => {
    const html = renderToStaticMarkup(
      <Button asChild variant="link">
        <a href="/x">Link</a>
      </Button>
    );
    expect(html).toContain('<a');
    expect(html).toContain('href="/x"');
    expect(html).not.toContain('<button');
    expect(html).toContain('data-slot="button"');
  });

  it('buttonVariants экспортируется и генерирует классы', () => {
    const cls = buttonVariants({ variant: 'outline', size: 'sm' });
    expect(cls).toContain('border');
    expect(cls).toContain('h-8');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Button className="bg-red-500">X</Button>);
    expect(html).toContain('bg-red-500');
  });
});
