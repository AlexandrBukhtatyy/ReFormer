import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuShortcut,
} from './index';

// Radix-overlay: в SSR (renderToStaticMarkup) рендерится только триггер — Content уходит в Portal,
// который на сервере отдаёт null. ContextMenu активируется правым кликом, поэтому триггер — <span>
// (без aria-haspopup / <button>). Тестируем доступную статическую поверхность: триггер (data-slot,
// data-state) и self-contained Shortcut (обычный span).

describe('ContextMenu (base, Radix compound overlay)', () => {
  it('Trigger несёт свой data-slot и рендерится как <span> в закрытом состоянии', () => {
    const html = renderToStaticMarkup(
      <ContextMenu>
        <ContextMenuTrigger>Кликни правой кнопкой</ContextMenuTrigger>
      </ContextMenu>
    );
    expect(html).toMatch(/^<span/);
    expect(html).toContain('data-slot="context-menu-trigger"');
    expect(html).toContain('data-state="closed"');
    expect(html).toContain('Кликни правой кнопкой');
  });

  it('Trigger asChild — сливает slot/state на дочерний элемент (полиморфизм)', () => {
    const html = renderToStaticMarkup(
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div data-testid="custom-trigger">Кастомная область</div>
        </ContextMenuTrigger>
      </ContextMenu>
    );
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-testid="custom-trigger"');
    expect(html).toContain('data-slot="context-menu-trigger"');
    expect(html).toContain('data-state="closed"');
  });

  it('ContextMenuShortcut — span со своим data-slot (self-contained)', () => {
    const html = renderToStaticMarkup(<ContextMenuShortcut>⌘K</ContextMenuShortcut>);
    expect(html).toMatch(/^<span/);
    expect(html).toContain('data-slot="context-menu-shortcut"');
    expect(html).toContain('text-muted-foreground');
    expect(html).toContain('⌘K');
  });

  it('ContextMenuShortcut мёржит className (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <ContextMenuShortcut className="text-red-500">X</ContextMenuShortcut>
    );
    expect(html).toContain('text-red-500');
    expect(html).not.toContain('text-muted-foreground');
  });

  it('Content уходит в Portal — в SSR-разметке отсутствует, доступен только триггер', () => {
    const html = renderToStaticMarkup(
      <ContextMenu>
        <ContextMenuTrigger>Область</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem>Пункт</ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
    expect(html).toContain('data-slot="context-menu-trigger"');
    expect(html).not.toContain('data-slot="context-menu-content"');
  });
});
