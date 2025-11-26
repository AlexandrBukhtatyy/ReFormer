---
sidebar_position: 8
---

# Полный поток отправки

Объединение всех компонентов отправки в полный, работающий рабочий процесс.

## Обзор

Полный поток отправки объединяет все компоненты которые мы создали:

- **Многошаговая навигация** - Управление шагами формы
- **Валидация** - Валидирование каждого шага
- **Состояния отправки** - Отслеживание состояния отправки
- **Обработка ошибок** - Обработка ошибок сервера
- **Логика повтора** - Автоматический повтор при ошибках
- **Оптимистичные обновления** - Мгновенное обновление интерфейса
- **Успешное завершение** - Навигация после успеха

## Полная архитектура

### Компоненты системы

```
┌─────────────────────────────────────────────┐
│     CreditApplicationForm (главный)         │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │   StepIndicator - Индикатор прогресса  │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ ┌─────────────────────────────────────────┐ │
│ │   StepForm - Форма текущего шага        │ │
│ │   ┌─────────────────────────────────────┤ │
│ │   │ FormFields - Поля формы             │ │
│ │   └─────────────────────────────────────┤ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ ┌─────────────────────────────────────────┐ │
│ │   StepNavigation - Кнопки навигации     │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ ┌─────────────────────────────────────────┐ │
│ │   ReviewPage - Страница проверки        │ │
│ └─────────────────────────────────────────┘ │
│                                              │
│ ┌─────────────────────────────────────────┐ │
│ │   SubmissionStatus - Статус отправки    │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Используемые хуки

```typescript
- useMultiStep: Управление шагами
- useSubmissionState: Управление состоянием отправки
- useRetry: Логика повтора
- useOptimistic: Оптимистичные обновления
- useAutoClearErrors: Очистка ошибок
```

## Полная реализация компонента

### Главный компонент формы

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { mapServerErrors } from '../utils/map-server-errors';
import { useMultiStep } from '../hooks/useMultiStep';
import { useSubmissionState } from '../hooks/useSubmissionState';
import { useAutoClearErrors } from '../hooks/useAutoClearErrors';
import { StepIndicator } from './StepIndicator';
import { StepNavigation } from './StepNavigation';
import { ReviewPage } from './ReviewPage';
import { SubmissionStatus } from './SubmissionStatus';
import { FormRenderer } from './FormRenderer';
import { ErrorAlert } from './ErrorAlert';

const STEPS = [
  { name: 'Информация о кредите', path: 'step1' },
  { name: 'Личная информация', path: 'step2' },
  { name: 'Контактная информация', path: 'step3' },
  { name: 'Информация о работе', path: 'step4' },
  { name: 'Дополнительная информация', path: 'step5' },
];

export function CreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [showReview, setShowReview] = useState(false);
  const [globalError, setGlobalError] = useState<Error | null>(null);

  // Управление многошаговой навигацией
  const {
    currentStep,
    currentStepData,
    isFirstStep,
    isLastStep,
    goToStep,
    goNext,
    goPrevious,
  } = useMultiStep(form, STEPS);

  // Управление состоянием отправки с повтором
  const {
    state,
    submit,
    reset: resetSubmission,
    attempt,
    retrying,
    isSubmitting,
  } = useSubmissionState(
    form,
    async (data) => {
      const apiData = creditApplicationTransformer.serialize(data);
      return await submitApplication(apiData);
    },
    {
      retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 5000,
        backoffMultiplier: 2,
      },
    }
  );

  // Автоматически очищать ошибки при изменении
  useAutoClearErrors(form);

  // Обработчик перехода на следующий шаг
  const handleNext = async () => {
    const canProceed = await goNext();
    if (canProceed && isLastStep) {
      setShowReview(true);
    }
  };

  // Обработчик отправки
  const handleSubmit = async () => {
    setGlobalError(null);

    try {
      const result = await submit();

      // Успех! Перейти на страницу успеха
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`);
      }, 2000);
    } catch (error) {
      console.error('Ошибка отправки:', error);

      if (error instanceof ValidationSubmissionError) {
        mapServerErrors(form, error);
        setGlobalError(
          new Error('Пожалуйста, исправьте ошибки валидации и попробуйте снова.')
        );
      } else if (error instanceof AuthenticationError) {
        setGlobalError(error);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else {
        setGlobalError(error as Error);
      }
    }
  };

  // Обработчик возврата из проверки
  const handleBackFromReview = () => {
    setShowReview(false);
  };

  if (showReview) {
    return (
      <ReviewPage
        form={form}
        steps={STEPS}
        onEdit={(stepIndex) => {
          setShowReview(false);
          goToStep(stepIndex);
        }}
        onSubmit={handleSubmit}
        submitting={isSubmitting || retrying}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">Заявка на кредит</h1>

      {/* Индикатор прогресса */}
      <StepIndicator
        steps={STEPS}
        currentStep={currentStep}
        onStepClick={goToStep}
      />

      {/* Статус отправки */}
      <SubmissionStatus state={state} onReset={resetSubmission} />

      {/* Глобальная ошибка */}
      {globalError && (
        <ErrorAlert
          error={globalError}
          onRetry={isSubmitting ? undefined : handleSubmit}
          onDismiss={() => setGlobalError(null)}
        />
      )}

      {/* Индикатор повтора */}
      {attempt > 0 && (
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
          <p className="text-blue-700">
            Попытка повтора {attempt} из 3...
          </p>
        </div>
      )}

      {/* Форма текущего шага */}
      <div className="bg-white rounded-lg shadow p-6 my-6">
        <h2 className="text-2xl font-bold mb-4">{currentStepData.name}</h2>
        <FormRenderer form={form} state={state} />
      </div>

      {/* Навигация по шагам */}
      <StepNavigation
        isFirstStep={isFirstStep}
        isLastStep={isLastStep}
        onPrevious={goPrevious}
        onNext={handleNext}
        onReview={handleNext}
        loading={retrying}
      />
    </div>
  );
}
```

## Тестирование полного потока

### Сценарии тестирования

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';

jest.mock('../services/api/submission.api');

describe('Полный поток отправки', () => {
  test('завершает полный процесс успешно', async () => {
    (submitApplication as jest.Mock).mockResolvedValue({
      id: 'app-123',
      status: 'pending',
      message: 'Заявка получена',
    });

    render(<CreditApplicationForm />);

    // Шаг 1
    expect(screen.getByText('Информация о кредите')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Следующий шаг'));

    // Шаг 2
    await waitFor(() => {
      expect(screen.getByText('Личная информация')).toBeInTheDocument();
    });

    // ... продолжить для каждого шага

    // Проверка
    fireEvent.click(screen.getByText('Проверить заявку'));
    await waitFor(() => {
      expect(screen.getByText('Проверьте вашу заявку')).toBeInTheDocument();
    });

    // Отправка
    fireEvent.click(screen.getByText('Отправить заявку'));

    // Успех
    await waitFor(() => {
      expect(screen.getByText(/успешно отправлена/i)).toBeInTheDocument();
    });
  });

  test('обрабатывает ошибки валидации и повторы', async () => {
    let attempts = 0;
    (submitApplication as jest.Mock).mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new Error('Ошибка сети'));
      }
      return Promise.resolve({ id: 'app-123', status: 'pending' });
    });

    render(<CreditApplicationForm />);

    // ... заполнить все шаги

    // Отправить
    fireEvent.click(screen.getByText('Отправить заявку'));

    // Должно показать повторы
    await waitFor(() => {
      expect(screen.getByText(/Попытка повтора/i)).toBeInTheDocument();
    });

    // В конце успех
    await waitFor(() => {
      expect(screen.getByText(/успешно отправлена/i)).toBeInTheDocument();
    });
  });
});
```

