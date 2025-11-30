---
sidebar_position: 3
---

# Базовый компонент формы

Создание главного компонента формы с навигацией по шагам.

## Обзор

Базовый компонент формы — это точка входа для нашей многошаговой формы. Он:

- Создаёт и управляет экземпляром формы
- Обрабатывает навигацию по шагам
- Отображает текущий шаг
- Управляет отправкой формы

## Создание экземпляра формы

Ранее мы уже создали компонент для демонстрации работы схемы.
Пора время применить реальную схему в нашем компоненте.

```tsx title="reformer-tutorial/src/forms/credit-application/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from './createCreditApplicationForm';

function CreditApplicationForm() {
  // Создаём экземпляр формы один раз
  const form = useMemo(() => createCreditApplicationForm(), []);

  // ...
}
```

:::warning Важно
Всегда оборачивайте создание формы в `useMemo`. Без этого форма будет пересоздаваться при каждом рендере, теряя все введённые пользователем данные.
:::

## Навигация по шагам

Для многошаговых форм необходимо отслеживать текущий шаг и обеспечить навигацию:

```tsx
import { useState } from 'react';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 6;

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

  // ...
}
```

## Отображение шагов

Отображайте соответствующий компонент шага в зависимости от `currentStep`:

```tsx
import { BasicInfoForm } from './steps/BasicInfoForm';
import { PersonalInfoForm } from './steps/PersonalInfoForm';
import { ContactInfoForm } from './steps/ContactInfoForm';
import { EmploymentForm } from './steps/EmploymentForm';
import { AdditionalInfoForm } from './steps/AdditionalInfoForm';
import { ConfirmationForm } from './steps/ConfirmationForm';

function CreditApplicationForm() {
  // ... настройка формы и состояния

  return (
    <div>
      {/* Индикатор шага */}
      <div className="mb-6">
        Шаг {currentStep} из {totalSteps}
      </div>

      {/* Содержимое текущего шага */}
      <div className="bg-white p-6 rounded-lg shadow">
        {currentStep === 1 && <BasicInfoForm control={form} />}
        {currentStep === 2 && <PersonalInfoForm control={form} />}
        {currentStep === 3 && <ContactInfoForm control={form} />}
        {currentStep === 4 && <EmploymentForm control={form} />}
        {currentStep === 5 && <AdditionalInfoForm control={form} />}
        {currentStep === 6 && <ConfirmationForm control={form} />}
      </div>

      {/* Кнопки навигации */}
      <div className="flex justify-between mt-6">
        <button onClick={goToPreviousStep} disabled={currentStep === 1}>
          Назад
        </button>

        {currentStep < totalSteps ? (
          <button onClick={goToNextStep}>Далее</button>
        ) : (
          <button onClick={handleSubmit}>Отправить</button>
        )}
      </div>
    </div>
  );
}
```

## Передача формы в шаги

Каждый компонент шага получает всю форму через проп `control`:

```tsx
interface StepProps {
  control: GroupNodeWithControls<CreditApplicationForm>;
}

function BasicInfoForm({ control }: StepProps) {
  return (
    <div>
      <FormField control={control.loanType} />
      <FormField control={control.loanAmount} />
      {/* ... */}
    </div>
  );
}
```

Такой подход:

- Даёт каждому шагу доступ ко всем полям формы
- Позволяет создавать зависимости между шагами (например, показывать поля на основе значений с других шагов)
- Сохраняет единый источник истины для состояния формы

## Отправка формы

Обработайте отправку формы, когда пользователь завершит все шаги:

```tsx
function CreditApplicationForm() {
  // ... настройка формы и состояния

  const handleSubmit = async () => {
    // Получаем все значения формы
    const values = form.getValue();

    try {
      // Отправляем на сервер
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        alert('Заявка успешно отправлена!');
      }
    } catch (error) {
      console.error('Ошибка отправки:', error);
    }
  };

  // ...
}
```

## Полный пример

Вот полный базовый компонент формы:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import type { GroupNodeWithControls } from 'reformer';
import { createCreditApplicationForm } from './schemas/create-credit-application-form';
import type { CreditApplicationForm } from './types';

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
    <div className="max-w-4xl mx-auto p-6">
      {/* Индикатор шагов */}
      <div>
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
```

## Следующий шаг

Теперь, когда у нас есть базовый компонент формы, давайте создадим отдельные компоненты шагов, которые отображают поля формы.
