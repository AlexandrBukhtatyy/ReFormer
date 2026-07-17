import {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Message — не form-control: презентационный compound для чата с ИИ (MessageGroup /
 * Message / MessageAvatar / MessageContent / MessageHeader / MessageFooter). Таб Variants
 * показывает выравнивание (assistant слева / user справа) и наличие аватара, Examples —
 * рецепт целого треда, props — таблица.
 */
export const messageDocConfig: ComponentDocConfig = {
  name: 'Message',
  importFrom: '@reformer/ui-kit',
  description:
    'Сообщение чата с ИИ на shadcn. Compound-набор: MessageGroup / Message / MessageAvatar / MessageContent / MessageHeader / MessageFooter. Сторона реплики — через align ("start" | "end").',
  variants: [
    {
      id: 'assistant',
      title: 'Реплика ассистента (align="start")',
      description:
        'align="start" (по умолчанию) — сообщение выравнивается к началу строки. С аватаром и заголовком-ролью.',
      render: () => (
        <Message align="start" style={{ maxWidth: 480 }}>
          <MessageAvatar>ИИ</MessageAvatar>
          <MessageContent>
            <MessageHeader>Ассистент</MessageHeader>
            Готов помочь. Опишите задачу — предложу решение.
          </MessageContent>
        </Message>
      ),
      code: `<Message align="start">
  <MessageAvatar>ИИ</MessageAvatar>
  <MessageContent>
    <MessageHeader>Ассистент</MessageHeader>
    Готов помочь. Опишите задачу — предложу решение.
  </MessageContent>
</Message>`,
    },
    {
      id: 'user',
      title: 'Реплика пользователя (align="end")',
      description:
        'align="end" — сообщение выравнивается к концу строки (порядок аватар/контент разворачивается).',
      render: () => (
        <Message align="end" style={{ maxWidth: 480 }}>
          <MessageContent>Собери форму заявки на кредит.</MessageContent>
        </Message>
      ),
      code: `<Message align="end">
  <MessageContent>Собери форму заявки на кредит.</MessageContent>
</Message>`,
    },
    {
      id: 'with-footer',
      title: 'С футером (метаданные)',
      description:
        'MessageFooter под контентом — для времени, статуса доставки или подписи. Аватар автоматически поднимается.',
      render: () => (
        <Message align="start" style={{ maxWidth: 480 }}>
          <MessageAvatar>ИИ</MessageAvatar>
          <MessageContent>
            <MessageHeader>Ассистент</MessageHeader>
            Форма готова — проверьте поля перед отправкой.
            <MessageFooter>14:32 · доставлено</MessageFooter>
          </MessageContent>
        </Message>
      ),
      code: `<Message align="start">
  <MessageAvatar>ИИ</MessageAvatar>
  <MessageContent>
    <MessageHeader>Ассистент</MessageHeader>
    Форма готова — проверьте поля перед отправкой.
    <MessageFooter>14:32 · доставлено</MessageFooter>
  </MessageContent>
</Message>`,
    },
  ],
  examples: [
    {
      id: 'thread',
      title: 'Диалог (тред)',
      description:
        'MessageGroup собирает несколько реплик в вертикальный тред: пользователь справа, ассистент слева.',
      render: () => (
        <MessageGroup style={{ width: '100%', maxWidth: 480 }}>
          <Message align="end">
            <MessageContent>Какой сегодня курс евро?</MessageContent>
          </Message>
          <Message align="start">
            <MessageAvatar>ИИ</MessageAvatar>
            <MessageContent>
              <MessageHeader>Ассистент</MessageHeader>
              Сейчас около 105 ₽ за евро. Нужен график за месяц?
            </MessageContent>
          </Message>
          <Message align="end">
            <MessageContent>Да, покажи график.</MessageContent>
          </Message>
        </MessageGroup>
      ),
      code: `<MessageGroup>
  <Message align="end">
    <MessageContent>Какой сегодня курс евро?</MessageContent>
  </Message>
  <Message align="start">
    <MessageAvatar>ИИ</MessageAvatar>
    <MessageContent>
      <MessageHeader>Ассистент</MessageHeader>
      Сейчас около 105 ₽ за евро. Нужен график за месяц?
    </MessageContent>
  </Message>
  <Message align="end">
    <MessageContent>Да, покажи график.</MessageContent>
  </Message>
</MessageGroup>`,
    },
  ],
  props: [
    {
      name: 'align (Message)',
      type: "'start' | 'end'",
      default: "'start'",
      description:
        'Сторона реплики: "start" — ассистент (слева), "end" — пользователь (справа, порядок под-частей разворачивается).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы на любой под-части (tailwind-merge — класс вызывающего перекрывает).',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description:
        'Содержимое под-части. MessageAvatar принимает аватар/инициалы, MessageContent — текст реплики и вложенные Header/Footer.',
    },
    {
      name: '...props (div)',
      type: 'React.ComponentProps<"div">',
      description:
        'Все под-части — обычные <div>; принимают любые HTML-атрибуты (data-testid, style, aria-*, onClick).',
    },
  ],
};
