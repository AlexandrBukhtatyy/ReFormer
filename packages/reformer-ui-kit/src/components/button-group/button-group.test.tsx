import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ButtonGroup, ButtonGroupText, ButtonGroupSeparator, buttonGroupVariants } from './index';

describe('ButtonGroup (base)', () => {
  it('рендерит <div role="group"> с data-slot и дефолтными (горизонтальными) классами', () => {
    const html = renderToStaticMarkup(
      <ButtonGroup>
        <button>A</button>
        <button>B</button>
      </ButtonGroup>
    );
    expect(html).toContain('role="group"');
    expect(html).toContain('data-slot="button-group"');
    // defaultVariants → orientation: horizontal
    expect(html).toContain('rounded-l-none');
    expect(html).toContain('border-l-0');
  });

  it('orientation="vertical" прокидывает data-orientation и вертикальные классы', () => {
    const html = renderToStaticMarkup(
      <ButtonGroup orientation="vertical">
        <button>A</button>
      </ButtonGroup>
    );
    expect(html).toContain('data-orientation="vertical"');
    expect(html).toContain('flex-col');
    expect(html).toContain('rounded-t-none');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<ButtonGroup className="gap-4">X</ButtonGroup>);
    expect(html).toContain('gap-4');
  });

  it('buttonGroupVariants экспортируется и генерирует классы по orientation', () => {
    expect(buttonGroupVariants({ orientation: 'horizontal' })).toContain('items-stretch');
    expect(buttonGroupVariants({ orientation: 'vertical' })).toContain('flex-col');
  });
});

describe('ButtonGroupText', () => {
  it('рендерит <div> с muted-стилем и детьми', () => {
    const html = renderToStaticMarkup(<ButtonGroupText>USD</ButtonGroupText>);
    expect(html).toContain('bg-muted');
    expect(html).toContain('font-medium');
    expect(html).toContain('>USD</div>');
  });

  it('asChild сливает стиль на дочерний элемент (напр. <label>)', () => {
    const html = renderToStaticMarkup(
      <ButtonGroupText asChild>
        <label htmlFor="x">Сумма</label>
      </ButtonGroupText>
    );
    expect(html).toContain('<label');
    expect(html).toContain('for="x"');
    expect(html).toContain('bg-muted');
    expect(html).toContain('Сумма');
  });
});

describe('ButtonGroupSeparator', () => {
  it('рендерит Separator с data-slot="button-group-separator" и вертикальной ориентацией по умолчанию', () => {
    const html = renderToStaticMarkup(<ButtonGroupSeparator />);
    expect(html).toContain('data-slot="button-group-separator"');
    expect(html).toContain('data-orientation="vertical"');
    expect(html).toContain('bg-input');
  });
});
