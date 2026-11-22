import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DirectionProvider, useDirection } from './index';

// DirectionProvider — контекст-провайдер: DOM-обёртки/data-slot не рендерит, только
// прокидывает children и задаёт направление для потомков через useDirection.
// Тестируем статику: pass-through детей и значение контекста (React-контекст работает в SSR).
function DirConsumer() {
  const dir = useDirection();
  return <span data-testid="dir">{dir}</span>;
}

describe('Direction (base)', () => {
  it('DirectionProvider прокидывает children без собственной DOM-обёртки', () => {
    const html = renderToStaticMarkup(
      <DirectionProvider dir="rtl">
        <span data-testid="child">Контент</span>
      </DirectionProvider>
    );
    expect(html).toBe('<span data-testid="child">Контент</span>');
  });

  it('useDirection внутри dir="rtl" возвращает "rtl"', () => {
    const html = renderToStaticMarkup(
      <DirectionProvider dir="rtl">
        <DirConsumer />
      </DirectionProvider>
    );
    expect(html).toContain('>rtl</span>');
  });

  it('алиас `direction` перекрывает `dir`', () => {
    const html = renderToStaticMarkup(
      <DirectionProvider dir="ltr" direction="rtl">
        <DirConsumer />
      </DirectionProvider>
    );
    expect(html).toContain('>rtl</span>');
  });

  it('useDirection без провайдера — дефолт "ltr"', () => {
    const html = renderToStaticMarkup(<DirConsumer />);
    expect(html).toContain('>ltr</span>');
  });

  it('DirectionProvider / useDirection экспортируются', () => {
    expect(typeof DirectionProvider).toBe('function');
    expect(typeof useDirection).toBe('function');
  });
});
