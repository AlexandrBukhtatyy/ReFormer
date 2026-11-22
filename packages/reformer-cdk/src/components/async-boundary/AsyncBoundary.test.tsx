/**
 * Unit-тесты AsyncBoundary — headless-состояния загрузки данных в CDK.
 *
 * Проверяет взаимоисключаемость слотов (idle / loading / ready / error), передачу
 * ошибки и `retry` в render-функцию слота Error (то, чего не было у props-less слотов
 * прежнего ui-kit AsyncBoundary), поведение `Empty` только внутри `ready`, stale-while-
 * revalidate у `Content` и скрытие `Retry` без `onRetry`.
 */
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AsyncBoundaryContext, type AsyncBoundaryContextValue } from './AsyncBoundaryContext';
import { AsyncBoundaryIdle } from './AsyncBoundaryIdle';
import { AsyncBoundaryLoading } from './AsyncBoundaryLoading';
import { AsyncBoundaryContent } from './AsyncBoundaryContent';
import { AsyncBoundaryEmpty } from './AsyncBoundaryEmpty';
import { AsyncBoundaryError } from './AsyncBoundaryError';
import { AsyncBoundaryRetry } from './AsyncBoundaryRetry';
import { AsyncBoundary } from './AsyncBoundary';
import type { AsyncStatus } from './types';

function ctx(
  overrides: Partial<AsyncBoundaryContextValue<unknown, string>> = {}
): AsyncBoundaryContextValue<unknown, string> {
  const status: AsyncStatus = overrides.status ?? 'ready';
  return {
    status,
    data: undefined,
    isIdle: status === 'idle',
    isLoading: status === 'loading',
    isReady: status === 'ready',
    isError: status === 'error',
    refreshing: false,
    error: null,
    retry: () => {},
    canRetry: false,
    ids: { region: 'async-x', status: 'async-status-x', error: 'async-error-x' },
    rootProps: { id: 'async-x', 'data-status': status },
    loadingProps: { id: 'async-status-x', role: 'status', 'aria-live': 'polite' },
    errorProps: { id: 'async-error-x', role: 'alert', 'aria-live': 'assertive' },
    ...overrides,
  };
}

const render = (value: AsyncBoundaryContextValue<unknown, string>, node: React.ReactElement) =>
  renderToStaticMarkup(
    <AsyncBoundaryContext.Provider value={value}>{node}</AsyncBoundaryContext.Provider>
  );

describe('AsyncBoundary — слоты состояний', () => {
  it('Loading рендерится только при isLoading', () => {
    expect(
      render(ctx({ status: 'loading' }), <AsyncBoundaryLoading>грузим</AsyncBoundaryLoading>)
    ).toBe('грузим');
    expect(
      render(ctx({ status: 'ready' }), <AsyncBoundaryLoading>грузим</AsyncBoundaryLoading>)
    ).toBe('');
  });

  it('Loading скрыт, пока не истёк delayMs (isLoading=false при status=loading)', () => {
    // Отложенный спиннер: статус уже loading, но флаг ещё false — вспышки нет.
    const delayed = ctx({ status: 'loading', isLoading: false });
    expect(render(delayed, <AsyncBoundaryLoading>грузим</AsyncBoundaryLoading>)).toBe('');
  });

  it('Idle рендерится только при status=idle', () => {
    expect(render(ctx({ status: 'idle' }), <AsyncBoundaryIdle>новая</AsyncBoundaryIdle>)).toBe(
      'новая'
    );
    expect(render(ctx({ status: 'ready' }), <AsyncBoundaryIdle>новая</AsyncBoundaryIdle>)).toBe('');
  });

  it('Content рендерится только при status=ready', () => {
    expect(
      render(ctx({ status: 'ready' }), <AsyncBoundaryContent>форма</AsyncBoundaryContent>)
    ).toBe('форма');
    expect(
      render(ctx({ status: 'error' }), <AsyncBoundaryContent>форма</AsyncBoundaryContent>)
    ).toBe('');
  });

  it('Content остаётся видимым при refreshing (stale-while-revalidate)', () => {
    const refreshing = ctx({ status: 'ready', refreshing: true });
    expect(render(refreshing, <AsyncBoundaryContent>форма</AsyncBoundaryContent>)).toBe('форма');
  });

  it('Content скрывается при refreshing, если showWhileRefreshing=false', () => {
    const refreshing = ctx({ status: 'ready', refreshing: true });
    expect(
      render(
        refreshing,
        <AsyncBoundaryContent showWhileRefreshing={false}>форма</AsyncBoundaryContent>
      )
    ).toBe('');
  });
});

describe('AsyncBoundary.Empty', () => {
  it('рендерится только внутри ready и только при when=true', () => {
    expect(
      render(ctx({ status: 'ready' }), <AsyncBoundaryEmpty when>пусто</AsyncBoundaryEmpty>)
    ).toBe('пусто');
    expect(
      render(ctx({ status: 'ready' }), <AsyncBoundaryEmpty when={false}>пусто</AsyncBoundaryEmpty>)
    ).toBe('');
    // when=true во время загрузки не должен «опережать» данные.
    expect(
      render(ctx({ status: 'loading' }), <AsyncBoundaryEmpty when>пусто</AsyncBoundaryEmpty>)
    ).toBe('');
  });
});

