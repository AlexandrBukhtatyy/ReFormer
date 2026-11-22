import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
} from './index';

// Radix-overlay: в SSR (renderToStaticMarkup) рендерится только триггер — Content уходит в Portal,
// который на сервере отдаёт null. Поэтому тестируем доступную статическую поверхность:
// триггер (data-slot, aria-семантика, asChild) и self-contained Shortcut (обычный span).

describe('DropdownMenu (base, Radix compound overlay)', () => {
  it('Trigger несёт свой data-slot и семантику меню', () => {
    const html = renderToStaticMarkup(
      <DropdownMenu>
        <DropdownMenuTrigger>Открыть меню</DropdownMenuTrigger>
      </DropdownMenu>
    );
    expect(html).toContain('data-slot="dropdown-menu-trigger"');
    expect(html).toContain('aria-haspopup="menu"');
    expect(html).toContain('Открыть меню');
  });

  it('Trigger по умолчанию — <button> в закрытом состоянии', () => {
    const html = renderToStaticMarkup(
      <DropdownMenu>
        <DropdownMenuTrigger>Меню</DropdownMenuTrigger>
      </DropdownMenu>
    );
    expect(html).toMatch(/^<button/);
    expect(html).toContain('data-state="closed"');
  });

  it('Trigger asChild — сливает slot/aria на дочерний элемент (полиморфизм)', () => {
    const html = renderToStaticMarkup(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span data-testid="custom-trigger">Кастомный триггер</span>
        </DropdownMenuTrigger>
      </DropdownMenu>
    );
    expect(html).toMatch(/^<span/);
    expect(html).toContain('data-testid="custom-trigger"');
    expect(html).toContain('data-slot="dropdown-menu-trigger"');
    expect(html).toContain('aria-haspopup="menu"');
  });

  it('DropdownMenuShortcut — span со своим data-slot (self-contained)', () => {
    const html = renderToStaticMarkup(<DropdownMenuShortcut>⌘K</DropdownMenuShortcut>);
    expect(html).toMatch(/^<span/);
    expect(html).toContain('data-slot="dropdown-menu-shortcut"');
    expect(html).toContain('text-muted-foreground');
    expect(html).toContain('⌘K');
  });

  it('DropdownMenuShortcut мёржит className (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <DropdownMenuShortcut className="text-red-500">X</DropdownMenuShortcut>
    );
    expect(html).toContain('text-red-500');
    expect(html).not.toContain('text-muted-foreground');
  });

  it('Content уходит в Portal — в SSR-разметке отсутствует, доступен только триггер', () => {
    const html = renderToStaticMarkup(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Меню</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Пункт</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
    expect(html).toContain('data-slot="dropdown-menu-trigger"');
    expect(html).not.toContain('data-slot="dropdown-menu-content"');
  });
});
