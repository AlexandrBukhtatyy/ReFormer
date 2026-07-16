import { useState } from 'react';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

// ─── Инлайновые стили демо ────────────────────────────────────────────────
// Collapsible — headless-набор (без встроенных стилей). В Docusaurus Tailwind-классы
// ui-kit не применяются, поэтому демо стилизуем инлайном, чтобы блоки рендерились корректно.
const box: React.CSSProperties = {
  width: '100%',
  maxWidth: 380,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const triggerBtn: React.CSSProperties = {
  display: 'flex',
  width: '100%',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '8px 12px',
  fontSize: 14,
  fontWeight: 600,
  border: '1px solid var(--ifm-color-emphasis-300)',
  borderRadius: 8,
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
};
const item: React.CSSProperties = {
  padding: '8px 12px',
  fontSize: 14,
  border: '1px solid var(--ifm-color-emphasis-200)',
  borderRadius: 8,
};

/**
 * Collapsible — не form-control: compound поверх Radix Collapsible (Collapsible /
 * CollapsibleTrigger / CollapsibleContent). Управляет раскрытием одного блока.
 * Таб Variants — режимы (uncontrolled defaultOpen / controlled), Examples — рецепт
 * «показать ещё» (peek-list), props — таблица.
 */
export const collapsibleDocConfig: ComponentDocConfig = {
  name: 'Collapsible',
  importFrom: '@reformer/ui-kit',
  description:
    'Раскрывающийся блок на shadcn / Radix Collapsible. Compound-набор: Collapsible / CollapsibleTrigger / CollapsibleContent. Headless — стили задаёт вызывающий код.',
  variants: [
    {
      id: 'uncontrolled',
      title: 'Uncontrolled (defaultOpen)',
      description:
        'Простейший режим: состояние хранит сам компонент, стартовое — через defaultOpen.',
      render: () => (
        <Collapsible defaultOpen style={box}>
          <CollapsibleTrigger style={triggerBtn}>Детали заказа</CollapsibleTrigger>
          <CollapsibleContent>
            <div style={item}>Заказ №1024 — доставка 18 июля, оплачен картой.</div>
          </CollapsibleContent>
        </Collapsible>
      ),
      code: `<Collapsible defaultOpen>
  <CollapsibleTrigger>Детали заказа</CollapsibleTrigger>
  <CollapsibleContent>
    <div>Заказ №1024 — доставка 18 июля, оплачен картой.</div>
  </CollapsibleContent>
</Collapsible>`,
    },
    {
      id: 'controlled',
      title: 'Controlled (open / onOpenChange)',
      description:
        'Состояние снаружи: open + onOpenChange. Позволяет синхронизировать иконку/подпись триггера.',
      render: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks -- VariantGallery рендерит render как <Render/> (компонент), useState безопасен
        const [open, setOpen] = useState(false);
        return (
          <Collapsible open={open} onOpenChange={setOpen} style={box}>
            <CollapsibleTrigger style={triggerBtn}>
              <span>Настройки уведомлений</span>
              <span aria-hidden>{open ? '▾' : '▸'}</span>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div style={item}>Email-уведомления о статусе заказа: включены.</div>
            </CollapsibleContent>
          </Collapsible>
        );
      },
      code: `const [open, setOpen] = useState(false);

<Collapsible open={open} onOpenChange={setOpen}>
  <CollapsibleTrigger>
    <span>Настройки уведомлений</span>
    <span aria-hidden>{open ? '▾' : '▸'}</span>
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div>Email-уведомления о статусе заказа: включены.</div>
  </CollapsibleContent>
</Collapsible>`,
    },
    {
      id: 'disabled',
      title: 'Disabled',
      description:
        'disabled на Collapsible блокирует триггер (data-disabled прокидывается на кнопку).',
      render: () => (
        <Collapsible disabled style={box}>
          <CollapsibleTrigger style={{ ...triggerBtn, opacity: 0.5, cursor: 'not-allowed' }}>
            Раздел недоступен
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div style={item}>Скрытое содержимое.</div>
          </CollapsibleContent>
        </Collapsible>
      ),
      code: `<Collapsible disabled>
  <CollapsibleTrigger>Раздел недоступен</CollapsibleTrigger>
  <CollapsibleContent>
    <div>Скрытое содержимое.</div>
  </CollapsibleContent>
</Collapsible>`,
    },
  ],
  examples: [
    {
      id: 'peek-list',
      title: 'Список «показать ещё»',
      description:
        'Первый элемент виден всегда, остальные — под триггером. Типовой сценарий peek-list.',
      render: () => {
        // eslint-disable-next-line react-hooks/rules-of-hooks -- VariantGallery рендерит render как <Render/> (компонент), useState безопасен
        const [open, setOpen] = useState(false);
        return (
          <Collapsible open={open} onOpenChange={setOpen} style={box}>
            <div style={item}>@reformer/core</div>
            <CollapsibleTrigger style={triggerBtn}>
              {open ? 'Свернуть' : 'Показать ещё 2 пакета'}
            </CollapsibleTrigger>
            <CollapsibleContent style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={item}>@reformer/ui-kit</div>
              <div style={item}>@reformer/renderer-react</div>
            </CollapsibleContent>
          </Collapsible>
        );
      },
      code: `const [open, setOpen] = useState(false);

<Collapsible open={open} onOpenChange={setOpen}>
  <div>@reformer/core</div>
  <CollapsibleTrigger>
    {open ? 'Свернуть' : 'Показать ещё 2 пакета'}
  </CollapsibleTrigger>
  <CollapsibleContent>
    <div>@reformer/ui-kit</div>
    <div>@reformer/renderer-react</div>
  </CollapsibleContent>
</Collapsible>`,
    },
  ],
  props: [
    {
      name: 'open',
      type: 'boolean',
      description: 'Раскрыт ли блок в controlled-режиме (вместе с onOpenChange).',
    },
    {
      name: 'defaultOpen',
      type: 'boolean',
      default: 'false',
      description: 'Стартовое состояние в uncontrolled-режиме.',
    },
    {
      name: 'onOpenChange',
      type: '(open: boolean) => void',
      description: 'Колбэк смены состояния (controlled-режим).',
    },
    {
      name: 'disabled',
      type: 'boolean',
      default: 'false',
      description: 'Блокирует триггер — раскрытие/сворачивание недоступно.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы на под-частях (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
