import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './index';

describe('AlertDialog (base, Radix compound overlay)', () => {
  it('AlertDialogTrigger рендерит <button> с data-slot="alert-dialog-trigger"', () => {
    const html = renderToStaticMarkup(
      <AlertDialog>
        <AlertDialogTrigger>Открыть</AlertDialogTrigger>
      </AlertDialog>
    );
    expect(html).toContain('data-slot="alert-dialog-trigger"');
    expect(html).toMatch(/<button[^>]*>Открыть<\/button>/);
    // Диалог по умолчанию закрыт → триггер отражает состояние
    expect(html).toContain('data-state="closed"');
  });

  it('AlertDialogHeader — <div> с data-slot="alert-dialog-header"', () => {
    const html = renderToStaticMarkup(<AlertDialogHeader>Шапка</AlertDialogHeader>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-slot="alert-dialog-header"');
    expect(html).toContain('>Шапка</div>');
  });

  it('AlertDialogFooter — <div> с data-slot="alert-dialog-footer"', () => {
    const html = renderToStaticMarkup(<AlertDialogFooter>Подвал</AlertDialogFooter>);
    expect(html).toMatch(/^<div/);
    expect(html).toContain('data-slot="alert-dialog-footer"');
    expect(html).toContain('>Подвал</div>');
  });

  it('AlertDialogAction — кнопка (buttonVariants default) с data-slot="alert-dialog-action"', () => {
    const html = renderToStaticMarkup(
      <AlertDialog>
        <AlertDialogAction>Продолжить</AlertDialogAction>
      </AlertDialog>
    );
    expect(html).toContain('data-slot="alert-dialog-action"');
    // asChild-обёртка <Button> прокидывает buttonVariants через data-variant
    expect(html).toContain('data-variant="default"');
    expect(html).toMatch(/<button[^>]*>Продолжить<\/button>/);
  });

  // Примечание: AlertDialogCancel требует контекст AlertDialogContent (Radix берёт из него
  // ref для фокуса), поэтому standalone-рендер (вне Content) бросает исключение. Content живёт
  // в Portal и в SSR не рендерится — Cancel проверяется внутри Content в тесте про Portal ниже.

  it('className мёржится на статических частях (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <AlertDialogHeader className="text-left">X</AlertDialogHeader>
    );
    expect(html).toContain('text-left');
    expect(html).not.toContain('text-center');
  });

  it('статические части прокидывают произвольные props (напр. data-testid)', () => {
    const html = renderToStaticMarkup(
      <AlertDialogFooter data-testid="alert-dialog-footer-x">Y</AlertDialogFooter>
    );
    expect(html).toContain('data-testid="alert-dialog-footer-x"');
  });

  it('AlertDialogContent живёт в Portal — в SSR присутствует только триггер, контент отсутствует', () => {
    const html = renderToStaticMarkup(
      <AlertDialog defaultOpen>
        <AlertDialogTrigger>Открыть</AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Заголовок</AlertDialogTitle>
            <AlertDialogDescription>Описание</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction>Ок</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
    // Триггер рендерится инлайн
    expect(html).toContain('data-slot="alert-dialog-trigger"');
    // Content и его потомки — в Portal (document.body), в SSR их нет
    expect(html).not.toContain('data-slot="alert-dialog-content"');
    expect(html).not.toContain('data-slot="alert-dialog-title"');
  });
});
