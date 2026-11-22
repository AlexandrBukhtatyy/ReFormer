import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarShortcut,
} from './index';

// Radix-overlay compound: в SSR (renderToStaticMarkup) рендерятся корневая панель (Menubar)
// и триггеры — Content уходит в Portal, который на сервере отдаёт null. Поэтому тестируем
// доступную статическую поверхность: панель + триггеры (data-slot) и self-contained Shortcut.

describe('Menubar (base, Radix compound overlay)', () => {
  it('Menubar (корень) несёт свой data-slot и статически рендерит панель', () => {
    const html = renderToStaticMarkup(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Файл</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    expect(html).toContain('data-slot="menubar"');
    expect(html).toContain('rounded-md');
    expect(html).toContain('shadow-xs');
  });

  it('Trigger несёт свой data-slot, текст и стилевые классы', () => {
    const html = renderToStaticMarkup(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Правка</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    expect(html).toContain('data-slot="menubar-trigger"');
    expect(html).toContain('Правка');
    expect(html).toContain('font-medium');
  });

  it('Trigger мёржит className (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger className="px-6">Вид</MenubarTrigger>
        </MenubarMenu>
      </Menubar>
    );
    expect(html).toContain('px-6');
    expect(html).not.toContain('px-2 py-1 text-sm');
  });

  it('MenubarShortcut — span со своим data-slot (self-contained)', () => {
    const html = renderToStaticMarkup(<MenubarShortcut>⌘T</MenubarShortcut>);
    expect(html).toMatch(/^<span/);
    expect(html).toContain('data-slot="menubar-shortcut"');
    expect(html).toContain('text-muted-foreground');
    expect(html).toContain('⌘T');
  });

  it('MenubarShortcut мёржит className (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <MenubarShortcut className="text-red-500">X</MenubarShortcut>
    );
    expect(html).toContain('text-red-500');
    expect(html).not.toContain('text-muted-foreground');
  });

  it('Content уходит в Portal — в SSR-разметке отсутствует, доступны панель и триггер', () => {
    const html = renderToStaticMarkup(
      <Menubar>
        <MenubarMenu>
          <MenubarTrigger>Файл</MenubarTrigger>
          <MenubarContent>
            <MenubarItem>Новый</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    );
    expect(html).toContain('data-slot="menubar-trigger"');
    expect(html).not.toContain('data-slot="menubar-content"');
  });
});
