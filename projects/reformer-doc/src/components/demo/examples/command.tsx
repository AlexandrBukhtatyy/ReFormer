import { useEffect, useState } from 'react';
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@reformer/ui-kit/command';
import { Button } from '@reformer/ui-kit';
import { Calculator, Calendar, CreditCard, Settings, Smile, User } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Command — не поле формы: палитра команд на cmdk — поле поиска фильтрует список, стрелки ходят по
 * пунктам. CommandDialog кладёт палитру в Dialog (приём ⌘K). cmdk — необязательная
 * peer-зависимость, поэтому импорт только из `@reformer/ui-kit/command`. Variants — палитра на
 * странице, Examples — палитра в окне, пустой результат.
 */
export const commandDocConfig: ComponentDocConfig = {
  name: 'Command',
  importFrom: '@reformer/ui-kit/command',
  description:
    'Список команд с поиском: ввод сужает список, стрелки выбирают. Импорт — @reformer/ui-kit/command, нужен пакет cmdk.',
  variants: [
    {
      id: 'inline',
      title: 'Палитра на странице',
      description:
        'Поле поиска и список: ввод сужает список, стрелки выбирают пункт. Группы разделяет CommandSeparator; CommandShortcut — только подпись клавиш.',
      render: () => (
        <Command className="rounded-lg border shadow-md md:min-w-[450px]">
          <CommandInput placeholder="Введите команду или поиск…" />
          <CommandList>
            <CommandEmpty>Ничего не найдено.</CommandEmpty>
            <CommandGroup heading="Подсказки">
              <CommandItem>
                <Calendar />
                <span>Календарь</span>
              </CommandItem>
              <CommandItem>
                <Smile />
                <span>Смайлы</span>
              </CommandItem>
              <CommandItem>
                <Calculator />
                <span>Калькулятор</span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Настройки">
              <CommandItem>
                <User />
                <span>Профиль</span>
                <CommandShortcut>⇧⌘P</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <CreditCard />
                <span>Оплата</span>
                <CommandShortcut>⌘B</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <Settings />
                <span>Настройки</span>
                <CommandShortcut>⌘S</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      ),
      code: `<Command className="rounded-lg border shadow-md md:min-w-[450px]">
  <CommandInput placeholder="Введите команду или поиск…" />
  <CommandList>
    <CommandEmpty>Ничего не найдено.</CommandEmpty>
    <CommandGroup heading="Подсказки">
      <CommandItem>
        <Calendar />
        <span>Календарь</span>
      </CommandItem>
      <CommandItem>
        <Smile />
        <span>Смайлы</span>
      </CommandItem>
      <CommandItem>
        <Calculator />
        <span>Калькулятор</span>
      </CommandItem>
    </CommandGroup>
    <CommandSeparator />
    <CommandGroup heading="Настройки">
      <CommandItem>
        <User />
        <span>Профиль</span>
        <CommandShortcut>⇧⌘P</CommandShortcut>
      </CommandItem>
      <CommandItem>
        <CreditCard />
        <span>Оплата</span>
        <CommandShortcut>⌘B</CommandShortcut>
      </CommandItem>
      <CommandItem>
        <Settings />
        <span>Настройки</span>
        <CommandShortcut>⌘S</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</Command>`,
    },
  ],
  examples: [
    {
      id: 'dialog',
      title: 'Палитра команд (⌘K)',
      description:
        'CommandDialog кладёт палитру в модальное окно. Сочетание ⌘K / Ctrl+K слушает ваш обработчик keydown на document; выбор пункта закрывает окно через onSelect.',
      render: () => {
        const CommandMenuDemo = () => {
          const [open, setOpen] = useState(false);
          useEffect(() => {
            const down = (e: KeyboardEvent) => {
              if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((o) => !o);
              }
            };
            document.addEventListener('keydown', down);
            return () => document.removeEventListener('keydown', down);
          }, []);
          return (
            <>
              <Button variant="outline" onClick={() => setOpen(true)}>
                Открыть палитру <CommandShortcut className="ml-2">⌘K</CommandShortcut>
              </Button>
              <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Введите команду или поиск…" />
                <CommandList>
                  <CommandEmpty>Ничего не найдено.</CommandEmpty>
                  <CommandGroup heading="Подсказки">
                    <CommandItem onSelect={() => setOpen(false)}>
                      <Calendar />
                      <span>Календарь</span>
                    </CommandItem>
                    <CommandItem onSelect={() => setOpen(false)}>
                      <Smile />
                      <span>Смайлы</span>
                    </CommandItem>
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading="Настройки">
                    <CommandItem onSelect={() => setOpen(false)}>
                      <User />
                      <span>Профиль</span>
                      <CommandShortcut>⇧⌘P</CommandShortcut>
                    </CommandItem>
                    <CommandItem onSelect={() => setOpen(false)}>
                      <Settings />
                      <span>Настройки</span>
                      <CommandShortcut>⌘S</CommandShortcut>
                    </CommandItem>
                  </CommandGroup>
                </CommandList>
              </CommandDialog>
            </>
          );
        };
        return <CommandMenuDemo />;
      },
      code: `function CommandMenuDemo() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Открыть палитру <CommandShortcut className="ml-2">⌘K</CommandShortcut>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Введите команду или поиск…" />
        <CommandList>
          <CommandEmpty>Ничего не найдено.</CommandEmpty>
          <CommandGroup heading="Подсказки">
            <CommandItem onSelect={() => setOpen(false)}>
              <Calendar />
              <span>Календарь</span>
            </CommandItem>
            <CommandItem onSelect={() => setOpen(false)}>
              <Smile />
              <span>Смайлы</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Настройки">
            <CommandItem onSelect={() => setOpen(false)}>
              <User />
              <span>Профиль</span>
              <CommandShortcut>⇧⌘P</CommandShortcut>
            </CommandItem>
            <CommandItem onSelect={() => setOpen(false)}>
              <Settings />
              <span>Настройки</span>
              <CommandShortcut>⌘S</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}`,
    },
    {
      id: 'empty',
      title: 'Пустой результат',
      description:
        'CommandEmpty виден, когда поиск ничего не нашёл. Наберите «zzz», чтобы его увидеть.',
      render: () => (
        <Command className="rounded-lg border shadow-md md:min-w-[450px]">
          <CommandInput placeholder="Попробуйте набрать «zzz»…" />
          <CommandList>
            <CommandEmpty>Ничего не найдено.</CommandEmpty>
            <CommandGroup heading="Файлы">
              <CommandItem>README.md</CommandItem>
              <CommandItem>package.json</CommandItem>
              <CommandItem>tsconfig.json</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      ),
      code: `<Command className="rounded-lg border shadow-md md:min-w-[450px]">
  <CommandInput placeholder="Попробуйте набрать «zzz»…" />
  <CommandList>
    <CommandEmpty>Ничего не найдено.</CommandEmpty>
    <CommandGroup heading="Файлы">
      <CommandItem>README.md</CommandItem>
      <CommandItem>package.json</CommandItem>
      <CommandItem>tsconfig.json</CommandItem>
    </CommandGroup>
  </CommandList>
</Command>`,
    },
  ],
  props: [
    {
      name: 'Command',
      type: 'cmdk Command',
      description:
        'Корень: поиск и выбор стрелками. value + onValueChange — выделенный пункт; filter — своя функция поиска; shouldFilter (true); loop — по кругу; label — имя для скринридера.',
    },
    {
      name: 'CommandDialog',
      type: 'Dialog + Command',
      default: 'showCloseButton=true',
      description:
        'Палитра в модальном окне. Пропсы Dialog (open + onOpenChange), title и description — скрытые заголовок и описание окна, showCloseButton.',
    },
    {
      name: 'CommandInput',
      type: 'cmdk Command.Input',
      description:
        'Поле поиска с иконкой лупы. placeholder; value + onValueChange — чтобы управлять текстом поиска.',
    },
    {
      name: 'CommandList',
      type: 'cmdk Command.List',
      description: 'Список результатов, прокрутка после 300px высоты.',
    },
    {
      name: 'CommandEmpty',
      type: 'cmdk Command.Empty',
      description: 'Текст, который виден, когда поиск ничего не нашёл.',
    },
    {
      name: 'CommandGroup',
      type: 'cmdk Command.Group',
      description:
        'Группа пунктов с заголовком heading. Прячется, если поиск отсеял все её пункты.',
    },
    {
      name: 'CommandItem',
      type: 'cmdk Command.Item',
      description:
        'Пункт: onSelect — действие (Enter или щелчок); value и keywords — по чему искать; disabled.',
    },
    {
      name: 'CommandShortcut',
      type: 'span',
      description: 'Подпись сочетания клавиш у правого края пункта. Только текст.',
    },
    {
      name: 'CommandSeparator',
      type: 'cmdk Command.Separator',
      description: 'Линия между группами.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
