import { useState } from 'react';
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarGroup,
  MenubarLabel,
  MenubarItem,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Menubar — не поле формы: строка меню поверх Radix Menubar, как в настольном приложении.
 * Variants — виды пунктов (обычные, флажки, радио, подменю), Examples — типовые сценарии,
 * API — таблица props. Компоненты со своим состоянием объявлены на уровне модуля.
 */

function CheckboxMenubar() {
  const [statusBar, setStatusBar] = useState(true);
  const [activityBar, setActivityBar] = useState(false);
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>Вид</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel>Показывать</MenubarLabel>
          <MenubarSeparator />
          <MenubarCheckboxItem checked={statusBar} onCheckedChange={setStatusBar}>
            Строка состояния
          </MenubarCheckboxItem>
          <MenubarCheckboxItem checked={activityBar} onCheckedChange={setActivityBar}>
            Панель активности
          </MenubarCheckboxItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

function RadioMenubar() {
  const [profile, setProfile] = useState('andrey');
  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>Профиль</MenubarTrigger>
        <MenubarContent>
          <MenubarLabel>Активный профиль</MenubarLabel>
          <MenubarSeparator />
          <MenubarRadioGroup value={profile} onValueChange={setProfile}>
            <MenubarRadioItem value="andrey">Андрей</MenubarRadioItem>
            <MenubarRadioItem value="maria">Мария</MenubarRadioItem>
            <MenubarRadioItem value="oleg">Олег</MenubarRadioItem>
          </MenubarRadioGroup>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}

export const menubarDocConfig: ComponentDocConfig = {
  name: 'Menubar',
  importFrom: '@reformer/ui-kit',
  description:
    'Строка меню, как в настольном приложении: «Файл», «Правка», «Вид». Каждый пункт строки открывает своё меню.',
  variants: [
    {
      id: 'basic',
      title: 'Строка из нескольких меню',
      description:
        'Несколько MenubarMenu в строке. В меню — пункты, разделитель и подписи горячих клавиш.',
      render: () => (
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>Файл</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                Новый файл
                <MenubarShortcut>⌘N</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Открыть
                <MenubarShortcut>⌘O</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>
                Сохранить
                <MenubarShortcut>⌘S</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Правка</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                Отменить
                <MenubarShortcut>⌘Z</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Повторить
                <MenubarShortcut>⇧⌘Z</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      ),
      code: `<Menubar>
  <MenubarMenu>
    <MenubarTrigger>Файл</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        Новый файл
        <MenubarShortcut>⌘N</MenubarShortcut>
      </MenubarItem>
      <MenubarItem>
        Открыть
        <MenubarShortcut>⌘O</MenubarShortcut>
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem>
        Сохранить
        <MenubarShortcut>⌘S</MenubarShortcut>
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>
  <MenubarMenu>
    <MenubarTrigger>Правка</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        Отменить
        <MenubarShortcut>⌘Z</MenubarShortcut>
      </MenubarItem>
      <MenubarItem>
        Повторить
        <MenubarShortcut>⇧⌘Z</MenubarShortcut>
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>`,
    },
    {
      id: 'checkbox-items',
      title: 'Пункты-флажки (CheckboxItem)',
      description:
        'MenubarCheckboxItem с checked и onCheckedChange — включить или выключить панель. Меню при выборе закрывается.',
      render: CheckboxMenubar,
      code: `const [statusBar, setStatusBar] = useState(true);
const [activityBar, setActivityBar] = useState(false);

<Menubar>
  <MenubarMenu>
    <MenubarTrigger>Вид</MenubarTrigger>
    <MenubarContent>
      <MenubarLabel>Показывать</MenubarLabel>
      <MenubarSeparator />
      <MenubarCheckboxItem checked={statusBar} onCheckedChange={setStatusBar}>
        Строка состояния
      </MenubarCheckboxItem>
      <MenubarCheckboxItem checked={activityBar} onCheckedChange={setActivityBar}>
        Панель активности
      </MenubarCheckboxItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>`,
    },
    {
      id: 'radio-group',
      title: 'Выбор одного варианта (RadioGroup)',
      description:
        'MenubarRadioGroup с value и onValueChange, внутри — MenubarRadioItem. Отмечен всегда один пункт.',
      render: RadioMenubar,
      code: `const [profile, setProfile] = useState('andrey');

<Menubar>
  <MenubarMenu>
    <MenubarTrigger>Профиль</MenubarTrigger>
    <MenubarContent>
      <MenubarLabel>Активный профиль</MenubarLabel>
      <MenubarSeparator />
      <MenubarRadioGroup value={profile} onValueChange={setProfile}>
        <MenubarRadioItem value="andrey">Андрей</MenubarRadioItem>
        <MenubarRadioItem value="maria">Мария</MenubarRadioItem>
        <MenubarRadioItem value="oleg">Олег</MenubarRadioItem>
      </MenubarRadioGroup>
    </MenubarContent>
  </MenubarMenu>
</Menubar>`,
    },
    {
      id: 'submenu',
      title: 'Подменю (Sub)',
      description:
        'MenubarSub: MenubarSubTrigger открывает MenubarSubContent сбоку от меню. variant="destructive" — опасное действие.',
      render: () => (
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>Файл</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Новый файл</MenubarItem>
              <MenubarSub>
                <MenubarSubTrigger>Поделиться</MenubarSubTrigger>
                <MenubarSubContent>
                  <MenubarItem>По e-mail</MenubarItem>
                  <MenubarItem>По ссылке</MenubarItem>
                </MenubarSubContent>
              </MenubarSub>
              <MenubarSeparator />
              <MenubarItem variant="destructive">Удалить</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      ),
      code: `<Menubar>
  <MenubarMenu>
    <MenubarTrigger>Файл</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>Новый файл</MenubarItem>
      <MenubarSub>
        <MenubarSubTrigger>Поделиться</MenubarSubTrigger>
        <MenubarSubContent>
          <MenubarItem>По e-mail</MenubarItem>
          <MenubarItem>По ссылке</MenubarItem>
        </MenubarSubContent>
      </MenubarSub>
      <MenubarSeparator />
      <MenubarItem variant="destructive">Удалить</MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>`,
    },
  ],
  examples: [
    {
      id: 'app-menubar',
      title: 'Строка меню редактора',
      description:
        'Типовой сценарий: «Файл», «Правка», «Вид» — пункты с подписями клавиш, разделители, опасное действие и недоступный пункт.',
      render: () => (
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>Файл</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                Новая вкладка
                <MenubarShortcut>⌘T</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Новое окно
                <MenubarShortcut>⌘N</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem disabled>
                Печать…
                <MenubarShortcut>⌘P</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Правка</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                Отменить
                <MenubarShortcut>⌘Z</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>Найти</MenubarItem>
              <MenubarItem variant="destructive">Очистить всё</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Вид</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Увеличить</MenubarItem>
              <MenubarItem>Уменьшить</MenubarItem>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      ),
      code: `<Menubar>
  <MenubarMenu>
    <MenubarTrigger>Файл</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        Новая вкладка
        <MenubarShortcut>⌘T</MenubarShortcut>
      </MenubarItem>
      <MenubarItem>
        Новое окно
        <MenubarShortcut>⌘N</MenubarShortcut>
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem disabled>
        Печать…
        <MenubarShortcut>⌘P</MenubarShortcut>
      </MenubarItem>
    </MenubarContent>
  </MenubarMenu>
  <MenubarMenu>
    <MenubarTrigger>Правка</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        Отменить
        <MenubarShortcut>⌘Z</MenubarShortcut>
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem>Найти</MenubarItem>
      <MenubarItem variant="destructive">Очистить всё</MenubarItem>
    </MenubarContent>
  </MenubarMenu>
  <MenubarMenu>
    <MenubarTrigger>Вид</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>Увеличить</MenubarItem>
      <MenubarItem>Уменьшить</MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>`,
    },
    {
      id: 'groups',
      title: 'Группы пунктов (Group)',
      description:
        'MenubarGroup и MenubarSeparator делят меню на смысловые блоки, MenubarLabel подписывает блок.',
      render: () => (
        <Menubar>
          <MenubarMenu>
            <MenubarTrigger>Команда</MenubarTrigger>
            <MenubarContent>
              <MenubarGroup>
                <MenubarLabel>Участники</MenubarLabel>
                <MenubarItem>Мой профиль</MenubarItem>
                <MenubarItem>Пригласить</MenubarItem>
              </MenubarGroup>
              <MenubarSeparator />
              <MenubarGroup>
                <MenubarLabel>Проект</MenubarLabel>
                <MenubarItem>Параметры</MenubarItem>
              </MenubarGroup>
            </MenubarContent>
          </MenubarMenu>
        </Menubar>
      ),
      code: `<Menubar>
  <MenubarMenu>
    <MenubarTrigger>Команда</MenubarTrigger>
    <MenubarContent>
      <MenubarGroup>
        <MenubarLabel>Участники</MenubarLabel>
        <MenubarItem>Мой профиль</MenubarItem>
        <MenubarItem>Пригласить</MenubarItem>
      </MenubarGroup>
      <MenubarSeparator />
      <MenubarGroup>
        <MenubarLabel>Проект</MenubarLabel>
        <MenubarItem>Параметры</MenubarItem>
      </MenubarGroup>
    </MenubarContent>
  </MenubarMenu>
</Menubar>`,
    },
  ],
  props: [
    {
      name: 'value',
      type: 'string',
      description:
        'Какое меню открыто (value его MenubarMenu), когда состоянием управляете вы. Пустая строка — все закрыты.',
    },
    {
      name: 'defaultValue',
      type: 'string',
      description: 'Меню, открытое при первом рендере, если состоянием управляет сам компонент.',
    },
    {
      name: 'onValueChange',
      type: '(value: string) => void',
      description: 'Вызывается при открытии и закрытии меню.',
    },
    {
      name: 'loop',
      type: 'boolean',
      default: 'true',
      description:
        'Переходить стрелками ←/→ с последнего пункта строки на первый и обратно, в том числе при открытом меню.',
    },
    {
      name: 'dir',
      type: "'ltr' | 'rtl'",
      description:
        'Направление текста: при rtl стрелки ←/→ меняются местами. По умолчанию берётся из DirectionProvider.',
    },
    {
      name: 'MenubarMenu.value',
      type: 'string',
      description: 'Идентификатор меню для value корня. Если не задан, создаётся автоматически.',
    },
    {
      name: 'MenubarContent.align',
      type: "'start' | 'center' | 'end'",
      default: "'start'",
      description: 'Выравнивание меню относительно пункта строки.',
    },
    {
      name: 'MenubarContent.sideOffset',
      type: 'number',
      default: '8',
      description: 'Отступ меню от строки, px. Сдвиг вдоль строки — alignOffset (по умолчанию -4).',
    },
    {
      name: 'MenubarItem.onSelect',
      type: '(event: Event) => void',
      description:
        'Действие пункта: щелчок, Enter или пробел. event.preventDefault() оставляет меню открытым.',
    },
    {
      name: 'MenubarItem.variant',
      type: "'default' | 'destructive'",
      default: "'default'",
      description: 'destructive — красный цвет для опасного действия.',
    },
    {
      name: 'MenubarItem.inset',
      type: 'boolean',
      default: 'false',
      description:
        'Отступ слева под ширину значка — чтобы текст стоял в одну линию с флажками и радио. Есть также у MenubarLabel и MenubarSubTrigger.',
    },
    {
      name: 'MenubarItem.disabled',
      type: 'boolean',
      default: 'false',
      description: 'Пункт недоступен: его нельзя выбрать, стрелки его пропускают.',
    },
    {
      name: 'MenubarCheckboxItem.checked',
      type: "boolean | 'indeterminate'",
      description: 'Состояние флажка. Меняется через onCheckedChange.',
    },
    {
      name: 'MenubarRadioGroup.value',
      type: 'string',
      description:
        'Выбранный MenubarRadioItem (по его value). Меняется через onValueChange группы.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
