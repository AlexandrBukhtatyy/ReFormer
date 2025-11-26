---
sidebar_position: 3
---

# Состояния отправки

Управление полным жизненным циклом отправки формы с отслеживанием состояния.

## Обзор

Состояния отправки предоставляют четкую обратную связь пользователям во время процесса отправки:

- **Ожидание** - Форма еще не отправлена
- **Отправка** - Отправка в процессе
- **Успех** - Отправка завершена успешно
- **Ошибка** - Отправка не удалась
- **Переходы состояний** - Переход между состояниями
- **Обратная связь интерфейса** - Визуальные индикаторы для каждого состояния

## Понимание состояний отправки

### Четыре состояния

```typescript
type SubmissionState =
  | { status: 'idle' }                      // Начальное состояние
  | { status: 'submitting'; progress?: number }  // В процессе
  | { status: 'success'; data: any }        // Успешно завершено
  | { status: 'error'; error: Error };      // Не удалось с ошибкой
```

### Переходы состояний

```
┌─────────────────────────────────────────────────┐
│             Автомат состояний отправки           │
└─────────────────────────────────────────────────┘

    ┌──────────┐
    │ ОЖИДАНИЕ │  ← Начальное состояние
    └────┬─────┘
         │
         │ Пользователь нажимает отправку
         ▼
    ┌────────────┐
    │ ОТПРАВКА   │  ← Валидация + Сетевой запрос
    └─┬────────┬─┘
      │        │
      │        │ Ошибка сервера / Сбой сети
      │        ▼
      │   ┌────────┐
      │   │ ОШИБКА │  ← Можно повторить
      │   └───┬────┘
      │       │
      │       │ Пользователь нажимает повтор
      │       └──────────┐
      │                  │
      │ Успех           │
      ▼                  │
  ┌─────────┐            │
  │ УСПЕХ   │            │
  └─────────┘            │
      │                  │
      │ Перейти или      │
      │ сбросить         │
      ▼                  ▼
  ┌──────────┐      ┌──────────┐
  │ ОЖИДАНИЕ │ ←────┤ ОЖИДАНИЕ │
  └──────────┘      └──────────┘
```

## Создание хука useSubmissionState

Давайте создадим переиспользуемый хук для управления состояниями отправки.

### Базовая реализация

```typescript title="src/hooks/useSubmissionState.ts"
import { useState, useCallback } from 'react';
import type { FormNode } from 'reformer';

/**
 * Тип состояния отправки
 */
export type SubmissionState<T = any> =
  | { status: 'idle' }
  | { status: 'submitting'; progress?: number }
  | { status: 'success'; data: T }
  | { status: 'error'; error: Error };

/**
 * Тип возврата хука
 */
export interface UseSubmissionStateResult<T> {
  state: SubmissionState<T>;
  submit: () => Promise<T>;
  reset: () => void;
  isIdle: boolean;
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
}

/**
 * Хук для управления состоянием отправки формы
 * @param form Узел формы
 * @param submitFn Функция для выполнения при отправке
 * @returns Состояние отправки и элементы управления
 */
export function useSubmissionState<T>(
  form: FormNode,
  submitFn: (data: any) => Promise<T>
): UseSubmissionStateResult<T> {
  const [state, setState] = useState<SubmissionState<T>>({ status: 'idle' });

  const submit = useCallback(async () => {
    // Установить состояние отправки
    setState({ status: 'submitting' });

    try {
      // Использовать form.submit() для автоматической валидации
      const result = await form.submit(async (validData) => {
        return await submitFn(validData);
      });

      // Установить состояние успеха
      setState({ status: 'success', data: result });

      return result;
    } catch (error) {
      // Установить состояние ошибки
      setState({
        status: 'error',
        error: error instanceof Error ? error : new Error('Отправка не удалась')
      });

      // Пробросить чтобы вызывающая сторона могла обработать если нужно
      throw error;
    }
  }, [form, submitFn]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    submit,
    reset,
    // Удобные флаги
    isIdle: state.status === 'idle',
    isSubmitting: state.status === 'submitting',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
  };
}
```

