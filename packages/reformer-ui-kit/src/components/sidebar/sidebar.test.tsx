import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Sidebar,
  SidebarProvider,
  SidebarTrigger,
  SidebarRail,
  SidebarInset,
  SidebarInput,
  SidebarHeader,
  SidebarFooter,
  SidebarSeparator,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  useSidebar,
} from './index';

// Sidebar — не form-control: крупная композиция shadcn. Тестируем статику (renderToStaticMarkup):
// эффекты (useIsMobile / keyboard-shortcut) в SSR не выполняются, поэтому isMobile=false → всегда
// рендерится desktop-ветка Sidebar (Sheet-ветка мобилки и порталы Tooltip в SSR отсутствуют).
// Компоненты, читающие useSidebar (Sidebar / SidebarTrigger / SidebarRail / SidebarMenuButton),
// оборачиваем в SidebarProvider; структурные — можно рендерить standalone.

describe('SidebarProvider', () => {
  it('рендерит wrapper с data-slot и CSS-переменными ширины', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <div>контент</div>
      </SidebarProvider>
    );
    expect(html).toContain('data-slot="sidebar-wrapper"');
    expect(html).toContain('--sidebar-width:16rem');
    expect(html).toContain('--sidebar-width-icon:3rem');
    expect(html).toContain('контент');
  });

  it('прокидывает пользовательский style поверх переменных', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider style={{ color: 'red' }}>
        <span>x</span>
      </SidebarProvider>
    );
    expect(html).toContain('color:red');
    expect(html).toContain('--sidebar-width:16rem');
  });
});

describe('Sidebar (desktop-ветка в SSR)', () => {
  it('несёт data-slot и data-атрибуты состояния/стороны/варианта по умолчанию', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <Sidebar>
          <div>меню</div>
        </Sidebar>
      </SidebarProvider>
    );
    expect(html).toContain('data-slot="sidebar"');
    expect(html).toContain('data-state="expanded"');
    expect(html).toContain('data-variant="sidebar"');
    expect(html).toContain('data-side="left"');
    expect(html).toContain('меню');
    // desktop-каркас: gap + container + inner
    expect(html).toContain('data-slot="sidebar-gap"');
    expect(html).toContain('data-slot="sidebar-container"');
    expect(html).toContain('data-slot="sidebar-inner"');
  });

  it('side="right" / variant="floating" отражаются в data-атрибутах', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <Sidebar side="right" variant="floating" />
      </SidebarProvider>
    );
    expect(html).toContain('data-side="right"');
    expect(html).toContain('data-variant="floating"');
  });

  it('collapsible="none" рендерит плоскую панель без каркаса gap/container', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <Sidebar collapsible="none">
          <div>плоское</div>
        </Sidebar>
      </SidebarProvider>
    );
    expect(html).toContain('data-slot="sidebar"');
    expect(html).toContain('bg-sidebar');
    expect(html).toContain('плоское');
    expect(html).not.toContain('data-slot="sidebar-gap"');
  });
});

describe('SidebarTrigger / SidebarRail (используют useSidebar)', () => {
  it('SidebarTrigger — Button с data-sidebar="trigger", иконкой и sr-only подписью', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <SidebarTrigger />
      </SidebarProvider>
    );
    expect(html).toContain('data-slot="sidebar-trigger"');
    expect(html).toContain('data-sidebar="trigger"');
    expect(html).toContain('Toggle Sidebar');
    expect(html).toContain('<svg'); // PanelLeftIcon
  });

  it('SidebarRail — button с aria-label и data-sidebar="rail"', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <SidebarRail />
      </SidebarProvider>
    );
    expect(html).toContain('data-slot="sidebar-rail"');
    expect(html).toContain('data-sidebar="rail"');
    expect(html).toContain('aria-label="Toggle Sidebar"');
  });
});

