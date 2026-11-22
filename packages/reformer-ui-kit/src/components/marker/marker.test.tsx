import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Marker, MarkerIcon, MarkerContent, markerVariants } from './index';

describe('Marker (base)', () => {
  it('рендерит <div> с data-slot и дефолтным data-variant', () => {
    const html = renderToStaticMarkup(<Marker>Источники</Marker>);
    expect(html).toContain('data-slot="marker"');
    expect(html).toContain('data-variant="default"');
    expect(html).toContain('>Источники</div>');
  });

  it('прокидывает variant в data-атрибут и классы (separator)', () => {
    const html = renderToStaticMarkup(<Marker variant="separator">Ещё</Marker>);
    expect(html).toContain('data-variant="separator"');
    expect(html).toContain('before:flex-1');
  });

  it('вариант border добавляет разделительную рамку', () => {
    const html = renderToStaticMarkup(<Marker variant="border">Ниже</Marker>);
    expect(html).toContain('data-variant="border"');
    expect(html).toContain('border-b');
  });

  it('asChild рендерит дочерний элемент (напр. <a>) вместо <div>', () => {
    const html = renderToStaticMarkup(
      <Marker asChild>
        <a href="/x">Ссылка</a>
      </Marker>
    );
    expect(html).toContain('<a');
    expect(html).toContain('href="/x"');
    expect(html).not.toContain('<div');
    expect(html).toContain('data-slot="marker"');
  });

  it('MarkerIcon рендерит aria-hidden <span> с data-slot', () => {
    const html = renderToStaticMarkup(<MarkerIcon />);
    expect(html).toContain('data-slot="marker-icon"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('<span');
  });

  it('MarkerContent рендерит <span> с data-slot и содержимым', () => {
    const html = renderToStaticMarkup(<MarkerContent>текст</MarkerContent>);
    expect(html).toContain('data-slot="marker-content"');
    expect(html).toContain('>текст</span>');
  });

  it('compound: Marker c иконкой и контентом рендерит все data-slot', () => {
    const html = renderToStaticMarkup(
      <Marker>
        <MarkerIcon>*</MarkerIcon>
        <MarkerContent>Источник 1</MarkerContent>
      </Marker>
    );
    expect(html).toContain('data-slot="marker"');
    expect(html).toContain('data-slot="marker-icon"');
    expect(html).toContain('data-slot="marker-content"');
    expect(html).toContain('Источник 1');
  });

  it('markerVariants экспортируется и генерирует классы', () => {
    const cls = markerVariants({ variant: 'border' });
    expect(cls).toContain('border-b');
    expect(cls).toContain('flex');
  });

  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<Marker className="text-red-500">X</Marker>);
    expect(html).toContain('text-red-500');
  });
});