### Использование хука

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useSubmissionState } from '../hooks/useSubmissionState';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const {
    state,
    submit,
    reset,
    isIdle,
    isSubmitting,
    isSuccess,
    isError
  } = useSubmissionState(form, async (data) => {
    const apiData = creditApplicationTransformer.serialize(data);
    return await submitApplication(apiData);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submit();
      // Успех! Можно добавить дополнительную логику здесь
    } catch (error) {
      // Ошибка уже захвачена в состоянии
      console.error('Отправка не удалась:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Поля формы */}
      <FormRenderer form={form} />

      {/* Кнопка отправки изменяется в зависимости от состояния */}
      <button
        type="submit"
        disabled={isSubmitting || !form.valid.value}
      >
        {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
      </button>

      {/* Показать сообщение об успехе */}
      {isSuccess && state.status === 'success' && (
        <div className="text-green-600">
          Заявка {state.data.id} успешно отправлена!
        </div>
      )}

      {/* Показать сообщение об ошибке */}
      {isError && state.status === 'error' && (
        <div className="text-red-600">
          Ошибка: {state.error.message}
          <button onClick={() => submit()}>Повторить</button>
        </div>
      )}
    </form>
  );
}
```

## Создание компонентов, учитывающих состояние

### Кнопка отправки с состояниями

```tsx title="src/components/SubmitButton.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';
import type { SubmissionState } from '../hooks/useSubmissionState';

interface SubmitButtonProps {
  form: FormNode;
  state: SubmissionState;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function SubmitButton({
  form,
  state,
  onClick,
  children = 'Отправить'
}: SubmitButtonProps) {
  const { value: isValid } = useFormControl(form.valid);

  // Состояние ожидания - обычная кнопка
  if (state.status === 'idle') {
    return (
      <button
        type="submit"
        onClick={onClick}
        disabled={!isValid}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
      >
        {children}
      </button>
    );
  }

  // Состояние отправки - кнопка загрузки
  if (state.status === 'submitting') {
    return (
      <button
        type="button"
        disabled
        className="bg-blue-600 text-white px-6 py-3 rounded-lg flex items-center gap-2"
      >
        <svg
          className="animate-spin h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        Отправка...
        {state.progress && <span>({state.progress}%)</span>}
      </button>
    );
  }

  // Состояние успеха - успешная кнопка
  if (state.status === 'success') {
    return (
      <button
        type="button"
        disabled
        className="bg-green-600 text-white px-6 py-3 rounded-lg flex items-center gap-2"
      >
        <svg
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        Отправлено!
      </button>
    );
  }

  // Состояние ошибки - кнопка повтора
  if (state.status === 'error') {
    return (
      <button
        type="submit"
        onClick={onClick}
        className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700"
      >
        Повторить отправку
      </button>
    );
  }

  return null;
}
```

### Компонент SubmissionStatus

```tsx title="src/components/SubmissionStatus.tsx"
import type { SubmissionState } from '../hooks/useSubmissionState';

interface SubmissionStatusProps {
  state: SubmissionState;
  onReset?: () => void;
}

export function SubmissionStatus({ state, onReset }: SubmissionStatusProps) {
  // Ожидание - нет сообщения
  if (state.status === 'idle') {
    return null;
  }

  // Отправка - сообщение загрузки
  if (state.status === 'submitting') {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <div className="flex items-center">
          <svg
            className="animate-spin h-5 w-5 text-blue-600 mr-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <div>
            <p className="text-blue-800 font-medium">Отправка вашей заявки...</p>
            <p className="text-blue-600 text-sm">Пожалуйста, дождитесь пока мы обработаем ваш запрос.</p>
          </div>
        </div>
      </div>
    );
  }

  // Успех - сообщение об успехе
  if (state.status === 'success') {
    return (
      <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-green-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Заявка успешно отправлена!
            </h3>
            <div className="mt-2 text-sm text-green-700">
              <p>
                Ваша заявка получена и находится в процессе обработки.
                Мы свяжемся с вами вскоре с обновлением.
              </p>
              {state.data?.id && (
                <p className="mt-1">
                  ID ссылки: <span className="font-mono">{state.data.id}</span>
                </p>
              )}
            </div>
            {onReset && (
              <div className="mt-4">
                <button
                  onClick={onReset}
                  className="text-green-700 underline text-sm hover:text-green-900"
                >
                  Отправить еще одну заявку
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Ошибка - сообщение об ошибке
  if (state.status === 'error') {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">
              Отправка не удалась
            </h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{state.error.message}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
```

## Блокировка формы во время отправки

Предотвратить редактирование формы пользователем во время отправки.

### Блокировка полей формы

```tsx title="src/components/FormRenderer.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';
import type { SubmissionState } from '../hooks/useSubmissionState';

interface FormRendererProps {
  form: FormNode;
  state?: SubmissionState;
}

export function FormRenderer({ form, state }: FormRendererProps) {
  const isLocked = state?.status === 'submitting';

  return (
    <div className={isLocked ? 'opacity-60 pointer-events-none' : ''}>
      {/* Оверлей для предотвращения взаимодействия */}
      {isLocked && (
        <div className="absolute inset-0 bg-white bg-opacity-50 cursor-not-allowed z-10" />
      )}

      {/* Поля формы */}
      <div className="space-y-6">
        {/* Ваши поля формы здесь */}
      </div>
    </div>
  );
}
```

### Отключение отдельных полей

```tsx title="src/components/FormField.tsx"
import { useFormControl } from 'reformer';

interface FormFieldProps {
  control: any;
  label: string;
  locked?: boolean;
}

export function FormField({ control, label, locked = false }: FormFieldProps) {
  const { value, errors, setValue } = useFormControl(control);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={locked}
        className={`
          w-full px-3 py-2 border rounded-lg
          ${errors ? 'border-red-500' : 'border-gray-300'}
          ${locked ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
        `}
      />
      {errors && (
        <p className="text-red-600 text-sm mt-1">{errors[0]?.message}</p>
      )}
    </div>
  );
}
```

## Индикатор прогресса

Показать прогресс загрузки/отправки для долгоживущих операций.

### Компонент ProgressBar

```tsx title="src/components/ProgressBar.tsx"
interface ProgressBarProps {
  progress: number; // 0-100
  label?: string;
}

export function ProgressBar({ progress, label }: ProgressBarProps) {
  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between mb-1">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          <span className="text-sm font-medium text-gray-700">{progress}%</span>
        </div>
      )}
      <div className="w-full bg-gray-200 rounded-full h-2.5">
        <div
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
```

### С состоянием отправки

```tsx title="src/components/CreditApplicationForm.tsx"
import { ProgressBar } from './ProgressBar';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const { state, submit } = useSubmissionState(form, submitFn);

  return (
    <form onSubmit={handleSubmit}>
      <FormRenderer form={form} />

      {/* Показать прогресс при отправке */}
      {state.status === 'submitting' && state.progress && (
        <ProgressBar
          progress={state.progress}
          label="Загрузка заявки"
        />
      )}

      <SubmitButton form={form} state={state} />
    </form>
  );
}
```

## Полный пример интеграции

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useSubmissionState } from '../hooks/useSubmissionState';
import { SubmitButton } from './SubmitButton';
import { SubmissionStatus } from './SubmissionStatus';
import { FormRenderer } from './FormRenderer';

export function CreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);

  const {
    state,
    submit,
    reset,
    isIdle,
    isSubmitting,
    isSuccess,
    isError
  } = useSubmissionState(form, async (data) => {
    const apiData = creditApplicationTransformer.serialize(data);
    return await submitApplication(apiData);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await submit();

      // Перейти на страницу успеха после короткой задержки
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`);
      }, 2000);
    } catch (error) {
      // Ошибка уже захвачена в состоянии
      console.error('Отправка не удалась:', error);
    }
  };

  const handleReset = () => {
    reset();
    form.reset();
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Заявка на кредит</h1>

      {/* Сообщения о состоянии */}
      <SubmissionStatus state={state} onReset={handleReset} />

      <form onSubmit={handleSubmit}>
        {/* Поля формы - заблокированы при отправке */}
        <FormRenderer form={form} state={state} />

        {/* Кнопка отправки - изменяется в зависимости от состояния */}
        <div className="mt-6">
          <SubmitButton form={form} state={state} />
        </div>
      </form>
    </div>
  );
}
```

## Тестирование переходов состояний

### Сценарии тестирования

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';

jest.mock('../services/api/submission.api');

describe('CreditApplicationForm - Состояния отправки', () => {
  test('переходит от ожидания к отправке к успеху', async () => {
    (submitApplication as jest.Mock).mockResolvedValue({
      id: 'app-123',
      status: 'pending',
    });

    render(<CreditApplicationForm />);

    // Начальное состояние: Ожидание
    expect(screen.getByText('Отправить заявку')).toBeInTheDocument();

    // Заполнить форму и отправить
    const submitButton = screen.getByText('Отправить заявку');
    fireEvent.click(submitButton);

    // Состояние отправки
    await waitFor(() => {
      expect(screen.getByText('Отправка...')).toBeInTheDocument();
    });

    // Состояние успеха
    await waitFor(() => {
      expect(screen.getByText(/успешно отправлена/i)).toBeInTheDocument();
    });
  });

  test('переходит от отправки к ошибке при сбое', async () => {
    (submitApplication as jest.Mock).mockRejectedValue(
      new Error('Ошибка сети')
    );

    render(<CreditApplicationForm />);

    // Отправить форму
    const submitButton = screen.getByText('Отправить заявку');
    fireEvent.click(submitButton);

    // Состояние ошибки
    await waitFor(() => {
      expect(screen.getByText(/Ошибка сети/i)).toBeInTheDocument();
      expect(screen.getByText('Повторить отправку')).toBeInTheDocument();
    });
  });

  test('позволяет повтор из состояния ошибки', async () => {
    let attempts = 0;
    (submitApplication as jest.Mock).mockImplementation(() => {
      attempts++;
      if (attempts === 1) {
        return Promise.reject(new Error('Ошибка сети'));
      }
      return Promise.resolve({ id: 'app-123', status: 'pending' });
    });

    render(<CreditApplicationForm />);

    // Первая попытка - не удалась
    fireEvent.click(screen.getByText('Отправить заявку'));

    await waitFor(() => {
      expect(screen.getByText('Повторить отправку')).toBeInTheDocument();
    });

    // Повтор - успешно
    fireEvent.click(screen.getByText('Повторить отправку'));

    await waitFor(() => {
      expect(screen.getByText(/успешно отправлена/i)).toBeInTheDocument();
    });
  });

  test('блокирует форму при отправке', async () => {
    (submitApplication as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    const { container } = render(<CreditApplicationForm />);

    // Отправить форму
    fireEvent.click(screen.getByText('Отправить заявку'));

    // Форма должна быть заблокирована
    await waitFor(() => {
      const formInputs = container.querySelectorAll('input');
      formInputs.forEach(input => {
        expect(input).toBeDisabled();
      });
    });
  });
});
```