describe('Sidebar — структурные части (без провайдера)', () => {
  it('Header / Footer / Content / Group / GroupContent несут свои data-slot', () => {
    const html = renderToStaticMarkup(
      <>
        <SidebarHeader>шапка</SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>тело</SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>подвал</SidebarFooter>
      </>
    );
    expect(html).toContain('data-slot="sidebar-header"');
    expect(html).toContain('data-slot="sidebar-footer"');
    expect(html).toContain('data-slot="sidebar-content"');
    expect(html).toContain('data-slot="sidebar-group"');
    expect(html).toContain('data-slot="sidebar-group-content"');
    expect(html).toContain('шапка');
    expect(html).toContain('тело');
    expect(html).toContain('подвал');
  });

  it('SidebarInput — Input с data-sidebar="input"', () => {
    const html = renderToStaticMarkup(<SidebarInput placeholder="Поиск…" />);
    expect(html).toContain('data-slot="sidebar-input"');
    expect(html).toContain('data-sidebar="input"');
    expect(html).toContain('placeholder="Поиск…"');
  });

  it('SidebarSeparator — Separator с data-sidebar="separator"', () => {
    const html = renderToStaticMarkup(<SidebarSeparator />);
    expect(html).toContain('data-slot="sidebar-separator"');
    expect(html).toContain('data-sidebar="separator"');
  });

  it('SidebarInset — <main> с data-slot="sidebar-inset"', () => {
    const html = renderToStaticMarkup(<SidebarInset>основное</SidebarInset>);
    expect(html).toMatch(/^<main/);
    expect(html).toContain('data-slot="sidebar-inset"');
    expect(html).toContain('основное');
  });

  it('GroupLabel/GroupAction рендерят свои data-slot', () => {
    const html = renderToStaticMarkup(
      <SidebarGroup>
        <SidebarGroupLabel>Раздел</SidebarGroupLabel>
        <SidebarGroupAction aria-label="Добавить" />
      </SidebarGroup>
    );
    expect(html).toContain('data-slot="sidebar-group-label"');
    expect(html).toContain('data-slot="sidebar-group-action"');
    expect(html).toContain('Раздел');
  });

  it('GroupLabel с asChild мёржит слот в переданный элемент', () => {
    const html = renderToStaticMarkup(
      <SidebarGroupLabel asChild>
        <a href="/x">Ссылка-заголовок</a>
      </SidebarGroupLabel>
    );
    // Slot.Root: рендерится <a>, а data-slot/классы прокинуты на него
    expect(html).toMatch(/^<a/);
    expect(html).toContain('href="/x"');
    expect(html).toContain('data-slot="sidebar-group-label"');
    expect(html).toContain('Ссылка-заголовок');
  });
});

describe('Sidebar — меню', () => {
  it('Menu (ul) / MenuItem (li) несут свои data-slot', () => {
    const html = renderToStaticMarkup(
      <SidebarMenu>
        <SidebarMenuItem>пункт</SidebarMenuItem>
      </SidebarMenu>
    );
    expect(html).toMatch(/data-slot="sidebar-menu"/);
    expect(html).toContain('data-slot="sidebar-menu-item"');
    expect(html).toContain('пункт');
  });

  it('MenuButton (без tooltip) — button с data-active и cva-классами', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <SidebarMenuButton data-testid="input-home">Главная</SidebarMenuButton>
      </SidebarProvider>
    );
    expect(html).toContain('data-slot="sidebar-menu-button"');
    expect(html).toContain('data-sidebar="menu-button"');
    expect(html).toContain('data-active="false"');
    expect(html).toContain('data-size="default"');
    expect(html).toContain('data-testid="input-home"');
    expect(html).toContain('Главная');
  });

  it('MenuButton variant="outline" применяет outline-классы', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <SidebarMenuButton variant="outline">Профиль</SidebarMenuButton>
      </SidebarProvider>
    );
    expect(html).toContain('shadow-[0_0_0_1px_var(--sidebar-border)]');
  });

  it('MenuButton isActive выставляет data-active="true"', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <SidebarMenuButton isActive>Активный</SidebarMenuButton>
      </SidebarProvider>
    );
    expect(html).toContain('data-active="true"');
  });

  it('MenuButton с tooltip — сам button рендерится, контент tooltip уходит в Portal (в SSR отсутствует)', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <SidebarMenuButton tooltip="Подсказка">Свёрнуто</SidebarMenuButton>
      </SidebarProvider>
    );
    expect(html).toContain('data-slot="sidebar-menu-button"');
    expect(html).toContain('Свёрнуто');
    // Radix TooltipContent портируется → текст подсказки в SSR отсутствует
    expect(html).not.toContain('Подсказка');
  });

  it('MenuAction / MenuBadge несут свои data-slot', () => {
    const html = renderToStaticMarkup(
      <SidebarMenuItem>
        <SidebarMenuAction aria-label="Ещё" />
        <SidebarMenuBadge>12</SidebarMenuBadge>
      </SidebarMenuItem>
    );
    expect(html).toContain('data-slot="sidebar-menu-action"');
    expect(html).toContain('data-slot="sidebar-menu-badge"');
    expect(html).toContain('12');
  });

  it('MenuSub / MenuSubItem / MenuSubButton несут свои data-slot', () => {
    const html = renderToStaticMarkup(
      <SidebarMenuSub>
        <SidebarMenuSubItem>
          <SidebarMenuSubButton href="/sub">Подпункт</SidebarMenuSubButton>
        </SidebarMenuSubItem>
      </SidebarMenuSub>
    );
    expect(html).toContain('data-slot="sidebar-menu-sub"');
    expect(html).toContain('data-slot="sidebar-menu-sub-item"');
    expect(html).toContain('data-slot="sidebar-menu-sub-button"');
    expect(html).toContain('data-size="md"');
    expect(html).toContain('href="/sub"');
    expect(html).toContain('Подпункт');
  });

  it('MenuSkeleton — data-slot; showIcon добавляет skeleton-иконку', () => {
    const html = renderToStaticMarkup(<SidebarMenuSkeleton showIcon />);
    expect(html).toContain('data-slot="sidebar-menu-skeleton"');
    expect(html).toContain('data-sidebar="menu-skeleton-icon"');
    expect(html).toContain('data-sidebar="menu-skeleton-text"');
  });

  it('MenuSkeleton без showIcon не рендерит иконку', () => {
    const html = renderToStaticMarkup(<SidebarMenuSkeleton />);
    expect(html).toContain('data-slot="sidebar-menu-skeleton"');
    expect(html).not.toContain('data-sidebar="menu-skeleton-icon"');
  });
});

