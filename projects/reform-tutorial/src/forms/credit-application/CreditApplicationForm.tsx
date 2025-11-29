import { useMemo, useRef } from 'react';
import { createCreditApplicationForm } from './createCreditApplicationForm';
import {
  StepNavigation,
  type StepNavigationHandle,
  type StepNavigationConfig,
} from '../../components/ui/step-navigation';

// Компоненты шагов
import { BasicInfoForm } from './steps/BasicInfoForm';
import { PersonalInfoForm } from './steps/PersonalInfoForm';
import { ContactInfoForm } from './steps/ContactInfoForm';
import { EmploymentForm } from './steps/EmploymentForm';
import { AdditionalInfoForm } from './steps/AdditionalInfoForm';
import { ConfirmationForm } from './steps/ConfirmationForm';

// Валидаторы по шагам
import { step1LoanValidation } from './schemas/validators/loan-info';
import { step2PersonalValidation } from './schemas/validators/personal-info';
import { step3ContactValidation } from './schemas/validators/contact-info';
import { step4EmploymentValidation } from './schemas/validators/employment';
import { step5AdditionalValidation } from './schemas/validators/additional-info';
import { creditApplicationValidation } from './schemas/validators/credit-application';

import type { CreditApplicationForm as CreditApplicationFormType } from './types/credit-application.types';

const STEPS = [
  { id: 1, title: 'Кредит' },
  { id: 2, title: 'Личные данные' },
  { id: 3, title: 'Контакты' },
  { id: 4, title: 'Занятость' },
  { id: 5, title: 'Дополнительно' },
  { id: 6, title: 'Подтверждение' },
];

// Конфигурация валидации по шагам
const STEP_CONFIG: StepNavigationConfig<CreditApplicationFormType> = {
  totalSteps: 6,
  stepValidations: {
    1: step1LoanValidation,
    2: step2PersonalValidation,
    3: step3ContactValidation,
    4: step4EmploymentValidation,
    5: step5AdditionalValidation,
    // Шаг 6 (подтверждение) - без валидации, только просмотр
  },
  fullValidation: creditApplicationValidation,
};

function CreditApplicationForm() {
  // Создаём экземпляр формы
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Ref для доступа к методам навигации
  const navRef = useRef<StepNavigationHandle<CreditApplicationFormType>>(null);

  // Отправка формы
  const handleSubmit = async (values: CreditApplicationFormType) => {
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Заявка отправлена! ID: ${data.id}`);
      }
    } catch (error) {
      console.error('Ошибка отправки:', error);
    }
  };

  return (
    <StepNavigation ref={navRef} form={form} config={STEP_CONFIG}>
      {({ currentStep, completedSteps, isFirstStep, isLastStep, isValidating }) => (
        <div>
          {/* Индикатор шагов */}
          <div className="flex justify-between mb-4">
            {STEPS.map((step) => {
              const isCompleted = completedSteps.includes(step.id);
              const isCurrent = currentStep === step.id;
              const canNavigate = step.id === 1 || completedSteps.includes(step.id - 1);

              return (
                <button
                  key={step.id}
                  onClick={() => navRef.current?.goToStep(step.id)}
                  disabled={!canNavigate}
                  className={`px-4 py-2 rounded transition-colors ${
                    isCurrent
                      ? 'bg-blue-600 text-white'
                      : isCompleted
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : canNavigate
                          ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {step.id}. {step.title}
                </button>
              );
            })}
          </div>

          {/* Содержимое текущего шага */}
          <div className="bg-white p-8 rounded-lg shadow-md">
            {currentStep === 1 && <BasicInfoForm control={form} />}
            {currentStep === 2 && <PersonalInfoForm control={form} />}
            {currentStep === 3 && <ContactInfoForm control={form} />}
            {currentStep === 4 && <EmploymentForm control={form} />}
            {currentStep === 5 && <AdditionalInfoForm control={form} />}
            {currentStep === 6 && <ConfirmationForm control={form} />}
          </div>

          {/* Кнопки навигации */}
          <div className="flex justify-between mt-6">
            <button
              onClick={() => navRef.current?.goToPreviousStep()}
              disabled={isFirstStep || isValidating}
              className="px-6 py-2 bg-gray-300 rounded disabled:opacity-50 hover:bg-gray-400 transition-colors"
            >
              Назад
            </button>

            {!isLastStep ? (
              <button
                onClick={() => navRef.current?.goToNextStep()}
                disabled={isValidating}
                className="px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-50 hover:bg-blue-700 transition-colors"
              >
                {isValidating ? 'Проверка...' : 'Далее'}
              </button>
            ) : (
              <button
                onClick={() => navRef.current?.submit(handleSubmit)}
                disabled={isValidating}
                className="px-6 py-2 bg-green-600 text-white rounded disabled:opacity-50 hover:bg-green-700 transition-colors"
              >
                {isValidating ? 'Проверка...' : 'Отправить заявку'}
              </button>
            )}
          </div>

          {/* Информация о прогрессе */}
          <div className="mt-4 text-center text-sm text-gray-600">
            Шаг {currentStep} из {STEP_CONFIG.totalSteps} •{' '}
            {Math.round((currentStep / STEP_CONFIG.totalSteps) * 100)}% завершено
          </div>
        </div>
      )}
    </StepNavigation>
  );
}

export default CreditApplicationForm;
