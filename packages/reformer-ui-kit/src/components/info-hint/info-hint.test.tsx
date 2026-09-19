import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { InfoHint } from './index';

// Контент Radix Tooltip живёт в Portal — в SSR его нет. Проверяем кнопку и скрытый дубль текста.
describe('InfoHint (base)', () => {
  it('рендерит кнопку type="button" с data-slot и aria-label по умолчанию', () => {
    const html = renderToStaticMarkup(<InfoHint content="Только латиница" />);
    expect(html).toMatch(/<button[^>]*type="button"/);
    expect(html).toContain('data-slot="info-hint"');
    expect(html).toContain('aria-label="Подсказка"');
    expect(html).toContain('<svg');
  });

  it('aria-label переопределяется, произвольные props уходят в кнопку', () => {
    const html = renderToStaticMarkup(
      <InfoHint content="x" aria-label="Подсказка: Email" data-testid="label-tooltip-email" />
    );
    expect(html).toContain('aria-label="Подсказка: Email"');
    expect(html).toContain('data-testid="label-tooltip-email"');
  });

  it('скрытый дубль текста рендерится только при descriptionId', () => {
    expect(renderToStaticMarkup(<InfoHint content="Текст" />)).not.toContain('hidden=""');
    const html = renderToStaticMarkup(<InfoHint content="Текст" descriptionId="hint-1" />);
    expect(html).toContain('<span id="hint-1" hidden="">Текст</span>');
  });

  it('кнопка никогда не disabled — подсказка читается и у выключенного поля', () => {
    expect(renderToStaticMarkup(<InfoHint content="x" />)).not.toContain('disabled');
  });

  it('пустой content — ничего не рендерит', () => {
    expect(renderToStaticMarkup(<InfoHint content="" />)).toBe('');
  });
});
