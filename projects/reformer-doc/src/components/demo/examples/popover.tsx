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
 * Popover — не form-control: overlay поверх Radix Popover. Триггер (PopoverTrigger) открывает
 * плавающую панель (PopoverContent в Portal), позиционируемую относительно триггера или отдельного
 * якоря (PopoverAnchor). Header / Title / Description — презентационные части содержимого.
 * Таб Variants показывает готовые конфигурации, Examples — приёмы (якорь, управляемое состояние).
 */
export const popoverDocConfig: ComponentDocConfig = {
  name: 'Popover',
  importFrom: '@reformer/ui-kit',
  description:
    'Всплывающая панель на shadcn / Radix Popover. Триггер открывает контент в Portal, позиционируемый через align / side / sideOffset. Части (Trigger / Content / Anchor / Header / Title / Description) несут свой data-slot.',
  variants: [
    {
      id: 'basic',
      title: 'Базовый popover',
      description: 'Триггер-кнопка (asChild) открывает панель с заголовком и описанием.',
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
      title: 'Позиционирование (align / side)',
      description:
        'align выравнивает панель относительно триггера (start / center / end); sideOffset задаёт отступ.',
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
  <PopoverContent align="start" sideOffset={4}>
    Панель прижата к началу триггера.
  </PopoverContent>
</Popover>`,
    },
  ],
  examples: [
    {
      id: 'anchor',
      title: 'Отдельный якорь (PopoverAnchor)',
      description:
        'PopoverAnchor задаёт элемент, относительно которого позиционируется панель, — независимо от триггера.',
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
    <div>Панель откроется рядом с этим блоком</div>
  </PopoverAnchor>
  <PopoverTrigger asChild>
    <Button variant="outline">Открыть у якоря</Button>
  </PopoverTrigger>
  <PopoverContent>Позиционируется относительно якоря, а не кнопки.</PopoverContent>
</Popover>`,
    },
    {
      id: 'controlled',
      title: 'Управляемое состояние (open / onOpenChange)',
      description:
        'open + onOpenChange переводят открытие под контроль вызывающего — например, закрыть по действию внутри панели.',
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
    <Button size="sm" onClick={() => setOpen(false)}>Готово</Button>
  </PopoverContent>
</Popover>`,
    },
  ],
  props: [
    {
      name: 'Popover',
      type: 'Radix Popover.Root',
      description: 'Корень: управляет открытием. Props: open / defaultOpen / onOpenChange / modal.',
    },
    {
      name: 'PopoverTrigger',
      type: 'Radix Popover.Trigger',
      description: 'Триггер открытия. asChild — слить props на дочерний элемент (напр. Button).',
    },
    {
      name: 'PopoverContent',
      type: 'Radix Popover.Content',
      default: 'align="center", sideOffset={4}',
      description:
        'Плавающая панель в Portal. Позиционирование: align (start / center / end), side, sideOffset, alignOffset.',
    },
    {
      name: 'PopoverAnchor',
      type: 'Radix Popover.Anchor',
      description: 'Опц. элемент-якорь для позиционирования панели независимо от триггера.',
    },
    {
      name: 'PopoverHeader',
      type: 'div',
      description: 'Презентационная шапка содержимого (вертикальный стек, text-sm).',
    },
    {
      name: 'PopoverTitle',
      type: 'div',
      description: 'Заголовок панели (font-medium).',
    },
    {
      name: 'PopoverDescription',
      type: 'p',
      description: 'Описание / подзаголовок (muted-foreground).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
