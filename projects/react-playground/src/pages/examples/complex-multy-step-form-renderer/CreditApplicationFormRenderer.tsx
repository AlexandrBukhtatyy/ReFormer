/**
 * CreditApplicationFormRenderer
 *
 * Та же форма кредитной заявки, но с использованием renderSchema API.
 * Демонстрирует полностью декларативный подход к описанию сложных multi-step форм.
 *
 * Использует:
 * - FormRenderer с пользовательским CreditApplicationWizard компонентом
 * - Единую renderSchema для всей формы (включая навигацию)
 * - Переиспользует типы, схему, валидацию и API из complex-multy-step-form
 */

import { useMemo } from 'react';
import { createCreditApplicationForm } from '../complex-multy-step-form/schemas/create-credit-application-form';
import { useLoadCreditApplication } from '../complex-multy-step-form/hooks/useLoadCreditApplication';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField } from '@/components/ui/form-field';
import { creditApplicationRenderSchema } from './render-schema';
import { LoadingState } from '../complex-multy-step-form/components/ui/LoadingState';
import { ErrorState } from '../complex-multy-step-form/components/ui/ErrorState';

function CreditApplicationFormRenderer() {
  // Инициализируем форму (мемоизируем, чтобы не пересоздавать при каждом рендере)
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Загружаем данные заявки
  const { isLoading, error } = useLoadCreditApplication(form, '1');

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  // Рендер: Форма через FormRenderer с CreditApplicationWizard
  return (
    <div className="w-full">
      <FormRenderer
        form={form}
        render={creditApplicationRenderSchema}
        settings={{ fieldWrapper: FormField }}
      />
    </div>
  );
}

export default CreditApplicationFormRenderer;
