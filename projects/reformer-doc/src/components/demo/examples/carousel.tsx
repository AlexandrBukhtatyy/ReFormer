import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@reformer/ui-kit/carousel';
import type { ComponentDocConfig } from '../types';

/**
 * Carousel — не form-control: compound на embla-carousel-react (Carousel / CarouselContent /
 * CarouselItem / CarouselPrevious / CarouselNext). Корень раздаёт контекст (ref эмблы, api,
 * scrollPrev/Next, canScrollPrev/Next); стрелки — outline/icon Button, авто-disabled на краях;
 * навигация клавишами ←/→. embla — optional peer (тяжёлая dep, external в сборке). Таб Variants —
 * готовые раскладки, Examples — приёмы (несколько на экран, вертикаль, loop), API — части и props.
 */

// Плитка-заглушка слайда (в реальном приложении — Card / изображение / произвольный контент).
function Slide({ label }: { label: string }) {
  return (
    <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted p-6 text-4xl font-semibold">
      {label}
    </div>
  );
}

export const carouselDocConfig: ComponentDocConfig = {
  name: 'Carousel',
  importFrom: '@reformer/ui-kit',
  description:
    'Карусель на shadcn / embla-carousel-react. Compound: Carousel (корень с контекстом) + CarouselContent (вьюпорт эмблы) + CarouselItem (слайд) + CarouselPrevious / CarouselNext (стрелки-Button, авто-disabled на краях). Навигация ←/→ и свайпом. embla-carousel-react — optional peer dependency.',
  variants: [
    {
      id: 'basic',
      title: 'Базовая карусель',
      description:
        'Один слайд на экран, стрелки по бокам. На первом слайде «назад» неактивна, на последнем — «вперёд».',
      render: () => (
        <div className="px-12">
          <Carousel className="w-full max-w-xs">
            <CarouselContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <CarouselItem key={n}>
                  <Slide label={String(n)} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      ),
      code: `<Carousel className="w-full max-w-xs">
  <CarouselContent>
    {[1, 2, 3, 4, 5].map((n) => (
      <CarouselItem key={n}>{/* содержимое слайда */}</CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>`,
    },
  ],
  examples: [
    {
      id: 'multiple-per-view',
      title: 'Несколько слайдов на экран',
      description:
        'Ширина слайда задаётся классом basis-* на CarouselItem (напр. basis-1/3 — три в ряд). basis-full по умолчанию — один на экран.',
      render: () => (
        <div className="px-12">
          <Carousel className="w-full max-w-sm">
            <CarouselContent>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <CarouselItem key={n} className="basis-1/3">
                  <Slide label={String(n)} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      ),
      code: `<Carousel className="w-full max-w-sm">
  <CarouselContent>
    {items.map((n) => (
      <CarouselItem key={n} className="basis-1/3">
        {/* содержимое слайда */}
      </CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>`,
    },
    {
      id: 'vertical',
      title: 'Вертикальная ориентация',
      description:
        'orientation="vertical" переключает ось прокрутки; стрелки встают сверху/снизу. Требует фиксированной высоты у CarouselContent.',
      render: () => (
        <div className="py-12">
          <Carousel orientation="vertical" className="w-full max-w-xs">
            <CarouselContent className="h-[300px]">
              {[1, 2, 3, 4, 5].map((n) => (
                <CarouselItem key={n} className="basis-1/2">
                  <Slide label={String(n)} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      ),
      code: `<Carousel orientation="vertical" className="w-full max-w-xs">
  <CarouselContent className="h-[300px]">
    {items.map((n) => (
      <CarouselItem key={n} className="basis-1/2">
        {/* содержимое слайда */}
      </CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>`,
    },
    {
      id: 'loop',
      title: 'Бесконечная прокрутка (loop)',
      description:
        'opts прокидываются в embla. { loop: true } зацикливает карусель — стрелки никогда не блокируются.',
      render: () => (
        <div className="px-12">
          <Carousel opts={{ loop: true }} className="w-full max-w-xs">
            <CarouselContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <CarouselItem key={n}>
                  <Slide label={String(n)} />
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious />
            <CarouselNext />
          </Carousel>
        </div>
      ),
      code: `<Carousel opts={{ loop: true }} className="w-full max-w-xs">
  <CarouselContent>
    {items.map((n) => (
      <CarouselItem key={n}>{/* содержимое слайда */}</CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>`,
    },
  ],
  props: [
    {
      name: 'Carousel',
      type: 'div + embla context',
      default: 'orientation="horizontal"',
      description:
        'Корень: инициализирует embla, раздаёт контекст (api, scrollPrev/Next, canScrollPrev/Next). Props: orientation, opts (EmblaOptionsType), plugins, setApi (получить api-инстанс). Навигация ←/→ — на корне.',
    },
    {
      name: 'CarouselContent',
      type: 'div (вьюпорт эмблы)',
      description:
        'Обёртка-вьюпорт (overflow-hidden) с внутренним flex-треком. className вешается на трек (напр. высота для vertical).',
    },
    {
      name: 'CarouselItem',
      type: 'div[role=group]',
      default: 'basis-full',
      description:
        'Слайд. Ширину/высоту на экране задаёт basis-* (basis-1/3, basis-1/2). role="group" + aria-roledescription="slide".',
    },
    {
      name: 'CarouselPrevious / CarouselNext',
      type: 'Button (outline / icon)',
      description:
        'Стрелки навигации. Авто-disabled, когда прокрутка в соответствующую сторону невозможна (кроме loop). variant / size / className переопределяемы.',
    },
    {
      name: 'CarouselApi',
      type: 'type (embla api)',
      description:
        'Тип api-инстанса embla (setApi даёт к нему доступ — программная прокрутка, подписки на события).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Доп. классы у любой части (tailwind-merge — класс вызывающего перекрывает дефолтные).',
    },
  ],
};
