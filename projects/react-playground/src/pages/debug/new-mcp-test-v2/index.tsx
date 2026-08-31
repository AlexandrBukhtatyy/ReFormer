/**
 * Страница «Заявка на кредит» (renderer-json).
 *
 * Сборка формы — ОДИН проход через `createJsonForm`, стабилизированный
 * `useJsonForm` (ленивый `useState`; `useMemo` не годится — React вправе
 * сбросить кэш и потерять введённое). Бандл целиком уходит рендереру
 * пропом `form`.
 */
import { useCallback, useMemo, useState } from 'react';

import {
  createJsonForm,
  JsonFormRenderer,
  JsonRendererProvider,
  useJsonForm,
} from '@reformer/renderer-json';
import { AsyncBoundary, Button, ExampleCard } from '@reformer/ui-kit';

import { loadApplicationBundle, type ApplicationBundle } from './api';
import { creditFormBehavior } from './form.behavior';
import { createCreditModel } from './model';
import { createCreditRenderBehavior } from './renderer.behavior';
import { creditFormSchema } from './renderer.schema';
import { createRegistry } from './registry';
import type { CreditApplicationForm, FormMode } from './types';
import { creditValidation } from './validation';

const MOUNT_SNIPPET = [
  'const jsonForm = useJsonForm(() =>',
  '  createJsonForm<CreditApplicationForm>({',
  '    schema: creditFormSchema,',
  '    registry: createRegistry(dictionaries),',
  '    model: createCreditModel(prefill),',
  '    behavior: creditFormBehavior,',
  '    validation: creditValidation,',
  '    renderBehavior: createCreditRenderBehavior,',
  '  })',
  ');',
  '',
  '<JsonRendererProvider settings={{ registry: jsonForm.registry }}>',
  '  <JsonFormRenderer form={jsonForm} validateSchema={import.meta.env.DEV} />',
  '</JsonRendererProvider>',
].join('\n');

interface Scenario {
  id: string;
  label: string;
  applicationId: string | null;
  mode: FormMode;
}

const SCENARIOS: Scenario[] = [
  { id: 'create', label: 'Создание (пустая форма)', applicationId: null, mode: 'create' },
  { id: 'edit', label: 'Редактирование (заявка №1)', applicationId: '1', mode: 'edit' },
  { id: 'view', label: 'Просмотр (заявка №2)', applicationId: '2', mode: 'view' },
];

interface CreditFormProps {
  data: ApplicationBundle;
  mode: FormMode;
}

/** Монтируется только когда справочники и заявка уже загружены. */
function CreditForm({ data, mode }: CreditFormProps) {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const registry = useMemo(() => createRegistry(data.dictionaries), [data.dictionaries]);

  const jsonForm = useJsonForm(() =>
    createJsonForm<CreditApplicationForm>({
      schema: creditFormSchema,
      registry,
      model: createCreditModel(data.application ?? undefined),
      behavior: creditFormBehavior,
      validation: creditValidation,
      renderBehavior: (form, model, validation) =>
        createCreditRenderBehavior(form, model, validation, {
          mode,
          onSubmitted: (message) => {
            setError(null);
            setStatus(message);
          },
          onSubmitError: (message) => {
            setStatus(null);
            setError(message);
          },
        }),
    })
  );

  return (
    <div className="space-y-4" data-testid="credit-form-root">
      {status && (
        <div
          className="p-4 rounded-md border border-emerald-300 bg-emerald-50 text-sm text-emerald-900"
          data-testid="submit-success"
          role="status"
        >
          {status}
        </div>
      )}
      {error && (
        <div
          className="p-4 rounded-md border border-red-300 bg-red-50 text-sm text-red-900"
          data-testid="submit-error"
          role="alert"
        >
          {error}
        </div>
      )}
      <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
        <JsonFormRenderer<CreditApplicationForm>
          form={jsonForm}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}

interface ScenarioFormProps {
  scenario: Scenario;
  simulateError: boolean;
}

/**
 * Загрузка заявки + справочников. Self-managed `AsyncBoundary` сам ведёт
 * статус, отменяет устаревший запрос и рисует экран ошибки с «Повторить».
 */
function ScenarioForm({ scenario, simulateError }: ScenarioFormProps) {
  const [data, setData] = useState<ApplicationBundle | null>(null);

  const load = useCallback(
    (signal: AbortSignal) => loadApplicationBundle(scenario.applicationId, signal, simulateError),
    [scenario.applicationId, simulateError]
  );

  return (
    <AsyncBoundary<ApplicationBundle>
      load={load}
      loadKey={`${scenario.id}:${String(simulateError)}`}
      onSuccess={setData}
      delayMs={150}
      loadingTitle="Загружаем заявку и справочники…"
      errorTitle="Не удалось загрузить данные"
      retryLabel="Попробовать снова"
    >
      {data ? <CreditForm data={data} mode={scenario.mode} /> : null}
    </AsyncBoundary>
  );
}

export default function NewMcpTestV2() {
  const [scenarioId, setScenarioId] = useState<string>('create');
  const [simulateError, setSimulateError] = useState(false);

  const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0];

  return (
    <ExampleCard
      title="Заявка на кредит — renderer-json"
      code={MOUNT_SNIPPET}
      description="6 шагов, вычисляемые поля, условная видимость, каскадные сбросы, массивы и асинхронные справочники. Layout — JSON-DSL, валидация и поведение — отдельные схемы над моделью."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2" data-testid="scenario-switcher">
          {SCENARIOS.map((item) => (
            <Button
              key={item.id}
              variant={item.id === scenarioId ? 'default' : 'outline'}
              size="sm"
              data-testid={`scenario-${item.id}`}
              onClick={() => setScenarioId(item.id)}
            >
              {item.label}
            </Button>
          ))}
          <Button
            variant={simulateError ? 'destructive' : 'ghost'}
            size="sm"
            data-testid="toggle-simulate-error"
            onClick={() => setSimulateError((value) => !value)}
          >
            {simulateError ? 'Имитация ошибки: вкл' : 'Имитация ошибки: выкл'}
          </Button>
        </div>

        <ScenarioForm
          key={`${scenario.id}:${String(simulateError)}`}
          scenario={scenario}
          simulateError={simulateError}
        />
      </div>
    </ExampleCard>
  );
}
