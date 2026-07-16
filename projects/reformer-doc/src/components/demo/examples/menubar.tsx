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
 * Menubar — не form-control: горизонтальная панель меню поверх Radix Menubar (как строка меню
 * десктоп-приложения). Собирается из корня Menubar, набора MenubarMenu (по одному на пункт панели),
 * триггера MenubarTrigger и содержимого MenubarContent (в Portal). Пункты бывают обычные (Item),
 * с флажком (CheckboxItem), радио-группой (RadioItem) и вложенным подменю (Sub*).
 * Таб Variants показывает готовые конфигурации, Examples — приёмы (иконки-shortcut, группы).
 */
export const menubarDocConfig: ComponentDocConfig = {
  name: 'Menubar',
  importFrom: '@reformer/ui-kit',
  description:
    'Горизонтальная строка меню на shadcn / Radix Menubar (как в десктоп-приложении). Корень Menubar держит несколько MenubarMenu; каждый — триггер + содержимое в Portal. Пункты: обычные (Item), с флажком (CheckboxItem), радио-выбором (RadioItem) и вложенным подменю (Sub). Все части несут свой data-slot.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая панель меню',
      description:
        'Несколько MenubarMenu в строке. Каждый триггер открывает своё меню с пунктами, разделителем и горячими клавишами (Shortcut).',
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
      <MenubarItem>Новый файл<MenubarShortcut>⌘N</MenubarShortcut></MenubarItem>
      <MenubarItem>Открыть<MenubarShortcut>⌘O</MenubarShortcut></MenubarItem>
      <MenubarSeparator />
      <MenubarItem>Сохранить<MenubarShortcut>⌘S</MenubarShortcut></MenubarItem>
    </MenubarContent>
  </MenubarMenu>
  <MenubarMenu>
    <MenubarTrigger>Правка</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>Отменить<MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
      <MenubarItem>Повторить<MenubarShortcut>⇧⌘Z</MenubarShortcut></MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>`,
    },
    {
      id: 'checkbox-items',
      title: 'Пункты с флажком (CheckboxItem)',
      description:
        'CheckboxItem с checked / onCheckedChange внутри меню панели — переключение видимости панелей.',
      render: () => {
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
        return <CheckboxMenubar />;
      },
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
      title: 'Радио-выбор (RadioGroup)',
      description:
        'MenubarRadioGroup + RadioItem — взаимоисключающий выбор одного значения (value / onValueChange).',
      render: () => {
        function RadioMenubar() {
          const [profile, setProfile] = useState('andy');
          return (
            <Menubar>
              <MenubarMenu>
                <MenubarTrigger>Профиль</MenubarTrigger>
                <MenubarContent>
                  <MenubarLabel>Активный профиль</MenubarLabel>
                  <MenubarSeparator />
                  <MenubarRadioGroup value={profile} onValueChange={setProfile}>
                    <MenubarRadioItem value="andy">Андрей</MenubarRadioItem>
                    <MenubarRadioItem value="benoit">Бенуа</MenubarRadioItem>
                    <MenubarRadioItem value="luis">Луис</MenubarRadioItem>
                  </MenubarRadioGroup>
                </MenubarContent>
              </MenubarMenu>
            </Menubar>
          );
        }
        return <RadioMenubar />;
      },
      code: `const [profile, setProfile] = useState('andy');

<Menubar>
  <MenubarMenu>
    <MenubarTrigger>Профиль</MenubarTrigger>
    <MenubarContent>
      <MenubarLabel>Активный профиль</MenubarLabel>
      <MenubarSeparator />
      <MenubarRadioGroup value={profile} onValueChange={setProfile}>
        <MenubarRadioItem value="andy">Андрей</MenubarRadioItem>
        <MenubarRadioItem value="benoit">Бенуа</MenubarRadioItem>
        <MenubarRadioItem value="luis">Луис</MenubarRadioItem>
      </MenubarRadioGroup>
    </MenubarContent>
  </MenubarMenu>
</Menubar>`,
    },
    {
      id: 'submenu',
      title: 'Вложенное подменю (Sub)',
      description:
        'MenubarSub / SubTrigger / SubContent разворачивают второй уровень пунктов сбоку от родительского.',
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
      title: 'Строка меню приложения',
      description:
        'Типовой сценарий: панель Файл / Правка / Вид как в десктоп-приложении — пункты с горячими клавишами, разделители и destructive-действие.',
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
              <MenubarItem>
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
      <MenubarItem>Новая вкладка<MenubarShortcut>⌘T</MenubarShortcut></MenubarItem>
      <MenubarItem>Новое окно<MenubarShortcut>⌘N</MenubarShortcut></MenubarItem>
      <MenubarSeparator />
      <MenubarItem>Печать…<MenubarShortcut>⌘P</MenubarShortcut></MenubarItem>
    </MenubarContent>
  </MenubarMenu>
  <MenubarMenu>
    <MenubarTrigger>Правка</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>Отменить<MenubarShortcut>⌘Z</MenubarShortcut></MenubarItem>
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
      title: 'Группировка пунктов (Group)',
      description:
        'MenubarGroup + Separator визуально разбивают содержимое меню на смысловые блоки с заголовками (Label).',
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
      name: 'Menubar',
      type: 'Radix Menubar.Root',
      description:
        'Корневая панель (role="menubar"). Держит несколько MenubarMenu. Props: value / defaultValue / onValueChange / dir / loop.',
    },
    {
      name: 'MenubarMenu',
      type: 'Radix Menubar.Menu',
      description:
        'Один пункт панели: обёртка вокруг триггера и его содержимого. value — идентификатор для controlled-режима.',
    },
    {
      name: 'MenubarTrigger',
      type: 'Radix Menubar.Trigger',
      description:
        'Кнопка-заголовок меню в панели (открывает MenubarContent). Активна по фокусу/клику.',
    },
    {
      name: 'MenubarContent',
      type: 'Radix Menubar.Content',
      default: 'align="start", alignOffset={-4}, sideOffset={8}',
      description:
        'Содержимое меню в Portal. Позиционирование: align (start / center / end), side, sideOffset, alignOffset.',
    },
    {
      name: 'MenubarItem',
      type: 'Radix Menubar.Item',
      default: 'variant="default"',
      description:
        'Пункт-действие (onSelect). variant: default / destructive; inset — доп. левый отступ под иконки соседей.',
    },
    {
      name: 'MenubarCheckboxItem',
      type: 'Radix Menubar.CheckboxItem',
      description: 'Пункт-флажок: checked / onCheckedChange, индикатор-галочка слева.',
    },
    {
      name: 'MenubarRadioGroup / RadioItem',
      type: 'Radix Menubar.RadioGroup',
      description:
        'Взаимоисключающий выбор: value / onValueChange у группы, value у каждого RadioItem.',
    },
    {
      name: 'MenubarLabel',
      type: 'Radix Menubar.Label',
      description: 'Заголовок секции (font-medium). inset — левый отступ под иконки.',
    },
    {
      name: 'MenubarSeparator',
      type: 'Radix Menubar.Separator',
      description: 'Горизонтальный разделитель между группами пунктов.',
    },
    {
      name: 'MenubarShortcut',
      type: 'span',
      description: 'Подпись горячей клавиши, прижатая к правому краю пункта (ml-auto).',
    },
    {
      name: 'MenubarGroup',
      type: 'Radix Menubar.Group',
      description: 'Семантическая группировка пунктов (для доступности и разметки).',
    },
    {
      name: 'MenubarSub / SubTrigger / SubContent',
      type: 'Radix Menubar.Sub',
      description: 'Вложенное подменю: SubTrigger разворачивает SubContent сбоку.',
    },
    {
      name: 'MenubarPortal',
      type: 'Radix Menubar.Portal',
      description:
        'Портал для содержимого (уже встроен в Content; экспортирован для ручных случаев).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
