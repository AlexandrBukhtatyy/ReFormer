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
 * ContextMenu — не поле формы: меню на Radix ContextMenu. В отличие от DropdownMenu открывается
 * правым щелчком (или долгим касанием) по области и встаёт у курсора. Variants — виды пунктов,
 * Examples — иконки и группы.
 */

// Класс области-триггера: правый щелчок по ней открывает меню. В `code` он выписан полностью.
const triggerBox =
  'flex h-32 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground select-none';

export const contextMenuDocConfig: ComponentDocConfig = {
  name: 'ContextMenu',
  importFrom: '@reformer/ui-kit',
  description:
    'Меню по правому щелчку на области: пункты, флажки, выбор одного, подменю. Встаёт у курсора.',
  variants: [
    {
      id: 'basic',
      title: 'Базовое меню',
      description:
        'Правый щелчок или долгое касание по области открывает меню у курсора. Shortcut — только подпись клавиш.',
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
  <ContextMenuTrigger className="flex h-32 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground select-none">
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
        'CheckboxItem с checked / onCheckedChange — включить или выключить режим. Меню при выборе закрывается.',
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
  <ContextMenuTrigger className="flex h-32 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground select-none">
    Кликни правой кнопкой
  </ContextMenuTrigger>
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
        'RadioGroup с value / onValueChange и RadioItem внутри — выбор одного значения из нескольких.',
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
  <ContextMenuTrigger className="flex h-32 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground select-none">
    Кликни правой кнопкой
  </ContextMenuTrigger>
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
        'Sub / SubTrigger / SubContent — второй уровень пунктов сбоку. Открывается наведением или стрелкой →.',
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
  <ContextMenuTrigger className="flex h-32 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground select-none">
    Кликни правой кнопкой
  </ContextMenuTrigger>
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
        'Иконка внутри пункта получает размер и отступ сама. variant="destructive" красит пункт удаления.',
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

<ContextMenu>
  <ContextMenuTrigger className="flex h-32 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground select-none">
    Кликни правой кнопкой
  </ContextMenuTrigger>
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
</ContextMenu>`,
    },
    {
      id: 'groups',
      title: 'Группировка пунктов (Group)',
      description:
        'Group объединяет связанные пункты, Label подписывает группу, Separator отделяет её от соседних.',
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
      code: `import { Copy, Star, Trash2 } from 'lucide-react';

<ContextMenu>
  <ContextMenuTrigger className="flex h-32 w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground select-none">
    Кликни правой кнопкой
  </ContextMenuTrigger>
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
</ContextMenu>`,
    },
  ],
  props: [
    {
      name: 'ContextMenu',
      type: 'Radix ContextMenu.Root',
      description:
        'Корень: onOpenChange, modal (true) — блокировать страницу, пока меню открыто; dir. Свойства open нет.',
    },
    {
      name: 'ContextMenuTrigger',
      type: 'Radix ContextMenu.Trigger',
      description:
        'Область, правый щелчок по которой открывает меню. По умолчанию <span>; asChild — стать своим элементом. disabled — отключить меню.',
    },
    {
      name: 'ContextMenuContent',
      type: 'Radix ContextMenu.Content',
      description: 'Список пунктов в портале, встаёт у курсора. alignOffset, collisionPadding.',
    },
    {
      name: 'ContextMenuItem',
      type: 'Radix ContextMenu.Item',
      default: 'variant="default"',
      description:
        'Пункт-действие: onSelect, disabled. variant — default / destructive; inset — отступ слева, чтобы выровнять с пунктами-иконками.',
    },
    {
      name: 'ContextMenuCheckboxItem',
      type: 'Radix ContextMenu.CheckboxItem',
      description: 'Пункт-флажок: checked / onCheckedChange, галочка слева.',
    },
    {
      name: 'ContextMenuRadioGroup / RadioItem',
      type: 'Radix ContextMenu.RadioGroup',
      description: 'Выбор одного: value / onValueChange у группы, value у каждого RadioItem.',
    },
    {
      name: 'ContextMenuLabel',
      type: 'Radix ContextMenu.Label',
      description: 'Подпись группы пунктов, не выбирается. inset — отступ слева.',
    },
    {
      name: 'ContextMenuSeparator',
      type: 'Radix ContextMenu.Separator',
      description: 'Линия между группами пунктов.',
    },
    {
      name: 'ContextMenuShortcut',
      type: 'span',
      description:
        'Подпись сочетания клавиш у правого края пункта. Только текст: обработчик клавиш вешаете сами.',
    },
    {
      name: 'ContextMenuGroup',
      type: 'Radix ContextMenu.Group',
      description: 'Группа связанных пунктов (role="group").',
    },
    {
      name: 'ContextMenuSub / SubTrigger / SubContent',
      type: 'Radix ContextMenu.Sub',
      description: 'Подменю: SubTrigger — пункт со стрелкой, SubContent — второй уровень сбоку.',
    },
    {
      name: 'ContextMenuPortal',
      type: 'Radix ContextMenu.Portal',
      description:
        'Портал. ContextMenuContent рисует его сам; отдельно нужен только для своей композиции.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
