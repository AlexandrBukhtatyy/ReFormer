import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Section } from './index';

describe('Section (base, DSL-контейнер)', () => {
  it('рендерит семантический <section> с data-slot=section', () => {
    const html = renderToStaticMarkup(<Section>Контент</Section>);
    expect(html).toMatch(/^<section/);
    expect(html).toContain('data-slot="section"');
    expect(html).toContain('Контент');
  });

  it('заголовок рендерится с data-slot=section-title', () => {
    const html = renderToStaticMarkup(<Section title="Личные данные">X</Section>);
    expect(html).toContain('data-slot="section-title"');
    expect(html).toContain('>Личные данные</h3>');
  });

  it('без title заголовок не рендерится (только обёртка)', () => {
    const html = renderToStaticMarkup(<Section>X</Section>);
    expect(html).not.toContain('data-slot="section-title"');
  });

  it('titleAs управляет уровнем заголовка (h1-h6)', () => {
    const html = renderToStaticMarkup(<Section title="Шаг 1" titleAs="h2" />);
    expect(html).toContain('<h2');
    expect(html).toContain('>Шаг 1</h2>');
    expect(html).not.toContain('<h3');
  });

  it('titleAs по умолчанию h3', () => {
    const html = renderToStaticMarkup(<Section title="Заголовок" />);
    expect(html).toContain('<h3');
  });

  it('className на контейнере, titleClassName на заголовке', () => {
    const html = renderToStaticMarkup(
      <Section title="T" className="grid grid-cols-2 gap-4" titleClassName="text-xl font-bold" />
    );
    expect(html).toContain('class="grid grid-cols-2 gap-4"');
    expect(html).toContain('class="text-xl font-bold"');
  });

  it('рендерит дочерние элементы внутри секции', () => {
    const html = renderToStaticMarkup(
      <Section title="Адрес">
        <span>Улица</span>
        <span>Город</span>
      </Section>
    );
    expect(html).toContain('<span>Улица</span>');
    expect(html).toContain('<span>Город</span>');
  });
});
