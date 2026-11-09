import { useState, type CSSProperties } from 'react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from '@reformer/ui-kit/sidebar';
import {
  Calendar,
  Folder,
  GalleryVerticalEnd,
  Home,
  Inbox,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Sidebar — не поле формы: боковая панель навигации приложения из частей shadcn. Импорт только из
 * `@reformer/ui-kit/sidebar`. Variants — статичная панель (collapsible="none") и части меню,
 * Examples — сворачивание и группы, API — таблица props.
 *
 * Рамка демо (`<div style>`) есть только в render. В приложении панель занимает высоту окна
 * (`fixed`, `h-svh`), поэтому в рамке провайдеру задан `className="h-full min-h-0"`, а для
 * сворачиваемых примеров у рамки стоит `transform`: он делает её точкой отсчёта для `fixed`.
 */

const frame: CSSProperties = { width: '100%', height: 420, overflow: 'hidden' };
const fixedFrame: CSSProperties = { ...frame, position: 'relative', transform: 'translateZ(0)' };

function ControlledIconSidebar() {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border" style={fixedFrame}>
      <SidebarProvider className="h-full min-h-0" open={open} onOpenChange={setOpen}>
        <Sidebar collapsible="icon">
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Меню</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive tooltip="Главная">
                      <Home />
                      <span>Главная</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Поиск">
                      <Search />
                      <span>Поиск</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip="Настройки">
                      <Settings />
                      <span>Настройки</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <span className="text-sm font-medium">
              Панель {open ? 'развёрнута' : 'свёрнута до иконок'}
            </span>
          </header>
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}

export const sidebarDocConfig: ComponentDocConfig = {
  name: 'Sidebar',
  importFrom: '@reformer/ui-kit/sidebar',
  description:
    'Боковая панель навигации приложения: провайдер состояния, панель, меню и основная область рядом с ней.',
  variants: [
    {
      id: 'flat',
      title: 'Статичная панель (collapsible="none")',
      description:
        'Шапка, меню с активным пунктом и счётчиком, подвал и основная область. collapsible="none" — панель не сворачивается и стоит в потоке страницы.',
      render: () => (
        <div className="rounded-lg border" style={frame}>
          <SidebarProvider className="h-full min-h-0">
            <Sidebar collapsible="none">
              <SidebarHeader>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton size="lg">
                      <GalleryVerticalEnd />
                      <div className="flex flex-col gap-0.5 leading-none">
                        <span className="font-semibold">Acme Inc</span>
                        <span className="text-xs">Рабочее пространство</span>
                      </div>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarHeader>
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Навигация</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton isActive>
                          <Home />
                          <span>Главная</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <Inbox />
                          <span>Входящие</span>
                        </SidebarMenuButton>
                        <SidebarMenuBadge>4</SidebarMenuBadge>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <Calendar />
                          <span>Календарь</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
              <SidebarFooter>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <Settings />
                      <span>Настройки</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarFooter>
            </Sidebar>
            <SidebarInset>
              <header className="flex h-12 items-center gap-2 border-b px-4">
                <span className="text-sm font-medium">Главная</span>
              </header>
              <div className="p-4 text-sm text-muted-foreground">Основная область страницы.</div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      ),
      code: `<SidebarProvider className="h-full min-h-0">
  <Sidebar collapsible="none">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">
            <GalleryVerticalEnd />
            <div className="flex flex-col gap-0.5 leading-none">
              <span className="font-semibold">Acme Inc</span>
              <span className="text-xs">Рабочее пространство</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Навигация</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive>
                <Home />
                <span>Главная</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Inbox />
                <span>Входящие</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>4</SidebarMenuBadge>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Calendar />
                <span>Календарь</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>
            <Settings />
            <span>Настройки</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>
  <SidebarInset>
    <header className="flex h-12 items-center gap-2 border-b px-4">
      <span className="text-sm font-medium">Главная</span>
    </header>
    <div className="p-4 text-sm text-muted-foreground">Основная область страницы.</div>
  </SidebarInset>
</SidebarProvider>`,
    },
    {
      id: 'menu-parts',
      title: 'Части меню',
      description:
        'Пункт с кнопкой-действием (SidebarMenuAction) и счётчиком (SidebarMenuBadge), вложенное подменю (SidebarMenuSub) и заглушки на время загрузки (SidebarMenuSkeleton).',
      render: () => (
        <div className="rounded-lg border" style={{ ...frame, maxWidth: 256 }}>
          <SidebarProvider className="h-full min-h-0">
            <Sidebar collapsible="none">
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Проекты</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <Folder />
                          <span>Дизайн-система</span>
                        </SidebarMenuButton>
                        <SidebarMenuAction aria-label="Добавить раздел">
                          <Plus />
                        </SidebarMenuAction>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton href="#components" isActive>
                              Компоненты
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton href="#tokens">Токены</SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <Folder />
                          <span>Маркетинг</span>
                        </SidebarMenuButton>
                        <SidebarMenuBadge>9</SidebarMenuBadge>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                <SidebarGroup>
                  <SidebarGroupLabel>Загрузка</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuSkeleton showIcon />
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
          </SidebarProvider>
        </div>
      ),
      code: `<SidebarProvider className="h-full min-h-0">
  <Sidebar collapsible="none">
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Проекты</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Folder />
                <span>Дизайн-система</span>
              </SidebarMenuButton>
              <SidebarMenuAction aria-label="Добавить раздел">
                <Plus />
              </SidebarMenuAction>
              <SidebarMenuSub>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton href="#components" isActive>
                    Компоненты
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
                <SidebarMenuSubItem>
                  <SidebarMenuSubButton href="#tokens">Токены</SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Folder />
                <span>Маркетинг</span>
              </SidebarMenuButton>
              <SidebarMenuBadge>9</SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarGroup>
        <SidebarGroupLabel>Загрузка</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuSkeleton showIcon />
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</SidebarProvider>`,
    },
  ],
  examples: [
    {
      id: 'offcanvas',
      title: 'Панель, которая уезжает за край (offcanvas)',
      description:
        'collapsible="offcanvas": SidebarTrigger или Ctrl/Cmd+B прячут панель целиком, основная область занимает освободившееся место. SidebarRail — полоса у края панели, щелчок по ней тоже переключает.',
      render: () => (
        <div className="rounded-lg border" style={fixedFrame}>
          <SidebarProvider className="h-full min-h-0">
            <Sidebar collapsible="offcanvas">
              <SidebarHeader>
                <SidebarGroupLabel>Acme Inc</SidebarGroupLabel>
              </SidebarHeader>
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Меню</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton isActive>
                          <Home />
                          <span>Главная</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <Search />
                          <span>Поиск</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
              <SidebarRail />
            </Sidebar>
            <SidebarInset>
              <header className="flex h-12 items-center gap-2 border-b px-4">
                <SidebarTrigger />
                <span className="text-sm font-medium">Дашборд</span>
              </header>
              <div className="p-4 text-sm text-muted-foreground">
                Нажмите кнопку слева или Ctrl/Cmd+B, чтобы спрятать панель.
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      ),
      code: `<SidebarProvider className="h-full min-h-0">
  <Sidebar collapsible="offcanvas">
    <SidebarHeader>
      <SidebarGroupLabel>Acme Inc</SidebarGroupLabel>
    </SidebarHeader>
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Меню</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive>
                <Home />
                <span>Главная</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Search />
                <span>Поиск</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>
  <SidebarInset>
    <header className="flex h-12 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <span className="text-sm font-medium">Дашборд</span>
    </header>
    <div className="p-4 text-sm text-muted-foreground">
      Нажмите кнопку слева или Ctrl/Cmd+B, чтобы спрятать панель.
    </div>
  </SidebarInset>
</SidebarProvider>`,
    },
    {
      id: 'icon-controlled',
      title: 'Сворачивание до иконок и своё состояние',
      description:
        'collapsible="icon" сужает панель до колонки иконок; подсказка tooltip у пункта видна только в свёрнутом виде. open + onOpenChange — состояние держит ваш компонент.',
      render: ControlledIconSidebar,
      code: `const [open, setOpen] = useState(true);

<SidebarProvider className="h-full min-h-0" open={open} onOpenChange={setOpen}>
  <Sidebar collapsible="icon">
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Меню</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton isActive tooltip="Главная">
                <Home />
                <span>Главная</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Поиск">
                <Search />
                <span>Поиск</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Настройки">
                <Settings />
                <span>Настройки</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
  <SidebarInset>
    <header className="flex h-12 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <span className="text-sm font-medium">
        Панель {open ? 'развёрнута' : 'свёрнута до иконок'}
      </span>
    </header>
  </SidebarInset>
</SidebarProvider>`,
    },
    {
      id: 'groups',
      title: 'Группы с заголовками и действиями',
      description:
        'Несколько SidebarGroup, у каждой заголовок SidebarGroupLabel; SidebarGroupAction — кнопка в углу группы, SidebarSeparator разделяет группы.',
      render: () => (
        <div className="rounded-lg border" style={{ ...frame, maxWidth: 256 }}>
          <SidebarProvider className="h-full min-h-0">
            <Sidebar collapsible="none">
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Избранное</SidebarGroupLabel>
                  <SidebarGroupAction aria-label="Добавить в избранное">
                    <Plus />
                  </SidebarGroupAction>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <Home />
                          <span>Обзор</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <Inbox />
                          <span>Входящие</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
                <SidebarSeparator />
                <SidebarGroup>
                  <SidebarGroupLabel>Прочее</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <Calendar />
                          <span>Календарь</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <Settings />
                          <span>Настройки</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              </SidebarContent>
            </Sidebar>
          </SidebarProvider>
        </div>
      ),
      code: `<SidebarProvider className="h-full min-h-0">
  <Sidebar collapsible="none">
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Избранное</SidebarGroupLabel>
        <SidebarGroupAction aria-label="Добавить в избранное">
          <Plus />
        </SidebarGroupAction>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Home />
                <span>Обзор</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Inbox />
                <span>Входящие</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <SidebarSeparator />
      <SidebarGroup>
        <SidebarGroupLabel>Прочее</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Calendar />
                <span>Календарь</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <Settings />
                <span>Настройки</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</SidebarProvider>`,
    },
  ],
  props: [
    {
      name: 'SidebarProvider.defaultOpen',
      type: 'boolean',
      default: 'true',
      description:
        'Развёрнута ли панель при первом рендере, если состоянием управляет провайдер. Сохранённое в cookie sidebar_state состояние важнее.',
    },
    {
      name: 'SidebarProvider.open',
      type: 'boolean',
      description:
        'Развёрнута ли панель, когда состоянием управляете вы. Используется с onOpenChange.',
    },
    {
      name: 'SidebarProvider.onOpenChange',
      type: '(open: boolean) => void',
      description:
        'Вызывается при сворачивании и разворачивании на широком экране (кнопка, полоса, Ctrl/Cmd+B).',
    },
    {
      name: 'SidebarProvider.style',
      type: 'CSSProperties',
      description:
        'Ширина панели — переменные --sidebar-width (16rem) и --sidebar-width-icon (3rem); ваши значения перекрывают встроенные.',
    },
    {
      name: 'Sidebar.side',
      type: "'left' | 'right'",
      default: "'left'",
      description: 'С какой стороны окна стоит панель.',
    },
    {
      name: 'Sidebar.variant',
      type: "'sidebar' | 'floating' | 'inset'",
      default: "'sidebar'",
      description:
        'sidebar — панель с границей; floating — карточка с тенью и отступом; inset — основная область становится карточкой рядом с панелью.',
    },
    {
      name: 'Sidebar.collapsible',
      type: "'offcanvas' | 'icon' | 'none'",
      default: "'offcanvas'",
      description:
        'offcanvas — свёрнутая панель уезжает за край; icon — сужается до колонки иконок; none — не сворачивается и стоит в потоке страницы.',
    },
    {
      name: 'SidebarMenuButton.isActive',
      type: 'boolean',
      default: 'false',
      description:
        'Подсветить пункт как текущий (data-active) и поставить aria-current="page". С asChild атрибут достаётся вашей ссылке.',
    },
    {
      name: 'SidebarMenuButton.tooltip',
      type: 'string | TooltipContent props',
      description: 'Подсказка справа от пункта. Видна только в свёрнутой до иконок панели.',
    },
    {
      name: 'SidebarMenuButton.variant',
      type: "'default' | 'outline'",
      default: "'default'",
      description: 'outline — пункт с рамкой и фоном.',
    },
    {
      name: 'SidebarMenuButton.size',
      type: "'default' | 'sm' | 'lg'",
      default: "'default'",
      description: 'Высота пункта: 32, 28 или 48 px. lg — для шапки с названием и подписью.',
    },
    {
      name: 'asChild',
      type: 'boolean',
      default: 'false',
      description:
        'У SidebarMenuButton, SidebarMenuAction, SidebarMenuSubButton, SidebarGroupLabel и SidebarGroupAction: стили части переносятся на единственного ребёнка, например ссылку роутера.',
    },
    {
      name: 'SidebarMenuAction.showOnHover',
      type: 'boolean',
      default: 'false',
      description: 'На широком экране кнопка видна только при наведении или фокусе внутри пункта.',
    },
    {
      name: 'SidebarMenuSubButton.size',
      type: "'sm' | 'md'",
      default: "'md'",
      description: 'Размер текста пункта подменю. Сама часть — ссылка <a>.',
    },
    {
      name: 'SidebarMenuSubButton.isActive',
      type: 'boolean',
      default: 'false',
      description: 'Подсветить пункт подменю как текущий и поставить aria-current="page".',
    },
    {
      name: 'SidebarMenuSkeleton.showIcon',
      type: 'boolean',
      default: 'false',
      description:
        'Добавить к заглушке квадрат иконки. Ширина полосы текста — от 50 до 89 %, разная у соседних заглушек.',
    },
    {
      name: 'useSidebar()',
      type: '{ state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }',
      description:
        'Состояние панели для своих частей. state — "expanded" | "collapsed". Вне SidebarProvider бросает ошибку.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Есть у всех частей. Сливается через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
