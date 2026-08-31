/**
 * Страница-пример: «Заявка на кредит» на `@reformer/renderer-react`.
 *
 * Модуль плоский, все шаги визарда — внутри render-схемы (`renderer.schema.tsx`);
 * здесь только сборка бандла, предзагрузка данных и экраны состояний.
 */

import { useCallback, useEffect, useState } from 'react';

import type { FormModel, FormProxy } from '@reformer/core';
import { createReactForm, FormRenderer, useReactForm } from '@reformer/renderer-react';
import { Button, FormField } from '@reformer/ui-kit';

import { fetchCreditApplication, type SubmitApplicationResult } from './api';
import { fetchDictionaries } from './data-sources';
import { creditApplicationBehavior } from './form.behavior';
import { createCreditApplicationModel } from './model';
import { makeCreditApplicationRenderBehavior } from './renderer.behavior';
import { buildCreditApplicationSchema } from './renderer.schema';
import type { CreditApplicationForm, FormMode } from './types';

// ----------------------------------------------------------------------------------------------
// Предзагрузка: заявка + справочники параллельно, с race-guard и отложенным updateComponentProps
// ----------------------------------------------------------------------------------------------

type LoadingState = { isLoading: boolean; error: string | null };

function useCreditApplicationData(
  model: FormModel<CreditApplicationForm>,
  form: FormProxy<CreditApplicationForm>,
  applicationId: string | null
): LoadingState {
  const [state, setState] = useState<LoadingState>({ isLoading: true, error: null });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setState({ isLoading: true, error: null });
      try {
        const [application, dictionaries] = await Promise.all([
          applicationId ? fetchCreditApplication(applicationId) : Promise.resolve(null),
          fetchDictionaries(),
        ]);
        if (cancelled) return;

        if (application && !application.success) {
          throw new Error(application.error ?? 'Не удалось загрузить заявку');
        }
        if (application?.data) {
          model.set(application.data);
          // Загруженные значения становятся новой точкой отсчёта для reset().
          model.captureInitial();
        }

        // Динамические componentProps — после реактивных эффектов от set().
        queueMicrotask(() => {
          if (cancelled) return;
          form.registrationAddress.region.updateComponentProps({
            options: dictionaries.regions,
          });
          form.residenceAddress.region.updateComponentProps({ options: dictionaries.regions });
        });

        setState({ isLoading: false, error: null });
      } catch (error) {
        if (cancelled) return;
        setState({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Неизвестная ошибка загрузки',
        });
      }
    })();

    return () => {
      cancelled = true;
    };
    // model / form стабильны — их создаёт useReactForm ровно один раз.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  return state;
}

// ----------------------------------------------------------------------------------------------
// Форма
// ----------------------------------------------------------------------------------------------

type CreditApplicationViewProps = {
  mode: FormMode;
  applicationId: string | null;
};

function CreditApplicationView({ mode, applicationId }: CreditApplicationViewProps) {
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitApplicationResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onSubmitStart = useCallback(() => {
    setSubmitting(true);
    setSubmitError(null);
    setSubmitResult(null);
  }, []);
  const onSubmitSuccess = useCallback((result: SubmitApplicationResult) => {
    setSubmitting(false);
    setSubmitResult(result);
  }, []);
  const onSubmitError = useCallback((message: string) => {
    setSubmitting(false);
    setSubmitError(message);
  }, []);

  // Форма собирается ОДИН раз: useReactForm — ленивый useState, а не useMemo.
  const bundle = useReactForm(() =>
    createReactForm<CreditApplicationForm>({
      model: createCreditApplicationModel(),
      schema: buildCreditApplicationSchema,
      behavior: creditApplicationBehavior,
      renderBehavior: makeCreditApplicationRenderBehavior({
        mode,
        onSubmitStart,
        onSubmitSuccess,
        onSubmitError,
      }),
    })
  );

  const { isLoading, error } = useCreditApplicationData(bundle.model, bundle.form, applicationId);

  if (isLoading) {
    return (
      <div className="p-6" data-testid="credit-form-loading">
        Загружаем данные заявки…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-4" data-testid="credit-form-error">
        <p>{error}</p>
        <Button onClick={() => window.location.reload()}>Попробовать снова</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {submitting && <p data-testid="credit-form-submitting">Отправляем заявку…</p>}
      {submitError && (
        <p data-testid="credit-form-submit-error" role="alert">
          {submitError}
        </p>
      )}
      {submitResult && (
        <p data-testid="credit-form-submit-success">
          {submitResult.message} (№ {submitResult.id})
        </p>
      )}
      <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}

// ----------------------------------------------------------------------------------------------
// Страница
// ----------------------------------------------------------------------------------------------

const MODES: { value: FormMode; label: string }[] = [
  { value: 'create', label: 'Создание' },
  { value: 'edit', label: 'Редактирование' },
  { value: 'view', label: 'Просмотр' },
];

export default function NewMcpTestV2ReactPage() {
  const [mode, setMode] = useState<FormMode>('create');
  const [applicationId, setApplicationId] = useState<string | null>(null);

  const selectMode = (next: FormMode) => {
    setMode(next);
    setApplicationId(next === 'create' ? null : '1');
  };

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-xl font-bold">Заявка на кредит — renderer-react</h1>
        <div className="flex items-center gap-2">
          {MODES.map((item) => (
            <Button
              key={item.value}
              variant={item.value === mode ? 'default' : 'outline'}
              size="sm"
              data-testid={`mode-${item.value}`}
              onClick={() => selectMode(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* key пересобирает бандл при смене режима/заявки: renderBehavior замыкает mode. */}
      <CreditApplicationView
        key={`${mode}:${applicationId ?? 'new'}`}
        mode={mode}
        applicationId={applicationId}
      />
    </div>
  );
}
