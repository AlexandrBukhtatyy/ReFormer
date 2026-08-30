import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ScrollArea, ScrollBar } from './index';

// ScrollArea — compound поверх Radix ScrollArea (не form-control). Root + Viewport
// рендерятся всегда; собственная вертикальная ScrollBar в дефолтном type="hover"
// монтируется только при наведении (в SSR её нет) — для проверки полос используем
// type="always" (Radix оставляет полосу видимой). Thumb измеряется на клиенте, поэтому
// в статической разметке его нет — проверяем сам scrollbar (data-slot + orientation).

describe('ScrollArea (base, compound over Radix)', () => {
  it('Root и Viewport несут собственный data-slot, контент — внутри Viewport', () => {
    const html = renderToStaticMarkup(
      <ScrollArea>
        <div>Длинный контент</div>
      </ScrollArea>
    );
    expect(html).toContain('data-slot="scroll-area"');
    expect(html).toContain('data-slot="scroll-area-viewport"');
    expect(html).toContain('>Длинный контент<');
  });

  it('className мёржится на Root (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <ScrollArea className="h-40 w-64">
        <div>c</div>
      </ScrollArea>
    );
    // базовый `relative` из реализации + классы вызывающего
    expect(html).toMatch(/data-slot="scroll-area"[^>]*class="relative h-40 w-64"/);
  });

  it('прокидывает произвольные props (напр. data-testid) на Root', () => {
    const html = renderToStaticMarkup(
      <ScrollArea data-testid="log">
        <div>c</div>
      </ScrollArea>
    );
    expect(html).toMatch(/data-slot="scroll-area"[^>]*data-testid="log"/);
  });

  it('type="always" рендерит вертикальную ScrollBar (data-slot + orientation)', () => {
    const html = renderToStaticMarkup(
      <ScrollArea type="always">
        <div>c</div>
      </ScrollArea>
    );
    expect(html).toContain('data-slot="scroll-area-scrollbar"');
    expect(html).toContain('data-orientation="vertical"');
    // вертикальная ветка cn(): ширина полосы
    expect(html).toContain('w-2.5');
  });

  it('size="xs" сужает собственную вертикальную полосу области (10px → 6px)', () => {
    const html = renderToStaticMarkup(
      <ScrollArea type="always" size="xs">
        <div>c</div>
      </ScrollArea>
    );
    expect(html).toContain('data-size="xs"');
    expect(html).toContain('w-1.5');
    // базовая ширина апстрима вытеснена tailwind-merge, а не приписана рядом
    expect(html).not.toContain('w-2.5');
  });

  it('size="xs" на горизонтальной ScrollBar меняет высоту полосы', () => {
    const html = renderToStaticMarkup(
      <ScrollArea type="always">
        <div>c</div>
        <ScrollBar orientation="horizontal" size="xs" />
      </ScrollArea>
    );
    expect(html).toContain('data-orientation="horizontal"');
    expect(html).toContain('h-1.5');
  });
  it('экспортируемая ScrollBar принимает orientation="horizontal" (горизонтальная ветка стилей)', () => {
    const html = renderToStaticMarkup(
      <ScrollArea type="always">
        <div>c</div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    );
    expect(html).toContain('data-orientation="horizontal"');
    // горизонтальная ветка cn(): высота полосы + flex-col
    expect(html).toContain('h-2.5');
    expect(html).toContain('flex-col');
  });
});
