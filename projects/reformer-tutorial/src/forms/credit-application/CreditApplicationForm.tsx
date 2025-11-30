import { useEffect, useMemo, useRef, useState } from 'react';
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
import { loanValidation } from './schemas/validators/loan-info';
import { personalValidation } from './schemas/validators/personal-info';
import { contactValidation } from './schemas/validators/contact-info';
import { employmentValidation } from './schemas/validators/employment';
import { additionalValidation } from './schemas/validators/additional-info';
import { creditApplicationValidation } from './schemas/validators/credit-application';

// Сервисы для работы с API
import { fetchApplication, saveApplication } from './services/api';
import { serializeApplication } from './utils/formTransformers';

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
    1: loanValidation,
    2: personalValidation,
    3: contactValidation,
    4: employmentValidation,
    5: additionalValidation,
    // Шаг 6 (подтверждение) - без валидации, только просмотр
  },
  fullValidation: creditApplicationValidation,
};

interface CreditApplicationFormProps {
  applicationId: string;
}

function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  // Создаём экземпляр формы
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Ref для доступа к методам навигации
  const navRef = useRef<StepNavigationHandle<CreditApplicationFormType>>(null);

  // Отправка формы
  const handleSubmit = async (values: CreditApplicationFormType) => {
    try {
      // Преобразование данных формы в формат API
      const apiData = serializeApplication(values);

      // Отправка на сервер через API сервис
      const result = await saveApplication(apiData);

      alert(`Заявка отправлена! ID: ${result.id}`);
    } catch (error) {
      console.error('Ошибка отправки:', error);
    }
  };

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadApplication() {
      try {
        setIsLoading(true);
        setError(null);

        const data = await fetchApplication(applicationId);

        // Загрузка всех данных в форму
        form.setValue(data);
      } catch (error: unknown) {
        console.error(error);
        setError('Не удалось загрузить заявку');
      } finally {
        setIsLoading(false);
      }
    }

    loadApplication();
  }, [form, applicationId]);

  if (isLoading) {
    return <div>Загрузка заявки...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

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
