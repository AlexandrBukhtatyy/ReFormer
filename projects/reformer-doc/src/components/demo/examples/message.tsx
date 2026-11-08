import {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
  Avatar,
  AvatarFallback,
  Bubble,
  BubbleContent,
  Attachment,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentContent,
  AttachmentTitle,
  Marker,
  MarkerIcon,
  MarkerContent,
} from '@reformer/ui-kit';
import { FileText, Sparkles } from 'lucide-react';
import type { ComponentDocConfig } from '../types';

/**
 * Message — не поле формы: строка сообщения чата (MessageGroup / Message / MessageAvatar /
 * MessageContent / MessageHeader / MessageFooter). Внутрь MessageContent кладут Bubble,
 * Attachment, Marker. Variants — сторона и подвал, Examples — тред и сообщение с вложениями,
 * API — таблица props. Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */
export const messageDocConfig: ComponentDocConfig = {
  name: 'Message',
  importFrom: '@reformer/ui-kit',
  description:
    'Строка сообщения чата: аватар, заголовок, содержимое и подвал. Сторону задаёт align ("start" | "end").',
  variants: [
    {
      id: 'assistant',
      title: 'Ответ ассистента (align="start")',
      description:
        'align="start" — по умолчанию: аватар слева, содержимое справа от него. MessageHeader подписывает автора.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Message align="start">
            <MessageAvatar>
              <Avatar>
                <AvatarFallback>ИИ</AvatarFallback>
              </Avatar>
            </MessageAvatar>
            <MessageContent>
              <MessageHeader>Ассистент</MessageHeader>
              <Bubble variant="muted">
                <BubbleContent>Опишите задачу — предложу решение.</BubbleContent>
              </Bubble>
            </MessageContent>
          </Message>
        </div>
      ),
      code: `<Message align="start">
  <MessageAvatar>
    <Avatar>
      <AvatarFallback>ИИ</AvatarFallback>
    </Avatar>
  </MessageAvatar>
  <MessageContent>
    <MessageHeader>Ассистент</MessageHeader>
    <Bubble variant="muted">
      <BubbleContent>Опишите задачу — предложу решение.</BubbleContent>
    </Bubble>
  </MessageContent>
</Message>`,
    },
    {
      id: 'user',
      title: 'Своя реплика (align="end")',
      description:
        'align="end" зеркалит строку: аватар справа, содержимое и пузыри прижаты к правому краю.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Message align="end">
            <MessageContent>
              <Bubble>
                <BubbleContent>Собери форму заявки на кредит.</BubbleContent>
              </Bubble>
            </MessageContent>
          </Message>
        </div>
      ),
      code: `<Message align="end">
  <MessageContent>
    <Bubble>
      <BubbleContent>Собери форму заявки на кредит.</BubbleContent>
    </Bubble>
  </MessageContent>
</Message>`,
    },
    {
      id: 'with-footer',
      title: 'С подвалом (MessageFooter)',
      description:
        'MessageFooter под содержимым — время, статус доставки. Аватар поднимается к последнему пузырю.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <Message align="start">
            <MessageAvatar>
              <Avatar>
                <AvatarFallback>ИИ</AvatarFallback>
              </Avatar>
            </MessageAvatar>
            <MessageContent>
              <Bubble variant="muted">
                <BubbleContent>Форма готова — проверьте поля перед отправкой.</BubbleContent>
              </Bubble>
              <MessageFooter>14:32 · доставлено</MessageFooter>
            </MessageContent>
          </Message>
        </div>
      ),
      code: `<Message align="start">
  <MessageAvatar>
    <Avatar>
      <AvatarFallback>ИИ</AvatarFallback>
    </Avatar>
  </MessageAvatar>
  <MessageContent>
    <Bubble variant="muted">
      <BubbleContent>Форма готова — проверьте поля перед отправкой.</BubbleContent>
    </Bubble>
    <MessageFooter>14:32 · доставлено</MessageFooter>
  </MessageContent>
</Message>`,
    },
  ],
  examples: [
    {
      id: 'thread',
      title: 'Тред',
      description:
        'MessageGroup ставит сообщения колонкой с отступом. Реплики пользователя справа, ассистента слева.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <MessageGroup>
            <Message align="end">
              <MessageContent>
                <Bubble>
                  <BubbleContent>Какой срок кредита выбрать?</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
            <Message align="start">
              <MessageAvatar>
                <Avatar>
                  <AvatarFallback>ИИ</AvatarFallback>
                </Avatar>
              </MessageAvatar>
              <MessageContent>
                <MessageHeader>Ассистент</MessageHeader>
                <Bubble variant="muted">
                  <BubbleContent>Три года — платёж ниже, переплата умеренная.</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
            <Message align="end">
              <MessageContent>
                <Bubble>
                  <BubbleContent>Тогда три года.</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          </MessageGroup>
        </div>
      ),
      code: `<MessageGroup>
  <Message align="end">
    <MessageContent>
      <Bubble>
        <BubbleContent>Какой срок кредита выбрать?</BubbleContent>
      </Bubble>
    </MessageContent>
  </Message>
  <Message align="start">
    <MessageAvatar>
      <Avatar>
        <AvatarFallback>ИИ</AvatarFallback>
      </Avatar>
    </MessageAvatar>
    <MessageContent>
      <MessageHeader>Ассистент</MessageHeader>
      <Bubble variant="muted">
        <BubbleContent>Три года — платёж ниже, переплата умеренная.</BubbleContent>
      </Bubble>
    </MessageContent>
  </Message>
  <Message align="end">
    <MessageContent>
      <Bubble>
        <BubbleContent>Тогда три года.</BubbleContent>
      </Bubble>
    </MessageContent>
  </Message>
</MessageGroup>`,
    },
    {
      id: 'composite',
      title: 'Сообщение с вложениями и статусом',
      description:
        'В MessageContent складываются другие AI-примитивы: лента Attachment, строка Marker и пузырь. С align="end" они прижимаются вправо сами.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 480 }}>
          <MessageGroup>
            <Message align="end">
              <MessageContent>
                <AttachmentGroup>
                  <Attachment size="sm">
                    <AttachmentMedia>
                      <FileText />
                    </AttachmentMedia>
                    <AttachmentContent>
                      <AttachmentTitle>справка.pdf</AttachmentTitle>
                    </AttachmentContent>
                  </Attachment>
                </AttachmentGroup>
                <Bubble>
                  <BubbleContent>Проверь, подходит ли справка.</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
            <Message align="start">
              <MessageContent>
                <Marker>
                  <MarkerIcon>
                    <Sparkles />
                  </MarkerIcon>
                  <MarkerContent>Ассистент читает справка.pdf</MarkerContent>
                </Marker>
                <Bubble variant="ghost">
                  <BubbleContent>Справка подходит: выдана меньше 30 дней назад.</BubbleContent>
                </Bubble>
              </MessageContent>
            </Message>
          </MessageGroup>
        </div>
      ),
      code: `<MessageGroup>
  <Message align="end">
    <MessageContent>
      <AttachmentGroup>
        <Attachment size="sm">
          <AttachmentMedia>
            <FileText />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>справка.pdf</AttachmentTitle>
          </AttachmentContent>
        </Attachment>
      </AttachmentGroup>
      <Bubble>
        <BubbleContent>Проверь, подходит ли справка.</BubbleContent>
      </Bubble>
    </MessageContent>
  </Message>
  <Message align="start">
    <MessageContent>
      <Marker>
        <MarkerIcon>
          <Sparkles />
        </MarkerIcon>
        <MarkerContent>Ассистент читает справка.pdf</MarkerContent>
      </Marker>
      <Bubble variant="ghost">
        <BubbleContent>Справка подходит: выдана меньше 30 дней назад.</BubbleContent>
      </Bubble>
    </MessageContent>
  </Message>
</MessageGroup>`,
    },
  ],
  props: [
    {
      name: 'Message.align',
      type: "'start' | 'end'",
      default: "'start'",
      description:
        'Сторона строки. "end" зеркалит её: аватар справа, части внутри MessageContent и пузыри прижаты к правому краю.',
    },
    {
      name: 'MessageAvatar.children',
      type: 'ReactNode',
      description:
        'Аватар автора — обычно Avatar из кита. Круглая ячейка, прижата к низу строки; при MessageFooter поднимается над ним.',
    },
    {
      name: 'MessageContent.children',
      type: 'ReactNode',
      description:
        'Колонка содержимого: MessageHeader, Bubble, AttachmentGroup, Marker, MessageFooter — в нужном порядке.',
    },
    {
      name: 'MessageHeader.children',
      type: 'ReactNode',
      description: 'Мелкая подпись над содержимым: имя автора, роль.',
    },
    {
      name: 'MessageFooter.children',
      type: 'ReactNode',
      description: 'Мелкая подпись под содержимым: время, статус. С align="end" — у правого края.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы любой части. Сливаются через tailwind-merge: ваш класс побеждает встроенный.',
    },
    {
      name: '...props',
      type: "ComponentProps<'div'>",
      description:
        'Все части — обычные <div> и принимают любые HTML-атрибуты: data-testid, aria-*, role.',
    },
  ],
};
