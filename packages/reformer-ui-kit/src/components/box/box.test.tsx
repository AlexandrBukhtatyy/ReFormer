import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Box } from './index';

describe('Box (base)', () => {
  it('рендерит <div> с data-slot="box"', () => {
    const html = renderToStaticMarkup(<Box />);
    expect(html).toContain('<div');
    expect(html).toContain('data-slot="box"');
  });

  it('прокидывает className на контейнер', () => {
    const html = renderToStaticMarkup(<Box className="flex flex-col gap-4" />);
    expect(html).toContain('class="flex flex-col gap-4"');
  });

  it('рендерит дочерние элементы внутри контейнера', () => {
    const html = renderToStaticMarkup(
      <Box className="grid grid-cols-2 gap-4">
        <span>Первый</span>
        <span>Второй</span>
      </Box>
    );
    expect(html).toContain('<span>Первый</span>');
    expect(html).toContain('<span>Второй</span>');
  });

  it('без className рендерит div без атрибута class', () => {
    const html = renderToStaticMarkup(<Box>Контент</Box>);
    expect(html).not.toContain('class=');
    expect(html).toContain('Контент');
  });
});
