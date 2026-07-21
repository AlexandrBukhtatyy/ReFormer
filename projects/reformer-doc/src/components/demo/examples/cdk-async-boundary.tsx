import { useState } from 'react';
import { AsyncBoundary, type AsyncStatus } from '@reformer/cdk/async-boundary';
import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Headless AsyncBoundary из `@reformer/cdk` — состояния загрузки данных без разметки.
 * Слоты возвращают голые фрагменты, всю вёрстку и ARIA-атрибуты задаёт консумент
 * (или готовая обёртка `AsyncBoundary` из `@reformer/ui-kit`). Демо ниже использует
 * inline-стили именно чтобы показать: CDK ничего не навязывает.
 */

const box: React.CSSProperties = {
  border: '1px solid var(--ifm-color-emphasis-300)',
  borderRadius: 8,
  padding: 16,
  fontSize: 14,
  width: '100%',
};

/** Переключатель состояний — чтобы каждое можно было посмотреть вживую. */
function StatePlayground() {
  const [status, setStatus] = useState<AsyncStatus>('loading');

  return (
    <div style={{ display: 'grid', gap: 12, width: '100%' }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['idle', 'loading', 'ready', 'error'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => setStatus(s)}
          >
            {s}
          </Button>
        ))}
      </div>

      <AsyncBoundary.Root
        status={status}
        error="Сервер недоступен"
        onRetry={() => setStatus('ready')}
      >
        <div style={box}>
          <AsyncBoundary.Idle>Загрузка не запускалась — новая запись.</AsyncBoundary.Idle>

          <AsyncBoundary.Loading>
            <span role="status" aria-live="polite">
              Загрузка…
            </span>
          </AsyncBoundary.Loading>

          <AsyncBoundary.Error>
            {({ error, retry }) => (
              <div role="alert" aria-live="assertive" style={{ display: 'grid', gap: 8 }}>
                <span>{String(error)}</span>
                <div>
                  <Button size="sm" variant="outline" onClick={retry}>
                    Повторить
                  </Button>
                </div>
              </div>
            )}
          </AsyncBoundary.Error>

          <AsyncBoundary.Content>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>Россия</li>
              <li>Казахстан</li>
              <li>Армения</li>
            </ul>
          </AsyncBoundary.Content>
        </div>
      </AsyncBoundary.Root>
    </div>
  );
}

function EmptyDemo() {
  return (
    <AsyncBoundary.Root status="ready">
      <div style={box}>
        <AsyncBoundary.Content>
          <AsyncBoundary.Empty when>
            <span style={{ color: 'var(--ifm-color-emphasis-600)' }}>Ничего не найдено</span>
          </AsyncBoundary.Empty>
        </AsyncBoundary.Content>
      </div>
    </AsyncBoundary.Root>
  );
}

export const cdkAsyncBoundaryDocConfig: ComponentDocConfig = {
  name: 'AsyncBoundary',
  importFrom: '@reformer/cdk/async-boundary',
  description:
    'Headless-компонент состояний загрузки данных: idle / loading / ready / error. Слоты возвращают голые фрагменты — разметку и ARIA задаёт консумент. Слот Error получает саму ошибку и retry через render-функцию. Это не Suspense-boundary: статусом управляете вы, данные компонент не грузит.',
  variants: [
    {
      id: 'playground',
      title: 'Все состояния',
      description:
        'Переключайте статус — в каждый момент рендерится ровно один слот. Empty и Content живут внутри ready, idle не схлопывается в ready.',
      render: () => <StatePlayground />,
      code: `<AsyncBoundary.Root status={status} error={error} onRetry={reload}>
  <AsyncBoundary.Idle>Новая запись</AsyncBoundary.Idle>

  <AsyncBoundary.Loading>
    <span role="status" aria-live="polite">Загрузка…</span>
  </AsyncBoundary.Loading>

  <AsyncBoundary.Error>
    {({ error, retry }) => (
      <div role="alert" aria-live="assertive">
        {String(error)}
        <button onClick={retry}>Повторить</button>
      </div>
    )}
  </AsyncBoundary.Error>

  <AsyncBoundary.Content>
    <CountriesList />
  </AsyncBoundary.Content>
</AsyncBoundary.Root>`,
    },
    {
      id: 'empty',
      title: 'Пустой результат',
      description:
        'Пустота — предикат поверх ready, а не пятый статус: считать его умеет только консумент, поэтому он приходит пропом when.',
      render: () => <EmptyDemo />,
      code: `<AsyncBoundary.Content>
  <AsyncBoundary.Empty when={items.length === 0}>
    Ничего не найдено
  </AsyncBoundary.Empty>
  {items.map(renderItem)}
</AsyncBoundary.Content>`,
    },
  ],
  examples: [
    {
      id: 'hook',
      title: 'Без compound-дерева: useAsyncBoundary',
      description:
        'Тот же расчёт состояния в виде хука с готовыми наборами a11y-пропсов — когда разметка пишется вручную.',
      render: () => <StatePlayground />,
      code: `import { useAsyncBoundary } from '@reformer/cdk/async-boundary';

function Panel({ status, error, reload, children }: Props) {
  const { isLoading, isError, retry, rootProps, loadingProps, errorProps } =
    useAsyncBoundary({ status, error, onRetry: reload, delayMs: 200 });

  return (
    <section {...rootProps}>
      {isLoading && <p {...loadingProps}>Загрузка…</p>}
      {isError && (
        <div {...errorProps}>
          {String(error)}
          <button onClick={retry}>Повторить</button>
        </div>
      )}
      {!isLoading && !isError && children}
    </section>
  );
}`,
    },
    {
      id: 'refreshing',
      title: 'Фоновое обновление',
      description:
        'refreshing оставляет уже показанный контент на экране (stale-while-revalidate) и помечает регион aria-busy — пользователь не теряет контекст.',
      render: () => <StatePlayground />,
      code: `<AsyncBoundary.Root status="ready" refreshing={isRefetching}>
  {/* контент виден; передайте showWhileRefreshing={false}, чтобы скрывать */}
  <AsyncBoundary.Content>
    <DataTable rows={rows} />
  </AsyncBoundary.Content>
</AsyncBoundary.Root>`,
    },
  ],
  props: [
    {
      name: 'status',
      type: "'idle' | 'loading' | 'ready' | 'error'",
      description:
        'Состояние асинхронной операции. idle — загрузка не запускалась (например, форма создания).',
    },
    {
      name: 'error',
      type: 'E | null',
      description: 'Полезная нагрузка ошибки. Приходит в render-функцию слота Error.',
    },
    {
      name: 'onRetry',
      type: '() => void',
      description:
        'Повтор загрузки. Без него canRetry === false и AsyncBoundary.Retry не рендерится.',
    },
    {
      name: 'refreshing',
      type: 'boolean',
      description: 'Фоновое обновление поверх показанного контента.',
    },
    {
      name: 'delayMs',
      type: 'number',
      description:
        'Не показывать слот Loading первые N мс — гасит вспышку спиннера. Статус при этом не подменяется.',
    },
    {
      name: 'id',
      type: 'string',
      description: 'Явный префикс генерируемых id для a11y-связок (по умолчанию useId).',
    },
  ],
};
