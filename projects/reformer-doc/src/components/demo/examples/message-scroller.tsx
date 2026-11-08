import { useRef, useState } from 'react';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
} from '@reformer/ui-kit/message-scroller';
import { Bubble, BubbleContent, Button, Message, MessageContent } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * MessageScroller — не поле формы: прокручиваемая лента сообщений чата поверх
 * `@shadcn/react/message-scroller` (Provider / MessageScroller / Viewport / Content / Item /
 * Button и хуки). Variants — базовая лента и кнопки перехода к краю, Examples — новая реплика
 * с якорем и прокрутка из кода, API — таблица props. Обёртка `<div style>` с рамкой в render —
 * рамка демо, в `code` её нет. `className="left-1/2"` у кнопки — обход класса `inset-s-1/2`,
 * которого нет в Tailwind 4.1 (см. страницу компонента).
 */

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

const dialog: ChatMessage[] = [
  { id: 'm1', role: 'assistant', text: 'Здравствуйте! Чем помочь с заявкой?' },
  { id: 'm2', role: 'user', text: 'Нужен кредит на автомобиль.' },
  { id: 'm3', role: 'assistant', text: 'На какую сумму и срок рассчитываете?' },
  { id: 'm4', role: 'user', text: 'Полтора миллиона на три года.' },
  { id: 'm5', role: 'assistant', text: 'Принято. Собираю форму из четырёх шагов.' },
  { id: 'm6', role: 'user', text: 'Отлично, спасибо.' },
  { id: 'm7', role: 'assistant', text: 'Готово. Открываю первый шаг: параметры кредита.' },
];

const frame = { border: '1px solid var(--border)', borderRadius: 8 } as const;

function ChatLine({ message }: { message: ChatMessage }) {
  return (
    <Message align={message.role === 'user' ? 'end' : 'start'}>
      <MessageContent>
        <Bubble variant={message.role === 'user' ? 'default' : 'muted'}>
          <BubbleContent>{message.text}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}

// Новая реплика пользователя — якорь: лента ставит её к верхнему краю, ответ появляется ниже.
function AnchoredChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(dialog.slice(0, 3));
  const nextId = useRef(0);

  const ask = () => {
    const id = ++nextId.current;
    setMessages((prev) => [...prev, { id: `q${id}`, role: 'user', text: `Вопрос №${id}` }]);
    // Вместо запроса к модели — задержка: пример работает прямо в браузере.
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: `a${id}`, role: 'assistant', text: `Ответ на вопрос №${id}.` },
      ]);
    }, 600);
  };

  return (
    <div
      style={{
        width: '100%',
        maxWidth: 480,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      <div style={{ ...frame, alignSelf: 'stretch' }}>
        <MessageScrollerProvider autoScroll>
          <MessageScroller style={{ height: 240 }}>
            <MessageScrollerViewport aria-label="Переписка">
              <MessageScrollerContent className="gap-3 p-3">
                {messages.map((m) => (
                  <MessageScrollerItem key={m.id} messageId={m.id} scrollAnchor={m.role === 'user'}>
                    <ChatLine message={m} />
                  </MessageScrollerItem>
                ))}
              </MessageScrollerContent>
            </MessageScrollerViewport>
            <MessageScrollerButton className="left-1/2" />
          </MessageScroller>
        </MessageScrollerProvider>
      </div>
      <Button onClick={ask}>Задать вопрос</Button>
    </div>
  );
}

// Хуки работают только внутри MessageScrollerProvider.
function ScrollControls() {
  const { scrollToStart, scrollToEnd } = useMessageScroller();
  const scrollable = useMessageScrollerScrollable();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button
        size="sm"
        variant="outline"
        disabled={!scrollable.start}
        onClick={() => scrollToStart()}
      >
        В начало
      </Button>
      <Button size="sm" variant="outline" disabled={!scrollable.end} onClick={() => scrollToEnd()}>
        В конец
      </Button>
    </div>
  );
}

