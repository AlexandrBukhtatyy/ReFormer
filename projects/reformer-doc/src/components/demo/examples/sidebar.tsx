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
  SidebarSeparator,
  SidebarTrigger,
} from '@reformer/ui-kit/sidebar';
import {
  Calendar,
  ChevronDown,
  GalleryVerticalEnd,
  Home,
  Inbox,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Sidebar — не form-control: крупная композиция shadcn для навигационной боковой панели
 * приложения. `SidebarProvider` держит состояние (expanded / collapsed, персист в cookie,
 * горячая клавиша Cmd/Ctrl+B, мобильный режим через Sheet) и раздаёт его через контекст
 * `useSidebar`. `Sidebar` — сама панель (side / variant / collapsible), `SidebarInset` — основная
 * область рядом с ней, `SidebarTrigger` сворачивает/разворачивает. Внутри: Header / Content /
 * Footer, группы (Group / GroupLabel / GroupAction), меню (Menu / MenuItem / MenuButton /
 * MenuAction / MenuBadge / MenuSub…). Все части несут свой data-slot.
 *
 * Тяжёлый компонент — импортируется из отдельного subpath `@reformer/ui-kit/sidebar`.
 * В превью док используется collapsible="none" (плоская панель без fixed-позиционирования) —
 * так композиция аккуратно ложится в карточку; реальное сворачивание показано в Examples.
 */
export const sidebarDocConfig: ComponentDocConfig = {
  name: 'Sidebar',
  importFrom: '@reformer/ui-kit/sidebar',
  description:
    'Навигационная боковая панель приложения на shadcn. SidebarProvider держит состояние (свёрнута/развёрнута, персист в cookie, Cmd/Ctrl+B, мобильный режим через Sheet), Sidebar — панель, SidebarInset — основная область, SidebarTrigger переключает. Импортируется из отдельного subpath @reformer/ui-kit/sidebar.',
  variants: [
    {
      id: 'app-shell',
      title: 'Каркас приложения',
      description:
        'SidebarProvider + Sidebar (шапка-бренд, меню с иконками и активным пунктом, подвал) + SidebarInset с верхней панелью и SidebarTrigger. В превью — collapsible="none" (плоская панель).',
      render: () => (
        <div className="h-[420px] w-full overflow-hidden rounded-lg border">
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
              <SidebarFooter>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <span>Иван Петров</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarFooter>
            </Sidebar>
            <SidebarInset>
              <header className="flex h-12 items-center gap-2 border-b px-4">
                <SidebarTrigger />
                <span className="text-sm font-medium">Главная</span>
              </header>
              <div className="p-4 text-sm text-muted-foreground">Основная область страницы.</div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      ),
      code: `<SidebarProvider>
  <Sidebar>
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
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>Иван Петров</SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  </Sidebar>
  <SidebarInset>
    <header className="flex h-12 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <span className="text-sm font-medium">Главная</span>
    </header>
    <div className="p-4">Основная область страницы.</div>
  </SidebarInset>
</SidebarProvider>`,
    },
    {
      id: 'menu-parts',
      title: 'Части меню',
      description:
        'Строительные блоки меню: MenuButton с действием (MenuAction) и счётчиком (MenuBadge), вложенное подменю (MenuSub / MenuSubItem / MenuSubButton) и загрузочные скелетоны (MenuSkeleton).',
      render: () => (
        <div className="h-[420px] w-56 overflow-hidden rounded-lg border">
          <SidebarProvider className="h-full min-h-0">
            <Sidebar collapsible="none">
              <SidebarContent>
                <SidebarGroup>
                  <SidebarGroupLabel>Проекты</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
                          <ChevronDown />
                          <span>Дизайн-система</span>
                        </SidebarMenuButton>
                        <SidebarMenuAction aria-label="Добавить">
                          <Plus />
                        </SidebarMenuAction>
                        <SidebarMenuSub>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton isActive>Компоненты</SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton>Токены</SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        </SidebarMenuSub>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton>
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
      code: `<SidebarMenu>
  <SidebarMenuItem>
    <SidebarMenuButton>
      <ChevronDown />
      <span>Дизайн-система</span>
    </SidebarMenuButton>
    <SidebarMenuAction aria-label="Добавить">
      <Plus />
    </SidebarMenuAction>
    <SidebarMenuSub>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton isActive>Компоненты</SidebarMenuSubButton>
      </SidebarMenuSubItem>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton>Токены</SidebarMenuSubButton>
      </SidebarMenuSubItem>
    </SidebarMenuSub>
  </SidebarMenuItem>
  <SidebarMenuItem>
    <SidebarMenuButton>Маркетинг</SidebarMenuButton>
    <SidebarMenuBadge>9</SidebarMenuBadge>
  </SidebarMenuItem>
</SidebarMenu>

{/* Загрузка */}
<SidebarMenuItem>
  <SidebarMenuSkeleton showIcon />
</SidebarMenuItem>`,
    },
  ],
  examples: [
    {
      id: 'collapsible',
      title: 'Сворачиваемая панель (offcanvas)',
      description:
        'Полноценный каркас: Sidebar с collapsible="offcanvas" уезжает за край при сворачивании, SidebarTrigger переключает (и глобальная горячая клавиша Cmd/Ctrl+B). Состояние сохраняется в cookie. В превью панель ограничена рамкой контейнера.',
      render: () => (
        <div
          className="relative h-[440px] w-full overflow-hidden rounded-lg border"
          style={{ transform: 'translateZ(0)' }}
        >
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
                <span className="text-sm font-medium">Дашборд</span>
              </header>
              <div className="p-4 text-sm text-muted-foreground">
                Нажмите на кнопку слева (или Cmd/Ctrl+B), чтобы свернуть панель.
              </div>
            </SidebarInset>
          </SidebarProvider>
        </div>
      ),
      code: `function AppShell() {
  return (
    <SidebarProvider>
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
                  <SidebarMenuButton isActive tooltip="Главная">
                    <Home />
                    <span>Главная</span>
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
          <span className="text-sm font-medium">Дашборд</span>
        </header>
        <div className="p-4">Контент страницы…</div>
      </SidebarInset>
    </SidebarProvider>
  );
}`,
    },
    {
      id: 'groups',
      title: 'Секции с заголовками и действиями',
      description:
        'Несколько SidebarGroup, каждая с SidebarGroupLabel и SidebarGroupAction (кнопка в углу секции); SidebarSeparator разделяет области. Так навигация разбивается на смысловые блоки.',
      render: () => (
        <div className="h-[420px] w-64 overflow-hidden rounded-lg border">
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
      code: `<SidebarContent>
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
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
  <SidebarSeparator />
  <SidebarGroup>
    <SidebarGroupLabel>Прочее</SidebarGroupLabel>
    <SidebarGroupContent>{/* … */}</SidebarGroupContent>
  </SidebarGroup>
</SidebarContent>`,
    },
  ],
  props: [
    {
      name: 'SidebarProvider',
      type: 'div + context',
      default: 'defaultOpen=true',
      description:
        'Корень. Держит состояние (open / onOpenChange для управляемого режима, defaultOpen для неуправляемого), персист в cookie, горячую клавишу Cmd/Ctrl+B и мобильный режим. Раздаёт всё через useSidebar. Задаёт CSS-переменные ширины.',
    },
    {
      name: 'Sidebar',
      type: 'div | Sheet',
      default: 'side=left, variant=sidebar, collapsible=offcanvas',
      description:
        'Сама панель. side: left | right; variant: sidebar | floating | inset; collapsible: offcanvas (уезжает за край) | icon (сжимается до иконок) | none (не сворачивается). На мобиле — Sheet.',
    },
    {
      name: 'SidebarTrigger',
      type: 'Button',
      description:
        'Кнопка-переключатель (иконка PanelLeft). Вызывает toggleSidebar из контекста. Обычно ставится в SidebarInset.',
    },
    {
      name: 'SidebarRail',
      type: 'button',
      description:
        'Тонкая полоса у края панели — клик/перетаскивание сворачивает-разворачивает. Ставится внутри Sidebar.',
    },
    {
      name: 'SidebarInset',
      type: 'main',
      description:
        'Основная область страницы рядом с панелью. Для variant="inset" получает скруглённый «остров».',
    },
    {
      name: 'SidebarHeader / SidebarFooter / SidebarContent',
      type: 'div',
      description:
        'Верхняя / нижняя закреплённые зоны и прокручиваемое тело панели соответственно.',
    },
    {
      name: 'SidebarGroup / SidebarGroupLabel / SidebarGroupAction / SidebarGroupContent',
      type: 'div (+ asChild у Label/Action)',
      description:
        'Секция навигации: обёртка, заголовок, кнопка-действие в углу секции и контейнер содержимого. Label/Action прячутся при collapsible="icon".',
    },
    {
      name: 'SidebarInput',
      type: 'Input',
      description: 'Поле поиска, стилизованное под панель (компактнее и без тени).',
    },
    {
      name: 'SidebarSeparator',
      type: 'Separator',
      description: 'Горизонтальный разделитель между областями панели.',
    },
    {
      name: 'SidebarMenu / SidebarMenuItem',
      type: 'ul / li',
      description: 'Список пунктов навигации и его элемент.',
    },
    {
      name: 'SidebarMenuButton',
      type: 'button (asChild)',
      default: 'variant=default, size=default',
      description:
        'Пункт меню. isActive подсвечивает активный; variant: default | outline; size: default | sm | lg; tooltip (строка или пропсы TooltipContent) показывается при свёрнутой панели; asChild оборачивает ссылку.',
    },
    {
      name: 'SidebarMenuAction',
      type: 'button (asChild)',
      default: 'showOnHover=false',
      description:
        'Вторичная кнопка-действие у пункта (в правом верхнем углу). showOnHover проявляет её только при наведении на пункт.',
    },
    {
      name: 'SidebarMenuBadge',
      type: 'div',
      description: 'Счётчик/бейдж у пункта (напр. число непрочитанных). Чисто визуальный.',
    },
    {
      name: 'SidebarMenuSkeleton',
      type: 'div',
      default: 'showIcon=false',
      description:
        'Скелетон пункта на время загрузки. showIcon добавляет плейсхолдер иконки; ширина текста случайная.',
    },
    {
      name: 'SidebarMenuSub / SidebarMenuSubItem / SidebarMenuSubButton',
      type: 'ul / li / a (asChild)',
      default: 'size=md',
      description:
        'Вложенное подменю: контейнер, элемент и ссылка-кнопка (size: sm | md, isActive). Скрывается при collapsible="icon".',
    },
    {
      name: 'useSidebar',
      type: '() => SidebarContext',
      description:
        'Хук доступа к состоянию: { state, open, setOpen, openMobile, setOpenMobile, isMobile, toggleSidebar }. Только внутри SidebarProvider.',
    },
  ],
};
