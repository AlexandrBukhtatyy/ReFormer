import { BubbleGroup, Bubble, BubbleContent, BubbleReactions } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Bubble — не form-control: AI-примитив пузыря сообщения чата (compound: BubbleGroup / Bubble /
 * BubbleContent / BubbleReactions). Таб Variants показывает cva-пресеты стиля (variant) и
 * выравнивание (align), Examples — приёмы (диалог, интерактивный пузырь через asChild, реакции).
 * Form-bound таба (api) нет.
 */
export const bubbleDocConfig: ComponentDocConfig = {
  name: 'Bubble',
  importFrom: '@reformer/ui-kit',
  description:
    'Пузырь сообщения чата на shadcn / Radix Slot. Стиль задаётся через variant, сторона через align (start — входящее, end — исходящее). Фон/паддинги живут на BubbleContent, а BubbleReactions — плавающая пилюля реакций поверх пузыря.',
  variants: [
    {
      id: 'variants',
      title: 'Варианты стиля',
      description:
        'variant: default / secondary / muted / tinted / outline / ghost / destructive. Стиль применяется к вложенному BubbleContent.',
      render: () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 420 }}>
          <Bubble variant="default">
            <BubbleContent>default</BubbleContent>
          </Bubble>
          <Bubble variant="secondary">
            <BubbleContent>secondary</BubbleContent>
          </Bubble>
          <Bubble variant="muted">
            <BubbleContent>muted</BubbleContent>
          </Bubble>
          <Bubble variant="tinted">
            <BubbleContent>tinted</BubbleContent>
          </Bubble>
          <Bubble variant="outline">
            <BubbleContent>outline</BubbleContent>
          </Bubble>
          <Bubble variant="ghost">
            <BubbleContent>ghost</BubbleContent>
          </Bubble>
          <Bubble variant="destructive">
            <BubbleContent>destructive</BubbleContent>
          </Bubble>
        </div>
      ),
      code: `<Bubble variant="default">
  <BubbleContent>default</BubbleContent>
</Bubble>
<Bubble variant="secondary">
  <BubbleContent>secondary</BubbleContent>
</Bubble>
<Bubble variant="muted">
  <BubbleContent>muted</BubbleContent>
</Bubble>
<Bubble variant="tinted">
  <BubbleContent>tinted</BubbleContent>
</Bubble>
<Bubble variant="outline">
  <BubbleContent>outline</BubbleContent>
</Bubble>
<Bubble variant="ghost">
  <BubbleContent>ghost</BubbleContent>
</Bubble>
<Bubble variant="destructive">
  <BubbleContent>destructive</BubbleContent>
</Bubble>`,
    },
    {
      id: 'align',
      title: 'Выравнивание (align)',
      description:
        'align="start" прижимает пузырь влево (входящее сообщение), align="end" — вправо (исходящее). Оборачивайте в BubbleGroup, чтобы получить вертикальный стек.',
      render: () => (
        <BubbleGroup style={{ width: '100%', maxWidth: 420 }}>
          <Bubble align="start" variant="muted">
            <BubbleContent>Входящее — слева</BubbleContent>
          </Bubble>
          <Bubble align="end" variant="default">
            <BubbleContent>Исходящее — справа</BubbleContent>
          </Bubble>
        </BubbleGroup>
      ),
      code: `<BubbleGroup>
  <Bubble align="start" variant="muted">
    <BubbleContent>Входящее — слева</BubbleContent>
  </Bubble>
  <Bubble align="end" variant="default">
    <BubbleContent>Исходящее — справа</BubbleContent>
  </Bubble>
</BubbleGroup>`,
    },
  ],
  examples: [
    {
      id: 'conversation',
      title: 'Диалог (BubbleGroup + чередование align)',
      description:
        'Стек сообщений: ассистент слева (muted), пользователь справа (default). BubbleGroup держит колонку с отступами.',
      render: () => (
        <BubbleGroup style={{ width: '100%', maxWidth: 420 }}>
          <Bubble align="start" variant="muted">
            <BubbleContent>Чем могу помочь?</BubbleContent>
          </Bubble>
          <Bubble align="end" variant="default">
            <BubbleContent>Собери форму заявки на кредит.</BubbleContent>
          </Bubble>
          <Bubble align="start" variant="muted">
            <BubbleContent>Готово — открываю мастер из четырёх шагов.</BubbleContent>
          </Bubble>
        </BubbleGroup>
      ),
      code: `<BubbleGroup>
  <Bubble align="start" variant="muted">
    <BubbleContent>Чем могу помочь?</BubbleContent>
  </Bubble>
  <Bubble align="end" variant="default">
    <BubbleContent>Собери форму заявки на кредит.</BubbleContent>
  </Bubble>
  <Bubble align="start" variant="muted">
    <BubbleContent>Готово — открываю мастер из четырёх шагов.</BubbleContent>
  </Bubble>
</BubbleGroup>`,
    },
    {
      id: 'as-child',
      title: 'Интерактивный пузырь (BubbleContent asChild)',
      description:
        'asChild сливает стили BubbleContent на единственный дочерний элемент вместо <div> — напр. <button>. Активируются интерактивные стили ([button,a] — hover/focus).',
      render: () => (
        <Bubble variant="secondary" align="end" style={{ maxWidth: 420 }}>
          <BubbleContent asChild>
            <button type="button" onClick={() => {}}>
              Повторить запрос
            </button>
          </BubbleContent>
        </Bubble>
      ),
      code: `<Bubble variant="secondary" align="end">
  <BubbleContent asChild>
    <button type="button" onClick={retry}>
      Повторить запрос
    </button>
  </BubbleContent>
</Bubble>`,
    },
    {
      id: 'reactions',
      title: 'Реакции (BubbleReactions)',
      description:
        'BubbleReactions — плавающая пилюля поверх пузыря (absolute относительно Bubble). side (top/bottom) и align (start/end) задают позицию.',
      render: () => (
        <Bubble variant="default" align="end" style={{ maxWidth: 420, marginBottom: 16 }}>
          <BubbleContent>Отчёт отправлен на согласование.</BubbleContent>
          <BubbleReactions side="bottom" align="end">
            <span>👍 3</span>
          </BubbleReactions>
        </Bubble>
      ),
      code: `<Bubble variant="default" align="end">
  <BubbleContent>Отчёт отправлен на согласование.</BubbleContent>
  <BubbleReactions side="bottom" align="end">
    <span>👍 3</span>
  </BubbleReactions>
</Bubble>`,
    },
  ],
  props: [
    {
      name: 'BubbleGroup',
      type: 'div',
      description: 'Контейнер-стек сообщений (flex-колонка, gap-2). Держит выравнивание пузырей.',
    },
    {
      name: 'Bubble',
      type: 'div',
      description:
        'Обёртка одного пузыря: несёт variant (стиль вложенного BubbleContent) и align (сторона).',
    },
    {
      name: 'Bubble.variant',
      type: "'default' | 'secondary' | 'muted' | 'tinted' | 'outline' | 'ghost' | 'destructive'",
      default: 'default',
      description: 'Вариант стиля пузыря (применяется к BubbleContent через data-slot).',
    },
    {
      name: 'Bubble.align',
      type: "'start' | 'end'",
      default: 'start',
      description: 'Сторона: start — входящее (влево), end — исходящее (вправо).',
    },
    {
      name: 'BubbleContent',
      type: 'div',
      description:
        'Само тело пузыря: фон, скругление, паддинги, перенос слов. Здесь виден variant.',
    },
    {
      name: 'BubbleContent.asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Слить стили на дочерний элемент (Radix Slot) вместо <div> — напр. <button>/<a>.',
    },
    {
      name: 'BubbleReactions',
      type: 'div',
      description: 'Плавающая пилюля реакций поверх пузыря (absolute относительно Bubble).',
    },
    {
      name: 'BubbleReactions.side',
      type: "'top' | 'bottom'",
      default: 'bottom',
      description: 'Вертикальная привязка пилюли реакций к краю пузыря.',
    },
    {
      name: 'BubbleReactions.align',
      type: "'start' | 'end'",
      default: 'end',
      description: 'Горизонтальная привязка пилюли реакций (left-3 / right-3).',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает).',
    },
  ],
};