## Лучшие практики для полного потока

### 1. Управление состоянием

```typescript
// ✅ ХОРОШО: Отделить много состояний
const { state: multiStepState } = useMultiStep(form, steps);
const { state: submissionState } = useSubmissionState(form, submitFn);

// ❌ ПЛОХО: Все в одном состоянии
const [allState, setAllState] = useState({});
```

### 2. Обработка ошибок

```typescript
// ✅ ХОРОШО: Обработать разные типы ошибок
if (error instanceof ValidationSubmissionError) {
  mapServerErrors(form, error);
} else if (error instanceof NetworkSubmissionError) {
  showRetryButton();
}

// ❌ ПЛОХО: Универсальная обработка
catch (error) {
  showAlert('Error occurred');
}
```

### 3. Пользовательский опыт

```typescript
// ✅ ХОРОШО: Предоставить обратную связь на каждом шаге
- Показать индикатор прогресса
- Позволить вернуться и отредактировать
- Предоставить страницу проверки
- Показать статус отправки

// ❌ ПЛОХО: Минимальная обратная связь
- Просто скрытые шаги
- Нет способа отредактировать
- Прямая отправка
```

## Улучшения и расширения

### Сохранение в черновиках

```typescript
// Сохранять данные формы в localStorage
const saveDraft = (data) => {
  localStorage.setItem('application-draft', JSON.stringify(data));
};

const loadDraft = () => {
  return JSON.parse(localStorage.getItem('application-draft') || '{}');
};
```

### Аналитика

```typescript
// Отслеживать взаимодействие пользователя
const trackEvent = (eventName, data) => {
  analytics.track(eventName, data);
};

// Использовать в компонентах
handleNext: () => {
  trackEvent('step_completed', { stepIndex: currentStep });
  goNext();
}
```

### Локализация

```typescript
// Использовать многоязычные строки
const [language] = useLanguage();
const stepName = t(`steps.${currentStepData.path}`);
```

## Заключение

Вы создали полный профессиональный рабочий процесс отправки форм с:

- Многошаговой навигацией
- Валидацией на каждом шаге
- Обработкой ошибок сервера
- Автоматическим повтором
- Оптимистичными обновлениями
- Страницей проверки
- Управлением состоянием отправки
- Полной обработкой ошибок

Этот рабочий процесс готов к использованию в производстве и может быть адаптирован к вашим конкретным потребностям.

## Ресурсы

- [ReFormer документация](https://reformer.dev)
- [React документация](https://react.dev)
- [TypeScript справка](https://www.typescriptlang.org/docs/)

Удачи в ваших проектах!
