import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Toaster, toast } from './index';

// Sonner Toaster — обёртка над пакетом `sonner`. В SSR (до mount) sonner рендерит только
// landmark-плейсхолдер <section> без тостов; className/style/тема/иконки применяются на клиенте
// после mount и в статическом markup не видны. Поэтому тестируем статическую поверхность:
// наличие секции уведомлений, пустоту, автономность (без next-themes) и реэкспорт `toast`.
describe('Sonner Toaster (base, wrapper над sonner)', () => {
  it('рендерит landmark-секцию уведомлений sonner (role/aria-live)', () => {
    const html = renderToStaticMarkup(<Toaster />);
    expect(html).toMatch(/^<section/);
    expect(html).toContain('aria-label="Notifications alt+T"');
    expect(html).toContain('aria-live="polite"');
  });

  it('работает автономно — без next-themes / ThemeProvider (рендер не бросает)', () => {
    // Регрессионный страж удаления useTheme: тема захардкожена 'system', провайдер не нужен.
    expect(() => renderToStaticMarkup(<Toaster />)).not.toThrow();
  });

  it('в SSR (до mount) тостов нет — секция пустая', () => {
    const html = renderToStaticMarkup(<Toaster />);
    expect(html).not.toContain('data-sonner-toast');
    expect(html).toMatch(/<\/section>$/);
  });

  it('принимает произвольные ToasterProps без ошибок (position / richColors / expand)', () => {
    expect(() =>
      renderToStaticMarkup(<Toaster position="top-center" richColors expand />)
    ).not.toThrow();
  });

  it('реэкспортирует императивный `toast` из sonner (с методами success/error)', () => {
    expect(typeof toast).toBe('function');
    expect(typeof toast.success).toBe('function');
    expect(typeof toast.error).toBe('function');
  });
});
