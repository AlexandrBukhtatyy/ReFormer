import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from './index';

// Carousel — inline compound (embla, без Portal): все части рендерятся в SSR.
// В SSR api ещё нет (эффекты не выполнялись) → canScrollPrev/Next = false, стрелки disabled.
function renderCarousel(props?: { orientation?: 'horizontal' | 'vertical' }) {
  return renderToStaticMarkup(
    <Carousel orientation={props?.orientation}>
      <CarouselContent>
        <CarouselItem>Слайд 1</CarouselItem>
        <CarouselItem>Слайд 2</CarouselItem>
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}

describe('Carousel (base, compound на embla)', () => {
  it('каждая часть несёт собственный data-slot', () => {
    const html = renderCarousel();
    expect(html).toContain('data-slot="carousel"');
    expect(html).toContain('data-slot="carousel-content"');
    expect(html).toContain('data-slot="carousel-item"');
    expect(html).toContain('data-slot="carousel-previous"');
    expect(html).toContain('data-slot="carousel-next"');
  });

  it('корень несёт ARIA carousel (role=region + aria-roledescription)', () => {
    const html = renderCarousel();
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-roledescription="carousel"');
  });

  it('каждый слайд несёт ARIA slide (role=group + aria-roledescription)', () => {
    const html = renderCarousel();
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-roledescription="slide"');
    expect(html).toContain('>Слайд 1</div>');
  });

  it('стрелки — <button> с sr-only подписями', () => {
    const html = renderCarousel();
    expect(html).toMatch(/<span[^>]*class="sr-only"[^>]*>Previous slide<\/span>/);
    expect(html).toMatch(/<span[^>]*class="sr-only"[^>]*>Next slide<\/span>/);
  });

  it('в SSR (api ещё нет) обе стрелки disabled', () => {
    const html = renderCarousel();
    // два disabled-атрибута — на Previous и Next
    const matches = html.match(/data-slot="carousel-(previous|next)"[^>]*disabled/g);
    expect(matches).not.toBeNull();
    expect(matches?.length).toBe(2);
  });

  it('стрелки — outline/icon Button (наследуют data-variant/size)', () => {
    const html = renderCarousel();
    expect(html).toContain('data-variant="outline"');
    expect(html).toContain('data-size="icon"');
  });

  it('горизонтальная ориентация (по умолчанию): слайд получает pl-4', () => {
    const html = renderCarousel();
    expect(html).toContain('pl-4');
  });

  it('вертикальная ориентация: content получает flex-col, слайд — pt-4', () => {
    const html = renderCarousel({ orientation: 'vertical' });
    expect(html).toContain('flex-col');
    expect(html).toContain('pt-4');
  });

  it('className мёржится на CarouselItem (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <Carousel>
        <CarouselContent>
          <CarouselItem className="basis-1/2">X</CarouselItem>
        </CarouselContent>
      </Carousel>
    );
    expect(html).toContain('basis-1/2');
  });

  it('прокидывает произвольные props (напр. data-testid) на слайд', () => {
    const html = renderToStaticMarkup(
      <Carousel>
        <CarouselContent>
          <CarouselItem data-testid="slide-a">A</CarouselItem>
        </CarouselContent>
      </Carousel>
    );
    expect(html).toContain('data-testid="slide-a"');
  });
});
