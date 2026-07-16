import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Alert, AlertTitle, AlertDescription, alertVariants } from './index';

describe('Alert (base)', () => {
  it('рендерит <div role="alert"> с data-slot="alert" и дефолтным (default) стилем', () => {
    const html = renderToStaticMarkup(<Alert>Heads up</Alert>);
    expect(html).toContain('data-slot="alert"');
    expect(html).toContain('role="alert"');
    // default variant → bg-card / text-card-foreground
    expect(html).toContain('text-card-foreground');
    expect(html).toContain('>Heads up</div>');
  });

  it('variant="destructive" даёт destructive-классы', () => {
    const html = renderToStaticMarkup(<Alert variant="destructive">Boom</Alert>);
    expect(html).toContain('role="alert"');
    expect(html).toContain('text-destructive');
  });

  it('AlertTitle / AlertDescription несут свои data-slot', () => {
    const html = renderToStaticMarkup(
      <Alert>
        <AlertTitle>Title</AlertTitle>
        <AlertDescription>Body</AlertDescription>
      </Alert>
    );
    expect(html).toContain('data-slot="alert-title"');
    expect(html).toContain('data-slot="alert-description"');
    expect(html).toContain('>Title</div>');
    expect(html).toContain('>Body</div>');
  });

  it('alertVariants экспортируется и генерирует классы', () => {
    const cls = alertVariants({ variant: 'destructive' });
    expect(cls).toContain('text-destructive');
    expect(cls).toContain('rounded-lg');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Alert className="rounded-none">X</Alert>);
    expect(html).toContain('rounded-none');
    expect(html).not.toContain('rounded-lg');
  });

  it('прокидывает произвольные props (напр. data-testid) на root', () => {
    const html = renderToStaticMarkup(<Alert data-testid="alert-x">Y</Alert>);
    expect(html).toContain('data-testid="alert-x"');
  });
});
