import { useState } from 'react';
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuLabel,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from '@reformer/ui-kit';
import { Copy, Scissors, ClipboardPaste, Star, Trash2 } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * ContextMenu — не form-control: overlay поверх Radix ContextMenu. В отличие от DropdownMenu
 * открывается правым кликом (contextmenu) по области-триггеру, а не кнопкой. Меню (ContextMenuContent)
 * уходит в Portal и позиционируется у курсора. Пункты бывают обычные (Item), с флажком (CheckboxItem),
 * радио-группой (RadioItem) и вложенным подменю (Sub*). Таб Variants показывает готовые конфигурации,
 * Examples — приёмы (иконки + destructive, группы).
 */

// Общий стиль области-триггера для превью (по клику правой кнопкой открывается меню).
const triggerBox =
  'flex h-32 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground select-none';

export const contextMenuDocConfig: ComponentDocConfig = {
  name: 'ContextMenu',
  importFrom: '@reformer/ui-kit',
  description:
    'Контекстное меню на shadcn / Radix ContextMenu. Открывается правым кликом по области-триггеру; список уходит в Portal и позиционируется у курсора. Пункты — обычные, с флажком (CheckboxItem), радио-выбором (RadioItem) или вложенным подменю (Sub). Все части несут свой data-slot.',
  variants: [
    {
      id: 'basic',
      title: 'Базовое меню',
      description:
        'Правый клик по области открывает меню с пунктами, разделителем и горячей клавишей (Shortcut).',
      render: () => (
        <ContextMenu>
          <ContextMenuTrigger className={triggerBox}>Кликни правой кнопкой</ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuItem>
              Назад
              <ContextMenuShortcut>⌘[</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              Вперёд
              <ContextMenuShortcut>⌘]</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              Обновить
              <ContextMenuShortcut>⌘R</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive">Удалить</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ),
      code: `<ContextMenu>
  <ContextMenuTrigger className="flex h-32 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm">
    Кликни правой кнопкой
  </ContextMenuTrigger>
  <ContextMenuContent className="w-52">
    <ContextMenuItem>
      Назад
      <ContextMenuShortcut>⌘[</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem>
      Вперёд
      <ContextMenuShortcut>⌘]</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem>
      Обновить
      <ContextMenuShortcut>⌘R</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem variant="destructive">Удалить</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>`,
    },
    {
      id: 'checkbox-items',
      title: 'Пункты с флажком (CheckboxItem)',
      description:
        'CheckboxItem с checked / onCheckedChange — переключение видимости панелей и т.п.',
      render: () => {
        function CheckboxMenu() {
          const [bookmarks, setBookmarks] = useState(true);
          const [urls, setUrls] = useState(false);
          return (
            <ContextMenu>
              <ContextMenuTrigger className={triggerBox}>Кликни правой кнопкой</ContextMenuTrigger>
              <ContextMenuContent className="w-52">
                <ContextMenuLabel>Панель</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuCheckboxItem checked={bookmarks} onCheckedChange={setBookmarks}>
                  Показывать закладки
                </ContextMenuCheckboxItem>
                <ContextMenuCheckboxItem checked={urls} onCheckedChange={setUrls}>
                  Показывать полные URL
                </ContextMenuCheckboxItem>
              </ContextMenuContent>
            </ContextMenu>
          );
        }
        return <CheckboxMenu />;
      },
      code: `const [bookmarks, setBookmarks] = useState(true);
const [urls, setUrls] = useState(false);

<ContextMenu>
  <ContextMenuTrigger className="...">Кликни правой кнопкой</ContextMenuTrigger>
  <ContextMenuContent className="w-52">
    <ContextMenuLabel>Панель</ContextMenuLabel>
    <ContextMenuSeparator />
    <ContextMenuCheckboxItem checked={bookmarks} onCheckedChange={setBookmarks}>
      Показывать закладки
    </ContextMenuCheckboxItem>
    <ContextMenuCheckboxItem checked={urls} onCheckedChange={setUrls}>
      Показывать полные URL
    </ContextMenuCheckboxItem>
  </ContextMenuContent>
</ContextMenu>`,
    },
    {
      id: 'radio-group',
      title: 'Радио-выбор (RadioGroup)',
      description:
        'ContextMenuRadioGroup + RadioItem — взаимоисключающий выбор одного значения (value / onValueChange).',
      render: () => {
        function RadioMenu() {
          const [person, setPerson] = useState('pedro');
          return (
            <ContextMenu>
              <ContextMenuTrigger className={triggerBox}>Кликни правой кнопкой</ContextMenuTrigger>
              <ContextMenuContent className="w-52">
                <ContextMenuLabel>Ответственный</ContextMenuLabel>
                <ContextMenuSeparator />
                <ContextMenuRadioGroup value={person} onValueChange={setPerson}>
                  <ContextMenuRadioItem value="pedro">Педро Дуарте</ContextMenuRadioItem>
                  <ContextMenuRadioItem value="colm">Колм Туи</ContextMenuRadioItem>
                </ContextMenuRadioGroup>
              </ContextMenuContent>
            </ContextMenu>
          );
        }
        return <RadioMenu />;
      },
      code: `const [person, setPerson] = useState('pedro');

<ContextMenu>
  <ContextMenuTrigger className="...">Кликни правой кнопкой</ContextMenuTrigger>
  <ContextMenuContent className="w-52">
    <ContextMenuLabel>Ответственный</ContextMenuLabel>
    <ContextMenuSeparator />
    <ContextMenuRadioGroup value={person} onValueChange={setPerson}>
      <ContextMenuRadioItem value="pedro">Педро Дуарте</ContextMenuRadioItem>
      <ContextMenuRadioItem value="colm">Колм Туи</ContextMenuRadioItem>
    </ContextMenuRadioGroup>
  </ContextMenuContent>
</ContextMenu>`,
    },
    {
      id: 'submenu',
      title: 'Вложенное подменю (Sub)',
      description:
        'ContextMenuSub / SubTrigger / SubContent разворачивают второй уровень пунктов сбоку от родительского.',
      render: () => (
        <ContextMenu>
          <ContextMenuTrigger className={triggerBox}>Кликни правой кнопкой</ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuItem>Открыть</ContextMenuItem>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Поделиться</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem>По e-mail</ContextMenuItem>
                <ContextMenuItem>По ссылке</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive">Удалить</ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ),
      code: `<ContextMenu>
  <ContextMenuTrigger className="...">Кликни правой кнопкой</ContextMenuTrigger>
  <ContextMenuContent className="w-52">
    <ContextMenuItem>Открыть</ContextMenuItem>
    <ContextMenuSub>
      <ContextMenuSubTrigger>Поделиться</ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuItem>По e-mail</ContextMenuItem>
        <ContextMenuItem>По ссылке</ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
    <ContextMenuSeparator />
    <ContextMenuItem variant="destructive">Удалить</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>`,
    },
  ],
  examples: [
    {
      id: 'icons',
      title: 'Иконки и destructive-пункт',
      description:
        'lucide-иконки внутри Item выравниваются автоматически (gap-2); variant="destructive" красит пункт удаления.',
      render: () => (
        <ContextMenu>
          <ContextMenuTrigger className={triggerBox}>Кликни правой кнопкой</ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuItem>
              <Copy />
              Копировать
              <ContextMenuShortcut>⌘C</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              <Scissors />
              Вырезать
              <ContextMenuShortcut>⌘X</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuItem>
              <ClipboardPaste />
              Вставить
              <ContextMenuShortcut>⌘V</ContextMenuShortcut>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive">
              <Trash2 />
              Удалить
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      ),
      code: `import { Copy, Scissors, ClipboardPaste, Trash2 } from 'lucide-react';

<ContextMenuContent className="w-52">
  <ContextMenuItem><Copy />Копировать<ContextMenuShortcut>⌘C</ContextMenuShortcut></ContextMenuItem>
  <ContextMenuItem><Scissors />Вырезать<ContextMenuShortcut>⌘X</ContextMenuShortcut></ContextMenuItem>
  <ContextMenuItem><ClipboardPaste />Вставить<ContextMenuShortcut>⌘V</ContextMenuShortcut></ContextMenuItem>
  <ContextMenuSeparator />
  <ContextMenuItem variant="destructive"><Trash2 />Удалить</ContextMenuItem>
</ContextMenuContent>`,
    },
    {
      id: 'groups',
      title: 'Группировка пунктов (Group)',
      description: 'ContextMenuGroup + Separator визуально разбивают меню на смысловые блоки.',
      render: () => (
        <ContextMenu>
          <ContextMenuTrigger className={triggerBox}>Кликни правой кнопкой</ContextMenuTrigger>
          <ContextMenuContent className="w-52">
            <ContextMenuGroup>
              <ContextMenuLabel>Файл</ContextMenuLabel>
              <ContextMenuItem>
                <Copy />
                Дублировать
              </ContextMenuItem>
              <ContextMenuItem>
                <Star />В избранное
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuGroup>
              <ContextMenuLabel>Опасная зона</ContextMenuLabel>
              <ContextMenuItem variant="destructive">
                <Trash2 />
                Удалить
              </ContextMenuItem>
            </ContextMenuGroup>
          </ContextMenuContent>
        </ContextMenu>
      ),
      code: `<ContextMenuContent className="w-52">
  <ContextMenuGroup>
    <ContextMenuLabel>Файл</ContextMenuLabel>
    <ContextMenuItem><Copy />Дублировать</ContextMenuItem>
    <ContextMenuItem><Star />В избранное</ContextMenuItem>
  </ContextMenuGroup>
  <ContextMenuSeparator />
  <ContextMenuGroup>
    <ContextMenuLabel>Опасная зона</ContextMenuLabel>
    <ContextMenuItem variant="destructive"><Trash2 />Удалить</ContextMenuItem>
  </ContextMenuGroup>
</ContextMenuContent>`,
    },
  ],
  props: [
    {
      name: 'ContextMenu',
      type: 'Radix ContextMenu.Root',
      description: 'Корень: управляет открытием. Props: onOpenChange / modal / dir.',
    },
    {
      name: 'ContextMenuTrigger',
      type: 'Radix ContextMenu.Trigger',
      description:
        'Область-триггер (рендерится как <span>). Меню открывается правым кликом (contextmenu). asChild — слить props на дочерний элемент.',
    },
    {
      name: 'ContextMenuContent',
      type: 'Radix ContextMenu.Content',
      description:
        'Список меню в Portal, позиционируется у курсора. Позиционирование: align / alignOffset / collisionPadding.',
    },
    {
      name: 'ContextMenuItem',
      type: 'Radix ContextMenu.Item',
      default: 'variant="default"',
      description:
        'Пункт-действие (onSelect). variant: default / destructive; inset — доп. левый отступ под иконки соседей.',
    },
    {
      name: 'ContextMenuCheckboxItem',
      type: 'Radix ContextMenu.CheckboxItem',
      description: 'Пункт-флажок: checked / onCheckedChange, индикатор-галочка слева.',
    },
    {
      name: 'ContextMenuRadioGroup / RadioItem',
      type: 'Radix ContextMenu.RadioGroup',
      description:
        'Взаимоисключающий выбор: value / onValueChange у группы, value у каждого RadioItem.',
    },
    {
      name: 'ContextMenuLabel',
      type: 'Radix ContextMenu.Label',
      description: 'Заголовок секции (font-medium). inset — левый отступ под иконки.',
    },
    {
      name: 'ContextMenuSeparator',
      type: 'Radix ContextMenu.Separator',
      description: 'Горизонтальный разделитель между группами пунктов.',
    },
    {
      name: 'ContextMenuShortcut',
      type: 'span',
      description: 'Подпись горячей клавиши, прижатая к правому краю пункта (ml-auto).',
    },
    {
      name: 'ContextMenuGroup',
      type: 'Radix ContextMenu.Group',
      description: 'Семантическая группировка пунктов (для доступности и разметки).',
    },
    {
      name: 'ContextMenuSub / SubTrigger / SubContent',
      type: 'Radix ContextMenu.Sub',
      description: 'Вложенное подменю: SubTrigger разворачивает SubContent сбоку.',
    },
    {
      name: 'ContextMenuPortal',
      type: 'Radix ContextMenu.Portal',
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
