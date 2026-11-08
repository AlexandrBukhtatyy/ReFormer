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
 * DropdownMenu — не поле формы: меню на Radix DropdownMenu, открывается кнопкой. Пункты — действия
 * (Item), флажки (CheckboxItem), выбор одного (RadioItem) и подменю (Sub*). Variants — виды пунктов,
 * Examples — иконки и группы.
 */
export const dropdownMenuDocConfig: ComponentDocConfig = {
  name: 'DropdownMenu',
  importFrom: '@reformer/ui-kit',
  description:
    'Список действий за кнопкой: пункты, флажки, выбор одного из нескольких, подменю. Навигация стрелками.',
  variants: [
    {
      id: 'basic',
      title: 'Базовое меню',
      description:
        'Кнопка-триггер (asChild) открывает меню: заголовок, пункты, разделитель. Shortcut — только подпись клавиш, обработчик клавиш он не вешает.',
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
        'CheckboxItem с checked / onCheckedChange — включить или выключить колонку, панель, режим. Меню при выборе закрывается.',
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
        'RadioGroup с value / onValueChange и RadioItem внутри — выбор одного значения из нескольких.',
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
        'Sub / SubTrigger / SubContent — второй уровень пунктов сбоку. Открывается наведением или стрелкой →.',
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
        'Иконка внутри пункта получает размер и отступ сама. variant="destructive" красит пункт выхода или удаления.',
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
</DropdownMenu>`,
    },
    {
      id: 'groups',
      title: 'Группировка пунктов (Group)',
      description:
        'Group объединяет связанные пункты, Label подписывает группу, Separator отделяет её от соседних.',
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
      code: `import { Settings, User, UserPlus } from 'lucide-react';

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
</DropdownMenu>`,
    },
  ],
  props: [
    {
      name: 'DropdownMenu',
      type: 'Radix DropdownMenu.Root',
      description:
        'Корень: open + onOpenChange или defaultOpen; modal (true) — блокировать страницу, пока меню открыто; dir.',
    },
    {
      name: 'DropdownMenuTrigger',
      type: 'Radix DropdownMenu.Trigger',
      description:
        'Кнопка, которая открывает меню. asChild — стать своим элементом, например Button.',
    },
    {
      name: 'DropdownMenuContent',
      type: 'Radix DropdownMenu.Content',
      default: 'sideOffset={4}',
      description:
        'Список пунктов в портале. Положение: side, align (start / center / end), sideOffset, alignOffset.',
    },
    {
      name: 'DropdownMenuItem',
      type: 'Radix DropdownMenu.Item',
      default: 'variant="default"',
      description:
        'Пункт-действие: onSelect, disabled. variant — default / destructive; inset — отступ слева, чтобы выровнять с пунктами-иконками.',
    },
    {
      name: 'DropdownMenuCheckboxItem',
      type: 'Radix DropdownMenu.CheckboxItem',
      description: 'Пункт-флажок: checked / onCheckedChange, галочка слева.',
    },
    {
      name: 'DropdownMenuRadioGroup / RadioItem',
      type: 'Radix DropdownMenu.RadioGroup',
      description: 'Выбор одного: value / onValueChange у группы, value у каждого RadioItem.',
    },
    {
      name: 'DropdownMenuLabel',
      type: 'Radix DropdownMenu.Label',
      description: 'Подпись группы пунктов, не выбирается. inset — отступ слева.',
    },
    {
      name: 'DropdownMenuSeparator',
      type: 'Radix DropdownMenu.Separator',
      description: 'Линия между группами пунктов.',
    },
    {
      name: 'DropdownMenuShortcut',
      type: 'span',
      description:
        'Подпись сочетания клавиш у правого края пункта. Только текст: обработчик клавиш вешаете сами.',
    },
    {
      name: 'DropdownMenuGroup',
      type: 'Radix DropdownMenu.Group',
      description: 'Группа связанных пунктов (role="group").',
    },
    {
      name: 'DropdownMenuSub / SubTrigger / SubContent',
      type: 'Radix DropdownMenu.Sub',
      description: 'Подменю: SubTrigger — пункт со стрелкой, SubContent — второй уровень сбоку.',
    },
    {
      name: 'DropdownMenuPortal',
      type: 'Radix DropdownMenu.Portal',
      description:
        'Портал. DropdownMenuContent рисует его сам; отдельно нужен только для своей композиции.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