function ImperativeScroll() {
  return (
    <div style={{ width: '100%', maxWidth: 480 }}>
      <MessageScrollerProvider>
        <div style={{ display: 'grid', gap: 12 }}>
          <ScrollControls />
          <div style={frame}>
            <MessageScroller style={{ height: 200 }}>
              <MessageScrollerViewport aria-label="Переписка">
                <MessageScrollerContent className="gap-3 p-3">
                  {dialog.map((m) => (
                    <MessageScrollerItem key={m.id} messageId={m.id}>
                      <ChatLine message={m} />
                    </MessageScrollerItem>
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
            </MessageScroller>
          </div>
        </div>
      </MessageScrollerProvider>
    </div>
  );
}

const chatLineCode = `type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

// dialog: ChatMessage[] — сообщения переписки
function ChatLine({ message }: { message: ChatMessage }) {
  return (
    <Message align={message.role === 'user' ? 'end' : 'start'}>
      <MessageContent>
        <Bubble variant={message.role === 'user' ? 'default' : 'muted'}>
          <BubbleContent>{message.text}</BubbleContent>
        </Bubble>
      </MessageContent>
    </Message>
  );
}`;

export const messageScrollerDocConfig: ComponentDocConfig = {
  name: 'MessageScroller',
  importFrom: '@reformer/ui-kit/message-scroller',
  description:
    'Прокручиваемая лента сообщений чата: открывается с конца, держит позицию при подгрузке и даёт кнопку перехода к краю.',
  variants: [
    {
      id: 'basic',
      title: 'Лента сообщений',
      description:
        'Provider → MessageScroller → Viewport → Content → Item. Высоту задаёт MessageScroller (или его родитель). По умолчанию лента открывается с конца.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480, ...frame }}>
          <MessageScrollerProvider>
            <MessageScroller style={{ height: 240 }}>
              <MessageScrollerViewport aria-label="Переписка">
                <MessageScrollerContent className="gap-3 p-3">
                  {dialog.map((m) => (
                    <MessageScrollerItem key={m.id} messageId={m.id}>
                      <ChatLine message={m} />
                    </MessageScrollerItem>
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
            </MessageScroller>
          </MessageScrollerProvider>
        </div>
      ),
      code: `${chatLineCode}

<MessageScrollerProvider>
  <MessageScroller style={{ height: 240 }}>
    <MessageScrollerViewport aria-label="Переписка">
      <MessageScrollerContent className="gap-3 p-3">
        {dialog.map((m) => (
          <MessageScrollerItem key={m.id} messageId={m.id}>
            <ChatLine message={m} />
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
  </MessageScroller>
</MessageScrollerProvider>`,
    },
    {
      id: 'scroll-buttons',
      title: 'Кнопки перехода к краю',
      description:
        'MessageScrollerButton появляется, только когда к своему краю есть куда прокручивать. direction="end" — вниз, "start" — вверх. Здесь лента открывается с начала (defaultScrollPosition="start").',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480, ...frame }}>
          <MessageScrollerProvider defaultScrollPosition="start">
            <MessageScroller style={{ height: 240 }}>
              <MessageScrollerViewport aria-label="Переписка">
                <MessageScrollerContent className="gap-3 p-3">
                  {dialog.map((m) => (
                    <MessageScrollerItem key={m.id} messageId={m.id}>
                      <ChatLine message={m} />
                    </MessageScrollerItem>
                  ))}
                </MessageScrollerContent>
              </MessageScrollerViewport>
              <MessageScrollerButton direction="start" className="left-1/2" />
              <MessageScrollerButton direction="end" className="left-1/2" />
            </MessageScroller>
          </MessageScrollerProvider>
        </div>
      ),
      code: `<MessageScrollerProvider defaultScrollPosition="start">
  <MessageScroller style={{ height: 240 }}>
    <MessageScrollerViewport aria-label="Переписка">
      <MessageScrollerContent className="gap-3 p-3">
        {dialog.map((m) => (
          <MessageScrollerItem key={m.id} messageId={m.id}>
            <ChatLine message={m} />
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
    <MessageScrollerButton direction="start" className="left-1/2" />
    <MessageScrollerButton direction="end" className="left-1/2" />
  </MessageScroller>
</MessageScrollerProvider>`,
    },
  ],
  examples: [
    {
      id: 'anchored-question',
      title: 'Новый вопрос — к верхнему краю (scrollAnchor)',
      description:
        'Реплики пользователя помечены scrollAnchor. Новая такая реплика встаёт к верхнему краю ленты, а ответ появляется под ней. autoScroll держит ленту у конца, пока её не прокрутили вручную.',
      render: AnchoredChat,
      code: `function AnchoredChat() {
  const [messages, setMessages] = useState<ChatMessage[]>(dialog.slice(0, 3));
  const nextId = useRef(0);

  const ask = () => {
    const id = ++nextId.current;
    setMessages((prev) => [...prev, { id: \`q\${id}\`, role: 'user', text: \`Вопрос №\${id}\` }]);
    // Вместо запроса к модели — задержка: пример работает прямо в браузере.
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: \`a\${id}\`, role: 'assistant', text: \`Ответ на вопрос №\${id}.\` },
      ]);
    }, 600);
  };

  return (
    <>
      <MessageScrollerProvider autoScroll>
        <MessageScroller style={{ height: 240 }}>
          <MessageScrollerViewport aria-label="Переписка">
            <MessageScrollerContent className="gap-3 p-3">
              {messages.map((m) => (
                <MessageScrollerItem key={m.id} messageId={m.id} scrollAnchor={m.role === 'user'}>
                  <ChatLine message={m} />
                </MessageScrollerItem>
              ))}
            </MessageScrollerContent>
          </MessageScrollerViewport>
          <MessageScrollerButton className="left-1/2" />
        </MessageScroller>
      </MessageScrollerProvider>
      <Button onClick={ask}>Задать вопрос</Button>
    </>
  );
}`,
    },
    {
      id: 'imperative-scroll',
      title: 'Прокрутка из кода (хуки)',
      description:
        'useMessageScroller даёт scrollToStart / scrollToEnd / scrollToMessage, useMessageScrollerScrollable — есть ли куда прокручивать. Оба хука работают внутри MessageScrollerProvider.',
      render: ImperativeScroll,
      code: `function ScrollControls() {
  const { scrollToStart, scrollToEnd } = useMessageScroller();
  const scrollable = useMessageScrollerScrollable();
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <Button size="sm" variant="outline" disabled={!scrollable.start} onClick={() => scrollToStart()}>
        В начало
      </Button>
      <Button size="sm" variant="outline" disabled={!scrollable.end} onClick={() => scrollToEnd()}>
        В конец
      </Button>
    </div>
  );
}

<MessageScrollerProvider>
  <ScrollControls />
  <MessageScroller style={{ height: 200 }}>
    <MessageScrollerViewport aria-label="Переписка">
      <MessageScrollerContent className="gap-3 p-3">
        {dialog.map((m) => (
          <MessageScrollerItem key={m.id} messageId={m.id}>
            <ChatLine message={m} />
          </MessageScrollerItem>
        ))}
      </MessageScrollerContent>
    </MessageScrollerViewport>
  </MessageScroller>
</MessageScrollerProvider>`,
    },
  ],
  props: [
    {
      name: 'Provider.autoScroll',
      type: 'boolean',
      default: 'false',
      description:
        'Держать ленту у конца, когда содержимое растёт (новые сообщения, потоковый ответ), — пока пользователь не прокрутил её сам.',
    },
    {
      name: 'Provider.defaultScrollPosition',
      type: "'start' | 'end' | 'last-anchor'",
      default: "'end'",
      description:
        'Где открыть ленту при первом показе: в начале, в конце или у последнего элемента с scrollAnchor.',
    },
    {
      name: 'Provider.scrollEdgeThreshold',
      type: 'number',
      default: '8',
      description:
        'Сколько пикселей до края считаются «у края». От этого зависят useMessageScrollerScrollable и показ кнопок.',
    },
    {
      name: 'Provider.scrollPreviousItemPeek',
      type: 'number',
      default: '64',
      description:
        'Сколько пикселей предыдущего сообщения оставить видимыми, когда якорь ставится к верхнему краю.',
    },
    {
      name: 'Provider.scrollMargin',
      type: 'number',
      default: '0',
      description: 'Отступ от верхнего края при прокрутке к сообщению.',
    },
    {
      name: 'Viewport.aria-label',
      type: 'string',
      default: "'Messages'",
      description:
        'Подпись области прокрутки для скринридера. Кит её не переводит — задайте на языке интерфейса.',
    },
    {
      name: 'Viewport.preserveScrollOnPrepend',
      type: 'boolean',
      default: 'true',
      description: 'Не сдвигать видимое при добавлении сообщений в начало (подгрузка истории).',
    },
    {
      name: 'Item.messageId',
      type: 'string',
      description:
        'Идентификатор сообщения. Нужен для scrollToMessage и useMessageScrollerVisibility.',
    },
    {
      name: 'Item.scrollAnchor',
      type: 'boolean',
      default: 'false',
      description:
        'Якорь: когда такой элемент добавляется, лента ставит его к верхнему краю. Обычно — реплика пользователя.',
    },
    {
      name: 'Button.direction',
      type: "'start' | 'end'",
      default: "'end'",
      description: 'К какому краю ведёт кнопка: end — к последнему сообщению, start — к первому.',
    },
    {
      name: 'Button.variant',
      type: 'ButtonProps["variant"]',
      default: "'secondary'",
      description: 'Вид кнопки — те же значения, что у Button.',
    },
    {
      name: 'Button.size',
      type: 'ButtonProps["size"]',
      default: "'icon-sm'",
      description: 'Размер кнопки — те же значения, что у Button.',
    },
    {
      name: 'Button.children',
      type: 'ReactNode',
      description:
        'Содержимое кнопки. По умолчанию — стрелка и скрытая подпись из локали кита. Свои children заменяют и то и другое.',
    },
    {
      name: 'useMessageScroller()',
      type: '{ scrollToStart, scrollToEnd, scrollToMessage }',
      description:
        'Прокрутка из кода. Каждая функция принимает { align, behavior, scrollMargin }, scrollToMessage — ещё messageId.',
    },
    {
      name: 'useMessageScrollerScrollable()',
      type: '{ start: boolean; end: boolean }',
      description: 'Есть ли куда прокручивать вверх и вниз — для своих индикаторов и кнопок.',
    },
    {
      name: 'useMessageScrollerVisibility()',
      type: '{ currentAnchorId: string | null; visibleMessageIds: string[] }',
      description:
        'Какие сообщения сейчас видны (по messageId) и какой якорь у верхнего края — для отметок «прочитано».',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
  ],
};
