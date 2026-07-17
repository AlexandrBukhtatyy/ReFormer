import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Accordion — не form-control: compound поверх Radix Accordion (Accordion / AccordionItem /
 * AccordionTrigger / AccordionContent). Таб Variants показывает режимы раскрытия (single collapsible
 * / multiple), Examples — рецепты (FAQ), props — таблица.
 */
export const accordionDocConfig: ComponentDocConfig = {
  name: 'Accordion',
  importFrom: '@reformer/ui-kit',
  description:
    'Раскрывающиеся секции на shadcn / Radix Accordion. Compound-набор: Accordion / AccordionItem / AccordionTrigger / AccordionContent. Режим — через type ("single" | "multiple").',
  variants: [
    {
      id: 'single-collapsible',
      title: 'Одиночное раскрытие (single, collapsible)',
      description:
        'type="single" — одновременно открыта только одна секция. collapsible позволяет свернуть все.',
      render: () => (
        <Accordion
          type="single"
          collapsible
          defaultValue="item-1"
          style={{ width: '100%', maxWidth: 480 }}
        >
          <AccordionItem value="item-1">
            <AccordionTrigger>Что такое ReFormer?</AccordionTrigger>
            <AccordionContent>
              Библиотека для построения форм со связанной реактивностью полей.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-2">
            <AccordionTrigger>На чём построен ui-kit?</AccordionTrigger>
            <AccordionContent>
              На shadcn / Radix — с сохранением data-slot и дословным портом стилей.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="item-3">
            <AccordionTrigger>Можно ли темизировать?</AccordionTrigger>
            <AccordionContent>Да, через Tailwind-токены темы (CSS-переменные).</AccordionContent>
          </AccordionItem>
        </Accordion>
      ),
      code: `<Accordion type="single" collapsible defaultValue="item-1">
  <AccordionItem value="item-1">
    <AccordionTrigger>Что такое ReFormer?</AccordionTrigger>
    <AccordionContent>
      Библиотека для построения форм со связанной реактивностью полей.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>На чём построен ui-kit?</AccordionTrigger>
    <AccordionContent>
      На shadcn / Radix — с сохранением data-slot и дословным портом стилей.
    </AccordionContent>
  </AccordionItem>
</Accordion>`,
    },
    {
      id: 'multiple',
      title: 'Множественное раскрытие (multiple)',
      description: 'type="multiple" — несколько секций могут быть открыты одновременно.',
      render: () => (
        <Accordion
          type="multiple"
          defaultValue={['a', 'b']}
          style={{ width: '100%', maxWidth: 480 }}
        >
          <AccordionItem value="a">
            <AccordionTrigger>Доставка</AccordionTrigger>
            <AccordionContent>Отправляем в течение 1–2 рабочих дней.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="b">
            <AccordionTrigger>Оплата</AccordionTrigger>
            <AccordionContent>Картой или переводом при получении.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="c">
            <AccordionTrigger>Возврат</AccordionTrigger>
            <AccordionContent>14 дней на возврат без объяснения причин.</AccordionContent>
          </AccordionItem>
        </Accordion>
      ),
      code: `<Accordion type="multiple" defaultValue={['a', 'b']}>
  <AccordionItem value="a">
    <AccordionTrigger>Доставка</AccordionTrigger>
    <AccordionContent>Отправляем в течение 1–2 рабочих дней.</AccordionContent>
  </AccordionItem>
  <AccordionItem value="b">
    <AccordionTrigger>Оплата</AccordionTrigger>
    <AccordionContent>Картой или переводом при получении.</AccordionContent>
  </AccordionItem>
</Accordion>`,
    },
  ],
  examples: [
    {
      id: 'faq',
      title: 'FAQ-блок',
      description:
        'Типовой сценарий: список вопросов-ответов. Одна секция раскрыта по умолчанию через defaultValue.',
      render: () => (
        <Accordion
          type="single"
          collapsible
          defaultValue="q1"
          style={{ width: '100%', maxWidth: 480 }}
        >
          <AccordionItem value="q1">
            <AccordionTrigger>Как начать работу?</AccordionTrigger>
            <AccordionContent>
              Установите пакет и импортируйте нужные компоненты из @reformer/ui-kit.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="q2">
            <AccordionTrigger>Есть ли поддержка тёмной темы?</AccordionTrigger>
            <AccordionContent>
              Да — компоненты используют токены темы и адаптируются автоматически.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ),
      code: `<Accordion type="single" collapsible defaultValue="q1">
  <AccordionItem value="q1">
    <AccordionTrigger>Как начать работу?</AccordionTrigger>
    <AccordionContent>
      Установите пакет и импортируйте нужные компоненты из @reformer/ui-kit.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="q2">
    <AccordionTrigger>Есть ли поддержка тёмной темы?</AccordionTrigger>
    <AccordionContent>
      Да — компоненты используют токены темы и адаптируются автоматически.
    </AccordionContent>
  </AccordionItem>
</Accordion>`,
    },
  ],
  props: [
    {
      name: 'type',
      type: "'single' | 'multiple'",
      description:
        'Режим раскрытия: одна секция ("single") или несколько ("multiple"). Обязательный проп Accordion.',
    },
    {
      name: 'collapsible',
      type: 'boolean',
      default: 'false',
      description: 'Для type="single" — разрешить свернуть открытую секцию (все закрыты).',
    },
    {
      name: 'defaultValue',
      type: 'string | string[]',
      description:
        'Изначально раскрытая(-ые) секция(-и) (uncontrolled). string для single, string[] для multiple.',
    },
    {
      name: 'value',
      type: 'string | string[]',
      description: 'Раскрытая(-ые) секция(-и) в controlled-режиме (с onValueChange).',
    },
    {
      name: 'onValueChange',
      type: '(value: string | string[]) => void',
      description: 'Колбэк смены раскрытых секций (controlled-режим).',
    },
    {
      name: 'disabled',
      type: 'boolean',
      default: 'false',
      description: 'Отключить весь Accordion (или отдельный AccordionItem через свой disabled).',
    },
    {
      name: 'value (AccordionItem)',
      type: 'string',
      description: 'Уникальный идентификатор секции (обязателен на каждом AccordionItem).',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
