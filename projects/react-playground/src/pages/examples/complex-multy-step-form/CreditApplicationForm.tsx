/**
 * CreditApplicationForm
 *
 * Использует:
 * - StepNavigation компонент для управления multi-step формой
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
import { STEPS, TOTAL_STEPS } from './constants/credit-application';
import creditApplicationValidation, {
  STEP_VALIDATIONS,
} from './schemas/credit-application-validation';
import { useLoadCreditApplication } from './hooks/useLoadCreditApplication';
import { submitCreditApplication } from './api';
import { StepNavigation, type StepNavigationHandle } from '@/components/ui/step-navigation';
import { Button } from '@/components/ui/button';
import type { CreditApplicationForm as CreditApplicationFormType } from './types/credit-application';

// ============================================================================
// Компонент формы
// ============================================================================
function CreditApplicationForm() {
  // Ref для доступа к методам навигации
  const navRef = useRef<StepNavigationHandle<CreditApplicationFormType>>(null);

  //  Инициализируем форму (мемоизируем, чтобы не пересоздавать при каждом рендере)
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Конфигурация навигации
  const navConfig = useMemo(
    () => ({
      totalSteps: TOTAL_STEPS,
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
  // Рендер: Форма
  // ============================================================================
  return (
    <div className="w-full">
      <StepNavigation ref={navRef} form={form} config={navConfig}>
        {({ currentStep, completedSteps, isFirstStep, isLastStep, isValidating }) => (
          <>
            {/* Индикатор шагов */}
            <div className="flex items-center justify-between mb-8 p-4 bg-gray-100 rounded-lg">
              {STEPS.map((step: { number: number; title: string; icon: string }, index: number) => {
                const isCompleted = completedSteps.includes(step.number);
                const isCurrent = currentStep === step.number;
                const canClick = step.number === 1 || completedSteps.includes(step.number - 1);

                return (
                  <div key={step.number} className="flex items-center flex-1">
                    <div
                      className={`flex items-center gap-2 p-3 rounded-lg transition-all cursor-pointer
                        ${isCurrent ? 'bg-blue-500 text-white' : ''}
                        ${isCompleted ? 'text-green-500' : ''}
                        ${canClick ? 'hover:bg-gray-200' : 'cursor-not-allowed opacity-50'}
                      `}
                      onClick={() => canClick && navRef.current?.goToStep(step.number)}
                    >
                      <div className="text-2xl">{isCompleted ? '✓' : step.icon}</div>
                      <div className="text-xs font-medium">{step.title}</div>
                      <div className="text-xs opacity-70">{step.number}</div>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 ${isCompleted ? 'bg-green-500' : 'bg-gray-300'}`}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Форма текущего шага */}
            <div className="bg-white p-8 rounded-lg shadow-md">
              {currentStep === 1 && <BasicInfoForm control={form} />}
              {currentStep === 2 && <PersonalInfoForm control={form} />}
              {currentStep === 3 && <ContactInfoForm control={form} />}
              {currentStep === 4 && <EmploymentForm control={form} />}
              {currentStep === 5 && <AdditionalInfoForm control={form} />}
              {currentStep === 6 && <ConfirmationForm control={form} />}
            </div>

            {/* Кнопки навигации */}
            <div className="flex gap-4 mt-8">
              {!isFirstStep && (
                <Button
                  onClick={() => navRef.current?.goToPreviousStep()}
                  disabled={isValidating}
                  data-testid="btn-previous"
                >
                  ← Назад
                </Button>
              )}

              <div className="flex-1" />

              {!isLastStep && (
                <Button
                  onClick={() => navRef.current?.goToNextStep()}
                  disabled={isValidating}
                  data-testid="btn-next"
                >
                  Далее →
                </Button>
              )}

              {isLastStep && (
                <Button
                  onClick={submitApplication}
                  disabled={isValidating || form.submitting.value}
                  data-testid="btn-submit"
                >
                  {form.submitting.value ? 'Отправка...' : 'Отправить заявку'}
                </Button>
              )}
            </div>

            {/* Информация о прогрессе */}
            <div className="mt-4 text-center text-sm text-gray-600">
              Шаг {currentStep} из {TOTAL_STEPS} • {Math.round((currentStep / TOTAL_STEPS) * 100)}%
              завершено
            </div>
          </>
        )}
      </StepNavigation>
    </div>
  );
}

export default CreditApplicationForm;
