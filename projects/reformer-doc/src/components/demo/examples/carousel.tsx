import { useEffect, useState } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from '@reformer/ui-kit/carousel';
import type { ComponentDocConfig } from '../types';

/**
 * Carousel — не поле формы: части на embla-carousel-react (Carousel / CarouselContent /
 * CarouselItem / CarouselPrevious / CarouselNext). embla — необязательная peer-зависимость, поэтому
 * импорт только из `@reformer/ui-kit/carousel`. Variants — базовая карусель, Examples — приёмы
 * (несколько слайдов, вертикаль, loop, счётчик через setApi). Обёртка `<div className="px-12">` в
 * render — место под стрелки в рамке демо, в `code` её нет.
 */

const SLIDE = 'flex aspect-square items-center justify-center rounded-lg border bg-muted text-4xl';

/** Счётчик «Слайд N из M»: api карусели приходит через setApi. */
function CarouselWithCounter() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(1);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    const update = () => {
      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap() + 1);
    };
    update();
    api.on('select', update);
    return () => {
      api.off('select', update);
    };
  }, [api]);

  return (
    <div className="px-12">
      <Carousel setApi={setApi} className="w-full max-w-xs">
        <CarouselContent>
          {[1, 2, 3, 4, 5].map((n) => (
            <CarouselItem key={n} aria-label={`${n} из 5`}>
              <div className={SLIDE}>{n}</div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      <p aria-live="polite" className="py-2 text-center text-sm text-muted-foreground">
        Слайд {current} из {count}
      </p>
    </div>
  );
}

export const carouselDocConfig: ComponentDocConfig = {
  name: 'Carousel',
  importFrom: '@reformer/ui-kit/carousel',
  description:
    'Лента слайдов со стрелками, свайпом и клавишами ← / → (у вертикальной — ↑ / ↓). Импорт — @reformer/ui-kit/carousel, нужен пакет embla-carousel-react.',
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
                  <div className={SLIDE}>{n}</div>
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
      <CarouselItem key={n}>
        <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted text-4xl">
          {n}
        </div>
      </CarouselItem>
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
        'Ширину слайда задаёт класс basis-* на CarouselItem: basis-1/3 — три в ряд. По умолчанию basis-full — один на экран.',
      render: () => (
        <div className="px-12">
          <Carousel className="w-full max-w-sm">
            <CarouselContent>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <CarouselItem key={n} className="basis-1/3">
                  <div className={SLIDE}>{n}</div>
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
    {[1, 2, 3, 4, 5, 6].map((n) => (
      <CarouselItem key={n} className="basis-1/3">
        <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted text-4xl">
          {n}
        </div>
      </CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>`,
    },
    {
      id: 'vertical',
      title: 'Вертикальная лента',
      description:
        'orientation="vertical" листает сверху вниз, стрелки встают сверху и снизу, с клавиатуры — ↑ / ↓. CarouselContent нужна фиксированная высота.',
      render: () => (
        <div className="py-12">
          <Carousel orientation="vertical" className="w-full max-w-xs">
            <CarouselContent className="h-[300px]">
              {[1, 2, 3, 4, 5].map((n) => (
                <CarouselItem key={n} className="basis-1/2">
                  <div className={SLIDE}>{n}</div>
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
    {[1, 2, 3, 4, 5].map((n) => (
      <CarouselItem key={n} className="basis-1/2">
        <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted text-4xl">
          {n}
        </div>
      </CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>`,
    },
    {
      id: 'loop',
      title: 'Бесконечная лента (loop)',
      description:
        'opts передаются в embla как есть. { loop: true } зацикливает ленту — стрелки не блокируются.',
      render: () => (
        <div className="px-12">
          <Carousel opts={{ loop: true }} className="w-full max-w-xs">
            <CarouselContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <CarouselItem key={n}>
                  <div className={SLIDE}>{n}</div>
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
    {[1, 2, 3, 4, 5].map((n) => (
      <CarouselItem key={n}>
        <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted text-4xl">
          {n}
        </div>
      </CarouselItem>
    ))}
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>`,
    },
    {
      id: 'api',
      title: 'Счётчик слайдов (setApi)',
      description:
        'setApi отдаёт api embla: номер текущего слайда, их число, подписка на смену. Счётчик в aria-live объявляет переход скринридеру.',
      render: () => <CarouselWithCounter />,
      code: `import { useEffect, useState } from 'react';
import { type CarouselApi } from '@reformer/ui-kit/carousel';

function CarouselWithCounter() {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(1);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    const update = () => {
      setCount(api.scrollSnapList().length);
      setCurrent(api.selectedScrollSnap() + 1);
    };
    update();
    api.on('select', update);
    return () => {
      api.off('select', update);
    };
  }, [api]);

  return (
    <div>
      <Carousel setApi={setApi} className="w-full max-w-xs">
        <CarouselContent>
          {[1, 2, 3, 4, 5].map((n) => (
            <CarouselItem key={n} aria-label={\`\${n} из 5\`}>
              <div className="flex aspect-square items-center justify-center rounded-lg border bg-muted text-4xl">
                {n}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      <p aria-live="polite" className="py-2 text-center text-sm text-muted-foreground">
        Слайд {current} из {count}
      </p>
    </div>
  );
}`,
    },
  ],
  props: [
    {
      name: 'Carousel.orientation',
      type: "'horizontal' | 'vertical'",
      default: "'horizontal'",
      description:
        'Направление ленты. Стрелки переезжают по бокам или сверху и снизу; клавиши — ← / → или ↑ / ↓.',
    },
    {
      name: 'Carousel.opts',
      type: 'EmblaOptionsType',
      description: 'Настройки embla: loop, align, slidesToScroll, startIndex и др.',
    },
    {
      name: 'Carousel.plugins',
      type: 'EmblaPluginType[]',
      description: 'Плагины embla, например автопрокрутка (пакет embla-carousel-autoplay).',
    },
    {
      name: 'Carousel.setApi',
      type: '(api: CarouselApi) => void',
      description:
        'Получить api embla: scrollTo, selectedScrollSnap, scrollSnapList, подписки on / off.',
    },
    {
      name: 'CarouselContent',
      type: 'div',
      description:
        'Окно ленты с обрезкой по краям. className попадает на внутреннюю ленту — например, высота для вертикали.',
    },
    {
      name: 'CarouselItem',
      type: 'div',
      default: 'basis-full',
      description:
        'Слайд. Сколько слайдов видно сразу, задаёт класс basis-* (basis-1/2, basis-1/3).',
    },
    {
      name: 'CarouselPrevious / CarouselNext',
      type: 'Button',
      default: "variant='outline', size='icon'",
      description:
        'Стрелки. Сами блокируются, когда листать некуда. Принимают пропсы Button (variant, size, className).',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Дополнительные классы у любой части. При конфликте Tailwind-классов побеждает ваш.',
    },
  ],
};