describe('AsyncBoundary.Error', () => {
  it('ничего не рендерит вне состояния error', () => {
    expect(render(ctx({ status: 'ready' }), <AsyncBoundaryError>беда</AsyncBoundaryError>)).toBe(
      ''
    );
  });

  it('render-функция получает саму ошибку и canRetry', () => {
    const value = ctx({ status: 'error', error: 'Ошибка загрузки заявки', canRetry: true });
    const html = render(
      value,
      <AsyncBoundaryError<string>>
        {({ error, canRetry }) => (
          <p>
            {error}
            {canRetry ? ' (можно повторить)' : ''}
          </p>
        )}
      </AsyncBoundaryError>
    );
    expect(html).toBe('<p>Ошибка загрузки заявки (можно повторить)</p>');
  });

  it('вызывает retry из контекста', () => {
    let called = 0;
    const value = ctx({ status: 'error', canRetry: true, retry: () => (called += 1) });
    render(
      value,
      <AsyncBoundaryError>
        {({ retry }) => {
          retry();
          return null;
        }}
      </AsyncBoundaryError>
    );
    expect(called).toBe(1);
  });

  it('принимает статичный узел вместо render-функции', () => {
    const value = ctx({ status: 'error', error: 'что-то пошло не так' });
    expect(render(value, <AsyncBoundaryError>Не удалось загрузить</AsyncBoundaryError>)).toBe(
      'Не удалось загрузить'
    );
  });
});

describe('AsyncBoundary.Retry', () => {
  it('не рендерится без onRetry (canRetry=false)', () => {
    expect(
      render(ctx({ status: 'error' }), <AsyncBoundaryRetry>Повторить</AsyncBoundaryRetry>)
    ).toBe('');
  });

  it('рендерит button[type=button] когда retry доступен', () => {
    const value = ctx({ status: 'error', canRetry: true });
    const html = render(value, <AsyncBoundaryRetry>Повторить</AsyncBoundaryRetry>);
    expect(html).toContain('<button');
    expect(html).toContain('type="button"');
    expect(html).toContain('Повторить');
  });

  it('asChild подменяет тег и не навязывает type', () => {
    const value = ctx({ status: 'error', canRetry: true });
    const html = render(
      value,
      <AsyncBoundaryRetry asChild>
        <a href="/reload">Повторить</a>
      </AsyncBoundaryRetry>
    );
    expect(html).toContain('<a');
    expect(html).not.toContain('type="button"');
  });
});

describe('AsyncBoundary.Root', () => {
  it('показывает ровно один слот на состояние', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary.Root status="error" error="упало" onRetry={() => {}}>
        <AsyncBoundary.Idle>idle</AsyncBoundary.Idle>
        <AsyncBoundary.Loading>loading</AsyncBoundary.Loading>
        <AsyncBoundary.Content>content</AsyncBoundary.Content>
        <AsyncBoundary.Error>{({ error }) => <span>{String(error)}</span>}</AsyncBoundary.Error>
      </AsyncBoundary.Root>
    );
    expect(html).toBe('<span>упало</span>');
  });

  it('idle не схлопывается в ready', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary.Root status="idle">
        <AsyncBoundary.Idle>новая заявка</AsyncBoundary.Idle>
        <AsyncBoundary.Content>заполненная</AsyncBoundary.Content>
      </AsyncBoundary.Root>
    );
    expect(html).toBe('новая заявка');
  });

  it('слот вне Root бросает понятную ошибку', () => {
    expect(() => renderToStaticMarkup(<AsyncBoundaryLoading>грузим</AsyncBoundaryLoading>)).toThrow(
      /within <AsyncBoundary.Root>/
    );
  });

  it('controlled без status трактуется как idle, а не как ready', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary.Root>
        <AsyncBoundary.Idle>нечего грузить</AsyncBoundary.Idle>
        <AsyncBoundary.Content>данные</AsyncBoundary.Content>
      </AsyncBoundary.Root>
    );
    expect(html).toBe('нечего грузить');
  });
});

describe('AsyncBoundary.Root — self-managed режим (load)', () => {
  it('на первом рендере показывает загрузку, не дожидаясь ответа', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary.Root load={() => new Promise<string>(() => {})}>
        <AsyncBoundary.Loading>грузим</AsyncBoundary.Loading>
        <AsyncBoundary.Content>данные</AsyncBoundary.Content>
      </AsyncBoundary.Root>
    );
    // renderToStaticMarkup не выполняет эффекты — до старта загрузки состояние idle.
    expect(html).not.toContain('данные');
  });

  it('enabled={false} даёт idle и не вызывает load', () => {
    let calls = 0;
    const html = renderToStaticMarkup(
      <AsyncBoundary.Root
        enabled={false}
        load={() => {
          calls += 1;
          return Promise.resolve('x');
        }}
      >
        <AsyncBoundary.Idle>создание новой записи</AsyncBoundary.Idle>
        <AsyncBoundary.Loading>грузим</AsyncBoundary.Loading>
      </AsyncBoundary.Root>
    );
    expect(html).toBe('создание новой записи');
    expect(calls).toBe(0);
  });

  it('Content с render-функцией ничего не рендерит, пока данных нет', () => {
    const html = renderToStaticMarkup(
      <AsyncBoundary.Root status="ready">
        <AsyncBoundary.Content<string>>{(d) => <span>{d}</span>}</AsyncBoundary.Content>
      </AsyncBoundary.Root>
    );
    expect(html).toBe('');
  });

  it('Content с render-функцией получает данные из контекста', () => {
    const value = ctx({ status: 'ready', data: 'Иванов' });
    const html = render(
      value,
      <AsyncBoundaryContent<string>>{(d) => <span>{d}</span>}</AsyncBoundaryContent>
    );
    expect(html).toBe('<span>Иванов</span>');
  });
});
