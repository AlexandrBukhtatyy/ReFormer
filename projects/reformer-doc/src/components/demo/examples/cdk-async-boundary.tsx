import { useEffect, useRef, useState } from 'react';
import {
  AsyncBoundary,
  useAsyncBoundary,
  type AsyncBoundaryHandle,
  type AsyncStatus,
} from '@reformer/cdk/async-boundary';
import { Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * Headless AsyncBoundary из `@reformer/cdk` — состояния загрузки данных без разметки.
 * Слоты возвращают голые фрагменты, всю вёрстку задаёт консумент (или готовая обёртка
 * `AsyncBoundary` из `@reformer/ui-kit`). Демо используют inline-стили, чтобы показать:
 * cdk ничего не навязывает.
 */

const BOX: React.CSSProperties = {
  border: '1px solid var(--ifm-color-emphasis-300)',
  borderRadius: 8,
  padding: 16,
  fontSize: 14,
  width: '100%',
};

const STACK: React.CSSProperties = { display: 'grid', gap: 12, width: '100%' };
const TOOLBAR: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const MUTED: React.CSSProperties = { color: 'var(--ifm-color-emphasis-600)', fontSize: 13 };

type Country = { code: string; name: string };

const COUNTRIES: Country[] = [
  { code: 'ru', name: 'Россия' },
  { code: 'kz', name: 'Казахстан' },
  { code: 'am', name: 'Армения' },
];

/** Имитация сервера: ответ через 800 мс, отмена по `signal`, отказ по флагу `fail`. */
function fetchCountries(signal: AbortSignal, fail: boolean): Promise<Country[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (fail) reject(new Error('Сервер недоступен'));
      else resolve(COUNTRIES);
    }, 800);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

/** Controlled: статус приходит пропом, переключатель — чтобы увидеть каждое состояние. */
function ControlledDemo() {
  const [status, setStatus] = useState<AsyncStatus>('loading');

  return (
    <div style={STACK}>
      <div style={TOOLBAR}>
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
        onRetry={() => setStatus('loading')}
      >
        <div style={BOX}>
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
              {COUNTRIES.map((c) => (
                <li key={c.code}>{c.name}</li>
              ))}
            </ul>
          </AsyncBoundary.Content>
        </div>
      </AsyncBoundary.Root>
    </div>
  );
}

/** Self-managed: компонент грузит сам, ref даёт reload/abort для кнопок снаружи границы. */
function SelfManagedDemo() {
  const [fail, setFail] = useState(false);
  const boundaryRef = useRef<AsyncBoundaryHandle<Country[]>>(null);

  return (
    <div style={STACK}>
      <div style={{ ...TOOLBAR, alignItems: 'center' }}>
        <Button size="sm" variant="outline" onClick={() => boundaryRef.current?.reload()}>
          Обновить
        </Button>
        <Button size="sm" variant="ghost" onClick={() => boundaryRef.current?.abort()}>
          Отменить
        </Button>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <input type="checkbox" checked={fail} onChange={(e) => setFail(e.target.checked)} />
          Сервер отвечает ошибкой
        </label>
      </div>

      <AsyncBoundary.Root
        ref={boundaryRef}
        load={(signal) => fetchCountries(signal, fail)}
        delayMs={200}
      >
        <div style={BOX}>
          <AsyncBoundary.Idle>
            <span style={MUTED}>Загрузка отменена — нажмите «Обновить».</span>
          </AsyncBoundary.Idle>

          <AsyncBoundary.Loading>
            <span role="status" aria-live="polite">
              Загрузка стран…
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

          <AsyncBoundary.Content<Country[]>>
            {(countries) => (
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {countries.map((c) => (
                  <li key={c.code}>{c.name}</li>
                ))}
              </ul>
            )}
          </AsyncBoundary.Content>
        </div>
      </AsyncBoundary.Root>
    </div>
  );
}

function EmptyDemo() {
  const [items, setItems] = useState<Country[]>([]);

  return (
    <div style={STACK}>
      <div style={TOOLBAR}>
        <Button size="sm" variant="outline" onClick={() => setItems(items.length ? [] : COUNTRIES)}>
          {items.length ? 'Очистить' : 'Наполнить'}
        </Button>
      </div>
      <AsyncBoundary.Root status="ready">
        <div style={BOX}>
          <AsyncBoundary.Content>
            <AsyncBoundary.Empty when={items.length === 0}>
              <span style={MUTED}>Ничего не найдено</span>
            </AsyncBoundary.Empty>
            {items.map((c) => (
              <div key={c.code}>{c.name}</div>
            ))}
          </AsyncBoundary.Content>
        </div>
      </AsyncBoundary.Root>
    </div>
  );
}

