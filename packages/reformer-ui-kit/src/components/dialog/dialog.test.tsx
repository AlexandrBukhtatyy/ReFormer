import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './index';

describe('Dialog (base, Radix compound overlay)', () => {
  it('DialogTrigger рендерит <button> с data-slot="dialog-trigger"', () => {
    const html = renderToStaticMarkup(
      <Dialog>
        <DialogTrigger>Открыть</DialogTrigger>
      </Dialog>
    );
    expect(html).toContain('data-slot="dialog-trigger"');
    expect(html).toMatch(/<button[^>]*>Открыть<\/button>/);
    // Диалог по умолчанию закрыт → триггер отражает состояние
    expect(html).toContain('data-state="closed"');
  });

  it('DialogHeader — <div> с data-slot="dialog-header"', () => {
    const html = renderToStaticMarkup(<DialogHeader>Шапка</DialogHeader>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-slot="dialog-header"');
    expect(html).toContain('>Шапка</div>');
  });

  it('DialogFooter — <div> с data-slot="dialog-footer"', () => {
    const html = renderToStaticMarkup(<DialogFooter>Подвал</DialogFooter>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-slot="dialog-footer"');
    expect(html).toContain('>Подвал</div>');
  });

  it('DialogFooter showCloseButton рендерит кнопку «Close» через DialogClose', () => {
    const html = renderToStaticMarkup(
      <Dialog>
        <DialogFooter showCloseButton>Тело</DialogFooter>
      </Dialog>
    );
    expect(html).toContain('data-slot="dialog-footer"');
    // showCloseButton → <DialogPrimitive.Close asChild><Button>Close</Button>
    expect(html).toMatch(/<button[^>]*>Close<\/button>/);
  });

  it('className мёржится на статических частях (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<DialogHeader className="text-right">X</DialogHeader>);
    expect(html).toContain('text-right');
    expect(html).not.toContain('text-center');
  });

  it('статические части прокидывают произвольные props (напр. data-testid)', () => {
    const html = renderToStaticMarkup(<DialogFooter data-testid="dialog-footer-x">Y</DialogFooter>);
    expect(html).toContain('data-testid="dialog-footer-x"');
  });

  it('DialogContent живёт в Portal — в SSR присутствует только триггер, контент отсутствует', () => {
    const html = renderToStaticMarkup(
      <Dialog defaultOpen>
        <DialogTrigger>Открыть</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Заголовок</DialogTitle>
            <DialogDescription>Описание</DialogDescription>
          </DialogHeader>
          <DialogFooter>Действия</DialogFooter>
        </DialogContent>
      </Dialog>
    );
    // Триггер рендерится инлайн
    expect(html).toContain('data-slot="dialog-trigger"');
    // Content и его потомки — в Portal (document.body), в SSR их нет
    expect(html).not.toContain('data-slot="dialog-content"');
    expect(html).not.toContain('data-slot="dialog-title"');
  });
});
