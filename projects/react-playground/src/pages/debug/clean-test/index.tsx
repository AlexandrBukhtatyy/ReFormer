/**
 * Страница заявки на страхование: сценарии «создание / редактирование / просмотр»,
 * параллельная загрузка заявки и справочников, экран ошибки и экран результата.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { createForm } from '@reformer/core';
import { createLocaleLoader } from '@reformer/core/i18n';
import { I18nProvider, useFormBundle } from '@reformer/core/react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { AsyncBoundary } from '@reformer/cdk/async-boundary';
import { FormRenderer } from '@reformer/renderer-react';
import { Alert, Button, FormField } from '@reformer/ui-kit';
import { loadKitLocale } from '@reformer/ui-kit/locale';
import { fetchApplication, type CreatedApplication } from './api';
import { loadDictionaries } from './data-sources';
import { createApplicationBehavior } from './form.behavior';
import { formFlow } from './form.flow';
import { applicationMessages } from './form.messages';
import { createApplicationSchema } from './form.schema';
import { formValidation } from './form.validation';
import { createApplicationModel } from './model';
import type { FormMode, InsuranceApplicationForm } from './types';

const loadLocale = createLocaleLoader([loadKitLocale]);

interface Scenario {
  id: string;
  label: string;
  mode: FormMode;
  applicationId: string | null;
}

const SCENARIOS: Scenario[] = [
  { id: 'create', label: 'Создание', mode: 'create', applicationId: null },
  { id: 'edit', label: 'Редактирование', mode: 'edit', applicationId: 'demo' },
  { id: 'view', label: 'Просмотр', mode: 'view', applicationId: 'demo' },
  { id: 'missing', label: 'Ошибка загрузки', mode: 'edit', applicationId: 'not-found' },
];

type LoadStatus = 'loading' | 'ready' | 'error';

interface ApplicationFormProps {
  mode: FormMode;
  applicationId: string | null;
}

function ApplicationForm({ mode, applicationId }: ApplicationFormProps): ReactNode {
  const [created, setCreated] = useState<CreatedApplication | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [loadError, setLoadError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const application = useFormBundle(() =>
    createForm<InsuranceApplicationForm>({
      model: createApplicationModel(),
      schema: createApplicationSchema(mode),
      behavior: createApplicationBehavior({
        mode,
        onSubmitted: setCreated,
        onSubmitError: setSubmitError,
      }),
      ...(mode === 'view'
        ? { setup: (built) => built.form.disable() }
        : { validation: formValidation, flow: formFlow }),
    })
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [dictionaries, loaded] = await Promise.all([
          loadDictionaries(),
          applicationId ? fetchApplication(applicationId) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        if (loaded) application.model.set(loaded);
        // После реактивных эффектов от set: строки массивов уже созданы, опции не затрутся.
        queueMicrotask(() => {
          if (cancelled) return;
          application.form.vehicle.brand.updateComponentProps({
            options: dictionaries.carBrands,
          });
          application.form.travel.destination.updateComponentProps({
            options: dictionaries.countries,
          });
          if (mode === 'view') application.form.disable();
          setStatus('ready');
        });
      } catch (error) {
        if (cancelled) return;
        setLoadError(error);
        setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [application, applicationId, mode, reloadKey]);

  if (created) {
    return (
      <div className="space-y-2 rounded border border-green-300 bg-green-50 p-6 text-green-900">
        <h2 className="text-lg font-semibold">Полис оформлен</h2>
        <p>
          Номер полиса: <strong>{created.policyNumber}</strong>
        </p>
        <p>Номер заявки: {created.id}</p>
        <p>{created.message}</p>
      </div>
    );
  }

  return (
    <AsyncBoundary.Root
      status={status}
      error={loadError}
      onRetry={() => {
        setStatus('loading');
        setLoadError(null);
        setReloadKey((key) => key + 1);
      }}
    >
      <AsyncBoundary.Loading>
        <p>Загрузка данных…</p>
      </AsyncBoundary.Loading>
      <AsyncBoundary.Error>
        {({ error, retry }) => (
          <div className="space-y-3 rounded border border-red-300 bg-red-100 p-6 text-red-900">
            <h2 className="text-lg font-semibold">Не удалось загрузить данные</h2>
            <p>{error instanceof Error ? error.message : String(error)}</p>
            <Button type="button" variant="outline" onClick={retry}>
              Попробовать снова
            </Button>
          </div>
        )}
      </AsyncBoundary.Error>
      <AsyncBoundary.Content>
        <div className="space-y-4">
          {mode === 'view' && (
            <p className="text-sm text-muted-foreground">
              Режим просмотра: все поля заблокированы для редактирования.
            </p>
          )}
          {submitError && <Alert variant="destructive">{submitError}</Alert>}
          <FormRenderer form={application} settings={{ fieldWrapper: FormField }} />
        </div>
      </AsyncBoundary.Content>
    </AsyncBoundary.Root>
  );
}

export default function InsuranceApplicationPage(): ReactNode {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0];

  return (
    <I18nProvider lang="ru" load={loadLocale} fallback={<p>Загрузка…</p>}>
      <ValidationMessagesProvider messages={applicationMessages}>
        <div className="mx-auto max-w-4xl space-y-6 p-6">
          <h1 className="text-2xl font-bold">Заявка на страхование</h1>
          <div className="flex flex-wrap gap-2">
            {SCENARIOS.map((item) => (
              <Button
                key={item.id}
                type="button"
                size="sm"
                variant={item.id === scenario.id ? 'default' : 'outline'}
                onClick={() => setScenarioId(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
          {/* Ключ пересоздаёт сборку: режим задаётся при создании формы. */}
          <ApplicationForm
            key={scenario.id}
            mode={scenario.mode}
            applicationId={scenario.applicationId}
          />
        </div>
      </ValidationMessagesProvider>
    </I18nProvider>
  );
}