/** Та же логика состояний хуком — разметка пишется вручную. */
function HookDemo() {
  const [status, setStatus] = useState<AsyncStatus>('ready');
  const { isLoading, isError, isReady, error, retry, rootProps, loadingProps, errorProps } =
    useAsyncBoundary({
      status,
      error: status === 'error' ? 'Сервер недоступен' : null,
      onRetry: () => setStatus('ready'),
      delayMs: 200,
    });

  return (
    <div style={STACK}>
      <div style={TOOLBAR}>
        {(['loading', 'ready', 'error'] as const).map((s) => (
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
      <section {...rootProps} style={BOX}>
        {isLoading && <p {...loadingProps}>Загрузка…</p>}
        {isError && (
          <div {...errorProps} style={{ display: 'grid', gap: 8 }}>
            <span>{String(error)}</span>
            <div>
              <Button size="sm" variant="outline" onClick={retry}>
                Повторить
              </Button>
            </div>
          </div>
        )}
        {isReady && <p style={{ margin: 0 }}>Данные загружены.</p>}
      </section>
    </div>
  );
}

/** Фоновое обновление: контент на месте, регион помечен aria-busy. */
function RefreshingDemo() {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!refreshing) return;
    const timer = setTimeout(() => setRefreshing(false), 1500);
    return () => clearTimeout(timer);
  }, [refreshing]);

  return (
    <div style={STACK}>
      <div style={TOOLBAR}>
        <Button
          size="sm"
          variant="outline"
          disabled={refreshing}
          onClick={() => setRefreshing(true)}
        >
          {refreshing ? 'Обновляется…' : 'Обновить в фоне'}
        </Button>
      </div>
      <AsyncBoundary.Root status="ready" refreshing={refreshing}>
        <div style={{ ...BOX, opacity: refreshing ? 0.6 : 1, transition: 'opacity .2s' }}>
          <AsyncBoundary.Content>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {COUNTRIES.map((c) => (
                <li key={c.code}>{c.name}</li>
              ))}
            </ul>
          </AsyncBoundary.Content>
        </div>
      </AsyncBoundary.Root>
    </div>
  );
}

