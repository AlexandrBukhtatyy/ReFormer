import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
  Avatar,
  AvatarFallback,
  Button,
} from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * HoverCard — не поле формы: превью на Radix HoverCard (HoverCard / HoverCardTrigger /
 * HoverCardContent) по наведению или фокусу на ссылке. Variants — базовая карточка и стороны,
 * Examples — задержки, упоминание в тексте. Обёртка `<div style>` в render — рамка демо, в `code`
 * её нет.
 */
export const hoverCardDocConfig: ComponentDocConfig = {
  name: 'HoverCard',
  importFrom: '@reformer/ui-kit',
  description:
    'Карточка-превью, которая появляется при наведении на ссылку или фокусе на ней: профиль, документ, ссылка.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая карточка',
      description:
        'Ссылка-триггер и превью профиля. Наведите курсор на «@reformer» или сфокусируйтесь на нём клавишей Tab.',
      render: () => (
        <HoverCard>
          <HoverCardTrigger asChild>
            <Button variant="link">@reformer</Button>
          </HoverCardTrigger>
          <HoverCardContent>
            <div className="flex gap-3">
              <Avatar>
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
        </HoverCard>
      ),
      code: `<HoverCard>
  <HoverCardTrigger asChild>
    <Button variant="link">@reformer</Button>
  </HoverCardTrigger>
  <HoverCardContent>
    <div className="flex gap-3">
      <Avatar>
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
        'side у HoverCardContent — сторона появления: top, right, bottom (по умолчанию), left.',
      render: () => (
        <div className="flex flex-wrap gap-3">
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
      code: `<div className="flex flex-wrap gap-3">
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
</div>`,
    },
  ],
  examples: [
    {
      id: 'delay',
      title: 'Задержка появления и закрытия',
      description:
        'openDelay и closeDelay у HoverCard — пауза перед показом и скрытием, мс. По умолчанию 700 и 300.',
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
        'Превью при наведении на упоминание внутри абзаца: триггер — ссылка в строке текста.',
      render: () => (
        <p className="max-w-md text-sm">
          Проект развивают участники сообщества, включая{' '}
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button variant="link" className="h-auto p-0">
                @maintainer
              </Button>
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
        </p>
      ),
      code: `<p className="max-w-md text-sm">
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
        'Корень: open + onOpenChange или defaultOpen. openDelay / closeDelay — задержки показа и скрытия, мс.',
    },
    {
      name: 'HoverCardTrigger',
      type: 'Radix HoverCard.Trigger',
      description:
        'Элемент, при наведении или фокусе на котором появляется карточка. По умолчанию <a>; asChild — стать своим элементом.',
    },
    {
      name: 'HoverCardContent',
      type: 'Radix HoverCard.Content',
      default: 'align=center, sideOffset=4',
      description:
        'Карточка в портале, ширина w-64. Положение: side, align (start / center / end), sideOffset.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш (w-auto вместо w-64).',
    },
  ],
};
