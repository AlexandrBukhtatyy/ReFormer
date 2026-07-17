import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './index';

describe('Sheet (base, Radix Dialog overlay как боковая панель)', () => {
  it('SheetTrigger рендерит <button> с data-slot="sheet-trigger"', () => {
    const html = renderToStaticMarkup(
      <Sheet>
        <SheetTrigger>Открыть</SheetTrigger>
      </Sheet>
    );
    expect(html).toContain('data-slot="sheet-trigger"');
    expect(html).toMatch(/<button[^>]*>Открыть<\/button>/);
    // Панель по умолчанию закрыта → триггер отражает состояние
    expect(html).toContain('data-state="closed"');
  });

  it('SheetHeader — <div> с data-slot="sheet-header"', () => {
    const html = renderToStaticMarkup(<SheetHeader>Шапка</SheetHeader>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-slot="sheet-header"');
    expect(html).toContain('>Шапка</div>');
  });

  it('SheetFooter — <div> с data-slot="sheet-footer"', () => {
    const html = renderToStaticMarkup(<SheetFooter>Подвал</SheetFooter>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-slot="sheet-footer"');
    expect(html).toContain('>Подвал</div>');
  });

  it('className мёржится на статических частях (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<SheetHeader className="p-8">X</SheetHeader>);
    expect(html).toContain('p-8');
    expect(html).not.toContain('p-4');
  });

  it('статические части прокидывают произвольные props (напр. data-testid)', () => {
    const html = renderToStaticMarkup(<SheetFooter data-testid="sheet-footer-x">Y</SheetFooter>);
    expect(html).toContain('data-testid="sheet-footer-x"');
  });

  it('SheetContent живёт в Portal — в SSR присутствует только триггер, контент отсутствует', () => {
    const html = renderToStaticMarkup(
      <Sheet defaultOpen>
        <SheetTrigger>Открыть</SheetTrigger>
        <SheetContent side="left">
          <SheetHeader>
            <SheetTitle>Заголовок</SheetTitle>
            <SheetDescription>Описание</SheetDescription>
          </SheetHeader>
          <SheetFooter>Действия</SheetFooter>
        </SheetContent>
      </Sheet>
    );
    // Триггер рендерится инлайн
    expect(html).toContain('data-slot="sheet-trigger"');
    // Content и его потомки — в Portal (document.body), в SSR их нет
    expect(html).not.toContain('data-slot="sheet-content"');
    expect(html).not.toContain('data-slot="sheet-title"');
  });
});
