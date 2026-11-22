import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Toggle, toggleVariants } from './index';
import { Bound } from '@/test-utils/bound';

describe('Toggle (base, pure shadcn Radix)', () => {
  it('рендерит button с data-slot=toggle, aria-pressed и дефолтным data-state', () => {
    const html = renderToStaticMarkup(<Toggle>B</Toggle>);
    expect(html).toContain('data-slot="toggle"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain('data-state="off"');
    expect(html).toContain('B');
  });

  it('pressed → data-state=on + aria-pressed=true', () => {
    const html = renderToStaticMarkup(<Toggle pressed>B</Toggle>);
    expect(html).toContain('data-state="on"');
    expect(html).toContain('aria-pressed="true"');
  });

  it('variant=outline / size=lg прокидываются в cva-классы', () => {
    const html = renderToStaticMarkup(
      <Toggle variant="outline" size="lg">
        B
      </Toggle>
    );
    expect(html).toContain('border'); // outline
    expect(html).toContain('h-10'); // lg
  });

  it('toggleVariants экспортируется и генерирует классы', () => {
    const cls = toggleVariants({ variant: 'outline', size: 'sm' });
    expect(cls).toContain('border');
    expect(cls).toContain('h-8');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    expect(renderToStaticMarkup(<Toggle className="bg-red-500">X</Toggle>)).toContain('bg-red-500');
  });
});

describe('Toggle (field, boolean value-based, НЕ inline-label)', () => {
  it('НЕ выставляет reformerLayout (подпись рисует FormField сверху)', () => {
    expect((Toggle as { reformerLayout?: string }).reformerLayout).toBeUndefined();
  });

  it('value=true → нажат (data-state=on, aria-pressed=true) на Root примитива', () => {
    const html = renderToStaticMarkup(
      <Bound component={Toggle} value={true}>
        B
      </Bound>
    );
    expect(html).toContain('data-slot="toggle"');
    expect(html).toContain('data-state="on"');
    expect(html).toContain('aria-pressed="true"');
  });

  it('value=false → отжат (data-state=off)', () => {
    expect(
      renderToStaticMarkup(
        <Bound component={Toggle} value={false}>
          B
        </Bound>
      )
    ).toContain('data-state="off"');
  });

  it('value=undefined (null-coerce) → отжат, без падения', () => {
    expect(renderToStaticMarkup(<Bound component={Toggle}>B</Bound>)).toContain('data-state="off"');
  });

  it('контент рендерится ВНУТРИ toggle (children)', () => {
    const html = renderToStaticMarkup(
      <Bound component={Toggle} value={false}>
        Полужирный
      </Bound>
    );
    expect(html).toMatch(/data-slot="toggle"[\s\S]*Полужирный/);
  });

  it('data-testid ложится на Root примитива (button), единственным вхождением', () => {
    const html = renderToStaticMarkup(
      <Bound component={Toggle} value={false} data-testid="input-bold">
        B
      </Bound>
    );
    expect(html).toMatch(/data-slot="toggle"[^>]*data-testid="input-bold"/);
    expect(html.match(/data-testid="input-bold"/g)).toHaveLength(1);
  });

  it('variant/size прокидываются как componentProps (cva-классы)', () => {
    const html = renderToStaticMarkup(
      <Bound component={Toggle} value={false} variant="outline" size="lg">
        B
      </Bound>
    );
    expect(html).toContain('border');
    expect(html).toContain('h-10');
  });

  it('прокидывает id/aria-* на контрол (seam-контракт)', () => {
    const html = renderToStaticMarkup(
      <Bound component={Toggle} value={false} id="control-a" aria-describedby="desc-a" aria-invalid>
        B
      </Bound>
    );
    expect(html).toContain('id="control-a"');
    expect(html).toContain('aria-describedby="desc-a"');
  });
});
