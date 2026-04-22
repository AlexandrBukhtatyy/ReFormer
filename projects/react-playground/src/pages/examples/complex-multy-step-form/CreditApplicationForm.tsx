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
import creditApplicationValidation, {
  STEP_VALIDATIONS,
} from './schemas/credit-application-validation';
import { useLoadCreditApplication } from './hooks/useLoadCreditApplication';
import { submitCreditApplication } from './api';
import type { CreditApplicationForm as CreditApplicationFormType } from './types/credit-application';
import { LoadingState } from './components/ui/LoadingState';
import { ErrorState } from './components/ui/ErrorState';
import { FormWizard } from './components/ui/FormWizzard/FormWizard';
import type { FormWizardHandle, FormWizardIndicatorStep } from '@reformer/cdk/form-wizard';

export const STEPS: FormWizardIndicatorStep[] = [
  { number: 1, title: 'Кредит', icon: '💰', component: BasicInfoForm },
  { number: 2, title: 'Данные', icon: '👤', component: PersonalInfoForm },
  { number: 3, title: 'Контакты', icon: '📞', component: ContactInfoForm },
  { number: 4, title: 'Работа', icon: '💼', component: EmploymentForm },
  { number: 5, title: 'Доп. инфо', icon: '📋', component: AdditionalInfoForm },
  { number: 6, title: 'Подтверждение', icon: '✓', component: ConfirmationForm },
];

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
