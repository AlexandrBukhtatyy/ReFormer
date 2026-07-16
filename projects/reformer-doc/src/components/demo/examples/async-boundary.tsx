import { AsyncBoundary, Spinner, Alert, AlertTitle, AlertDescription } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

/**
 * AsyncBoundary — не form-control: ReFormer-специфичный контейнер трёх состояний
 * (loading / error / ready). Управляется извне через проп `status`; слоты
 * `LoadingComponent` / `ErrorComponent` — это `ComponentType` без props, а `children`
 * показываются в состоянии `ready`. Это не Suspense-boundary — ничего не throw'ится.
 * Таб Variants показывает каждое из трёх состояний с mock-слотами (Spinner / Alert).
 */

const LoadingSlot = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <Spinner className="size-5 text-muted-foreground" />
    <span style={{ fontSize: 14, color: 'var(--muted-foreground, #64748b)' }}>Загрузка…</span>
  </div>
);

const ErrorSlot = () => (
  <Alert variant="destructive">
    <AlertTitle>Не удалось загрузить</AlertTitle>
    <AlertDescription>Проверьте соединение и попробуйте снова.</AlertDescription>
  </Alert>
);

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
    'ReFormer-специфичный контейнер трёх состояний (loading / error / ready). Состояние задаётся снаружи через status; слоты LoadingComponent / ErrorComponent — ComponentType без props, children показываются при status="ready". Не Suspense-boundary.',
  variants: [
    {
      id: 'loading',
      title: 'Состояние loading',
      description:
        'status="loading" → рендерит LoadingComponent (здесь Spinner с подписью). children и error-слот скрыты.',
      render: () => (
        <AsyncBoundary status="loading" LoadingComponent={LoadingSlot} ErrorComponent={ErrorSlot}>
          <ReadyContent />
        </AsyncBoundary>
      ),
      code: `const LoadingSlot = () => (
  <div className="flex items-center gap-2">
    <Spinner className="size-5 text-muted-foreground" />
    <span className="text-sm text-muted-foreground">Загрузка…</span>
  </div>
);

<AsyncBoundary status="loading" LoadingComponent={LoadingSlot}>
  <CountriesList />
</AsyncBoundary>`,
    },
    {
      id: 'error',
      title: 'Состояние error',
      description:
        'status="error" → рендерит ErrorComponent (здесь Alert variant="destructive"). children и loading-слот скрыты.',
      render: () => (
        <AsyncBoundary status="error" LoadingComponent={LoadingSlot} ErrorComponent={ErrorSlot}>
          <ReadyContent />
        </AsyncBoundary>
      ),
      code: `const ErrorSlot = () => (
  <Alert variant="destructive">
    <AlertTitle>Не удалось загрузить</AlertTitle>
    <AlertDescription>Проверьте соединение и попробуйте снова.</AlertDescription>
  </Alert>
);

<AsyncBoundary status="error" ErrorComponent={ErrorSlot}>
  <CountriesList />
</AsyncBoundary>`,
    },
    {
      id: 'ready',
      title: 'Состояние ready',
      description: 'status="ready" → рендерит children. Слоты loading/error не показываются.',
      render: () => (
        <AsyncBoundary status="ready" LoadingComponent={LoadingSlot} ErrorComponent={ErrorSlot}>
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
  ],
  examples: [
    {
      id: 'fetch-lifecycle',
      title: 'Жизненный цикл запроса',
      description:
        'status держится в state рядом с данными: loading на старте, ready после ответа, error в catch. Слоты передаются один раз, AsyncBoundary переключает их по status.',
      render: () => (
        <AsyncBoundary status="ready" LoadingComponent={LoadingSlot} ErrorComponent={ErrorSlot}>
          <ReadyContent />
        </AsyncBoundary>
      ),
      code: `function CountriesPage() {
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [countries, setCountries] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/countries')
      .then((r) => r.json())
      .then((d) => { setCountries(d); setStatus('ready'); })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <AsyncBoundary
      status={status}
      LoadingComponent={LoadingSlot}
      ErrorComponent={ErrorSlot}
    >
      <ul>{countries.map((c) => <li key={c}>{c}</li>)}</ul>
    </AsyncBoundary>
  );
}`,
    },
  ],
  props: [
    {
      name: 'status',
      type: "'loading' | 'error' | 'ready'",
      description:
        'Текущее состояние асинхронной операции. Управляется снаружи — AsyncBoundary решает, какой слот показать.',
    },
    {
      name: 'LoadingComponent',
      type: 'ComponentType',
      description:
        'Компонент для status="loading", без props. Если не передан — рендерится null. Для props оберни в тонкий компонент.',
    },
    {
      name: 'ErrorComponent',
      type: 'ComponentType',
      description: 'Компонент для status="error", без props. Если не передан — рендерится null.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description: 'Контент, рендерящийся при status="ready".',
    },
  ],
};
