import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './index';

// Radix Tooltip рендерит Content в Portal — в SSR он отсутствует. Тестируем доступное:
// триггер (data-slot / роль / passthrough) и статические экспорты.
describe('Tooltip (base)', () => {
  it('рендерит триггер с data-slot="tooltip-trigger" (button по умолчанию)', () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger>Наведи</TooltipTrigger>
          <TooltipContent>Подсказка</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    expect(html).toContain('data-slot="tooltip-trigger"');
    expect(html).toContain('<button');
    expect(html).toContain('>Наведи</button>');
  });

  it('Content в Portal — в SSR отсутствует', () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <Tooltip defaultOpen>
          <TooltipTrigger>Наведи</TooltipTrigger>
          <TooltipContent>Секрет</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
    // Portal не рендерится на сервере → контента нет, но триггер есть.
    expect(html).toContain('data-slot="tooltip-trigger"');
    expect(html).not.toContain('Секрет');
  });

  it('триггер прокидывает произвольные props (data-testid)', () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger data-testid="tt-trigger">?</TooltipTrigger>
        </Tooltip>
      </TooltipProvider>
    );
    expect(html).toContain('data-testid="tt-trigger"');
  });

  it('asChild — триггер рендерит дочерний элемент вместо <button>', () => {
    const html = renderToStaticMarkup(
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <a href="/docs">Документация</a>
          </TooltipTrigger>
        </Tooltip>
      </TooltipProvider>
    );
    expect(html).toContain('data-slot="tooltip-trigger"');
    expect(html).toContain('<a');
    expect(html).toContain('href="/docs"');
    expect(html).toContain('>Документация</a>');
  });

  it('Tooltip / TooltipTrigger / TooltipContent / TooltipProvider экспортируются', () => {
    expect(typeof Tooltip).toBe('function');
    expect(typeof TooltipTrigger).toBe('function');
    expect(typeof TooltipContent).toBe('function');
    expect(typeof TooltipProvider).toBe('function');
  });
});
