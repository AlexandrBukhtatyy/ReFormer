import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HoverCard, HoverCardTrigger, HoverCardContent } from './index';

// Radix-overlay: в SSR (renderToStaticMarkup) рендерится только триггер — Content уходит в Portal,
// который на сервере отдаёт null. Поэтому тестируем доступную статическую поверхность:
// триггер (data-slot, полиморфизм asChild) и отсутствие Content в разметке.

describe('HoverCard (base, Radix compound overlay)', () => {
  it('Trigger несёт свой data-slot и содержимое', () => {
    const html = renderToStaticMarkup(
      <HoverCard>
        <HoverCardTrigger>Навести карточку</HoverCardTrigger>
      </HoverCard>
    );
    expect(html).toContain('data-slot="hover-card-trigger"');
    expect(html).toContain('Навести карточку');
  });

  it('Trigger по умолчанию — <a> в закрытом состоянии', () => {
    const html = renderToStaticMarkup(
      <HoverCard>
        <HoverCardTrigger href="#">Ссылка</HoverCardTrigger>
      </HoverCard>
    );
    expect(html).toMatch(/^<a/);
    expect(html).toContain('data-state="closed"');
  });

  it('Trigger asChild — сливает slot на дочерний элемент (полиморфизм)', () => {
    const html = renderToStaticMarkup(
      <HoverCard>
        <HoverCardTrigger asChild>
          <button data-testid="custom-trigger">Кастомный триггер</button>
        </HoverCardTrigger>
      </HoverCard>
    );
    expect(html).toMatch(/^<button/);
    expect(html).toContain('data-testid="custom-trigger"');
    expect(html).toContain('data-slot="hover-card-trigger"');
  });

  it('Content уходит в Portal — в SSR-разметке отсутствует, доступен только триггер', () => {
    const html = renderToStaticMarkup(
      <HoverCard defaultOpen>
        <HoverCardTrigger>Триггер</HoverCardTrigger>
        <HoverCardContent>Содержимое карточки</HoverCardContent>
      </HoverCard>
    );
    expect(html).toContain('data-slot="hover-card-trigger"');
    expect(html).not.toContain('data-slot="hover-card-content"');
    expect(html).not.toContain('Содержимое карточки');
  });
});
