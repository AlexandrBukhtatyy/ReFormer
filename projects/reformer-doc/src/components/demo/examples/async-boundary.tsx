import { useState } from 'react';
import { AsyncBoundary, AsyncBoundaryEmpty, Button, Skeleton } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * AsyncBoundary — не поле формы: контейнер состояний загрузки (idle / loading / ready / error)
 * поверх headless-версии из `@reformer/cdk/async-boundary`. Variants — каждое состояние в
 * управляемом режиме (status), Examples — загрузка самим компонентом (load) и замена блоков,
 * API — таблица props. Обёртка `<div style>` в render — рамка демо, в `code` её нет.
 */

const COUNTRIES: Record<string, string[]> = {
  europe: ['Германия', 'Франция', 'Италия'],
  asia: ['Китай', 'Япония', 'Индия'],
};

// Вместо запроса к серверу — задержка; signal прерывает ожидание при смене региона.
function fetchCountries(region: string, fail: boolean, signal: AbortSignal): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (fail) reject(new Error('Сервер не ответил. Попробуйте ещё раз.'));
      else resolve(COUNTRIES[region] ?? []);
    }, 800);
    signal.addEventListener('abort', () => clearTimeout(timer));
  });
}

function SelfManagedExample() {
  const [region, setRegion] = useState('europe');
  const [fail, setFail] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button size="sm" variant="outline" onClick={() => setRegion('europe')}>
          Европа
        </Button>
        <Button size="sm" variant="outline" onClick={() => setRegion('asia')}>
          Азия
        </Button>
        <Button size="sm" variant="outline" onClick={() => setFail((v) => !v)}>
          {fail ? 'Чинить запрос' : 'Ломать запрос'}
        </Button>
      </div>
      <AsyncBoundary
        load={(signal) => fetchCountries(region, fail, signal)}
        loadKey={region}
        onSuccess={setCountries}
        delayMs={200}
      >
        <ul className="list-disc pl-6 text-sm">
          {countries.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </AsyncBoundary>
    </div>
  );
}

