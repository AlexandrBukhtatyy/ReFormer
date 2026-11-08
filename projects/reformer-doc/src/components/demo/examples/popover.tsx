import { useState } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
  Button,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Popover — не поле формы: панель на Radix Popover рядом с триггером (PopoverContent в портале)
 * или у отдельного якоря (PopoverAnchor). Header / Title / Description — оформление содержимого.
 * Variants — базовая панель и выравнивание, Examples — якорь, управляемое состояние. Обёртка
 * `<div style>` в render — рамка демо, в `code` её нет.
 */
export const popoverDocConfig: ComponentDocConfig = {
  name: 'Popover',
  importFrom: '@reformer/ui-kit',
  description: 'Небольшая панель рядом с кнопкой: открывается щелчком, страницу не блокирует.',
  variants: [
    {
      id: 'basic',
      title: 'Базовый popover',
      description: 'Кнопка-триггер (asChild) открывает панель с заголовком и описанием.',
      render: () => (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline">Открыть popover</Button>
          </PopoverTrigger>
          <PopoverContent>
            <PopoverHeader>
              <PopoverTitle>Настройки уведомлений</PopoverTitle>
              <PopoverDescription>Выберите, что приходит на почту.</PopoverDescription>
            </PopoverHeader>
          </PopoverContent>
        </Popover>
      ),
      code: `<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">Открыть popover</Button>
  </PopoverTrigger>
  <PopoverContent>
    <PopoverHeader>
      <PopoverTitle>Настройки уведомлений</PopoverTitle>
      <PopoverDescription>Выберите, что приходит на почту.</PopoverDescription>
    </PopoverHeader>
  </PopoverContent>
</Popover>`,
    },
    {
      id: 'align',
      title: 'Выравнивание (align)',
      description:
        'align — по какому краю триггера выровнять панель: start, center (по умолчанию), end. side — с какой стороны открыть.',
      render: () => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">{'align="start"'}</Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56">
              Панель прижата к началу триггера.
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">{'align="end"'}</Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56">
              Панель прижата к концу триггера.
            </PopoverContent>
          </Popover>
        </div>
      ),
      code: `<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">align="start"</Button>
  </PopoverTrigger>
  <PopoverContent align="start" className="w-56">
    Панель прижата к началу триггера.
  </PopoverContent>
</Popover>
<Popover>
  <PopoverTrigger asChild>
    <Button variant="outline">align="end"</Button>
  </PopoverTrigger>
  <PopoverContent align="end" className="w-56">
    Панель прижата к концу триггера.
  </PopoverContent>
</Popover>`,
    },
  ],
  examples: [
    {
      id: 'anchor',
      title: 'Отдельный якорь (PopoverAnchor)',
      description:
        'PopoverAnchor — элемент, рядом с которым откроется панель, если это не сам триггер.',
      render: () => (
        <Popover>
          <PopoverAnchor asChild>
            <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
              Панель откроется рядом с этим блоком
            </div>
          </PopoverAnchor>
          <PopoverTrigger asChild>
            <Button variant="outline" className="mt-2">
              Открыть у якоря
            </Button>
          </PopoverTrigger>
          <PopoverContent>Позиционируется относительно якоря, а не кнопки.</PopoverContent>
        </Popover>
      ),
      code: `<Popover>
  <PopoverAnchor asChild>
    <div className="rounded-md border px-3 py-2 text-sm text-muted-foreground">
      Панель откроется рядом с этим блоком
    </div>
  </PopoverAnchor>
  <PopoverTrigger asChild>
    <Button variant="outline" className="mt-2">
      Открыть у якоря
    </Button>
  </PopoverTrigger>
  <PopoverContent>Позиционируется относительно якоря, а не кнопки.</PopoverContent>
</Popover>`,
    },
    {
      id: 'controlled',
      title: 'Закрыть из кода (open / onOpenChange)',
      description:
        'open и onOpenChange отдают состояние вам — например, чтобы закрыть панель кнопкой внутри неё.',
      render: () => {
        function Controlled() {
          const [open, setOpen] = useState(false);
          return (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline">{open ? 'Открыт' : 'Закрыт'}</Button>
              </PopoverTrigger>
              <PopoverContent>
                <PopoverHeader>
                  <PopoverTitle>Подтверждение</PopoverTitle>
                  <PopoverDescription>Закройте панель кнопкой ниже.</PopoverDescription>
                </PopoverHeader>
                <Button size="sm" className="mt-3" onClick={() => setOpen(false)}>
                  Готово
                </Button>
              </PopoverContent>
            </Popover>
          );
        }
        return <Controlled />;
      },
      code: `const [open, setOpen] = useState(false);

<Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline">{open ? 'Открыт' : 'Закрыт'}</Button>
  </PopoverTrigger>
  <PopoverContent>
    <PopoverHeader>
      <PopoverTitle>Подтверждение</PopoverTitle>
      <PopoverDescription>Закройте панель кнопкой ниже.</PopoverDescription>
    </PopoverHeader>
    <Button size="sm" className="mt-3" onClick={() => setOpen(false)}>
      Готово
    </Button>
  </PopoverContent>
</Popover>`,
    },
  ],
  props: [
    {
      name: 'Popover',
      type: 'Radix Popover.Root',
      description:
        'Корень, хранит открытость: open + onOpenChange или defaultOpen. modal (false) — запереть фокус в панели.',
    },
    {
      name: 'PopoverTrigger',
      type: 'Radix Popover.Trigger',
      description: 'Кнопка, которая открывает и закрывает панель. asChild — стать своим элементом.',
    },
    {
      name: 'PopoverContent',
      type: 'Radix Popover.Content',
      default: 'align="center", sideOffset={4}',
      description:
        'Панель в портале, ширина w-72. Положение: side, align (start / center / end), sideOffset, alignOffset.',
    },
    {
      name: 'PopoverAnchor',
      type: 'Radix Popover.Anchor',
      description: 'Элемент, рядом с которым откроется панель вместо триггера.',
    },
    {
      name: 'PopoverHeader',
      type: 'div',
      description: 'Шапка содержимого: заголовок и описание столбиком.',
    },
    {
      name: 'PopoverTitle',
      type: 'div',
      description: 'Заголовок панели. Это <div>, с панелью не связан — см. «Доступность».',
    },
    {
      name: 'PopoverDescription',
      type: 'p',
      description: 'Описание приглушённым цветом.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
