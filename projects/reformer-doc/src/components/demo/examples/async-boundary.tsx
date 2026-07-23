import { AsyncBoundary, AsyncBoundaryEmpty, Skeleton, Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * AsyncBoundary — не form-control: ReFormer-специфичный контейнер состояний загрузки
 * (idle / loading / ready / error) поверх headless-версии из `@reformer/cdk/async-boundary`.
 * Управляется извне через `status`; блоки загрузки и ошибки встроены и рисуются на токенах
 * темы, а `loadingSlot` / `errorSlot` их полностью заменяют. Это не Suspense-boundary.
 * Таб Variants показывает каждое состояние.
 */

const ReadyContent = () => (
  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 14 }}>
    <li>Россия</li>
    <li>Казахстан</li>
    <li>Армения</li>
  </ul>
);

export const asyncBoundaryDocConfig: ComponentDocConfig = {
  name: 'AsyncBoundary',
  importFrom: '@reformer/ui-kit',
  description:
    'Контейнер состояний загрузки данных: idle / loading / ready / error. Блоки загрузки и ошибки встроены (спиннер, карточка ошибки с кнопкой «Повторить») и заменяются через loadingSlot / errorSlot. Статусом управляет консумент — это не Suspense-boundary.',
  variants: [
    {
      id: 'loading',
      title: 'Состояние loading',
      description:
        'status="loading" → спиннер с подписью, регион помечается aria-busy. children скрыты.',
      render: () => (
        <AsyncBoundary status="loading">
          <ReadyContent />
        </AsyncBoundary>
      ),
      code: `<AsyncBoundary status="loading">
  <CountriesList />
</AsyncBoundary>`,
    },
    {
      id: 'error',
      title: 'Состояние error',
      description:
        'status="error" → карточка ошибки с текстом из пропа error. Кнопка «Повторить» появляется, только если задан onRetry.',
      render: () => (
        <AsyncBoundary
          status="error"
          error="Проверьте соединение и попробуйте снова."
          onRetry={() => {}}
        >
          <ReadyContent />
        </AsyncBoundary>
      ),
      code: `<AsyncBoundary
  status="error"
  error="Проверьте соединение и попробуйте снова."
  onRetry={reload}
>
  <CountriesList />
</AsyncBoundary>`,
    },
    {
      id: 'ready',
      title: 'Состояние ready',
      description: 'status="ready" → рендерятся children.',
      render: () => (
        <AsyncBoundary status="ready">
          <ReadyContent />
        </AsyncBoundary>
      ),
      code: `<AsyncBoundary status="ready">
  <ul>
    <li>Россия</li>
    <li>Казахстан</li>
    <li>Армения</li>
  </ul>
</AsyncBoundary>`,
    },
    {
      id: 'idle',
      title: 'Состояние idle',
      description:
        'status="idle" → загрузка не запускалась (форма создания, id ещё не выбран). Показываются children, а не индикатор: пустая форма и успешно загруженная — разные состояния.',
      render: () => (
        <AsyncBoundary status="idle">
          <ReadyContent />
        </AsyncBoundary>
      ),
      code: `// applicationId === null → грузить нечего
<AsyncBoundary status={applicationId ? status : 'idle'}>
  <ApplicationForm />
</AsyncBoundary>`,
    },
  ],
  examples: [
    {
      id: 'fetch-lifecycle',
      title: 'Жизненный цикл запроса',
      description:
        'status держится в state рядом с данными: loading на старте, ready после ответа, error в catch. Текст ошибки и повтор передаются пропами — оборачивать блоки в отдельные компоненты не нужно.',
      render: () => (
        <AsyncBoundary status="ready">
          <ReadyContent />
        </AsyncBoundary>
      ),
      code: `function CountriesPage() {
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [countries, setCountries] = useState<string[]>([]);

  const load = useCallback(() => {
    setStatus('loading');
    fetch('/api/countries')
      .then((r) => r.json())
      .then((d) => { setCountries(d); setStatus('ready'); })
      .catch((e) => { setError(String(e)); setStatus('error'); });
  }, []);

  useEffect(load, [load]);

  return (
    <AsyncBoundary status={status} error={error} onRetry={load} delayMs={200}>
      <ul>{countries.map((c) => <li key={c}>{c}</li>)}</ul>
    </AsyncBoundary>
  );
}`,
    },
    {
      id: 'skeleton',
      title: 'Скелетон вместо спиннера',
      description:
        'loadingSlot полностью заменяет встроенный блок загрузки — например на строки-скелетоны под будущую таблицу.',
      render: () => (
        <AsyncBoundary
          status="loading"
          loadingSlot={
            <div style={{ display: 'grid', gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          }
        >
          <ReadyContent />
        </AsyncBoundary>
      ),
      code: `<AsyncBoundary
  status={status}
  loadingSlot={
    <div className="space-y-2">
      {[0, 1, 2].map((i) => <Skeleton key={i} className="h-9 w-full" />)}
    </div>
  }
>
  <DataTable rows={rows} />
</AsyncBoundary>`,
    },
    {
      id: 'empty',
      title: 'Пустой результат',
      description:
        'Пустота — не статус, а предикат поверх ready: успешная загрузка нуля записей не должна объявляться как ошибка. Блок собирается из AsyncBoundaryEmpty.',
      render: () => (
        <AsyncBoundaryEmpty
          title="Ничего не найдено"
          description="Попробуйте изменить условия поиска"
          action={<Button variant="outline">Сбросить фильтры</Button>}
        />
      ),
      code: `import { AsyncBoundary } from '@reformer/cdk/async-boundary';
import { AsyncBoundaryEmpty } from '@reformer/ui-kit';

<AsyncBoundary.Content>
  <AsyncBoundary.Empty when={items.length === 0}>
    <AsyncBoundaryEmpty
      title="Ничего не найдено"
      description="Попробуйте изменить условия поиска"
      action={<Button variant="outline">Сбросить фильтры</Button>}
    />
  </AsyncBoundary.Empty>
  {items.map(renderItem)}
</AsyncBoundary.Content>`,
    },
  ],
  props: [
    {
      name: 'status',
      type: "'idle' | 'loading' | 'ready' | 'error'",
      description:
        'Текущее состояние асинхронной операции. Управляется снаружи. idle — загрузка не запускалась (показываются children).',
    },
    {
      name: 'error',
      type: 'ReactNode | null',
      description: 'Текст ошибки. Попадает во встроенный блок ошибки и в render-функцию errorSlot.',
    },
    {
      name: 'onRetry',
      type: '() => void',
      description: 'Повтор загрузки. Без него кнопка «Повторить» не рендерится.',
    },
    {
      name: 'refreshing',
      type: 'boolean',
      description:
        'Фоновое обновление: контент остаётся на экране (stale-while-revalidate), регион помечается aria-busy.',
    },
    {
      name: 'delayMs',
      type: 'number',
      description:
        'Не показывать блок загрузки первые N мс — гасит вспышку спиннера при быстром ответе. По умолчанию 0.',
    },
    {
      name: 'loadingSlot',
      type: 'ReactNode',
      description: 'Полная замена встроенного блока загрузки — например скелетон.',
    },
    {
      name: 'errorSlot',
      type: 'ReactNode | ((props: { error; retry; canRetry }) => ReactNode)',
      description:
        'Полная замена блока ошибки. Render-функция получает саму ошибку и колбэк повтора.',
    },
    {
      name: 'loadingTitle / loadingSubtitle / errorTitle / retryLabel',
      type: 'ReactNode',
      description: 'Тексты встроенных блоков, если заменять их целиком не требуется.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Контент, рендерящийся при status="ready" и status="idle".',
    },
  ],
};