function EmptyResultExample() {
  const [items, setItems] = useState<string[]>([]);
  return (
    <div style={{ width: '100%', maxWidth: 420 }}>
      <AsyncBoundary status="ready">
        {items.length === 0 ? (
          <AsyncBoundaryEmpty
            title="Заявок нет"
            description="Создайте первую заявку"
            action={<Button onClick={() => setItems(['Заявка №1'])}>Создать</Button>}
          />
        ) : (
          <ul className="list-disc pl-6 text-sm">
            {items.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        )}
      </AsyncBoundary>
    </div>
  );
}

export const asyncBoundaryDocConfig: ComponentDocConfig = {
  name: 'AsyncBoundary',
  importFrom: '@reformer/ui-kit',
  description:
    'Контейнер состояний загрузки данных: idle / loading / ready / error. Блоки загрузки и ошибки встроены, заменяются слотами.',
  variants: [
    {
      id: 'loading',
      title: 'Загрузка (status="loading")',
      description: 'Спиннер с подписью, регион помечен aria-busy, содержимое скрыто.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <AsyncBoundary status="loading">
            <ul className="list-disc pl-6 text-sm">
              <li>Германия</li>
              <li>Франция</li>
            </ul>
          </AsyncBoundary>
        </div>
      ),
      code: `<AsyncBoundary status="loading">
  <ul className="list-disc pl-6 text-sm">
    <li>Германия</li>
    <li>Франция</li>
  </ul>
</AsyncBoundary>`,
    },
    {
      id: 'error',
      title: 'Ошибка (status="error")',
      description:
        'Карточка ошибки с текстом из error. Кнопка «Повторить» есть, только если передан onRetry.',
      render: () => {
        // В демо повтор ничего не делает: в приложении здесь перезапуск запроса.
        const reload = () => {};
        return (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <AsyncBoundary
              status="error"
              error="Проверьте соединение и попробуйте снова."
              onRetry={reload}
            >
              <ul className="list-disc pl-6 text-sm">
                <li>Германия</li>
                <li>Франция</li>
              </ul>
            </AsyncBoundary>
          </div>
        );
      },
      code: `<AsyncBoundary
  status="error"
  error="Проверьте соединение и попробуйте снова."
  onRetry={reload}
>
  <ul className="list-disc pl-6 text-sm">
    <li>Германия</li>
    <li>Франция</li>
  </ul>
</AsyncBoundary>`,
    },
    {
      id: 'ready',
      title: 'Данные получены (status="ready")',
      description: 'Показывается содержимое — children.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <AsyncBoundary status="ready">
            <ul className="list-disc pl-6 text-sm">
              <li>Германия</li>
              <li>Франция</li>
            </ul>
          </AsyncBoundary>
        </div>
      ),
      code: `<AsyncBoundary status="ready">
  <ul className="list-disc pl-6 text-sm">
    <li>Германия</li>
    <li>Франция</li>
  </ul>
</AsyncBoundary>`,
    },
    {
      id: 'idle',
      title: 'Загрузки не было (status="idle")',
      description:
        'Грузить нечего — например, форма создания новой записи. Показывается содержимое, а не индикатор.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <AsyncBoundary status="idle">
            <p className="text-sm">Новая заявка: заполните поля ниже.</p>
          </AsyncBoundary>
        </div>
      ),
      code: `<AsyncBoundary status="idle">
  <p className="text-sm">Новая заявка: заполните поля ниже.</p>
</AsyncBoundary>`,
    },
    {
      id: 'custom-texts',
      title: 'Свои тексты блоков',
      description:
        'errorTitle и retryLabel меняют заголовок и кнопку блока ошибки, loadingTitle и loadingSubtitle — подписи загрузки.',
      render: () => {
        // В демо повтор ничего не делает: в приложении здесь перезапуск запроса.
        const reload = () => {};
        return (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <AsyncBoundary
              status="error"
              error="Нет связи с сервером."
              errorTitle="Заявка не загрузилась"
              retryLabel="Загрузить снова"
              onRetry={reload}
            />
          </div>
        );
      },
      code: `<AsyncBoundary
  status="error"
  error="Нет связи с сервером."
  errorTitle="Заявка не загрузилась"
  retryLabel="Загрузить снова"
  onRetry={reload}
/>`,
    },
  ],
  examples: [
    {
      id: 'self-managed',
      title: 'Компонент грузит данные сам (load)',
      description:
        'load получает AbortSignal, смена loadKey перезапускает загрузку и прерывает устаревший запрос. «Ломать запрос» действует на следующую загрузку: сломайте и смените регион, потом почините и нажмите «Повторить».',
      render: SelfManagedExample,
      code: `const COUNTRIES: Record<string, string[]> = {
  europe: ['Германия', 'Франция', 'Италия'],
  asia: ['Китай', 'Япония', 'Индия'],
};

// Вместо запроса к серверу — задержка; signal прерывает ожидание при смене региона.
function fetchCountries(region: string, fail: boolean, signal: AbortSignal): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (fail) reject(new Error('Сервер не ответил. Попробуйте ещё раз.'));
      else resolve(COUNTRIES[region] ?? []);
    }, 800);
    signal.addEventListener('abort', () => clearTimeout(timer));
  });
}

function Countries() {
  const [region, setRegion] = useState('europe');
  const [fail, setFail] = useState(false);
  const [countries, setCountries] = useState<string[]>([]);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setRegion('europe')}>
        Европа
      </Button>
      <Button size="sm" variant="outline" onClick={() => setRegion('asia')}>
        Азия
      </Button>
      <Button size="sm" variant="outline" onClick={() => setFail((v) => !v)}>
        {fail ? 'Чинить запрос' : 'Ломать запрос'}
      </Button>
      <AsyncBoundary
        load={(signal) => fetchCountries(region, fail, signal)}
        loadKey={region}
        onSuccess={setCountries}
        delayMs={200}
      >
        <ul className="list-disc pl-6 text-sm">
          {countries.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      </AsyncBoundary>
    </>
  );
}`,
    },
    {
      id: 'skeleton',
      title: 'Скелетон вместо спиннера (loadingSlot)',
      description:
        'loadingSlot целиком заменяет встроенный блок загрузки — например строками-скелетонами под будущий список.',
      render: () => (
        <div style={{ width: '100%', maxWidth: 420 }}>
          <AsyncBoundary
            status="loading"
            loadingSlot={
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            }
          >
            <ul className="list-disc pl-6 text-sm">
              <li>Германия</li>
              <li>Франция</li>
            </ul>
          </AsyncBoundary>
        </div>
      ),
      code: `<AsyncBoundary
  status="loading"
  loadingSlot={
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  }
>
  <ul className="list-disc pl-6 text-sm">
    <li>Германия</li>
    <li>Франция</li>
  </ul>
</AsyncBoundary>`,
    },
    {
      id: 'error-slot',
      title: 'Свой блок ошибки (errorSlot)',
      description:
        'errorSlot-функция получает error, retry и canRetry. Роль alert своему блоку ставите сами — встроенную разметку слот заменяет целиком.',
      render: () => {
        // В демо повтор ничего не делает: в приложении здесь перезапуск запроса.
        const reload = () => {};
        return (
          <div style={{ width: '100%', maxWidth: 420 }}>
            <AsyncBoundary
              status="error"
              error="Таймаут запроса"
              onRetry={reload}
              errorSlot={({ error, retry, canRetry }) => (
                <div role="alert" className="flex items-center gap-2 text-sm">
                  <span>Не загрузилось: {error}</span>
                  {canRetry && (
                    <Button size="sm" variant="link" onClick={retry}>
                      Ещё раз
                    </Button>
                  )}
                </div>
              )}
            />
          </div>
        );
      },
      code: `<AsyncBoundary
  status="error"
  error="Таймаут запроса"
  onRetry={reload}
  errorSlot={({ error, retry, canRetry }) => (
    <div role="alert" className="flex items-center gap-2 text-sm">
      <span>Не загрузилось: {error}</span>
      {canRetry && (
        <Button size="sm" variant="link" onClick={retry}>
          Ещё раз
        </Button>
      )}
    </div>
  )}
/>`,
    },
    {
      id: 'empty',
      title: 'Пустой результат',
      description:
        'Ноль записей — это успех, а не ошибка: статус ready, пустоту рисует AsyncBoundaryEmpty внутри children.',
      render: EmptyResultExample,
      code: `const [items, setItems] = useState<string[]>([]);

<AsyncBoundary status="ready">
  {items.length === 0 ? (
    <AsyncBoundaryEmpty
      title="Заявок нет"
      description="Создайте первую заявку"
      action={<Button onClick={() => setItems(['Заявка №1'])}>Создать</Button>}
    />
  ) : (
    <ul className="list-disc pl-6 text-sm">
      {items.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  )}
</AsyncBoundary>`,
    },
  ],
  props: [
    {
      name: 'load',
      type: '(signal: AbortSignal) => Promise<T>',
      description:
        'Загрузчик. Если задан, компонент сам ведёт статус, прерывает устаревший запрос и даёт повтор. status, error, refreshing и onRetry тогда не действуют.',
    },
    {
      name: 'loadKey',
      type: 'unknown',
      description:
        'Смена значения запускает новую загрузку, прежний запрос прерывается. Обычно id записи; сравнивается через Object.is — передавайте примитив.',
    },
    {
      name: 'enabled',
      type: 'boolean',
      default: 'true',
      description: 'false — не загружать, статус idle. Например, форма создания записи.',
    },
    {
      name: 'onSuccess',
      type: '(data: T) => void',
      description: 'Вызывается с данными после успешной загрузки — например, model.patch(data).',
    },
    {
      name: 'onError',
      type: '(error: ReactNode) => void',
      description: 'Вызывается после ошибки загрузки — для лога или уведомления.',
    },
    {
      name: 'toError',
      type: '(e: unknown) => ReactNode',
      description:
        'Как превратить отказ промиса в текст. По умолчанию — message у Error, строка как есть, иначе "Unknown error".',
    },
    {
      name: 'ref',
      type: 'Ref<AsyncBoundaryHandle<T>>',
      description:
        'reload() — перезапустить, abort() — прервать запрос; status, data, error — текущее состояние. Тип — из @reformer/cdk/async-boundary.',
    },
    {
      name: 'status',
      type: "'idle' | 'loading' | 'ready' | 'error'",
      description:
        'Состояние, когда загрузкой владеет ваш код (load не задан). idle и ready показывают children.',
    },
    {
      name: 'error',
      type: 'ReactNode | null',
      default: 'null',
      description: 'Текст ошибки для встроенного блока и для errorSlot.',
    },
    {
      name: 'onRetry',
      type: '() => void',
      description: 'Повтор загрузки. Без него кнопки «Повторить» нет.',
    },
    {
      name: 'refreshing',
      type: 'boolean',
      default: 'false',
      description: 'Фоновое обновление: содержимое остаётся на экране, регион помечен aria-busy.',
    },
    {
      name: 'delayMs',
      type: 'number',
      default: '0',
      description:
        'Не показывать блок загрузки первые N мс. Быстрый ответ обходится без мелькания спиннера.',
    },
    {
      name: 'loadingTitle',
      type: 'ReactNode',
      description:
        'Заголовок блока загрузки. По умолчанию — строка kit.asyncBoundary.loadingTitle.',
    },
    {
      name: 'loadingSubtitle',
      type: 'ReactNode',
      description:
        'Подзаголовок блока загрузки. По умолчанию — kit.asyncBoundary.loadingSubtitle; null скрывает его.',
    },
    {
      name: 'errorTitle',
      type: 'ReactNode',
      description: 'Заголовок блока ошибки. По умолчанию — kit.asyncBoundary.errorTitle.',
    },
    {
      name: 'retryLabel',
      type: 'ReactNode',
      description: 'Подпись кнопки повтора. По умолчанию — kit.asyncBoundary.retry.',
    },
    {
      name: 'loadingSlot',
      type: 'ReactNode',
      description: 'Замена всего блока загрузки — например, скелетон.',
    },
    {
      name: 'errorSlot',
      type: 'ReactNode | ((p: { error, retry, canRetry }) => ReactNode)',
      description: 'Замена всего блока ошибки. Функция получает ошибку и повтор.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Содержимое для состояний ready и idle.',
    },
    {
      name: 'className',
      type: 'string',
      description: 'Классы региона-обёртки.',
    },
  ],
};
