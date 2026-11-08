import { useState } from 'react';
import { ChevronsUpDownIcon } from 'lucide-react';
import {
  Button,
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
  Item,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Collapsible — не поле формы: compound поверх Radix Collapsible (Collapsible / CollapsibleTrigger /
 * CollapsibleContent). Своих стилей у него нет, поэтому кнопку даёт Button через asChild, строки —
 * Item. Variants — режимы состояния, Examples — типовые сценарии, API — таблица props.
 * Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */

function ControlledCollapsible() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="justify-between">
            Настройки уведомлений
            <ChevronsUpDownIcon />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Item variant="outline" size="sm">
            Письма о статусе заказа: {open ? 'включены' : '—'}
          </Item>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function ShowMoreList() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ width: '100%', maxWidth: 380 }}>
      <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
        <Item variant="outline" size="sm">
          @reformer/core
        </Item>
        <CollapsibleContent className="flex flex-col gap-2">
          <Item variant="outline" size="sm">
            @reformer/ui-kit
          </Item>
          <Item variant="outline" size="sm">
            @reformer/renderer-react
          </Item>
        </CollapsibleContent>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm">
            {open ? 'Свернуть' : 'Показать ещё 2 пакета'}
          </Button>
        </CollapsibleTrigger>
      </Collapsible>
    </div>
  );
}

export const collapsibleDocConfig: ComponentDocConfig = {
  name: 'Collapsible',
  importFrom: '@reformer/ui-kit',
  description:
    'Один блок, который показывается и скрывается по кнопке. Своих стилей нет — оформление задаёте вы.',
  variants: [
    {
      id: 'uncontrolled',
      title: 'Состояние внутри компонента (defaultOpen)',
      description:
        'Компонент сам помнит, открыт ли блок. defaultOpen — открыть при первом рендере.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 380 }}>
          <Collapsible defaultOpen className="flex flex-col gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="justify-between">
                Детали заказа
                <ChevronsUpDownIcon />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Item variant="outline" size="sm">
                Заказ №1024 — доставка 18 июля, оплачен картой.
              </Item>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ),
      code: `<Collapsible defaultOpen className="flex flex-col gap-2">
  <CollapsibleTrigger asChild>
    <Button variant="outline" className="justify-between">
      Детали заказа
      <ChevronsUpDownIcon />
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <Item variant="outline" size="sm">
      Заказ №1024 — доставка 18 июля, оплачен картой.
    </Item>
  </CollapsibleContent>
</Collapsible>`,
    },
    {
      id: 'controlled',
      title: 'Управляемый блок (open + onOpenChange)',
      description:
        'Открыт ли блок, хранит ваше состояние: его можно читать снаружи и менять из другого места.',
      render: ControlledCollapsible,
      code: `const [open, setOpen] = useState(false);

<Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
  <CollapsibleTrigger asChild>
    <Button variant="outline" className="justify-between">
      Настройки уведомлений
      <ChevronsUpDownIcon />
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <Item variant="outline" size="sm">
      Письма о статусе заказа: {open ? 'включены' : '—'}
    </Item>
  </CollapsibleContent>
</Collapsible>`,
    },
    {
      id: 'disabled',
      title: 'Недоступный блок (disabled)',
      description: 'disabled у Collapsible блокирует кнопку: блок не раскрывается.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 380 }}>
          <Collapsible disabled className="flex flex-col gap-2">
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="justify-between">
                Раздел недоступен
                <ChevronsUpDownIcon />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Item variant="outline" size="sm">
                Скрытое содержимое.
              </Item>
            </CollapsibleContent>
          </Collapsible>
        </div>
      ),
      code: `<Collapsible disabled className="flex flex-col gap-2">
  <CollapsibleTrigger asChild>
    <Button variant="outline" className="justify-between">
      Раздел недоступен
      <ChevronsUpDownIcon />
    </Button>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <Item variant="outline" size="sm">
      Скрытое содержимое.
    </Item>
  </CollapsibleContent>
</Collapsible>`,
    },
  ],
  examples: [
    {
      id: 'show-more',
      title: 'Список «Показать ещё»',
      description:
        'Первый элемент виден всегда, остальные скрыты под кнопкой. Подпись кнопки зависит от состояния.',
      render: ShowMoreList,
      code: `const [open, setOpen] = useState(false);

<Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-2">
  <Item variant="outline" size="sm">
    @reformer/core
  </Item>
  <CollapsibleContent className="flex flex-col gap-2">
    <Item variant="outline" size="sm">
      @reformer/ui-kit
    </Item>
    <Item variant="outline" size="sm">
      @reformer/renderer-react
    </Item>
  </CollapsibleContent>
  <CollapsibleTrigger asChild>
    <Button variant="ghost" size="sm">
      {open ? 'Свернуть' : 'Показать ещё 2 пакета'}
    </Button>
  </CollapsibleTrigger>
</Collapsible>`,
    },
  ],
  props: [
    {
      name: 'defaultOpen',
      type: 'boolean',
      default: 'false',
      description: 'Открыть блок при первом рендере, если состоянием управляет сам компонент.',
    },
    {
      name: 'open',
      type: 'boolean',
      description: 'Открыт ли блок, когда состоянием управляете вы. Используется с onOpenChange.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean) => void',
      description: 'Вызывается при открытии и закрытии.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      default: 'false',
      description: 'Заблокировать кнопку: блок не раскрывается и не сворачивается.',
    },
    {
      name: 'CollapsibleTrigger.asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Не рисовать свою кнопку, а передать поведение дочернему элементу — например, Button кита.',
    },
    {
      name: 'CollapsibleContent.forceMount',
      type: 'true',
      description:
        'Всегда держать содержимое в DOM. Без него закрытое содержимое удаляется; с ним — остаётся видимым, скрывайте его своим классом (data-[state=closed]:hidden).',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Классы любой части. Встроенных стилей у частей нет — вид задаёте вы.',
    },
  ],
};
