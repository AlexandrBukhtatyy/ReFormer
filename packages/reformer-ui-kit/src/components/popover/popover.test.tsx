import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from './index';

// Radix Popover — overlay: в SSR (renderToStaticMarkup) рендерится только триггер,
// Content живёт в Portal и в статичной разметке отсутствует. Поэтому проверяем
// доступное: data-slot триггера + презентационные части (обычные div/p — рендерятся в SSR).

describe('Popover (base, Radix overlay)', () => {
  it('PopoverTrigger несёт data-slot="popover-trigger" и рендерит содержимое (button)', () => {
    const html = renderToStaticMarkup(
      <Popover defaultOpen>
        <PopoverTrigger>Открыть</PopoverTrigger>
        <PopoverContent>Контент</PopoverContent>
      </Popover>
    );
    expect(html).toContain('data-slot="popover-trigger"');
    expect(html).toContain('>Открыть</button>');
    // Content — в Portal, в SSR отсутствует.
    expect(html).not.toContain('data-slot="popover-content"');
  });

  it('прокидывает произвольные props (напр. data-testid) на триггер', () => {
    const html = renderToStaticMarkup(
      <Popover>
        <PopoverTrigger data-testid="popover-x">T</PopoverTrigger>
      </Popover>
    );
    expect(html).toContain('data-testid="popover-x"');
  });

  it('PopoverHeader / PopoverTitle / PopoverDescription несут свои data-slot', () => {
    const html = renderToStaticMarkup(
      <PopoverHeader>
        <PopoverTitle>Заголовок</PopoverTitle>
        <PopoverDescription>Описание</PopoverDescription>
      </PopoverHeader>
    );
    expect(html).toContain('data-slot="popover-header"');
    expect(html).toContain('data-slot="popover-title"');
    expect(html).toContain('data-slot="popover-description"');
    expect(html).toContain('>Заголовок</div>');
    expect(html).toContain('>Описание</p>');
  });

  it('className мёржится (tailwind-merge, caller wins) на презентационных частях', () => {
    const html = renderToStaticMarkup(<PopoverTitle className="font-normal">X</PopoverTitle>);
    expect(html).toContain('font-normal');
    expect(html).not.toContain('font-medium');
  });
});