export const cdkAsyncBoundaryDocConfig: ComponentDocConfig = {
  name: 'AsyncBoundary',
  importFrom: '@reformer/cdk/async-boundary',
  description:
    'Headless-компонент состояний загрузки данных: idle / loading / ready / error. Грузит данные сам (проп load) или показывает статус, который ведёт ваш код (проп status). Слоты не добавляют разметки — вёрстку пишете вы.',
  variants: [
    {
      id: 'controlled',
      title: 'Статус снаружи (controlled)',
      description:
        'Без load состояние приходит пропом status. В каждый момент виден ровно один слот; idle — отдельное состояние, а не ready.',
      render: ControlledDemo,
      code: `const [status, setStatus] = useState<AsyncStatus>('loading');

<AsyncBoundary.Root status={status} error="Сервер недоступен" onRetry={() => setStatus('loading')}>
  <AsyncBoundary.Idle>Загрузка не запускалась — новая запись.</AsyncBoundary.Idle>

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
      id: 'self-managed',
      title: 'Загрузка внутри компонента (self-managed)',
      description:
        'С load компонент грузит сам: отменяет запрос при размонтировании, даёт повтор, а повторная загрузка поверх данных идёт в фоне. Ref даёт reload() и abort() кнопкам вне границы.',
      render: SelfManagedDemo,
      code: `const boundaryRef = useRef<AsyncBoundaryHandle<Country[]>>(null);

<button onClick={() => boundaryRef.current?.reload()}>Обновить</button>
<button onClick={() => boundaryRef.current?.abort()}>Отменить</button>

<AsyncBoundary.Root
  ref={boundaryRef}
  load={(signal) => fetchCountries(signal)} // signal — в fetch, чтобы отмена дошла до сети
  delayMs={200}
>
  <AsyncBoundary.Idle>Загрузка отменена — нажмите «Обновить».</AsyncBoundary.Idle>
  <AsyncBoundary.Loading>
    <span role="status" aria-live="polite">Загрузка стран…</span>
  </AsyncBoundary.Loading>
  <AsyncBoundary.Error>
    {({ error, retry }) => (
      <div role="alert" aria-live="assertive">
        {String(error)}
        <button onClick={retry}>Повторить</button>
      </div>
    )}
  </AsyncBoundary.Error>
  <AsyncBoundary.Content<Country[]>>
    {(countries) => (
      <ul>
        {countries.map((c) => <li key={c.code}>{c.name}</li>)}
      </ul>
    )}
  </AsyncBoundary.Content>
</AsyncBoundary.Root>`,
    },
    {
      id: 'empty',
      title: 'Пустой результат',
      description:
        'Пустота — предикат внутри ready, а не пятый статус: посчитать её может только ваш код, поэтому она приходит пропом when.',
      render: EmptyDemo,
      code: `<AsyncBoundary.Root status="ready">
  <AsyncBoundary.Content>
    <AsyncBoundary.Empty when={items.length === 0}>Ничего не найдено</AsyncBoundary.Empty>
    {items.map((c) => <div key={c.code}>{c.name}</div>)}
  </AsyncBoundary.Content>
</AsyncBoundary.Root>`,
    },
  ],
  examples: [
    {
      id: 'hook',
      title: 'Без compound-дерева: useAsyncBoundary',
      description:
        'Тот же расчёт состояния хуком с готовыми наборами a11y-пропсов — когда разметка пишется вручную.',
      render: HookDemo,
      code: `import { useAsyncBoundary } from '@reformer/cdk/async-boundary';

const { isLoading, isError, isReady, error, retry, rootProps, loadingProps, errorProps } =
  useAsyncBoundary({ status, error, onRetry: reload, delayMs: 200 });

<section {...rootProps}>
  {isLoading && <p {...loadingProps}>Загрузка…</p>}
  {isError && (
    <div {...errorProps}>
      {String(error)}
      <button onClick={retry}>Повторить</button>
    </div>
  )}
  {isReady && <p>Данные загружены.</p>}
</section>`,
    },
    {
      id: 'refreshing',
      title: 'Фоновое обновление',
      description:
        'refreshing оставляет показанный контент на экране и ставит региону aria-busy. Чтобы скрывать контент на время обновления, передайте Content проп showWhileRefreshing={false}.',
      render: RefreshingDemo,
      code: `<AsyncBoundary.Root status="ready" refreshing={isRefetching}>
  <AsyncBoundary.Content>
    <CountriesList />
  </AsyncBoundary.Content>
</AsyncBoundary.Root>`,
    },
  ],
  props: [
    {
      name: 'load',
      type: '(signal: AbortSignal) => Promise<T>',
      description:
        'Включает self-managed режим: компонент грузит сам. signal прокидывайте в fetch — отмена дойдёт до сети. Режим выбирается при монтировании.',
    },
    {
      name: 'loadKey / enabled',
      type: 'unknown / boolean',
      default: 'enabled: true',
      description:
        'Смена loadKey перезапускает загрузку и отменяет прежний запрос (сравнение по Object.is — нужен примитив). enabled={false} — грузить нечего, статус idle.',
    },
    {
      name: 'onSuccess / onError / toError',
      type: '(data: T) => void / (error: E) => void / (e: unknown) => E',
      description:
        'Что сделать с ответом и с ошибкой. Без toError ошибка — текст отказа или локализованная фраза «Unknown error».',
    },
    {
      name: 'status / error / onRetry',
      type: "'idle' | 'loading' | 'ready' | 'error' / E | null / () => void",
      description:
        'Controlled режим (load не передан). Без onRetry повтор недоступен: canRetry === false, AsyncBoundary.Retry не рендерится. В self-managed режиме эти пропсы игнорируются.',
    },
    {
      name: 'refreshing',
      type: 'boolean',
      default: 'false',
      description: 'Фоновое обновление поверх показанного контента (controlled режим).',
    },
    {
      name: 'delayMs',
      type: 'number',
      default: '0',
      description:
        'Не показывать слот Loading первые N мс — гасит вспышку индикатора. Статус при этом остаётся loading.',
    },
    {
      name: 'id',
      type: 'string',
      description: 'Префикс генерируемых id для a11y-связок (по умолчанию useId).',
    },
    {
      name: 'ref',
      type: 'AsyncBoundaryHandle<T, E>',
      description:
        'reload() и abort() для триггеров вне дерева; status / data / error — снимок на момент рендера. В controlled режиме reload() зовёт onRetry, abort() ничего не делает.',
    },
    {
      name: 'Idle / Loading / Error / Content / Empty / Retry',
      type: 'слоты',
      description:
        'Error принимает узел или функцию ({ error, retry, canRetry }); Content — узел или функцию (data) в self-managed режиме и проп showWhileRefreshing; Empty — проп when; Retry — кнопка (asChild).',
    },
    {
      name: 'useAsyncBoundary(options)',
      type: '→ { status, isIdle, isLoading, isReady, isError, refreshing, error, retry, canRetry, ids, rootProps, loadingProps, errorProps }',
      description: 'Расчёт состояния без compound-дерева. isLoading учитывает delayMs.',
    },
    {
      name: 'useAsyncResource(options)',
      type: '→ { status, data, error, refreshing, reload, abort }',
      description:
        'Загрузка с отменой и повтором без разметки — то, что Root использует в self-managed режиме.',
    },
  ],
};
