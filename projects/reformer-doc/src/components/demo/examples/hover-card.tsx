import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * HoverCard — не form-control: overlay-compound над Radix HoverCard (HoverCard /
 * HoverCardTrigger / HoverCardContent). Карточка-предпросмотр появляется при наведении /
 * фокусе на триггере (обычно ссылке). Таб Variants показывает готовые композиции,
 * Examples — приёмы (сторона появления, управляемое состояние), API — таблицу частей.
 */
export const hoverCardDocConfig: ComponentDocConfig = {
  name: 'HoverCard',
  importFrom: '@reformer/ui-kit',
  description:
    'Всплывающая карточка-предпросмотр на shadcn / Radix. Compound: HoverCard (корень) + HoverCardTrigger (элемент наведения) + HoverCardContent (в Portal). Появляется при наведении курсора или фокусе с клавиатуры — удобно для превью профиля, ссылки, сущности.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая карточка',
      description:
        'Триггер-ссылка + Content с превью профиля. Наведите курсор (или сфокусируйтесь) на «@reformer».',
      render: () => (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="link">@reformer</Button>
          </HoverCardTrigger>
          <HoverCardContent>
            <div style={{ display: 'flex', gap: 12 }}>
              <Avatar>
                <AvatarImage src="" alt="ReFormer" />
                <AvatarFallback>RF</AvatarFallback>
              </Avatar>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>@reformer</span>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  Декларативные формы для React на основе схемы.
                </span>
              </div>
            </div>
          </HoverCardContent>
        </HoverCard>
      ),
      code: `<HoverCard>
  <HoverCardTrigger asChild>
    <Button variant="link">@reformer</Button>
  </HoverCardTrigger>
  <HoverCardContent>
    <div className="flex gap-3">
      <Avatar>
        <AvatarImage src="" alt="ReFormer" />
        <AvatarFallback>RF</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">@reformer</span>
        <span className="text-sm text-muted-foreground">
          Декларативные формы для React на основе схемы.
        </span>
      </div>
    </div>
  </HoverCardContent>
</HoverCard>`,
    },
    {
      id: 'sides',
      title: 'Сторона появления (side)',
      description:
        'HoverCardContent принимает side: top / right / bottom / left, а также align и sideOffset.',
      render: () => (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
            <HoverCard key={side}>
              <HoverCardTrigger asChild>
                <Button variant="outline">{side}</Button>
              </HoverCardTrigger>
              <HoverCardContent side={side} className="w-auto">
                Появляюсь со стороны: {side}
              </HoverCardContent>
            </HoverCard>
          ))}
        </div>
      ),
      code: `<HoverCard>
  <HoverCardTrigger asChild>
    <Button variant="outline">right</Button>
  </HoverCardTrigger>
  <HoverCardContent side="right" className="w-auto">
    Появляюсь справа
  </HoverCardContent>
</HoverCard>`,
    },
  ],
  examples: [
    {
      id: 'delay',
      title: 'Задержка появления и закрытия',
      description:
        'openDelay / closeDelay на HoverCard задают паузу (мс) перед показом и скрытием. По умолчанию 700 / 300.',
      render: () => (
        <HoverCard openDelay={200} closeDelay={100}>
          <HoverCardTrigger asChild>
            <Button variant="link">Быстрая карточка</Button>
          </HoverCardTrigger>
          <HoverCardContent>Появилась почти сразу (openDelay=200мс).</HoverCardContent>
        </HoverCard>
      ),
      code: `<HoverCard openDelay={200} closeDelay={100}>
  <HoverCardTrigger asChild>
    <Button variant="link">Быстрая карточка</Button>
  </HoverCardTrigger>
  <HoverCardContent>
    Появилась почти сразу (openDelay=200мс).
  </HoverCardContent>
</HoverCard>`,
    },
    {
      id: 'text-trigger',
      title: 'Триггер-ссылка в тексте',
      description:
        'Частый приём: превью появляется при наведении на упоминание внутри абзаца (HoverCardTrigger как inline-ссылка).',
      render: () => (
        <p style={{ maxWidth: 420, fontSize: 14, lineHeight: 1.6 }}>
          Проект развивают участники сообщества, включая{' '}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="link" className="h-auto p-0">
                @maintainer
              </Button>
            </HoverCardTrigger>
            <HoverCardContent>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Мейнтейнер</span>
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  Отвечает за релизы и код-ревью.
                </span>
              </div>
            </HoverCardContent>
          </HoverCard>{' '}
          — наведите на упоминание, чтобы увидеть карточку.
        </p>
      ),
      code: `<p>
  Проект развивают участники сообщества, включая{' '}
  <HoverCard>
    <HoverCardTrigger asChild>
      <Button variant="link" className="h-auto p-0">@maintainer</Button>
    </HoverCardTrigger>
    <HoverCardContent>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-semibold">Мейнтейнер</span>
        <span className="text-sm text-muted-foreground">
          Отвечает за релизы и код-ревью.
        </span>
      </div>
    </HoverCardContent>
  </HoverCard>{' '}
  — наведите на упоминание, чтобы увидеть карточку.
</p>`,
    },
  ],
  props: [
    {
      name: 'HoverCard',
      type: 'Radix HoverCard.Root',
      default: 'openDelay=700, closeDelay=300',
      description:
        'Корень. Управляемость: open / defaultOpen / onOpenChange. openDelay / closeDelay (мс) — задержка показа и скрытия.',
    },
    {
      name: 'HoverCardTrigger',
      type: 'Radix HoverCard.Trigger',
      description:
        'Элемент, при наведении / фокусе на который появляется карточка (по умолчанию <a>). asChild рендерит переданного потомка (напр. Button variant="link") вместо ссылки.',
    },
    {
      name: 'HoverCardContent',
      type: 'Radix HoverCard.Content',
      default: 'align=center, sideOffset=4',
      description:
        'Содержимое карточки (рендерится в Portal). Позиция — side (top/right/bottom/left), выравнивание — align (start/center/end), отступ от триггера — sideOffset.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у HoverCardContent (ширина по умолчанию w-64; tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
