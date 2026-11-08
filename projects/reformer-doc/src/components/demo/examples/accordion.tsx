import { useState } from 'react';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Button,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Accordion — не поле формы: compound поверх Radix Accordion (Accordion / AccordionItem /
 * AccordionTrigger / AccordionContent). Variants — режимы раскрытия, Examples — типовые сценарии,
 * API — таблица props. Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */

function ControlledAccordion() {
  const [open, setOpen] = useState<string[]>(['delivery']);
  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen(['delivery', 'payment', 'return'])}
        >
          Раскрыть все
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen([])}>
          Свернуть все
        </Button>
      </div>
      <Accordion type="multiple" value={open} onValueChange={setOpen}>
        <AccordionItem value="delivery">
          <AccordionTrigger>Доставка</AccordionTrigger>
          <AccordionContent>Отправляем в течение 1–2 рабочих дней.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="payment">
          <AccordionTrigger>Оплата</AccordionTrigger>
          <AccordionContent>Картой или переводом при получении.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="return">
          <AccordionTrigger>Возврат</AccordionTrigger>
          <AccordionContent>14 дней на возврат без объяснения причин.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

export const accordionDocConfig: ComponentDocConfig = {
  name: 'Accordion',
  importFrom: '@reformer/ui-kit',
  description:
    'Стопка секций с заголовками: щелчок по заголовку раскрывает содержимое. Режим — type ("single" | "multiple").',
  variants: [
    {
      id: 'single-collapsible',
      title: 'Одна секция за раз (single, collapsible)',
      description:
        'type="single" — открыта не больше одной секции. collapsible разрешает свернуть и её.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Accordion type="single" collapsible defaultValue="item-1">
            <AccordionItem value="item-1">
              <AccordionTrigger>Что такое ReFormer?</AccordionTrigger>
              <AccordionContent>
                Библиотека для построения форм со связанной реактивностью полей.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger>На чём построен ui-kit?</AccordionTrigger>
              <AccordionContent>На shadcn/ui и Radix, стили — Tailwind.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger>Можно ли поменять тему?</AccordionTrigger>
              <AccordionContent>Да, через CSS-переменные темы.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
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
    <AccordionContent>На shadcn/ui и Radix, стили — Tailwind.</AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-3">
    <AccordionTrigger>Можно ли поменять тему?</AccordionTrigger>
    <AccordionContent>Да, через CSS-переменные темы.</AccordionContent>
  </AccordionItem>
</Accordion>`,
    },
    {
      id: 'multiple',
      title: 'Несколько секций (multiple)',
      description: 'type="multiple" — секции раскрываются независимо друг от друга.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Accordion type="multiple" defaultValue={['a', 'b']}>
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
        </div>
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
  <AccordionItem value="c">
    <AccordionTrigger>Возврат</AccordionTrigger>
    <AccordionContent>14 дней на возврат без объяснения причин.</AccordionContent>
  </AccordionItem>
</Accordion>`,
    },
    {
      id: 'disabled-item',
      title: 'Недоступная секция',
      description: 'disabled на AccordionItem — секцию нельзя раскрыть, фокус её пропускает.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Accordion type="single" collapsible>
            <AccordionItem value="basic">
              <AccordionTrigger>Базовый тариф</AccordionTrigger>
              <AccordionContent>До трёх форм и 1000 отправок в месяц.</AccordionContent>
            </AccordionItem>
            <AccordionItem value="pro" disabled>
              <AccordionTrigger>Тариф Pro (скоро)</AccordionTrigger>
              <AccordionContent>Описание появится позже.</AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ),
      code: `<Accordion type="single" collapsible>
  <AccordionItem value="basic">
    <AccordionTrigger>Базовый тариф</AccordionTrigger>
    <AccordionContent>До трёх форм и 1000 отправок в месяц.</AccordionContent>
  </AccordionItem>
  <AccordionItem value="pro" disabled>
    <AccordionTrigger>Тариф Pro (скоро)</AccordionTrigger>
    <AccordionContent>Описание появится позже.</AccordionContent>
  </AccordionItem>
</Accordion>`,
    },
  ],
  examples: [
    {
      id: 'faq',
      title: 'Блок вопросов и ответов',
      description:
        'Типовой сценарий: список вопросов. Первый ответ раскрыт сразу — через defaultValue.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Accordion type="single" collapsible defaultValue="q1">
            <AccordionItem value="q1">
              <AccordionTrigger>Как начать работу?</AccordionTrigger>
              <AccordionContent>
                Установите пакет и импортируйте нужные компоненты из @reformer/ui-kit.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="q2">
              <AccordionTrigger>Есть ли тёмная тема?</AccordionTrigger>
              <AccordionContent>
                Да — компоненты берут цвета из токенов темы и переключаются вместе с ней.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      ),
      code: `<Accordion type="single" collapsible defaultValue="q1">
  <AccordionItem value="q1">
    <AccordionTrigger>Как начать работу?</AccordionTrigger>
    <AccordionContent>
      Установите пакет и импортируйте нужные компоненты из @reformer/ui-kit.
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="q2">
    <AccordionTrigger>Есть ли тёмная тема?</AccordionTrigger>
    <AccordionContent>
      Да — компоненты берут цвета из токенов темы и переключаются вместе с ней.
    </AccordionContent>
  </AccordionItem>
</Accordion>`,
    },
    {
      id: 'controlled',
      title: 'Управляемое раскрытие',
      description:
        'value + onValueChange: какие секции открыты, решает ваше состояние — например, кнопки «раскрыть / свернуть все».',
      render: ControlledAccordion,
      code: `const [open, setOpen] = useState<string[]>(['delivery']);

<Button size="sm" variant="outline" onClick={() => setOpen(['delivery', 'payment', 'return'])}>
  Раскрыть все
</Button>
<Button size="sm" variant="outline" onClick={() => setOpen([])}>
  Свернуть все
</Button>

<Accordion type="multiple" value={open} onValueChange={setOpen}>
  <AccordionItem value="delivery">
    <AccordionTrigger>Доставка</AccordionTrigger>
    <AccordionContent>Отправляем в течение 1–2 рабочих дней.</AccordionContent>
  </AccordionItem>
  <AccordionItem value="payment">
    <AccordionTrigger>Оплата</AccordionTrigger>
    <AccordionContent>Картой или переводом при получении.</AccordionContent>
  </AccordionItem>
  <AccordionItem value="return">
    <AccordionTrigger>Возврат</AccordionTrigger>
    <AccordionContent>14 дней на возврат без объяснения причин.</AccordionContent>
  </AccordionItem>
</Accordion>`,
    },
  ],
  props: [
    {
      name: 'type',
      type: "'single' | 'multiple'",
      description:
        'Обязательный. "single" — открыта не больше одной секции, "multiple" — секции раскрываются независимо.',
    },
    {
      name: 'collapsible',
      type: 'boolean',
      default: 'false',
      description:
        'Только для type="single": разрешить свернуть открытую секцию, чтобы закрыты были все.',
    },
    {
      name: 'defaultValue',
      type: 'string | string[]',
      description:
        'Секции, открытые при первом рендере, если состоянием управляет сам компонент. Строка для single, массив для multiple.',
    },
    {
      name: 'value',
      type: 'string | string[]',
      description: 'Открытые секции, когда состоянием управляете вы. Используется с onValueChange.',
    },
    {
      name: 'onValueChange',
      type: '(value: string | string[]) => void',
      description:
        'Вызывается при раскрытии и сворачивании. Тип аргумента — как у value для выбранного type.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      default: 'false',
      description: 'Заблокировать все секции. Отдельную секцию блокирует disabled у AccordionItem.',
    },
    {
      name: 'orientation',
      type: "'vertical' | 'horizontal'",
      default: "'vertical'",
      description:
        'Какими стрелками переходить между заголовками: ↑/↓ для vertical, ←/→ для horizontal. Раскладку не меняет.',
    },
    {
      name: 'dir',
      type: "'ltr' | 'rtl'",
      description:
        'Направление текста для стрелок в horizontal. По умолчанию берётся из DirectionProvider.',
    },
    {
      name: 'AccordionItem.value',
      type: 'string',
      description:
        'Обязательный. Уникальный идентификатор секции — его содержат value и defaultValue.',
    },
    {
      name: 'AccordionItem.disabled',
      type: 'boolean',
      default: 'false',
      description: 'Секцию нельзя раскрыть, клавиатура её пропускает.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
