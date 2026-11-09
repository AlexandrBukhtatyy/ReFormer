import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Alert, AlertTitle, AlertDescription, alertVariants } from './index';

describe('Alert (base)', () => {
  it('рендерит <div> с data-slot="alert" и дефолтным (default) стилем, без живой роли', () => {
    const html = renderToStaticMarkup(<Alert>Heads up</Alert>);
    expect(html).toContain('data-slot="alert"');
    // Статичное пояснение не объявляется скринридером как срочное.
    expect(html).not.toContain('role=');
    // default variant → bg-card / text-card-foreground
    expect(html).toContain('text-card-foreground');
    expect(html).toContain('>Heads up</div>');
  });

  it('явный role перекрывает умолчание (status — для появляющихся сообщений)', () => {
    expect(renderToStaticMarkup(<Alert role="status">Сохранено</Alert>)).toContain('role="status"');
    expect(
      renderToStaticMarkup(
        <Alert variant="destructive" role="note">
          X
        </Alert>
      )
    ).toContain('role="note"');
  });

  it('variant="destructive" — role="alert" и destructive-классы', () => {
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
