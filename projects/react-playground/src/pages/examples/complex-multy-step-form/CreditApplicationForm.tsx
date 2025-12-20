/**
 * CreditApplicationForm
 *
 * Использует:
 * - FormNavigation компонент для multi-step формы
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
import { FormNavigation, type FormNavigationHandle } from '@reformer/ui/form-navigation';
import { Button } from '@/components/ui/button';
import type { CreditApplicationForm as CreditApplicationFormType } from './types/credit-application';

// ============================================================================
// Компонент формы
// ============================================================================
function CreditApplicationForm() {
  // Ref для доступа к методам навигации
  const navRef = useRef<FormNavigationHandle<CreditApplicationFormType>>(null);

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

  // ============================================================================
  // Рендер: Загрузка
  // ============================================================================
  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center p-12">
        <div className="text-center space-y-4">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <div className="text-lg text-gray-600">Загрузка данных...</div>
          <div className="text-sm text-gray-500">Пожалуйста, подождите</div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Рендер: Ошибка
  // ============================================================================
  if (error) {
    return (
      <div className="w-full">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center space-y-4">
          <div className="text-red-600 text-5xl">⚠️</div>
          <div className="text-xl font-semibold text-red-800">Ошибка загрузки</div>
          <div className="text-red-700">{error}</div>
          <Button onClick={() => window.location.reload()}>Попробовать снова</Button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Рендер: Форма с headless compound components
  // ============================================================================
  return (
    <div className="w-full">
      <FormNavigation ref={navRef} form={form} config={navConfig}>
        {/* Индикатор шагов (headless) */}
        <FormNavigation.Indicator steps={STEPS}>
          {({ steps, goToStep }) => (
            <div className="flex items-center justify-between p-4 bg-gray-100 rounded-lg mb-8">
              {steps.map((step, index) => (
                <div key={step.number} className="flex items-center flex-1">
                  <div
                    className={`flex items-center gap-2 p-3 rounded-lg transition-all cursor-pointer
                      ${step.isCurrent ? 'bg-blue-500 text-white' : ''}
                      ${step.isCompleted && !step.isCurrent ? 'text-green-500' : ''}
                      ${step.canNavigate ? 'hover:bg-gray-200' : 'cursor-not-allowed opacity-50'}
                    `}
                    onClick={() => step.canNavigate && goToStep(step.number)}
                  >
                    <div className="text-2xl">{step.isCompleted ? '✓' : step.icon}</div>
                    <div className="text-xs font-medium">{step.title}</div>
                    <div className="text-xs opacity-70">{step.number}</div>
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${step.isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </FormNavigation.Indicator>

        {/* Форма текущего шага */}
        <div className="bg-white p-8 rounded-lg shadow-md">
          <FormNavigation.Step component={BasicInfoForm} control={form} />
          <FormNavigation.Step component={PersonalInfoForm} control={form} />
          <FormNavigation.Step component={ContactInfoForm} control={form} />
          <FormNavigation.Step component={EmploymentForm} control={form} />
          <FormNavigation.Step component={AdditionalInfoForm} control={form} />
          <FormNavigation.Step component={ConfirmationForm} control={form} />
        </div>

        {/* Кнопки навигации (render props API) */}
        <FormNavigation.Actions onSubmit={submitApplication}>
          {({ prev, next, submit, isFirstStep, isLastStep, isValidating, isSubmitting }) => (
            <div className="flex gap-4 mt-8">
              {!isFirstStep && (
                <Button onClick={prev.onClick} disabled={prev.disabled} data-testid="btn-previous">
                  ← Назад
                </Button>
              )}
              <div className="flex-1" />
              {!isLastStep ? (
                <Button onClick={next.onClick} disabled={next.disabled} data-testid="btn-next">
                  {isValidating ? 'Проверка...' : 'Далее →'}
                </Button>
              ) : (
                <Button
                  onClick={submit.onClick}
                  disabled={submit.disabled}
                  data-testid="btn-submit"
                >
                  {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
                </Button>
              )}
            </div>
          )}
        </FormNavigation.Actions>

        {/* Информация о прогрессе (headless) */}
        <FormNavigation.Progress>
          {({ current, total, percent }) => (
            <div className="text-center text-sm text-gray-600 mt-4">
              Шаг {current} из {total} • {percent}% завершено
            </div>
          )}
        </FormNavigation.Progress>
      </FormNavigation>
    </div>
  );
}

export default CreditApplicationForm;
