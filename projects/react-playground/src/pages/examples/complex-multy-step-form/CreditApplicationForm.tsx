/**
 * CreditApplicationForm
 *
 * Использует:
 * - FormWizard компонент для multi-step формы
 * - Actions с render props для навигационных кнопок
 * - Headless компоненты (Indicator, Progress) с render props
 * - GroupNode для вложенных форм и массивов
 * - validateForm для валидации по шагам
 * - useLoadCreditApplication для загрузки данных
 * - Полную типизацию TypeScript
 */

import { useEffect, useMemo, useRef } from 'react';
import { createCreditApplicationFormM1 } from './schemas/create-form';
import { setupCreditApplicationBehavior } from './schemas/behavior';
import { BasicInfoForm } from './components/steps/BasicInfo/BasicInfoForm';
import { PersonalInfoForm } from './components/steps/PersonalInfo/PersonalInfoForm';
import { ContactInfoForm } from './components/steps/ContactInfo/ContactInfoForm';
import { EmploymentForm } from './components/steps/Employment/EmploymentForm';
import { AdditionalInfoForm } from './components/steps/AdditionalInfo/AdditionalInfoForm';
import { ConfirmationForm } from './components/steps/Confirmation/ConfirmationForm';
import { makeCreditValidationConfig } from './schemas/validation';
import { useLoadCreditApplication } from './hooks/useLoadCreditApplication';
import { submitCreditApplication } from './api';
import type { CreditApplicationForm as CreditApplicationFormType } from './types/credit-application';
import { LoadingState, ErrorState } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';

export const STEPS: FormWizardStep<CreditApplicationFormType>[] = [
  { number: 1, title: 'Кредит', icon: '💰', body: BasicInfoForm },
  { number: 2, title: 'Данные', icon: '👤', body: PersonalInfoForm },
  { number: 3, title: 'Контакты', icon: '📞', body: ContactInfoForm },
  { number: 4, title: 'Работа', icon: '💼', body: EmploymentForm },
  { number: 5, title: 'Доп. инфо', icon: '📋', body: AdditionalInfoForm },
  { number: 6, title: 'Подтверждение', icon: '✓', body: ConfirmationForm },
];

// ============================================================================
// Компонент формы
// ============================================================================
function CreditApplicationForm() {
  // Ref для доступа к методам навигации
  const navRef = useRef<FormWizardHandle<CreditApplicationFormType>>(null);

  //  Инициализируем модель + форму (M1) — мемоизируем, чтобы не пересоздавать при рендере
  const { form, model } = useMemo(() => createCreditApplicationFormM1(), []);

  //  Подключаем реактивное поведение (computeFrom/enableWhen/watchField) на модели + нодах.
  //  Настраивается после createForm (нужен реестр сигнал→нода) и до загрузки данных.
  useEffect(() => setupCreditApplicationBehavior(model, form), [model, form]);

  // Конфигурация навигации: M1-валидация (validateFormModel) per-step + полная
  const navConfig = useMemo(() => makeCreditValidationConfig(model), [model]);

  // ============================================================================
  // Загрузка данных
  // ============================================================================

  //  Загружаем данные заявки (можно передать ID: '1' или '2', или null для пустой формы)
  const { isLoading, error } = useLoadCreditApplication(form, '1');

  // ============================================================================
  // Отправка формы
  // ============================================================================

  const submitApplication = async () => {
    try {
      const result = await navRef.current?.submit(async (values: CreditApplicationFormType) => {
        const response = await submitCreditApplication(values);
        if (response.status === 200 || response.status === 201) {
          return response.data;
        }
        throw new Error('Ошибка отправки заявки');
      });

      if (result) {
        alert(`Заявка успешно отправлена! ID: ${result.id}`);
      } else {
        alert('Пожалуйста, исправьте ошибки в форме');
      }
    } catch {
      alert('Ошибка отправки заявки: сервер недоступен');
    }
  };

  // ============================================================================
  // Рендер
  // ============================================================================

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} onRetry={() => window.location.reload()} />;
  }

  // ============================================================================
  // Рендер: Форма с headless compound components
  // ============================================================================
  return (
    <div className="w-full">
      <FormWizard
        ref={navRef}
        form={form}
        config={navConfig}
        steps={STEPS}
        onSubmit={submitApplication}
      />
    </div>
  );
}

export default CreditApplicationForm;
