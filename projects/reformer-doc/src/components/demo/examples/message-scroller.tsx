import { useState } from 'react';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
} from '@reformer/ui-kit/message-scroller';
import { Bubble, BubbleContent, Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * MessageScroller — не form-control: AI-контейнер авто-скролла списка сообщений (compound
 * поверх headless-примитива @shadcn/react/message-scroller). Части: MessageScrollerProvider /
 * MessageScroller (Root) / MessageScrollerViewport / MessageScrollerContent / MessageScrollerItem /
 * MessageScrollerButton, плюс behaviour-хуки (useMessageScroller и др.). Таб Variants — базовая
 * компоновка и кнопка «вниз»; Examples — диалог и императивный скролл через хук. Form-bound таба (api) нет.
 */

// Демо-контент: короткий диалог ассистент/пользователь.
const demoDialog: { role: 'assistant' | 'user'; text: string }[] = [
  { role: 'assistant', text: 'Привет! Чем могу помочь с заявкой?' },
  { role: 'user', text: 'Нужен кредит на автомобиль.' },
  { role: 'assistant', text: 'Хорошо. На какой срок и какую сумму рассчитываете?' },
  { role: 'user', text: 'Полтора миллиона на три года.' },
  { role: 'assistant', text: 'Принято — собираю форму из четырёх шагов.' },
  { role: 'user', text: 'Отлично, спасибо.' },
  { role: 'assistant', text: 'Готово. Открываю первый шаг: параметры кредита.' },
];

function DialogItems() {
  return (
    <>
      {demoDialog.map((m, i) => (
        <MessageScrollerItem key={i} scrollAnchor={i === demoDialog.length - 1}>
          <Bubble
            align={m.role === 'user' ? 'end' : 'start'}
            variant={m.role === 'user' ? 'default' : 'muted'}
          >
            <BubbleContent>{m.text}</BubbleContent>
          </Bubble>
        </MessageScrollerItem>
      ))}
    </>
  );
}

// Императивный скролл: кнопка-отправка добавляет сообщение и прокручивает вниз через хук.
function SendButton({ onSend }: { onSend: () => void }) {
  const { scrollToEnd } = useMessageScroller();
  return (
    <Button
      type="button"
      onClick={() => {
        onSend();
        // даём разметке обновиться, затем скроллим к последнему сообщению
        requestAnimationFrame(() => scrollToEnd({ behavior: 'smooth' }));
      }}
    >
      Отправить сообщение
    </Button>
  );
}

function ImperativeDemo() {
  const [messages, setMessages] = useState<string[]>([
    'Первое сообщение',
    'Второе сообщение',
    'Третье сообщение',
  ]);
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 480 }}
    >
      <MessageScrollerProvider>
        <div style={{ height: 220, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)' }}>
          <MessageScroller>
            <MessageScrollerViewport>
              <MessageScrollerContent style={{ gap: '0.75rem', padding: '0.75rem' }}>
                {messages.map((text, i) => (
                  <MessageScrollerItem key={i} scrollAnchor={i === messages.length - 1}>
                    <Bubble align="start" variant="muted">
                      <BubbleContent>{text}</BubbleContent>
                    </Bubble>
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton direction="end" />
          </MessageScroller>
        </div>
        <SendButton
          onSend={() => setMessages((prev) => [...prev, `Новое сообщение #${prev.length + 1}`])}
        />
      </MessageScrollerProvider>
    </div>
  );
}

export const messageScrollerDocConfig: ComponentDocConfig = {
  name: 'MessageScroller',
  importFrom: '@reformer/ui-kit',
  description:
    'Авто-скроллящийся контейнер списка сообщений на shadcn / headless-примитиве @shadcn/react/message-scroller. Compound: MessageScrollerProvider / MessageScroller / MessageScrollerViewport / MessageScrollerContent / MessageScrollerItem / MessageScrollerButton. Provider держит поведение (авто-скролл, привязку к якорю, отслеживание видимости), а хук useMessageScroller даёт императивный скролл.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая компоновка',
      description:
        'Минимальный стек: Provider → MessageScroller → Viewport → Content → Item. Viewport берёт на себя overflow, поэтому контейнеру нужна фиксированная высота. Последнему сообщению ставится scrollAnchor — на него ориентируется авто-скролл.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <MessageScrollerProvider>
            <div
              style={{ height: 240, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)' }}
            >
              <MessageScroller>
                <MessageScrollerViewport>
                  <MessageScrollerContent style={{ gap: '0.75rem', padding: '0.75rem' }}>
                    <DialogItems />
                  </MessageScrollerContent>
                </MessageScrollerViewport>
              </MessageScroller>
            </div>
          </MessageScrollerProvider>
        </div>
      ),
      code: `<MessageScrollerProvider>
  <div style={{ height: 240 }}>
    <MessageScroller>
      <MessageScrollerViewport>
        <MessageScrollerContent>
          {messages.map((m, i) => (
            <MessageScrollerItem key={i} scrollAnchor={i === messages.length - 1}>
              <Bubble align={m.role === 'user' ? 'end' : 'start'}>
                <BubbleContent>{m.text}</BubbleContent>
              </Bubble>
            </MessageScrollerItem>
          ))}
        </MessageScrollerContent>
      </MessageScrollerViewport>
    </MessageScroller>
  </div>
</MessageScrollerProvider>`,
    },
    {
      id: 'scroll-button',
      title: 'Кнопка «прокрутить вниз»',
      description:
        'MessageScrollerButton — плавающая кнопка внутри MessageScroller. Появляется, когда список прокручен вверх (data-active), и уводит к последнему сообщению. direction="end" — вниз, "start" — вверх. Стиль берётся у Button (variant/size).',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <MessageScrollerProvider defaultScrollPosition="start">
            <div
              style={{ height: 240, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)' }}
            >
              <MessageScroller>
                <MessageScrollerViewport>
                  <MessageScrollerContent style={{ gap: '0.75rem', padding: '0.75rem' }}>
                    <DialogItems />
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton direction="end" />
              </MessageScroller>
            </div>
          </MessageScrollerProvider>
        </div>
      ),
      code: `<MessageScroller>
  <MessageScrollerViewport>
    <MessageScrollerContent>{/* items */}</MessageScrollerContent>
  </MessageScrollerViewport>
  <MessageScrollerButton direction="end" />
</MessageScroller>`,
    },
  ],
  examples: [
    {
      id: 'chat-log',
      title: 'Лог чата (диалог + Bubble)',
      description:
        'Типовой сценарий: сообщения ассистента (слева, muted) и пользователя (справа, default) в авто-скролл-контейнере. Каждое сообщение — MessageScrollerItem с Bubble внутри; кнопка «вниз» возвращает к концу переписки.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <MessageScrollerProvider>
            <div
              style={{ height: 260, borderRadius: 8, border: '1px solid var(--border, #e5e7eb)' }}
            >
              <MessageScroller>
                <MessageScrollerViewport>
                  <MessageScrollerContent style={{ gap: '0.75rem', padding: '0.75rem' }}>
                    <DialogItems />
                  </MessageScrollerContent>
                </MessageScrollerViewport>
                <MessageScrollerButton direction="end" />
              </MessageScroller>
            </div>
          </MessageScrollerProvider>
        </div>
      ),
      code: `<MessageScrollerProvider>
  <div style={{ height: 260 }}>
    <MessageScroller>
      <MessageScrollerViewport>
        <MessageScrollerContent>
          {dialog.map((m, i) => (
            <MessageScrollerItem key={i} scrollAnchor={i === dialog.length - 1}>
              <Bubble align={m.role === 'user' ? 'end' : 'start'} variant={m.role === 'user' ? 'default' : 'muted'}>
                <BubbleContent>{m.text}</BubbleContent>
              </Bubble>
            </MessageScrollerItem>
          ))}
        </MessageScrollerContent>
      </MessageScrollerViewport>
      <MessageScrollerButton direction="end" />
    </MessageScroller>
  </div>
</MessageScrollerProvider>`,
    },
    {
      id: 'imperative-scroll',
      title: 'Императивный скролл (useMessageScroller)',
      description:
        'Хук useMessageScroller() из-под Provider даёт scrollToEnd / scrollToStart / scrollToMessage. Здесь кнопка добавляет сообщение и вручную прокручивает контейнер вниз к новому сообщению.',
      render: ImperativeDemo,
      code: `function SendButton({ onSend }: { onSend: () => void }) {
  const { scrollToEnd } = useMessageScroller();
  return (
    <Button
      onClick={() => {
        onSend();
        requestAnimationFrame(() => scrollToEnd({ behavior: 'smooth' }));
      }}
    >
      Отправить сообщение
    </Button>
  );
}

<MessageScrollerProvider>
  <MessageScroller>{/* viewport + content + items */}</MessageScroller>
  <SendButton onSend={appendMessage} />
</MessageScrollerProvider>`,
    },
  ],
  props: [
    {
      name: 'MessageScrollerProvider',
      type: 'component',
      description:
        'Контекст поведения (без своего DOM): авто-скролл, привязка к якорю, отслеживание видимых сообщений. Оборачивает весь блок скроллера.',
    },
    {
      name: 'MessageScrollerProvider.autoScroll',
      type: 'boolean',
      default: 'true',
      description:
        'Автоматически удерживать прокрутку у последнего сообщения при добавлении новых (пока пользователь внизу).',
    },
    {
      name: 'MessageScrollerProvider.defaultScrollPosition',
      type: "'start' | 'end' | 'last-anchor'",
      description: 'Начальная позиция скролла при монтировании.',
    },
    {
      name: 'MessageScrollerProvider.scrollEdgeThreshold',
      type: 'number',
      description:
        'Порог (px) близости к краю, при котором список считается «внизу» (влияет на авто-скролл и активность кнопки).',
    },
    {
      name: 'MessageScroller',
      type: 'div',
      description:
        'Корневой контейнер (relative, flex-колонка, overflow-hidden). Позиционирует плавающую MessageScrollerButton.',
    },
    {
      name: 'MessageScrollerViewport',
      type: 'div',
      description:
        'Прокручиваемая область (overflow-y-auto, role="region"). Контейнеру-родителю нужна фиксированная высота.',
    },
    {
      name: 'MessageScrollerContent',
      type: 'div',
      description:
        'Внутренний стек сообщений (role="log", flex-колонка). Держит вертикальные отступы между Item.',
    },
    {
      name: 'MessageScrollerItem',
      type: 'div',
      description:
        'Обёртка одного сообщения (content-visibility для длинных списков). Внутрь кладётся любой контент — напр. Bubble.',
    },
    {
      name: 'MessageScrollerItem.scrollAnchor',
      type: 'boolean',
      default: 'false',
      description:
        'Пометить сообщение якорем скролла (обычно — последнее). На него ориентируется авто-скролл.',
    },
    {
      name: 'MessageScrollerButton',
      type: 'button',
      description:
        'Плавающая кнопка перехода к краю переписки. Активна (data-active) при отходе от края.',
    },
    {
      name: 'MessageScrollerButton.direction',
      type: "'start' | 'end'",
      default: 'end',
      description: 'Куда ведёт: end — к последнему сообщению (низ), start — к первому (верх).',
    },
    {
      name: 'MessageScrollerButton.variant / size',
      type: 'Button variant / size',
      default: 'secondary / icon-sm',
      description: 'Стиль кнопки (наследуется у Button из ui-kit).',
    },
    {
      name: 'useMessageScroller()',
      type: '() => { scrollToEnd; scrollToStart; scrollToMessage }',
      description: 'Императивный скролл из-под Provider (behaviour-хук).',
    },
    {
      name: 'useMessageScrollerScrollable()',
      type: '() => { start: boolean; end: boolean }',
      description: 'Есть ли куда скроллить вверх/вниз (для собственных индикаторов).',
    },
    {
      name: 'useMessageScrollerVisibility()',
      type: '() => { currentAnchorId; visibleMessageIds }',
      description: 'Текущий якорь и id видимых сообщений (для «прочитано»/подгрузки).',
    },
  ],
};
