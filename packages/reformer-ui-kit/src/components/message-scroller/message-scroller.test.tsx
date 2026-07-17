import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
  useMessageScroller,
  useMessageScrollerScrollable,
  useMessageScrollerVisibility,
} from './index';

// MessageScroller — compound поверх headless-примитива @shadcn/react/message-scroller
// (авто-скролл списка сообщений). Поведение (observers) живёт в эффектах и в SSR не
// запускается, поэтому статическую разметку (data-slot, роли, aria) можно проверять
// напрямую (renderToStaticMarkup + regex). Хуки/Button требуют Provider-контекст.

// Полное дерево (как в реальном использовании), обёрнутое в Provider.
function renderTree(itemProps: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <MessageScrollerProvider>
      <MessageScroller>
        <MessageScrollerViewport>
          <MessageScrollerContent>
            <MessageScrollerItem {...itemProps}>Привет</MessageScrollerItem>
          </MessageScrollerContent>
        </MessageScrollerViewport>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

describe('MessageScroller (base, compound)', () => {
  it('Root рендерит <div> со своим data-slot', () => {
    const html = renderTree();
    expect(html).toContain('data-slot="message-scroller"');
    expect(html).toMatch(/<div[^>]*data-slot="message-scroller"/);
  });

  it('Viewport несёт свой data-slot и accessibility-роль (region + aria-label)', () => {
    const html = renderTree();
    expect(html).toContain('data-slot="message-scroller-viewport"');
    expect(html).toContain('role="region"');
    expect(html).toContain('aria-label="Messages"');
  });

  it('Content несёт свой data-slot и роль log (live-region)', () => {
    const html = renderTree();
    expect(html).toContain('data-slot="message-scroller-content"');
    expect(html).toContain('role="log"');
  });

  it('Item несёт свой data-slot и по умолчанию data-scroll-anchor="false"', () => {
    const html = renderTree();
    expect(html).toContain('data-slot="message-scroller-item"');
    expect(html).toContain('data-scroll-anchor="false"');
    expect(html).toContain('>Привет');
  });

  it('Item со scrollAnchor выставляет data-scroll-anchor="true"', () => {
    const html = renderTree({ scrollAnchor: true });
    expect(html).toContain('data-scroll-anchor="true"');
  });

  it('Item прокидывает произвольные props (напр. data-testid)', () => {
    const html = renderTree({ 'data-testid': 'msg-1' });
    expect(html).toContain('data-testid="msg-1"');
  });

  it('className мёржится на Root (tailwind-merge, caller wins)', () => {
    const html = renderToStaticMarkup(
      <MessageScrollerProvider>
        <MessageScroller className="bg-red-500">x</MessageScroller>
      </MessageScrollerProvider>
    );
    expect(html).toContain('bg-red-500');
  });
});

describe('MessageScrollerButton (в контексте Provider)', () => {
  function renderButton(props: Record<string, unknown> = {}) {
    return renderToStaticMarkup(
      <MessageScrollerProvider>
        <MessageScrollerButton {...props} />
      </MessageScrollerProvider>
    );
  }

  it('по умолчанию direction="end": data-direction + подпись "Scroll to end"', () => {
    const html = renderButton();
    expect(html).toContain('data-direction="end"');
    expect(html).toContain('Scroll to end');
  });

  it('direction="start" меняет data-direction и подпись', () => {
    const html = renderButton({ direction: 'start' });
    expect(html).toContain('data-direction="start"');
    expect(html).toContain('Scroll to start');
  });

  it('дефолтные variant="secondary" и size="icon-sm" прокидываются в data-атрибуты', () => {
    const html = renderButton();
    expect(html).toContain('data-variant="secondary"');
    expect(html).toContain('data-size="icon-sm"');
  });

  it('рендерит иконку (svg) внутри кнопки по умолчанию', () => {
    const html = renderButton();
    expect(html).toMatch(/<svg/);
  });

  it('подпись направления — визуально скрытая (sr-only)', () => {
    const html = renderButton();
    expect(html).toMatch(/class="[^"]*sr-only[^"]*"/);
  });

  it('children переопределяют содержимое по умолчанию', () => {
    const html = renderToStaticMarkup(
      <MessageScrollerProvider>
        <MessageScrollerButton>Вниз</MessageScrollerButton>
      </MessageScrollerProvider>
    );
    expect(html).toContain('>Вниз');
    expect(html).not.toContain('Scroll to end');
  });
});

describe('MessageScroller — публичные behaviour-хуки', () => {
  it('реэкспортирует useMessageScroller / …Scrollable / …Visibility как функции', () => {
    expect(typeof useMessageScroller).toBe('function');
    expect(typeof useMessageScrollerScrollable).toBe('function');
    expect(typeof useMessageScrollerVisibility).toBe('function');
  });
});
