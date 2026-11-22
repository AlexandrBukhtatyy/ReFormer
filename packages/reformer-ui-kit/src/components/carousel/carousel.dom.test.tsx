// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from './index';

afterEach(cleanup);

/** Карусель с перехваченным embla-api: клавиши проверяются по вызовам scrollPrev/scrollNext. */
async function mount(orientation: 'horizontal' | 'vertical') {
  let api: CarouselApi;
  const view = render(
    <Carousel
      orientation={orientation}
      setApi={(next) => {
        api = next;
      }}
    >
      <CarouselContent>
        <CarouselItem>Слайд 1</CarouselItem>
        <CarouselItem>Слайд 2</CarouselItem>
      </CarouselContent>
    </Carousel>
  );
  await waitFor(() => expect(api).toBeDefined());
  const prev = vi.spyOn(api!, 'scrollPrev');
  const next = vi.spyOn(api!, 'scrollNext');
  const root = view.container.querySelector<HTMLElement>('[data-slot="carousel"]')!;
  return { view, api: api!, root, prev, next };
}

describe('Carousel (DOM): клавиатура и подписки', () => {
  it('горизонтальная лента листается ←/→ и не реагирует на ↑/↓', async () => {
    const { root, prev, next } = await mount('horizontal');
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    fireEvent.keyDown(root, { key: 'ArrowLeft' });
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(prev).toHaveBeenCalledTimes(1);
  });

  it('вертикальная лента листается ↑/↓ и не реагирует на ←/→', async () => {
    const { root, prev, next } = await mount('vertical');
    fireEvent.keyDown(root, { key: 'ArrowDown' });
    fireEvent.keyDown(root, { key: 'ArrowUp' });
    fireEvent.keyDown(root, { key: 'ArrowRight' });
    expect(next).toHaveBeenCalledTimes(1);
    expect(prev).toHaveBeenCalledTimes(1);
  });

  it('при размонтировании отписывается и от select, и от reInit', async () => {
    const { view, api } = await mount('horizontal');
    const off = vi.spyOn(api, 'off');
    view.unmount();
    const events = off.mock.calls.map(([event]) => event);
    expect(events).toContain('select');
    expect(events).toContain('reInit');
  });
});
