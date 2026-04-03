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

import { useMemo, useRef } from 'react';
import { createCreditApplicationForm } from './schemas/create-credit-application-form';
import { BasicInfoForm } from './components/steps/BasicInfo/BasicInfoForm';
import { PersonalInfoForm } from './components/steps/PersonalInfo/PersonalInfoForm';
import { ContactInfoForm } from './components/steps/ContactInfo/ContactInfoForm';
import { EmploymentForm } from './components/steps/Employment/EmploymentForm';
import { AdditionalInfoForm } from './components/steps/AdditionalInfo/AdditionalInfoForm';
import { ConfirmationForm } from './components/steps/Confirmation/ConfirmationForm';
import { STEPS } from './constants/credit-application';
import creditApplicationValidation, {
  STEP_VALIDATIONS,
} from './schemas/credit-application-validation';
import { useLoadCreditApplication } from './hooks/useLoadCreditApplication';
import { submitCreditApplication } from './api';
import { FormWizard, type FormWizardHandle } from '@reformer/ui/form-wizard';
import type { CreditApplicationForm as CreditApplicationFormType } from './types/credit-application';
import { FormWizardProgress } from './components/ui/FormWizardProgress';
import { StepIndicator } from './components/ui/StepIndicator';
import { FormWizardActions } from './components/ui/FormWizardActions';
import { LoadingState } from './components/ui/LoadingState';
import { ErrorState } from './components/ui/ErrorState';

// ============================================================================
// Компонент формы
// ============================================================================
function CreditApplicationForm() {
  // Ref для доступа к методам навигации
  const navRef = useRef<FormWizardHandle<CreditApplicationFormType>>(null);

  //  Инициализируем форму (мемоизируем, чтобы не пересоздавать при каждом рендере)
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Конфигурация навигации (totalSteps вычисляется автоматически из Step children)
  const navConfig = useMemo(
    () => ({
      stepValidations: STEP_VALIDATIONS,
      fullValidation: creditApplicationValidation,
    }),
    []
  );

  // ============================================================================
  // Загрузка данных
  // ============================================================================

  //  Загружаем данные заявки (можно передать ID: '1' или '2', или null для пустой формы)
  const { isLoading, error } = useLoadCreditApplication(form, '1');

  // ============================================================================
  // Отправка формы
  // ============================================================================

  const submitApplication = async () => {
    const result = await navRef.current?.submit(async (values: CreditApplicationFormType) => {
      // Отправляем данные на сервер через API
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
      <FormWizard ref={navRef} form={form} config={navConfig}>
        {/* Индикатор шагов (headless) */}
        <FormWizard.Indicator steps={STEPS}>
          {(indicatorProps) => <StepIndicator {...indicatorProps} className="mb-8"></StepIndicator>}
        </FormWizard.Indicator>

        {/* Форма текущего шага */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          <FormWizard.Step component={BasicInfoForm} control={form} />
          <FormWizard.Step component={PersonalInfoForm} control={form} />
          <FormWizard.Step component={ContactInfoForm} control={form} />
          <FormWizard.Step component={EmploymentForm} control={form} />
          <FormWizard.Step component={AdditionalInfoForm} control={form} />
          <FormWizard.Step component={ConfirmationForm} control={form} />
        </div>

        {/* Кнопки навигации (render props API) */}
        <FormWizard.Actions onSubmit={submitApplication}>
          {(actionsProps) => <FormWizardActions {...actionsProps} className="mt-8" />}
        </FormWizard.Actions>

        {/* Информация о прогрессе (headless) */}
        <FormWizard.Progress>
          {(progressProps) => <FormWizardProgress {...progressProps} className={'mt-4'} />}
        </FormWizard.Progress>
      </FormWizard>
    </div>
  );
}

export default CreditApplicationForm;
