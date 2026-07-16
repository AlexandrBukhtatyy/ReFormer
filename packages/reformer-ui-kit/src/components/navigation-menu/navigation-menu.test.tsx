import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from './index';

// Radix NavigationMenu — навигационный compound. В SSR (renderToStaticMarkup) рендерятся
// статические части (Root / List / Item / Trigger / Link) и контейнер Viewport; Content и
// сам Viewport-примитив монтируются через Presence и в закрытом состоянии отсутствуют.
// Тестируем доступную статическую поверхность и data-slot каждой части.

function renderMenu(props?: { viewport?: boolean }) {
  return renderToStaticMarkup(
    <NavigationMenu viewport={props?.viewport}>
      <NavigationMenuList>
        <NavigationMenuItem>
          <NavigationMenuTrigger>Товары</NavigationMenuTrigger>
          <NavigationMenuContent>
            <NavigationMenuLink href="/a">Ссылка</NavigationMenuLink>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

describe('NavigationMenu (base, Radix navigation compound)', () => {
  it('статические части несут собственный data-slot', () => {
    const html = renderMenu();
    expect(html).toContain('data-slot="navigation-menu"');
    expect(html).toContain('data-slot="navigation-menu-list"');
    expect(html).toContain('data-slot="navigation-menu-item"');
    expect(html).toContain('data-slot="navigation-menu-trigger"');
  });

  it('Root — <nav> с навигационной семантикой и data-viewport по умолчанию', () => {
    const html = renderMenu();
    expect(html).toMatch(/^<nav/);
    expect(html).toContain('aria-label="Main"');
    expect(html).toContain('data-viewport="true"');
  });

  it('Trigger — <button> в закрытом состоянии с data-state="closed" и aria-expanded', () => {
    const html = renderMenu();
    expect(html).toContain('data-state="closed"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('>Товары ');
  });

  it('Trigger содержит chevron-иконку с aria-hidden', () => {
    const html = renderMenu();
    expect(html).toContain('lucide-chevron-down');
    expect(html).toContain('aria-hidden="true"');
  });

  it('Content монтируется через Presence — в закрытом SSR отсутствует', () => {
    const html = renderMenu();
    expect(html).not.toContain('data-slot="navigation-menu-content"');
  });

  it('viewport по умолчанию рендерит контейнер Viewport (оверлей-слой)', () => {
    const html = renderMenu();
    expect(html).toContain('isolate z-50 flex justify-center');
  });

  it('viewport={false} — data-viewport="false", контейнер Viewport не рендерится', () => {
    const html = renderMenu({ viewport: false });
    expect(html).toContain('data-viewport="false"');
    expect(html).not.toContain('isolate z-50 flex justify-center');
  });

  it('NavigationMenuLink — <a> со своим data-slot, href и произвольными props', () => {
    const html = renderToStaticMarkup(
      <NavigationMenu viewport={false}>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink href="/about" data-testid="nav-about">
              О нас
            </NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    );
    expect(html).toContain('data-slot="navigation-menu-link"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('data-testid="nav-about"');
    expect(html).toContain('>О нас</a>');
  });

  it('navigationMenuTriggerStyle() экспортируется и генерирует классы', () => {
    const cls = navigationMenuTriggerStyle();
    expect(cls).toContain('inline-flex');
    expect(cls).toContain('data-[state=open]:bg-accent/50');
  });

  it('className мёржится на List (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <NavigationMenu>
        <NavigationMenuList className="gap-8">
          <NavigationMenuItem>
            <NavigationMenuTrigger>Меню</NavigationMenuTrigger>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    );
    // Дефолт списка gap-1 схлопнут в gap-8 (tailwind-merge). У List — единственный gap-*.
    const listClass = html.match(/data-slot="navigation-menu-list" class="([^"]*)"/)?.[1] ?? '';
    expect(listClass).toContain('gap-8');
    expect(listClass).not.toContain('gap-1');
  });

  it('прокидывает data-testid на триггер', () => {
    const html = renderToStaticMarkup(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger data-testid="nav-trigger">Меню</NavigationMenuTrigger>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>
    );
    expect(html).toContain('data-testid="nav-trigger"');
  });
});
