import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * NavigationMenu — не form-control: навигационный compound поверх Radix NavigationMenu
 * (NavigationMenu / NavigationMenuList / NavigationMenuItem / NavigationMenuTrigger /
 * NavigationMenuContent / NavigationMenuLink / NavigationMenuIndicator / NavigationMenuViewport).
 * Триггер раскрывает выпадающую панель (Content); панель показывается в общем слое Viewport
 * (viewport=true) либо инлайн под пунктом (viewport=false). navigationMenuTriggerStyle — cva-стиль
 * триггера, применим к NavigationMenuLink, чтобы простая ссылка выглядела как пункт-триггер.
 * Таб Variants — стили меню, Examples — типовые композиции, props — таблица частей.
 */
export const navigationMenuDocConfig: ComponentDocConfig = {
  name: 'NavigationMenu',
  importFrom: '@reformer/ui-kit',
  description:
    'Горизонтальное навигационное меню на shadcn / Radix NavigationMenu. Compound: NavigationMenu (корень) + NavigationMenuList / NavigationMenuItem / NavigationMenuTrigger / NavigationMenuContent / NavigationMenuLink / NavigationMenuIndicator / NavigationMenuViewport. Клавиатурная навигация и aria — из Radix.',
  variants: [
    {
      id: 'with-dropdown',
      title: 'Меню с выпадающей панелью (viewport)',
      description:
        'Пункт-триггер раскрывает панель Content. По умолчанию (viewport=true) панель показывается в общем слое Viewport под меню. Наведите на «Товары».',
      render: () => (
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Товары</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul style={{ display: 'grid', gap: 4, width: 220, padding: 4 }}>
                  <li>
                    <NavigationMenuLink href="#analytics">Аналитика</NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink href="#reports">Отчёты</NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink href="#integrations">Интеграции</NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#pricing">
                Тарифы
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      ),
      code: `<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Товары</NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-[220px] gap-1 p-1">
          <li><NavigationMenuLink href="#analytics">Аналитика</NavigationMenuLink></li>
          <li><NavigationMenuLink href="#reports">Отчёты</NavigationMenuLink></li>
          <li><NavigationMenuLink href="#integrations">Интеграции</NavigationMenuLink></li>
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
    <NavigationMenuItem>
      <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#pricing">
        Тарифы
      </NavigationMenuLink>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>`,
    },
    {
      id: 'links-only',
      title: 'Только ссылки (без выпадашки)',
      description:
        'Простое горизонтальное меню из ссылок. navigationMenuTriggerStyle() задаёт каждой ссылке вид пункта меню.',
      render: () => (
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#home">
                Главная
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#docs">
                Документация
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#contacts">
                Контакты
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      ),
      code: `<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#home">
        Главная
      </NavigationMenuLink>
    </NavigationMenuItem>
    <NavigationMenuItem>
      <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#docs">
        Документация
      </NavigationMenuLink>
    </NavigationMenuItem>
    <NavigationMenuItem>
      <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#contacts">
        Контакты
      </NavigationMenuLink>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>`,
    },
    {
      id: 'inline-viewport-false',
      title: 'Инлайн-панель (viewport={false})',
      description:
        'viewport={false} — панель Content раскрывается прямо под своим пунктом, без общего слоя Viewport. Удобно для компактных меню.',
      render: () => (
        <NavigationMenu viewport={false}>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Ресурсы</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul style={{ display: 'grid', gap: 4, width: 200, padding: 4 }}>
                  <li>
                    <NavigationMenuLink href="#blog">Блог</NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink href="#guides">Руководства</NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      ),
      code: `<NavigationMenu viewport={false}>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Ресурсы</NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-[200px] gap-1 p-1">
          <li><NavigationMenuLink href="#blog">Блог</NavigationMenuLink></li>
          <li><NavigationMenuLink href="#guides">Руководства</NavigationMenuLink></li>
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>`,
    },
  ],
  examples: [
    {
      id: 'rich-panel',
      title: 'Панель с описаниями',
      description:
        'NavigationMenuLink рендерит вертикальный блок (заголовок + описание) — типовая «богатая» панель навигации.',
      render: () => (
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Платформа</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul style={{ display: 'grid', gap: 4, width: 300, padding: 4 }}>
                  <li>
                    <NavigationMenuLink href="#builder">
                      <div style={{ fontWeight: 500 }}>Конструктор форм</div>
                      <p
                        style={{
                          fontSize: 12,
                          lineHeight: 1.4,
                          color: 'var(--muted-foreground, #666)',
                        }}
                      >
                        Собирайте формы из готовых блоков без кода.
                      </p>
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink href="#validation">
                      <div style={{ fontWeight: 500 }}>Валидация</div>
                      <p
                        style={{
                          fontSize: 12,
                          lineHeight: 1.4,
                          color: 'var(--muted-foreground, #666)',
                        }}
                      >
                        Правила, зависимости и асинхронные проверки.
                      </p>
                    </NavigationMenuLink>
                  </li>
                </ul>
              </NavigationMenuContent>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      ),
      code: `<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Платформа</NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-[300px] gap-1 p-1">
          <li>
            <NavigationMenuLink href="#builder">
              <div className="font-medium">Конструктор форм</div>
              <p className="text-muted-foreground text-sm">
                Собирайте формы из готовых блоков без кода.
              </p>
            </NavigationMenuLink>
          </li>
          <li>
            <NavigationMenuLink href="#validation">
              <div className="font-medium">Валидация</div>
              <p className="text-muted-foreground text-sm">
                Правила, зависимости и асинхронные проверки.
              </p>
            </NavigationMenuLink>
          </li>
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>`,
    },
    {
      id: 'active-link',
      title: 'Активная ссылка (data-active)',
      description:
        'NavigationMenuLink подсвечивает активный пункт через проп active (data-active=true) — для отметки текущего раздела.',
      render: () => (
        <NavigationMenu>
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#overview" active>
                Обзор
              </NavigationMenuLink>
            </NavigationMenuItem>
            <NavigationMenuItem>
              <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#settings">
                Настройки
              </NavigationMenuLink>
            </NavigationMenuItem>
          </NavigationMenuList>
        </NavigationMenu>
      ),
      code: `<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#overview" active>
        Обзор
      </NavigationMenuLink>
    </NavigationMenuItem>
    <NavigationMenuItem>
      <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#settings">
        Настройки
      </NavigationMenuLink>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>`,
    },
  ],
  props: [
    {
      name: 'NavigationMenu',
      type: 'Radix NavigationMenu.Root',
      default: 'viewport=true',
      description:
        'Корень меню. viewport — рендерить общий слой Viewport для панелей (true) или раскрывать инлайн под пунктом (false). value / onValueChange — управляемое состояние открытого пункта.',
    },
    {
      name: 'NavigationMenuList',
      type: 'Radix NavigationMenu.List',
      description: 'Список пунктов (ul). Горизонтальный ряд с gap.',
    },
    {
      name: 'NavigationMenuItem',
      type: 'Radix NavigationMenu.Item',
      description: 'Пункт меню (li) — контейнер для триггера/ссылки и его панели.',
    },
    {
      name: 'NavigationMenuTrigger',
      type: 'Radix NavigationMenu.Trigger',
      description:
        'Кнопка, раскрывающая панель Content. Включает chevron-иконку, поворачивающуюся при открытии.',
    },
    {
      name: 'NavigationMenuContent',
      type: 'Radix NavigationMenu.Content',
      description:
        'Выпадающая панель пункта. Монтируется при открытии; показывается в Viewport или инлайн (зависит от viewport на корне).',
    },
    {
      name: 'NavigationMenuLink',
      type: 'Radix NavigationMenu.Link',
      description:
        'Ссылка (a). active (data-active=true) подсвечивает текущий пункт. С navigationMenuTriggerStyle() выглядит как пункт-триггер.',
    },
    {
      name: 'NavigationMenuIndicator',
      type: 'Radix NavigationMenu.Indicator',
      description: 'Индикатор-«стрелка», указывающий на активный пункт под меню (опциональный).',
    },
    {
      name: 'NavigationMenuViewport',
      type: 'Radix NavigationMenu.Viewport',
      description:
        'Общий слой, куда проецируются панели Content (при viewport=true). Рендерится корнем автоматически.',
    },
    {
      name: 'navigationMenuTriggerStyle',
      type: '() => string',
      description:
        'cva-стиль пункта-триггера. Применяется к NavigationMenuLink, чтобы простая ссылка выглядела как пункт меню.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
