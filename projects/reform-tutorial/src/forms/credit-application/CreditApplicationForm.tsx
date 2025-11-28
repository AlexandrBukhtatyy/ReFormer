import { useMemo, useState } from 'react';
import { createCreditApplicationForm } from './createCreditApplicationForm';

// Компоненты шагов
import { BasicInfoForm } from './steps/BasicInfoForm';
import { PersonalInfoForm } from './steps/PersonalInfoForm';
import { ContactInfoForm } from './steps/ContactInfoForm';
import { EmploymentForm } from './steps/EmploymentForm';
import { AdditionalInfoForm } from './steps/AdditionalInfoForm';
import { ConfirmationForm } from './steps/ConfirmationForm';

const STEPS = [
  { id: 1, title: 'Кредит' },
  { id: 2, title: 'Личные данные' },
  { id: 3, title: 'Контакты' },
  { id: 4, title: 'Занятость' },
  { id: 5, title: 'Дополнительно' },
  { id: 6, title: 'Подтверждение' },
];

function CreditApplicationForm() {
  // Создаём экземпляр формы
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Состояние навигации по шагам
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = STEPS.length;

  // Обработчики навигации
  const goToNextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goToPreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (step: number) => {
    if (step >= 1 && step <= totalSteps) {
      setCurrentStep(step);
    }
  };

  // Отправка формы
  const handleSubmit = async () => {
    const values = form.getValue();

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
    <div>
      {/* Индикатор шагов */}
      <div className="flex justify-between mb-4">
        {STEPS.map((step) => (
          <button
            key={step.id}
            onClick={() => goToStep(step.id)}
            className={`px-4 py-2 rounded ${
              currentStep === step.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {step.id}. {step.title}
          </button>
        ))}
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
          onClick={goToPreviousStep}
          disabled={currentStep === 1}
          className="px-6 py-2 bg-gray-300 rounded disabled:opacity-50"
        >
          Назад
        </button>

        {currentStep < totalSteps ? (
          <button onClick={goToNextStep} className="px-6 py-2 bg-blue-600 text-white rounded">
            Далее
          </button>
        ) : (
          <button onClick={handleSubmit} className="px-6 py-2 bg-green-600 text-white rounded">
            Отправить заявку
          </button>
        )}
      </div>

      {/* Информация о прогрессе */}
      <div className="mt-4 text-center text-sm text-gray-600">
        Шаг {currentStep} из {totalSteps} • {Math.round((currentStep / totalSteps) * 100)}%
        завершено
      </div>
    </div>
  );
}

export default CreditApplicationForm;
