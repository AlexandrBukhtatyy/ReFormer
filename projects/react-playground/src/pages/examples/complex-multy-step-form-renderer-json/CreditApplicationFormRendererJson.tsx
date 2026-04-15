/**
 * CreditApplicationFormRendererJson
 *
 * Та же форма кредитной заявки, но layout описан в JSON-схеме.
 *
 * Архитектура (файлы в папке):
 * - [json-schema.ts] — layout формы.
 * - [registry.ts] — реестр компонентов и source-значений.
 * - [render-behavior.ts] — обёртка над TS-variant behavior-ом: инжектит форму
 *   в wizard через `onInit`, делегирует остальное.
 * - [RegistrationFormRendererJson.tsx] — этот файл: создаёт форму, собирает
 *   реестр/behavior, рендерит JsonFormRenderer внутри JsonRendererProvider.
 */

import { useMemo } from 'react';
import { JsonFormRenderer, JsonRendererProvider } from '@reformer/renderer-json';
import { FormField } from '@reformer/ui-kit';
import { createCreditApplicationForm } from '../complex-multy-step-form/schemas/create-credit-application-form';
import { useLoadCreditApplication } from '../complex-multy-step-form/hooks/useLoadCreditApplication';
import { LoadingState } from '../complex-multy-step-form/components/ui/LoadingState';
import { ErrorState } from '../complex-multy-step-form/components/ui/ErrorState';
import type { CreditApplicationForm } from '../complex-multy-step-form/types/credit-application';
import { creditApplicationJsonSchema } from './json-schema';
import { createCreditApplicationRegistry } from './registry';
import { createCreditApplicationJsonRenderBehavior } from './render-behavior';

export default function CreditApplicationFormRendererJson() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const registry = useMemo(() => createCreditApplicationRegistry(), []);
  const renderBehavior = useMemo(() => createCreditApplicationJsonRenderBehavior(form), [form]);

  const { isLoading, error } = useLoadCreditApplication(form, '1');

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="w-full">
      <JsonRendererProvider settings={{ fieldWrapper: FormField, registry }}>
        <JsonFormRenderer<CreditApplicationForm>
          schema={creditApplicationJsonSchema}
          renderBehavior={renderBehavior}
        />
      </JsonRendererProvider>
    </div>
  );
}
