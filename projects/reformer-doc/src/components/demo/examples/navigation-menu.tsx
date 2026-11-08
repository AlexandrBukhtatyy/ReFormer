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
 * NavigationMenu — не поле формы: навигация сайта поверх Radix NavigationMenu. Пункт-кнопка
 * раскрывает панель со ссылками, пункт-ссылка ведёт сразу на страницу. Variants — виды меню,
 * Examples — типовые панели, API — таблица props. Ссылки в демо — якоря `#…`, чтобы щелчок не
 * уводил со страницы документации.
 */
export const navigationMenuDocConfig: ComponentDocConfig = {
  name: 'NavigationMenu',
  importFrom: '@reformer/ui-kit',
  description:
    'Навигация сайта: ряд пунктов, часть из них раскрывает панель со ссылками. Клавиатура и aria — из Radix.',
  variants: [
    {
      id: 'with-dropdown',
      title: 'Пункт с панелью и пункт-ссылка',
      description:
        'NavigationMenuTrigger раскрывает панель NavigationMenuContent; панель показывается в общем слое под меню. Наведите на «Продукты».',
      render: () => (
        <NavigationMenu aria-label="Основная навигация">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Продукты</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-64 gap-1 p-1">
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
      code: `<NavigationMenu aria-label="Основная навигация">
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Продукты</NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-64 gap-1 p-1">
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
</NavigationMenu>`,
    },
    {
      id: 'links-only',
      title: 'Только ссылки',
      description:
        'Меню без панелей. navigationMenuTriggerStyle() даёт ссылке вид пункта меню; active помечает текущую страницу.',
      render: () => (
        <NavigationMenu aria-label="Разделы">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#home" active>
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
      code: `<NavigationMenu aria-label="Разделы">
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuLink className={navigationMenuTriggerStyle()} href="#home" active>
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
      title: 'Панель под своим пунктом (viewport={false})',
      description:
        'viewport={false} — панель раскрывается прямо под пунктом, а не в общем слое под всем меню.',
      render: () => (
        <NavigationMenu viewport={false} aria-label="Ресурсы">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Ресурсы</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-64 gap-1 p-1">
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
      code: `<NavigationMenu viewport={false} aria-label="Ресурсы">
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Ресурсы</NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-64 gap-1 p-1">
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
</NavigationMenu>`,
    },
  ],
  examples: [
    {
      id: 'rich-panel',
      title: 'Панель с описаниями',
      description:
        'NavigationMenuLink выстраивает содержимое в колонку: заголовок и строка пояснения под ним.',
      render: () => (
        <NavigationMenu aria-label="Платформа">
          <NavigationMenuList>
            <NavigationMenuItem>
              <NavigationMenuTrigger>Платформа</NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-72 gap-1 p-1">
                  <li>
                    <NavigationMenuLink href="#builder">
                      <div className="font-medium">Конструктор форм</div>
                      <p className="text-sm text-muted-foreground">
                        Собирайте формы из готовых блоков без кода.
                      </p>
                    </NavigationMenuLink>
                  </li>
                  <li>
                    <NavigationMenuLink href="#validation">
                      <div className="font-medium">Валидация</div>
                      <p className="text-sm text-muted-foreground">
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
      code: `<NavigationMenu aria-label="Платформа">
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Платформа</NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-72 gap-1 p-1">
          <li>
            <NavigationMenuLink href="#builder">
              <div className="font-medium">Конструктор форм</div>
              <p className="text-sm text-muted-foreground">
                Собирайте формы из готовых блоков без кода.
              </p>
            </NavigationMenuLink>
          </li>
          <li>
            <NavigationMenuLink href="#validation">
              <div className="font-medium">Валидация</div>
              <p className="text-sm text-muted-foreground">
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
  ],
  props: [
    {
      name: 'aria-label',
      type: 'string',
      default: "'Main'",
      description:
        'Подпись области навигации для скринридера. Radix ставит английское "Main" — задайте свою на языке страницы.',
    },
    {
      name: 'viewport',
      type: 'boolean',
      default: 'true',
      description:
        'true — панели показываются в общем слое под всем меню; false — каждая под своим пунктом.',
    },
    {
      name: 'value',
      type: 'string',
      description:
        'Какой пункт раскрыт (value его NavigationMenuItem), когда состоянием управляете вы. Пустая строка — все свёрнуты.',
    },
    {
      name: 'defaultValue',
      type: 'string',
      description: 'Пункт, раскрытый при первом рендере.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      description: 'Вызывается при раскрытии и сворачивании пунктов.',
    },
    {
      name: 'orientation',
      type: "'horizontal' | 'vertical'",
      default: "'horizontal'",
      description:
        'Раскладка для клавиатуры: в какую сторону стрелка уводит фокус в открытую панель (↓ или →).',
    },
    {
      name: 'dir',
      type: "'ltr' | 'rtl'",
      description:
        'Направление текста: при rtl стрелки ←/→ меняются местами. По умолчанию берётся из DirectionProvider.',
    },
    {
      name: 'delayDuration',
      type: 'number',
      default: '200',
      description: 'Задержка открытия панели при наведении мыши, мс.',
    },
    {
      name: 'skipDelayDuration',
      type: 'number',
      default: '300',
      description:
        'Сколько миллисекунд после ухода с пункта соседний пункт открывается без задержки.',
    },
    {
      name: 'NavigationMenuItem.value',
      type: 'string',
      description: 'Идентификатор пункта для value корня. Если не задан, создаётся автоматически.',
    },
    {
      name: 'NavigationMenuLink.active',
      type: 'boolean',
      default: 'false',
      description:
        'Текущая страница: ссылка получает aria-current="page". Подсветка в ките сейчас не срабатывает — см. раздел «Доступность».',
    },
    {
      name: 'NavigationMenuLink.onSelect',
      type: '(event: Event) => void',
      description:
        'Вызывается при переходе по ссылке. event.preventDefault() оставляет панель открытой.',
    },
    {
      name: 'navigationMenuTriggerStyle',
      type: '() => string',
      description:
        'Классы пункта меню. Передайте их в className ссылки верхнего уровня, чтобы она выглядела как NavigationMenuTrigger.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
