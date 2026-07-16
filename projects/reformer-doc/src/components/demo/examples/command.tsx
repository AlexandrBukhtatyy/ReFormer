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
 * Command — не form-control: обёртка над cmdk (командная палитра с фильтрацией по вводу).
 * Command (корень) + CommandInput (поле поиска), CommandList (прокручиваемый список),
 * CommandGroup / CommandItem / CommandSeparator / CommandShortcut / CommandEmpty. Фильтрация
 * (по value/keywords), клавиатурная навигация и подсветка — из cmdk. CommandDialog оборачивает
 * палитру в модальный Dialog (паттерн ⌘K). Таб Variants — готовые композиции, Examples — приёмы.
 */
export const commandDocConfig: ComponentDocConfig = {
  name: 'Command',
  importFrom: '@reformer/ui-kit',
  description:
    'Командная палитра на shadcn / cmdk. Поле ввода фильтрует список пунктов на лету; группы, разделители и горячие клавиши — для структуры. CommandDialog оборачивает палитру в модалку (паттерн ⌘K). Все части несут свой data-slot; клавиатура и фильтрация — из cmdk.',
  variants: [
    {
      id: 'inline',
      title: 'Инлайн-палитра',
      description:
        'Command с полем поиска и списком: ввод фильтрует пункты, стрелки навигируют. Группы разделены CommandSeparator, у пунктов — горячие клавиши (CommandShortcut).',
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
        'CommandDialog оборачивает палитру в модалку. Открывается кнопкой или сочетанием ⌘K / Ctrl+K (глобальный keydown-хэндлер); выбор пункта закрывает диалог.',
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
        'CommandEmpty показывается, когда фильтр не нашёл ни одного пункта. Введите текст, не совпадающий ни с одним пунктом, чтобы увидеть заглушку.',
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
        'Корень палитры. Управляет фильтрацией и клавиатурной навигацией. Пропсы cmdk: value / onValueChange, filter, shouldFilter, loop.',
    },
    {
      name: 'CommandDialog',
      type: 'Dialog + Command',
      default: 'showCloseButton=true',
      description:
        'Оборачивает палитру в модальный Dialog (паттерн ⌘K). Пропсы Dialog (open / onOpenChange) + title / description (sr-only, для доступности) + showCloseButton.',
    },
    {
      name: 'CommandInput',
      type: 'cmdk Command.Input',
      description:
        'Поле поиска с иконкой (SearchIcon). Значение фильтрует список; value / onValueChange для управляемого режима.',
    },
    {
      name: 'CommandList',
      type: 'cmdk Command.List',
      description:
        'Прокручиваемый контейнер результатов (max-h-[300px]). Содержит группы, пункты и заглушку.',
    },
    {
      name: 'CommandEmpty',
      type: 'cmdk Command.Empty',
      description: 'Заглушка, отображается когда фильтр не нашёл ни одного пункта.',
    },
    {
      name: 'CommandGroup',
      type: 'cmdk Command.Group',
      description:
        'Секция пунктов с заголовком (heading). Скрывается, если все её пункты отфильтрованы.',
    },
    {
      name: 'CommandItem',
      type: 'cmdk Command.Item',
      description:
        'Пункт палитры. onSelect — обработчик выбора; value / keywords влияют на фильтрацию; disabled отключает.',
    },
    {
      name: 'CommandShortcut',
      type: 'span',
      description: 'Подпись горячей клавиши, прижата вправо (ml-auto). Чисто визуальная.',
    },
    {
      name: 'CommandSeparator',
      type: 'cmdk Command.Separator',
      description: 'Разделитель между группами.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
