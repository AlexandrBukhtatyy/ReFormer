import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Kbd, KbdGroup } from './index';

describe('Kbd (base)', () => {
  it('рендерит <kbd> с data-slot="kbd" и содержимым', () => {
    const html = renderToStaticMarkup(<Kbd>Ctrl</Kbd>);
    expect(html).toMatch(/^<kbd/);
    expect(html).toContain('data-slot="kbd"');
    expect(html).toContain('>Ctrl</kbd>');
  });

  it('несёт базовые презентационные классы', () => {
    const html = renderToStaticMarkup(<Kbd>K</Kbd>);
    expect(html).toContain('bg-muted');
    expect(html).toContain('text-muted-foreground');
    expect(html).toContain('select-none');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Kbd className="bg-red-500">X</Kbd>);
    expect(html).toContain('bg-red-500');
    expect(html).not.toContain('bg-muted');
  });

  it('прокидывает произвольные props (напр. title) на <kbd>', () => {
    const html = renderToStaticMarkup(<Kbd title="Control">Ctrl</Kbd>);
    expect(html).toContain('title="Control"');
  });
});

describe('KbdGroup (base)', () => {
  it('рендерит контейнер с data-slot="kbd-group" и вложенными клавишами', () => {
    const html = renderToStaticMarkup(
      <KbdGroup>
        <Kbd>Ctrl</Kbd>
        <Kbd>K</Kbd>
      </KbdGroup>
    );
    expect(html).toContain('data-slot="kbd-group"');
    expect(html).toContain('data-slot="kbd"');
    expect(html).toContain('>Ctrl</kbd>');
    expect(html).toContain('>K</kbd>');
  });

  it('несёт flex-классы группировки', () => {
    const html = renderToStaticMarkup(<KbdGroup>x</KbdGroup>);
    expect(html).toContain('inline-flex');
    expect(html).toContain('items-center');
    expect(html).toContain('gap-1');
  });

  it('className мёржится на группе', () => {
    const html = renderToStaticMarkup(<KbdGroup className="gap-4">y</KbdGroup>);
    expect(html).toContain('gap-4');
    expect(html).not.toContain('gap-1');
  });
});
