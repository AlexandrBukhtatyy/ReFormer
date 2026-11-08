import { BubbleGroup, Bubble, BubbleContent, BubbleReactions } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Bubble — не поле формы: пузырь реплики чата (BubbleGroup / Bubble / BubbleContent /
 * BubbleReactions). Variants — оформление (variant) и сторона (align), Examples — диалог,
 * пузырь-кнопка и реакции, API — таблица props. Обёртка `<div style>` в render — рамка демо,
 * в `code` её нет.
 */
export const bubbleDocConfig: ComponentDocConfig = {
  name: 'Bubble',
  importFrom: '@reformer/ui-kit',
  description:
    'Пузырь реплики чата. Оформление — variant, сторона — align. Фон и отступы рисует BubbleContent.',
  variants: [
    {
      id: 'variants',
      title: 'Оформление (variant)',
      description:
        'variant: default / secondary / muted / tinted / outline / ghost / destructive. Цвет получает вложенный BubbleContent.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <BubbleGroup>
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
          </BubbleGroup>
        </div>
      ),
      code: `<BubbleGroup>
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
</BubbleGroup>`,
    },
    {
      id: 'align',
      title: 'Сторона (align)',
      description:
        'align="start" — пузырь у левого края, align="end" — у правого. Работает внутри колонки: BubbleGroup или MessageContent.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <BubbleGroup>
            <Bubble align="start" variant="muted">
              <BubbleContent>Входящая реплика — слева</BubbleContent>
            </Bubble>
            <Bubble align="end">
              <BubbleContent>Своя реплика — справа</BubbleContent>
            </Bubble>
          </BubbleGroup>
        </div>
      ),
      code: `<BubbleGroup>
  <Bubble align="start" variant="muted">
    <BubbleContent>Входящая реплика — слева</BubbleContent>
  </Bubble>
  <Bubble align="end">
    <BubbleContent>Своя реплика — справа</BubbleContent>
  </Bubble>
</BubbleGroup>`,
    },
  ],
  examples: [
    {
      id: 'conversation',
      title: 'Диалог',
      description:
        'BubbleGroup держит колонку пузырей с отступом. Реплики ассистента — слева (muted), пользователя — справа.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <BubbleGroup>
            <Bubble align="start" variant="muted">
              <BubbleContent>Чем могу помочь?</BubbleContent>
            </Bubble>
            <Bubble align="end">
              <BubbleContent>Собери форму заявки на кредит.</BubbleContent>
            </Bubble>
            <Bubble align="start" variant="muted">
              <BubbleContent>Готово — открываю мастер из четырёх шагов.</BubbleContent>
            </Bubble>
          </BubbleGroup>
        </div>
      ),
      code: `<BubbleGroup>
  <Bubble align="start" variant="muted">
    <BubbleContent>Чем могу помочь?</BubbleContent>
  </Bubble>
  <Bubble align="end">
    <BubbleContent>Собери форму заявки на кредит.</BubbleContent>
  </Bubble>
  <Bubble align="start" variant="muted">
    <BubbleContent>Готово — открываю мастер из четырёх шагов.</BubbleContent>
  </Bubble>
</BubbleGroup>`,
    },
    {
      id: 'as-child',
      title: 'Пузырь-кнопка (BubbleContent asChild)',
      description:
        'asChild отдаёт оформление BubbleContent дочернему элементу. С <button> пузырь получает подсветку при наведении и кольцо фокуса.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <BubbleGroup>
            <Bubble variant="secondary" align="end">
              <BubbleContent asChild>
                <button type="button" onClick={() => {}}>
                  Повторить запрос
                </button>
              </BubbleContent>
            </Bubble>
          </BubbleGroup>
        </div>
      ),
      code: `<BubbleGroup>
  <Bubble variant="secondary" align="end">
    <BubbleContent asChild>
      <button type="button" onClick={retry}>
        Повторить запрос
      </button>
    </BubbleContent>
  </Bubble>
</BubbleGroup>`,
    },
    {
      id: 'reactions',
      title: 'Реакции (BubbleReactions)',
      description:
        'BubbleReactions — плашка на краю пузыря. side (top / bottom) и align (start / end) выбирают угол.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420, paddingBottom: 16 }}>
          <BubbleGroup>
            <Bubble align="end">
              <BubbleContent>Отчёт отправлен на согласование.</BubbleContent>
              <BubbleReactions side="bottom" align="end">
                <span>👍 3</span>
              </BubbleReactions>
            </Bubble>
          </BubbleGroup>
        </div>
      ),
      code: `<BubbleGroup>
  <Bubble align="end">
    <BubbleContent>Отчёт отправлен на согласование.</BubbleContent>
    <BubbleReactions side="bottom" align="end">
      <span>👍 3</span>
    </BubbleReactions>
  </Bubble>
</BubbleGroup>`,
    },
  ],
  props: [
    {
      name: 'Bubble.variant',
      type: "'default' | 'secondary' | 'muted' | 'tinted' | 'outline' | 'ghost' | 'destructive'",
      default: "'default'",
      description:
        'Оформление пузыря. Цвет и рамку получает вложенный BubbleContent. ghost — без фона и отступов, на всю ширину.',
    },
    {
      name: 'Bubble.align',
      type: "'start' | 'end'",
      default: "'start'",
      description:
        'Край, к которому прижат пузырь. Действует внутри колонки (BubbleGroup, MessageContent). Внутри Message с align="end" пузырь встаёт вправо сам.',
    },
    {
      name: 'BubbleContent.asChild',
      type: 'boolean',
      default: 'false',
      description:
        'Отдать оформление дочернему элементу вместо <div>: например, <button> или <a> — тогда появляются наведение и кольцо фокуса.',
    },
    {
      name: 'BubbleReactions.side',
      type: "'top' | 'bottom'",
      default: "'bottom'",
      description: 'У какого края пузыря висит плашка реакций.',
    },
    {
      name: 'BubbleReactions.align',
      type: "'start' | 'end'",
      default: "'end'",
      description: 'Плашка у левого (start) или правого (end) угла пузыря.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
