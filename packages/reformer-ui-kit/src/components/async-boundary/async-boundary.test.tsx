import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  AsyncBoundary,
  AsyncBoundaryLoading,
  AsyncBoundaryError,
  AsyncBoundaryEmpty,
} from './index';

describe('AsyncBoundary — переключение состояний', () => {
  it('status="loading" рендерит блок загрузки, не контент и не ошибку', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary status="loading" error="упало">
        <span>content</span>
      </AsyncBoundary>
    );
    expect(html).toContain('data-slot="async-boundary-loading"');
    expect(html).not.toContain('data-slot="async-boundary-error"');
    expect(html).not.toContain('content');
  });

  it('status="error" рендерит блок ошибки с её текстом, не контент', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary status="error" error="Не удалось загрузить заявку">
        <span>content</span>
      </AsyncBoundary>
    );
    expect(html).toContain('data-slot="async-boundary-error"');
    expect(html).toContain('Не удалось загрузить заявку');
    expect(html).not.toContain('content');
  });

  it('status="ready" рендерит children', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary status="ready">
        <span>content</span>
      </AsyncBoundary>
    );
    expect(html).toContain('content');
    expect(html).not.toContain('data-slot="async-boundary-loading"');
  });

  it('status="idle" показывает children, а не индикатор загрузки', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary status="idle">
        <span>пустая форма</span>
      </AsyncBoundary>
    );
    expect(html).toContain('пустая форма');
    expect(html).not.toContain('data-slot="async-boundary-loading"');
  });

  it('регион несёт data-status и aria-busy во время загрузки', () => {
    const html = renderToStaticMarkup(<AsyncBoundary status="loading" />);
    expect(html).toContain('data-slot="async-boundary"');
    expect(html).toContain('data-status="loading"');
    expect(html).toContain('aria-busy="true"');
  });

  it('refreshing оставляет контент и помечает регион занятым', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary status="ready" refreshing>
        <span>content</span>
      </AsyncBoundary>
    );
    expect(html).toContain('content');
    expect(html).toContain('data-refreshing="true"');
    expect(html).toContain('aria-busy="true"');
  });

  it('в ready регион не помечен занятым', () => {
    const html = renderToStaticMarkup(<AsyncBoundary status="ready" />);
    expect(html).not.toContain('aria-busy');
    expect(html).not.toContain('data-refreshing');
  });
});

describe('AsyncBoundary — слоты и повтор', () => {
  it('кнопка повтора появляется только с onRetry', () => {
    const without = renderToStaticMarkup(<AsyncBoundary status="error" error="упало" />);
    expect(without).not.toContain('data-slot="async-boundary-retry"');

    const withRetry = renderToStaticMarkup(
      <AsyncBoundary status="error" error="упало" onRetry={() => {}} />
    );
    expect(withRetry).toContain('data-slot="async-boundary-retry"');
    expect(withRetry).toContain('Повторить');
  });

  it('errorSlot как render-функция получает саму ошибку и retry', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary
        status="error"
        error="Ошибка загрузки справочников"
        onRetry={() => {}}
        errorSlot={({ error, canRetry }) => (
          <p data-slot="custom-error">
            {error}
            {canRetry ? ' / retry' : ''}
          </p>
        )}
      />
    );
    expect(html).toContain('data-slot="custom-error"');
    expect(html).toContain('Ошибка загрузки справочников / retry');
    expect(html).not.toContain('data-slot="async-boundary-error"');
  });

  it('loadingSlot полностью заменяет блок загрузки', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary status="loading" loadingSlot={<p data-slot="skeleton">…</p>} />
    );
    expect(html).toContain('data-slot="skeleton"');
    expect(html).not.toContain('data-slot="async-boundary-loading"');
  });

  it('delayMs откладывает показ загрузки — на первом рендере блока нет', () => {
    const html = renderToStaticMarkup(<AsyncBoundary status="loading" delayMs={300} />);
    expect(html).not.toContain('data-slot="async-boundary-loading"');
    // Регион при этом уже объявлен занятым: подменяется только момент показа UI, не статус.
    expect(html).toContain('aria-busy="true"');
  });
});

describe('AsyncBoundaryLoading / AsyncBoundaryError — a11y и контракт e2e', () => {
  it('загрузка объявляется вежливо и несёт testid loading-state', () => {
    const html = renderToStaticMarkup(<AsyncBoundaryLoading />);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-testid="loading-state"');
  });

  it('ошибка объявляется настойчиво и несёт testid error-state', () => {
    const html = renderToStaticMarkup(<AsyncBoundaryError error="Не удалось загрузить" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    expect(html).toContain('data-testid="error-state"');
  });

  it('используются токены темы, а не числовая палитра Tailwind', () => {
    const html = renderToStaticMarkup(<AsyncBoundaryError error="упало" onRetry={() => {}} />);
    expect(html).toContain('text-destructive');
    expect(html).toContain('bg-card');
    expect(html).not.toMatch(/bg-red-\d|text-gray-\d|border-blue-\d/);
  });

  it('className мержится, дефолтный конфликтующий класс вытесняется', () => {
    const html = renderToStaticMarkup(<AsyncBoundaryLoading className="p-0" />);
    expect(html).toContain('p-0');
    expect(html).not.toContain('p-12');
  });

  it('произвольные props пробрасываются на корневой элемент', () => {
    const html = renderToStaticMarkup(<AsyncBoundaryLoading id="loader" data-x="1" />);
    expect(html).toContain('id="loader"');
    expect(html).toContain('data-x="1"');
  });
});

describe('AsyncBoundary — self-managed режим (load)', () => {
  it('enabled={false} не запускает загрузку и показывает children', () => {
    let calls = 0;
    const html = renderToStaticMarkup(
      <AsyncBoundary
        enabled={false}
        load={() => {
          calls += 1;
          return Promise.resolve('x');
        }}
      >
        <span>пустая форма</span>
      </AsyncBoundary>
    );
    expect(calls).toBe(0);
    expect(html).toContain('пустая форма');
    expect(html).toContain('data-status="idle"');
  });

  it('в self-managed режиме проп status игнорируется', () => {
    // Состоянием владеет компонент: переданный снаружи status не должен
    // конкурировать с внутренним и «застревать» на loading.
    const html = renderToStaticMarkup(
      <AsyncBoundary status="ready" enabled={false} load={() => Promise.resolve('x')}>
        <span>контент</span>
      </AsyncBoundary>
    );
    expect(html).toContain('data-status="idle"');
  });
});

describe('AsyncBoundaryEmpty', () => {
  it('рендерит пустое состояние без role="alert"', () => {
    const html = renderToStaticMarkup(<AsyncBoundaryEmpty description="Заявок пока нет" />);
    expect(html).toContain('data-slot="async-boundary-empty"');
    expect(html).toContain('Нет данных');
    expect(html).toContain('Заявок пока нет');
    expect(html).not.toContain('role="alert"');
  });
});
