import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
} from './index';

describe('Drawer (base, vaul compound overlay)', () => {
  it('DrawerTrigger рендерит <button> с data-slot="drawer-trigger"', () => {
    const html = renderToStaticMarkup(
      <Drawer>
        <DrawerTrigger>Открыть</DrawerTrigger>
      </Drawer>
    );
    expect(html).toContain('data-slot="drawer-trigger"');
    expect(html).toMatch(/<button[^>]*>Открыть<\/button>/);
  });

  it('DrawerHeader — <div> с data-slot="drawer-header"', () => {
    const html = renderToStaticMarkup(<DrawerHeader>Шапка</DrawerHeader>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-slot="drawer-header"');
    expect(html).toContain('>Шапка</div>');
  });

  it('DrawerFooter — <div> с data-slot="drawer-footer"', () => {
    const html = renderToStaticMarkup(<DrawerFooter>Подвал</DrawerFooter>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-slot="drawer-footer"');
    expect(html).toContain('>Подвал</div>');
  });

  it('className мёржится на статических частях (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(<DrawerFooter className="mt-0">X</DrawerFooter>);
    expect(html).toContain('mt-0');
    expect(html).not.toContain('mt-auto');
  });

  it('статические части прокидывают произвольные props (напр. data-testid)', () => {
    const html = renderToStaticMarkup(<DrawerFooter data-testid="drawer-footer-x">Y</DrawerFooter>);
    expect(html).toContain('data-testid="drawer-footer-x"');
  });

  it('DrawerContent живёт в Portal — в SSR присутствует только триггер, контент отсутствует', () => {
    const html = renderToStaticMarkup(
      <Drawer open>
        <DrawerTrigger>Открыть</DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Заголовок</DrawerTitle>
            <DrawerDescription>Описание</DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>Действия</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
    // Триггер рендерится инлайн
    expect(html).toContain('data-slot="drawer-trigger"');
    // Content и его потомки — в Portal (document.body), в SSR их нет
    expect(html).not.toContain('data-slot="drawer-content"');
    expect(html).not.toContain('data-slot="drawer-title"');
  });
});
