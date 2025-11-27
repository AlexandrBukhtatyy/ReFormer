/**
 * CreditApplicationForm
 *
 * Использует:
 * - useStepForm хук для управления multi-step формой
 * - GroupNode для вложенных форм и массивов
 * - validateForm для валидации по шагам
 * - useLoadCreditApplication для загрузки данных
 * - Полную типизацию TypeScript
 */

import { useMemo } from 'react';
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
import { useStepForm } from '@/components/ui/form-navigation/hooks';
import { StepIndicator } from '@/components/ui/form-navigation/StepIndicator';
import { NavigationButtons } from '@/components/ui/form-navigation/NavigationButtons';
import { Button } from '@/components/ui/button';

// ============================================================================
// Компонент формы
// ============================================================================
function CreditApplicationForm() {
  //  Инициализируем форму (мемоизируем, чтобы не пересоздавать при каждом рендере)
  const form = useMemo(() => createCreditApplicationForm(), []);

  //  Используем новый хук useStepForm
  const { currentStep, completedSteps, goToNextStep, goToPreviousStep, goToStep, submit } =
    useStepForm(form, {
      totalSteps: 6,
      stepSchemas: STEP_VALIDATIONS,
      fullSchema: creditApplicationValidation,
    });

  // ============================================================================
  // Загрузка данных
  // ============================================================================

  //  Загружаем данные заявки (можно передать ID: '1' или '2', или null для пустой формы)
  const { isLoading, error } = useLoadCreditApplication(form, '1');

  // ============================================================================
  // Отправка формы
  // ============================================================================

  const submitApplication = async () => {
    const result = await submit(async (values) => {
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
      {/* Индикатор шагов */}
      <StepIndicator
        steps={STEPS}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={goToStep}
      />

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
      <NavigationButtons
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        isSubmitting={form.submitting.value}
        onNext={goToNextStep}
        onPrevious={goToPreviousStep}
        onSubmit={submitApplication}
      />

      {/* Информация о прогрессе */}
      <div className="mt-4 text-center text-sm text-gray-600">
        Шаг {currentStep} из {TOTAL_STEPS} • {Math.round((currentStep / TOTAL_STEPS) * 100)}%
        завершено
      </div>
    </div>
  );
}

export default CreditApplicationForm;