## Лучшие практики

### 1. Всегда отслеживайте все состояния

```typescript
// ✅ ХОРОШО: Отслеживать все состояния
const { state, isIdle, isSubmitting, isSuccess, isError } = useSubmissionState(form, submitFn);

// ❌ ПЛОХО: Отслеживать только загрузку
const [loading, setLoading] = useState(false);
```

### 2. Предоставьте четкую визуальную обратную связь

```tsx
// ✅ ХОРОШО: Разный интерфейс для каждого состояния
{state.status === 'submitting' && <LoadingSpinner />}
{state.status === 'success' && <SuccessMessage />}
{state.status === 'error' && <ErrorMessage />}

// ❌ ПЛОХО: Универсальное сообщение
{loading && <span>Пожалуйста, дождитесь...</span>}
```

### 3. Блокируйте форму при отправке

```tsx
// ✅ ХОРОШО: Отключить все взаимодействия
<FormRenderer form={form} locked={isSubmitting} />

// ❌ ПЛОХО: Позволить редактирование при отправке
<FormRenderer form={form} />
```

### 4. Включите повтор при ошибке

```tsx
// ✅ ХОРОШО: Показать кнопку повтора
{isError && <button onClick={submit}>Повторить</button>}

// ❌ ПЛОХО: Нет способа повторить
{isError && <span>Произошла ошибка</span>}
```

### 5. Очистите успех перед новой отправкой

```typescript
// ✅ ХОРОШО: Сбросить состояние перед новой отправкой
const handleReset = () => {
  reset();
  form.reset();
};

// ❌ ПЛОХО: Сохранить устаревшее состояние успеха
// Предыдущее сообщение об успехе всё еще показывается
```

## Ключевые моменты

- Используйте автоматы состояний для отслеживания жизненного цикла отправки
- Предоставьте четкую визуальную обратную связь для каждого состояния
- Блокируйте форму при отправке чтобы предотвратить конфликты
- Включите повтор из состояния ошибки
- Показывайте прогресс для долгоживущих операций
- Протестируйте все переходы состояний
- Обработайте навигацию после успеха

## Что дальше?

Вы реализовали комплексное управление состоянием отправки! Далее мы будем обрабатывать **ошибки сервера**:

- Ошибки валидации на сервере
- Сопоставление ошибок полям формы
- Общие ошибки сервера
- Стратегии восстановления после ошибок
- Разные коды HTTP статуса
- Ошибки уровня поля vs глобальные ошибки

В следующем разделе мы убедимся, что ваша форма корректно обрабатывает все типы ответов сервера и предоставляет полезную обратную связь пользователям.