describe('Sidebar — доступность', () => {
  it('SidebarTrigger сообщает состояние и цель: aria-expanded + aria-controls на id панели', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <Sidebar />
        <SidebarTrigger />
      </SidebarProvider>
    );
    const controls = /aria-controls="([^"]+)"/.exec(html)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`id="${controls}"`);
    expect(html).toContain('aria-expanded="true"');

    const collapsed = renderToStaticMarkup(
      <SidebarProvider defaultOpen={false}>
        <SidebarTrigger />
      </SidebarProvider>
    );
    expect(collapsed).toContain('aria-expanded="false"');
  });

  it('isActive ставит aria-current="page" у MenuButton и MenuSubButton', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider>
        <SidebarMenuButton isActive>Текущий</SidebarMenuButton>
        <SidebarMenuButton>Другой</SidebarMenuButton>
      </SidebarProvider>
    );
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(renderToStaticMarkup(<SidebarMenuSubButton isActive href="#" />)).toContain(
      'aria-current="page"'
    );
  });

  it('свёрнутая offcanvas-панель скрыта от Tab (invisible), рейл остаётся видимым', () => {
    const html = renderToStaticMarkup(
      <SidebarProvider defaultOpen={false}>
        <Sidebar>
          <SidebarRail />
        </Sidebar>
      </SidebarProvider>
    );
    expect(html).toContain('data-collapsible="offcanvas"');
    expect(html).toMatch(
      /data-slot="sidebar-container"[^>]*class="[^"]*group-data-\[collapsible=offcanvas\]:invisible/
    );
    expect(html).toMatch(
      /data-slot="sidebar-rail"[^>]*class="[^"]*group-data-\[collapsible=offcanvas\]:visible/
    );
  });

  it('ширина MenuSkeleton детерминирована (сервер и клиент совпадают), без Math.random', () => {
    const random = vi.spyOn(Math, 'random');
    const tree = (
      <>
        <SidebarMenuSkeleton />
        <SidebarMenuSkeleton />
      </>
    );
    const first = renderToStaticMarkup(tree);
    expect(renderToStaticMarkup(tree)).toBe(first);
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
    for (const [, width] of first.matchAll(/--skeleton-width:(\d+)%/g)) {
      expect(Number(width)).toBeGreaterThanOrEqual(50);
      expect(Number(width)).toBeLessThan(90);
    }
  });
});

describe('Sidebar — общее поведение', () => {
  it('className мёржится (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<SidebarHeader className="p-8">x</SidebarHeader>);
    expect(html).toContain('p-8');
    // дефолтный p-2 вытеснен tailwind-merge
    expect(html).not.toMatch(/class="[^"]*\bp-2\b/);
  });

  it('useSidebar вне SidebarProvider бросает информативную ошибку', () => {
    expect(() => renderToStaticMarkup(<SidebarTrigger />)).toThrow(/SidebarProvider/);
  });

  it('useSidebar доступен как публичный хук (реэкспорт из barrel)', () => {
    expect(typeof useSidebar).toBe('function');
  });
});
