import { useEffect, useMemo, useRef, useState } from 'react';
import { FormWizard, type FormWizardHandle } from '@reformer/ui/form-wizard';

// Компоненты шагов
import { BasicInfoForm } from './steps/loan-info/BasicInfoForm';
import { PersonalInfoForm } from './steps/personal-info/PersonalInfoForm';
import { ContactInfoForm } from './steps/contact-info/ContactInfoForm';
import { EmploymentForm } from './steps/employment/EmploymentForm';
import { AdditionalInfoForm } from './steps/additional-info/AdditionalInfoForm';
import { ConfirmationForm } from './steps/confirmation/ConfirmationForm';

// Валидаторы по шагам
import { loanValidation } from './steps/loan-info/validators';
import { personalValidation } from './steps/personal-info/validators';
import { contactValidation } from './steps/contact-info/validators';
import { employmentValidation } from './steps/employment/validators';
import { additionalValidation } from './steps/additional-info/validators';
import { creditApplicationValidation } from './validators';

// Сервисы для работы с API
import { fetchApplication, saveApplication } from './services/api';
import { serializeApplication } from './utils/formTransformers';

import type { CreditApplicationForm as CreditApplicationFormType } from './type';
import { createForm } from '@reformer/core';
import { creditApplicationSchema } from './schema';
import { creditApplicationBehaviors } from './behaviors';
import { Button } from '@/components/ui/button';

const STEPS = [
  { number: 1, title: 'Кредит', icon: '💰' },
  { number: 2, title: 'Личные данные', icon: '👤' },
  { number: 3, title: 'Контакты', icon: '📞' },
  { number: 4, title: 'Занятость', icon: '💼' },
  { number: 5, title: 'Дополнительно', icon: '📋' },
  { number: 6, title: 'Подтверждение', icon: '✅' },
];

// Конфигурация валидации по шагам
const STEP_VALIDATIONS = {
  1: loanValidation,
  2: personalValidation,
  3: contactValidation,
  4: employmentValidation,
  5: additionalValidation,
  // Шаг 6 (подтверждение) - без валидации, только просмотр
};

interface CreditApplicationFormProps {
  applicationId: string;
}

function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  // Ref для доступа к методам навигации
  const navRef = useRef<FormWizardHandle<CreditApplicationFormType>>(null);

  // Создаём экземпляр формы
  const form = useMemo(
    () =>
      createForm<CreditApplicationFormType>({
        form: creditApplicationSchema,
        behavior: creditApplicationBehaviors,
        validation: creditApplicationValidation,
      }),
    []
  );

  // Конфигурация навигации
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

  // ============================================================================
  // Отправка формы
  // ============================================================================

  const submitApplication = async () => {
    const result = await navRef.current?.submit(async (values: CreditApplicationFormType) => {
      // Преобразование данных формы в формат API
      const apiData = serializeApplication(values);

      // Отправка на сервер через API сервис
      const response = await saveApplication(apiData);

      alert(`Заявка отправлена! ID: ${response.id}`);
      return response;
    });

    if (!result) {
      alert('Пожалуйста, исправьте ошибки в форме');
    }
  };

  // ============================================================================
  // Рендер: Загрузка
  // ============================================================================

  if (isLoading) {
    return <div>Загрузка заявки...</div>;
  }

  // ============================================================================
  // Рендер: Ошибка
  // ============================================================================

  if (error) {
    return <div className="error">{error}</div>;
  }

  // ============================================================================
  // Рендер: Форма с headless compound components
  // ============================================================================

  return (
    <FormWizard ref={navRef} form={form} config={navConfig}>
      {/* Индикатор шагов (headless) */}
      <FormWizard.Indicator steps={STEPS}>
        {({ steps, goToStep }) => (
          <div className="flex justify-between mb-4">
            {steps.map((step) => (
              <button
                key={step.number}
                onClick={() => step.canNavigate && goToStep(step.number)}
                disabled={!step.canNavigate}
                className={`px-4 py-2 rounded transition-colors ${
                  step.isCurrent
                    ? 'bg-blue-600 text-white'
                    : step.isCompleted
                      ? 'bg-green-100 text-green-800 hover:bg-green-200'
                      : step.canNavigate
                        ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {step.isCompleted ? '✓' : step.icon} {step.title}
              </button>
            ))}
          </div>
        )}
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

      {/* Кнопки навигации (headless) */}
      <FormWizard.Actions onSubmit={submitApplication}>
        {({ prev, next, submit, isFirstStep, isLastStep, isValidating }) => (
          <div className="flex justify-between mt-6">
            <Button
              onClick={prev.onClick}
              disabled={isFirstStep || prev.disabled}
              variant="secondary"
            >
              Назад
            </Button>

            {!isLastStep ? (
              <Button onClick={next.onClick} disabled={next.disabled}>
                {isValidating ? 'Проверка...' : 'Далее'}
              </Button>
            ) : (
              <Button onClick={submit.onClick} disabled={submit.disabled} variant="default">
                {submit.isSubmitting ? 'Отправка...' : 'Отправить заявку'}
              </Button>
            )}
          </div>
        )}
      </FormWizard.Actions>

      {/* Информация о прогрессе (headless) */}
      <FormWizard.Progress>
        {({ current, total, percent }) => (
          <div className="mt-4 text-center text-sm text-gray-600">
            Шаг {current} из {total} • {percent}% завершено
          </div>
        )}
      </FormWizard.Progress>
    </FormWizard>
  );
}

export default CreditApplicationForm;
