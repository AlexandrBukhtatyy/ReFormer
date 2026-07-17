import { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  Button,
} from '@reformer/ui-kit';
import { CreditCard, LogOut, Settings, User, UserPlus } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * DropdownMenu — не form-control: overlay поверх Radix DropdownMenu. Триггер открывает меню
 * (DropdownMenuContent в Portal), позиционируемое относительно триггера. Пункты бывают обычные
 * (Item), с флажком (CheckboxItem), радио-группой (RadioItem) и вложенным подменю (Sub*).
 * Таб Variants показывает готовые конфигурации, Examples — приёмы (иконки + destructive, группы).
 */
export const dropdownMenuDocConfig: ComponentDocConfig = {
  name: 'DropdownMenu',
  importFrom: '@reformer/ui-kit',
  description:
    'Выпадающее меню на shadcn / Radix DropdownMenu. Триггер открывает список в Portal; пункты — обычные, с флажком (CheckboxItem), радио-выбором (RadioItem) или вложенным подменю (Sub). Все части несут свой data-slot.',
  variants: [
    {
      id: 'basic',
      title: 'Базовое меню',
      description:
        'Триггер-кнопка (asChild) открывает меню с заголовком, пунктами, разделителем и горячей клавишей (Shortcut).',
      render: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Открыть меню</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              Профиль
              <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              Настройки
              <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Выйти</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      code: `<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Открыть меню</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem>
      Профиль
      <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuItem>
      Настройки
      <DropdownMenuShortcut>⌘,</DropdownMenuShortcut>
    </DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">Выйти</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
    },
    {
      id: 'checkbox-items',
      title: 'Пункты с флажком (CheckboxItem)',
      description:
        'CheckboxItem с checked / onCheckedChange — переключение видимости колонок, панелей и т.п.',
      render: () => {
        function CheckboxMenu() {
          const [statusBar, setStatusBar] = useState(true);
          const [activityBar, setActivityBar] = useState(false);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Панели</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Показывать</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={statusBar} onCheckedChange={setStatusBar}>
                  Строка состояния
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem checked={activityBar} onCheckedChange={setActivityBar}>
                  Панель активности
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        return <CheckboxMenu />;
      },
      code: `const [statusBar, setStatusBar] = useState(true);
const [activityBar, setActivityBar] = useState(false);

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Панели</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>Показывать</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuCheckboxItem checked={statusBar} onCheckedChange={setStatusBar}>
      Строка состояния
    </DropdownMenuCheckboxItem>
    <DropdownMenuCheckboxItem checked={activityBar} onCheckedChange={setActivityBar}>
      Панель активности
    </DropdownMenuCheckboxItem>
  </DropdownMenuContent>
</DropdownMenu>`,
    },
    {
      id: 'radio-group',
      title: 'Радио-выбор (RadioGroup)',
      description:
        'DropdownMenuRadioGroup + RadioItem — взаимоисключающий выбор одного значения (value / onValueChange).',
      render: () => {
        function RadioMenu() {
          const [position, setPosition] = useState('bottom');
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">Позиция панели</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56">
                <DropdownMenuLabel>Позиция</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup value={position} onValueChange={setPosition}>
                  <DropdownMenuRadioItem value="top">Сверху</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="bottom">Снизу</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="right">Справа</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        }
        return <RadioMenu />;
      },
      code: `const [position, setPosition] = useState('bottom');

<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Позиция панели</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuLabel>Позиция</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuRadioGroup value={position} onValueChange={setPosition}>
      <DropdownMenuRadioItem value="top">Сверху</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="bottom">Снизу</DropdownMenuRadioItem>
      <DropdownMenuRadioItem value="right">Справа</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
  </DropdownMenuContent>
</DropdownMenu>`,
    },
    {
      id: 'submenu',
      title: 'Вложенное подменю (Sub)',
      description:
        'DropdownMenuSub / SubTrigger / SubContent разворачивают второй уровень пунктов сбоку от родительского.',
      render: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Действия</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuItem>Новый файл</DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Пригласить</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>По e-mail</DropdownMenuItem>
                <DropdownMenuItem>По ссылке</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">Удалить</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      code: `<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="outline">Действия</Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-56">
    <DropdownMenuItem>Новый файл</DropdownMenuItem>
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Пригласить</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem>По e-mail</DropdownMenuItem>
        <DropdownMenuItem>По ссылке</DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    <DropdownMenuSeparator />
    <DropdownMenuItem variant="destructive">Удалить</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>`,
    },
  ],
  examples: [
    {
      id: 'icons',
      title: 'Иконки и destructive-пункт',
      description:
        'lucide-иконки внутри Item выравниваются автоматически (gap-2); variant="destructive" красит пункт удаления/выхода.',
      render: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Аккаунт</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User />
              Профиль
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CreditCard />
              Оплата
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings />
              Настройки
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive">
              <LogOut />
              Выйти
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      code: `import { CreditCard, LogOut, Settings, User } from 'lucide-react';

<DropdownMenuContent className="w-56">
  <DropdownMenuLabel>Мой аккаунт</DropdownMenuLabel>
  <DropdownMenuSeparator />
  <DropdownMenuItem><User />Профиль</DropdownMenuItem>
  <DropdownMenuItem><CreditCard />Оплата</DropdownMenuItem>
  <DropdownMenuItem><Settings />Настройки</DropdownMenuItem>
  <DropdownMenuSeparator />
  <DropdownMenuItem variant="destructive"><LogOut />Выйти</DropdownMenuItem>
</DropdownMenuContent>`,
    },
    {
      id: 'groups',
      title: 'Группировка пунктов (Group)',
      description: 'DropdownMenuGroup + Separator визуально разбивают меню на смысловые блоки.',
      render: () => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Команда</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Участники</DropdownMenuLabel>
              <DropdownMenuItem>
                <User />
                Мой профиль
              </DropdownMenuItem>
              <DropdownMenuItem>
                <UserPlus />
                Пригласить
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Проект</DropdownMenuLabel>
              <DropdownMenuItem>
                <Settings />
                Параметры
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
      code: `<DropdownMenuContent className="w-56">
  <DropdownMenuGroup>
    <DropdownMenuLabel>Участники</DropdownMenuLabel>
    <DropdownMenuItem><User />Мой профиль</DropdownMenuItem>
    <DropdownMenuItem><UserPlus />Пригласить</DropdownMenuItem>
  </DropdownMenuGroup>
  <DropdownMenuSeparator />
  <DropdownMenuGroup>
    <DropdownMenuLabel>Проект</DropdownMenuLabel>
    <DropdownMenuItem><Settings />Параметры</DropdownMenuItem>
  </DropdownMenuGroup>
</DropdownMenuContent>`,
    },
  ],
  props: [
    {
      name: 'DropdownMenu',
      type: 'Radix DropdownMenu.Root',
      description:
        'Корень: управляет открытием. Props: open / defaultOpen / onOpenChange / modal / dir.',
    },
    {
      name: 'DropdownMenuTrigger',
      type: 'Radix DropdownMenu.Trigger',
      description:
        'Триггер открытия (aria-haspopup="menu"). asChild — слить props на дочерний элемент (напр. Button).',
    },
    {
      name: 'DropdownMenuContent',
      type: 'Radix DropdownMenu.Content',
      default: 'sideOffset={4}',
      description:
        'Список меню в Portal. Позиционирование: align (start / center / end), side, sideOffset, alignOffset.',
    },
    {
      name: 'DropdownMenuItem',
      type: 'Radix DropdownMenu.Item',
      default: 'variant="default"',
      description:
        'Пункт-действие (onSelect). variant: default / destructive; inset — доп. левый отступ под иконки соседей.',
    },
    {
      name: 'DropdownMenuCheckboxItem',
      type: 'Radix DropdownMenu.CheckboxItem',
      description: 'Пункт-флажок: checked / onCheckedChange, индикатор-галочка слева.',
    },
    {
      name: 'DropdownMenuRadioGroup / RadioItem',
      type: 'Radix DropdownMenu.RadioGroup',
      description:
        'Взаимоисключающий выбор: value / onValueChange у группы, value у каждого RadioItem.',
    },
    {
      name: 'DropdownMenuLabel',
      type: 'Radix DropdownMenu.Label',
      description: 'Заголовок секции (font-medium). inset — левый отступ под иконки.',
    },
    {
      name: 'DropdownMenuSeparator',
      type: 'Radix DropdownMenu.Separator',
      description: 'Горизонтальный разделитель между группами пунктов.',
    },
    {
      name: 'DropdownMenuShortcut',
      type: 'span',
      description: 'Подпись горячей клавиши, прижатая к правому краю пункта (ml-auto).',
    },
    {
      name: 'DropdownMenuGroup',
      type: 'Radix DropdownMenu.Group',
      description: 'Семантическая группировка пунктов (для доступности и разметки).',
    },
    {
      name: 'DropdownMenuSub / SubTrigger / SubContent',
      type: 'Radix DropdownMenu.Sub',
      description: 'Вложенное подменю: SubTrigger разворачивает SubContent сбоку.',
    },
    {
      name: 'DropdownMenuPortal',
      type: 'Radix DropdownMenu.Portal',
      description: 'Портал для контента (уже встроен в Content; экспортирован для ручных случаев).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
