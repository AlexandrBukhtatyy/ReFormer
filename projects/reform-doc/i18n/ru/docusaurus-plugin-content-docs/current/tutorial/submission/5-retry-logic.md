---
sidebar_position: 5
---

# Логика повтора

Реализация механизмов автоматического и ручного повтора для неудачных отправок.

## Обзор

Логика повтора делает вашу форму устойчивой к временным сбоям:

- **Автоматический повтор** - Повторить неудачные запросы автоматически
- **Экспоненциальное отступление** - Увеличивать задержку между повторами
- **Максимальное количество попыток** - Ограничить попытки повтора
- **Ручной повтор** - Позволить повторы, инициированные пользователем
- **Индикаторы повтора** - Показать прогресс повтора пользователям
- **Выборочный повтор** - Повторять только подходящие ошибки

## Понимание стратегий повтора

### Когда повторять

```typescript
// ✅ ПОВТОРЯТЬ эти ошибки
- Ошибки сети (соединение не установлено)
- Ошибки сервера (500, 502, 503, 504)
- Ошибки тайм-аута
- Ограничение частоты (429) - после ожидания

// ❌ НЕ ПОВТОРЯТЬ эти ошибки
- Ошибки валидации (422)
- Ошибки аутентификации (401)
- Ошибки авторизации (403)
- Ошибки клиента (400, 404)
```

### Экспоненциальное отступление

Экспоненциальное отступление предотвращает перегрузку сервера:

```
Попытка 1: Ждать 1 секунду    (1 × 2^0)
Попытка 2: Ждать 2 секунды    (1 × 2^1)
Попытка 3: Ждать 4 секунды    (1 × 2^2)
Попытка 4: Ждать 8 секунд     (1 × 2^3)
Макс задержка: 10 секунд (предел)
```

```typescript
const delay = Math.min(
  initialDelay * Math.pow(backoffMultiplier, attemptNumber),
  maxDelay
);
```

## Создание хука useRetry

Создайте переиспользуемый хук для логики повтора.

### Опции повтора

```typescript title="src/hooks/useRetry.ts"
export interface RetryOptions {
  /**
   * Максимальное количество попыток повтора
   * @default 3
   */
  maxAttempts: number;

  /**
   * Начальная задержка в миллисекундах
   * @default 1000
   */
  initialDelay: number;

  /**
   * Максимальная задержка в миллисекундах
   * @default 10000
   */
  maxDelay: number;

  /**
   * Множитель отступления
   * @default 2
   */
  backoffMultiplier: number;

  /**
   * Функция для определения повторяемости ошибки
   */
  shouldRetry?: (error: Error) => boolean;

  /**
   * Callback вызываемый перед каждым повтором
   */
  onRetry?: (attempt: number, error: Error) => void;
}
```

### Реализация хука

```typescript title="src/hooks/useRetry.ts"
import { useState, useCallback } from 'react';
import {
  ValidationSubmissionError,
  AuthenticationError,
} from '../errors/submission-errors';

export interface UseRetryResult<T> {
  submit: () => Promise<T>;
  attempt: number;
  retrying: boolean;
  reset: () => void;
}

/**
 * Утилита сна
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Стратегия повтора по умолчанию - не повторять ошибки валидации или аутентификации
 */
function defaultShouldRetry(error: Error): boolean {
  // Никогда не повторять ошибки валидации
  if (error instanceof ValidationSubmissionError) {
    return false;
  }

  // Никогда не повторять ошибки аутентификации
  if (error instanceof AuthenticationError) {
    return false;
  }

  // Повторять ошибки с флагом повторяемости
  if ('retryable' in error) {
    return (error as any).retryable === true;
  }

  // По умолчанию, повторять другие ошибки
  return true;
}

/**
 * Хук для добавления логики повтора к функции отправки
 */
export function useRetry<T>(
  submitFn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): UseRetryResult<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = options;

  const [attempt, setAttempt] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const submit = useCallback(async (): Promise<T> => {
    let lastError: Error | undefined;

    for (let i = 0; i < maxAttempts; i++) {
      setAttempt(i + 1);

      try {
        // Попытаться отправить
        const result = await submitFn();

        // Успех! Сбросить и вернуть
        setAttempt(0);
        setRetrying(false);
        return result;
      } catch (error) {
        lastError = error as Error;

        console.log(`Попытка ${i + 1}/${maxAttempts} не удалась:`, error);

        // Проверить должны ли мы повторить эту ошибку
        if (!shouldRetry(lastError)) {
          console.log('Ошибка не повторяемая, остановка');
          setAttempt(0);
          setRetrying(false);
          throw lastError;
        }

        // Последняя попытка - не ждать, просто выбросить
        if (i === maxAttempts - 1) {
          console.log('Максимум попыток достигнут, остановка');
          setAttempt(0);
          setRetrying(false);
          throw lastError;
        }

        // Рассчитать задержку с экспоненциальным отступлением
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, i),
          maxDelay
        );

        console.log(`Повтор через ${delay}мс...`);

        // Вызвать callback повтора
        if (onRetry) {
          onRetry(i + 1, lastError);
        }

        // Ждать перед следующей попыткой
        setRetrying(true);
        await sleep(delay);
        setRetrying(false);
      }
    }

    // Никогда не должны добраться сюда, но TypeScript требует это
    throw lastError!;
  }, [submitFn, maxAttempts, initialDelay, maxDelay, backoffMultiplier, shouldRetry, onRetry]);

  const reset = useCallback(() => {
    setAttempt(0);
    setRetrying(false);
  }, []);

  return {
    submit,
    attempt,
    retrying,
    reset,
  };
}
```

## Использование хука повтора

### Базовое использование

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useRetry } from '../hooks/useRetry';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const { submit, attempt, retrying } = useRetry(
    async () => {
      return await form.submit(async (data) => {
        const apiData = creditApplicationTransformer.serialize(data);
        return await submitApplication(apiData);
      });
    },
    {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 2,
      onRetry: (attempt, error) => {
        console.log(`Попытка повтора ${attempt}:`, error.message);
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const result = await submit();
      console.log('Успех:', result);
    } catch (error) {
      console.error('Все попытки повтора не удались:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormRenderer form={form} />

      {/* Показать индикатор повтора */}
      {retrying && (
        <div className="text-blue-600">
          Повтор... (Попытка {attempt}/3)
        </div>
      )}

      <button type="submit" disabled={retrying}>
        Отправить заявку
      </button>
    </form>
  );
}
```

## Компонент индикатора повтора

Создайте визуальный индикатор для прогресса повтора.

### Компонент RetryIndicator

```tsx title="src/components/RetryIndicator.tsx"
interface RetryIndicatorProps {
  attempt: number;
  maxAttempts: number;
  retrying: boolean;
}

export function RetryIndicator({
  attempt,
  maxAttempts,
  retrying
}: RetryIndicatorProps) {
  if (attempt === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
      <div className="flex items-center">
        {retrying && (
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
        )}
        <div>
          <p className="text-blue-800 font-medium">
            {retrying ? 'Повтор отправки...' : 'Отправка...'}
          </p>
          <p className="text-blue-600 text-sm">
            Попытка {attempt} из {maxAttempts}
          </p>
        </div>
      </div>
    </div>
  );
}
```

### Использование RetryIndicator

```tsx title="src/components/CreditApplicationForm.tsx"
import { RetryIndicator } from './RetryIndicator';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const { submit, attempt, retrying } = useRetry(submitFn, {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 5000,
  });

  return (
    <form onSubmit={handleSubmit}>
      {/* Показать прогресс повтора */}
      <RetryIndicator
        attempt={attempt}
        maxAttempts={3}
        retrying={retrying}
      />

      <FormRenderer form={form} />

      <SubmitButton disabled={retrying} />
    </form>
  );
}
```

## Кнопка ручного повтора

Позвольте пользователям вручную повторить после того как все автоматические попытки не удались.

### Компонент ручного повтора

```tsx title="src/components/ManualRetryButton.tsx"
interface ManualRetryButtonProps {
  onRetry: () => void;
  error: Error;
  disabled?: boolean;
}

export function ManualRetryButton({
  onRetry,
  error,
  disabled = false
}: ManualRetryButtonProps) {
  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-yellow-800">
            Автоматический повтор не удалась
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>{error.message}</p>
            <p className="mt-1">
              Отправка не удалась после нескольких попыток. Вы можете повторить вручную.
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={onRetry}
              disabled={disabled}
              className="bg-yellow-100 text-yellow-800 px-4 py-2 rounded hover:bg-yellow-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

## Объединение повтора с состоянием отправки

Интегрируйте логику повтора с управлением состоянием отправки.

### Улучшенный useSubmissionState

```typescript title="src/hooks/useSubmissionState.ts"
import { useState, useCallback } from 'react';
import type { FormNode } from 'reformer';
import { useRetry, type RetryOptions } from './useRetry';

export interface UseSubmissionStateWithRetryOptions {
  retry?: Partial<RetryOptions>;
}

export function useSubmissionState<T>(
  form: FormNode,
  submitFn: (data: any) => Promise<T>,
  options: UseSubmissionStateWithRetryOptions = {}
): UseSubmissionStateResult<T> & {
  attempt: number;
  retrying: boolean;
} {
  const [state, setState] = useState<SubmissionState<T>>({ status: 'idle' });

  // Обернуть submitFn с form.submit
  const wrappedSubmit = useCallback(async () => {
    return await form.submit(submitFn);
  }, [form, submitFn]);

  // Добавить логику повтора
  const { submit: submitWithRetry, attempt, retrying } = useRetry(
    wrappedSubmit,
    {
      ...options.retry,
      onRetry: (attemptNum, error) => {
        // Обновить состояние для показа прогресса повтора
        setState({
          status: 'submitting',
          progress: (attemptNum / (options.retry?.maxAttempts || 3)) * 100,
        });

        // Вызвать пользовательский onRetry если предоставлен
        options.retry?.onRetry?.(attemptNum, error);
      },
    }
  );

  const submit = useCallback(async () => {
    setState({ status: 'submitting' });

    try {
      const result = await submitWithRetry();
      setState({ status: 'success', data: result });
      return result;
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error : new Error('Отправка не удалась')
      });
      throw error;
    }
  }, [submitWithRetry]);

  const reset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  return {
    state,
    submit,
    reset,
    attempt,
    retrying,
    isIdle: state.status === 'idle',
    isSubmitting: state.status === 'submitting',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
  };
}
```

## Полный пример интеграции

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { mapServerErrors } from '../utils/map-server-errors';
import { ValidationSubmissionError } from '../errors/submission-errors';
import { useSubmissionState } from '../hooks/useSubmissionState';
import { RetryIndicator } from './RetryIndicator';
import { ManualRetryButton } from './ManualRetryButton';
import { SubmitButton } from './SubmitButton';
import { FormRenderer } from './FormRenderer';

export function CreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [manualRetryNeeded, setManualRetryNeeded] = useState(false);
  const [lastError, setLastError] = useState<Error | null>(null);

  const {
    state,
    submit,
    attempt,
    retrying,
    isSubmitting,
    isSuccess,
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
        onRetry: (attempt, error) => {
          console.log(`Попытка повтора ${attempt}:`, error.message);
        },
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualRetryNeeded(false);
    setLastError(null);

    try {
      const result = await submit();

      // Успех - перейти на страницу успеха
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`);
      }, 2000);
    } catch (error) {
      console.error('Отправка не удалась после повторов:', error);
      setLastError(error as Error);

      // Обработать ошибки валидации (не повторяемые)
      if (error instanceof ValidationSubmissionError) {
        mapServerErrors(form, error);
      } else {
        // Другие ошибки - предложить ручной повтор
        setManualRetryNeeded(true);
      }
    }
  };

  const handleManualRetry = async () => {
    setManualRetryNeeded(false);
    await handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Заявка на кредит</h1>

      {/* Индикатор повтора */}
      <RetryIndicator
        attempt={attempt}
        maxAttempts={3}
        retrying={retrying}
      />

      {/* Кнопка ручного повтора */}
      {manualRetryNeeded && lastError && (
        <ManualRetryButton
          onRetry={handleManualRetry}
          error={lastError}
          disabled={isSubmitting}
        />
      )}

      {/* Сообщение об успехе */}
      {isSuccess && state.status === 'success' && (
        <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-6">
          <p className="text-green-700">
            Заявка {state.data.id} успешно отправлена!
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Поля формы */}
        <FormRenderer form={form} state={state} />

        {/* Кнопка отправки */}
        <div className="mt-6">
          <SubmitButton
            form={form}
            state={state}
          />
        </div>
      </form>
    </div>
  );
}
```

## Продвинутые стратегии повтора

### Пользовательская логика повтора

```typescript title="src/hooks/useCustomRetry.ts"
import { useRetry } from './useRetry';
import type { RetryOptions } from './useRetry';

/**
 * Повторять только ошибки сети и сервера
 */
export function useNetworkRetry<T>(submitFn: () => Promise<T>) {
  return useRetry(submitFn, {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 10000,
    shouldRetry: (error) => {
      // Повторять только ошибки сети и ошибки 5xx
      return (
        error.name === 'NetworkSubmissionError' ||
        ('statusCode' in error && (error as any).statusCode >= 500)
      );
    },
  });
}

/**
 * Агрессивный повтор для критических отправок
 */
export function useAggressiveRetry<T>(submitFn: () => Promise<T>) {
  return useRetry(submitFn, {
    maxAttempts: 10,
    initialDelay: 500,
    maxDelay: 30000,
    backoffMultiplier: 1.5,
  });
}

/**
 * Консервативный повтор для некритических отправок
 */
export function useConservativeRetry<T>(submitFn: () => Promise<T>) {
  return useRetry(submitFn, {
    maxAttempts: 2,
    initialDelay: 2000,
    maxDelay: 5000,
    backoffMultiplier: 2,
  });
}
```

### Повтор с учетом ограничения частоты

```typescript title="src/hooks/useRateLimitRetry.ts"
import { useRetry } from './useRetry';
import { RateLimitError } from '../errors/submission-errors';

/**
 * Повтор с учетом ограничения частоты
 */
export function useRateLimitRetry<T>(submitFn: () => Promise<T>) {
  return useRetry(submitFn, {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 60000, // Разрешить ждать до 1 минуты
    shouldRetry: (error) => {
      // Всегда повторять ошибки ограничения частоты
      if (error instanceof RateLimitError) {
        return true;
      }

      // Использовать логику повтора по умолчанию для других ошибок
      return (
        error.name !== 'ValidationSubmissionError' &&
        error.name !== 'AuthenticationError'
      );
    },
    onRetry: (attempt, error) => {
      if (error instanceof RateLimitError && error.retryAfter) {
        console.log(`Ограничено частота. Ждем ${error.retryAfter} секунд перед повтором.`);
      }
    },
  });
}
```

## Тестирование логики повтора

### Сценарии тестирования

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';
import { NetworkSubmissionError } from '../errors/submission-errors';

jest.mock('../services/api/submission.api');

describe('CreditApplicationForm - Логика повтора', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('повторяет при ошибке сети', async () => {
    let attempts = 0;

    (submitApplication as jest.Mock).mockImplementation(() => {
      attempts++;
      if (attempts < 3) {
        return Promise.reject(new NetworkSubmissionError());
      }
      return Promise.resolve({ id: 'app-123', status: 'pending' });
    });

    render(<CreditApplicationForm />);

    // Отправить форму
    fireEvent.click(screen.getByText('Отправить заявку'));

    // Должно показать индикатор повтора
    await waitFor(() => {
      expect(screen.getByText(/Повтор/i)).toBeInTheDocument();
    });

    // Быстро продвинуть через задержки повтора
    jest.runAllTimers();

    // В конце должно быть успешно
    await waitFor(() => {
      expect(screen.getByText(/успешно отправлена/i)).toBeInTheDocument();
    });

    // Должно быть 3 попытки
    expect(attempts).toBe(3);
  });

  test('останавливает повтор при ошибке валидации', async () => {
    const validationError = new ValidationSubmissionError([
      { field: 'email', code: 'required', message: 'Email требуется' },
    ]);

    (submitApplication as jest.Mock).mockRejectedValue(validationError);

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Отправить заявку'));

    // Не должно повторять
    await waitFor(() => {
      expect(screen.getByText(/Email требуется/i)).toBeInTheDocument();
    });

    // Должна быть только одна попытка
    expect(submitApplication).toHaveBeenCalledTimes(1);
  });

  test('показывает ручной повтор после макс попыток', async () => {
    (submitApplication as jest.Mock).mockRejectedValue(
      new NetworkSubmissionError()
    );

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Отправить заявку'));

    // Быстро продвинуть через все повторы
    jest.runAllTimers();

    // Должно показать кнопку ручного повтора
    await waitFor(() => {
      expect(screen.getByText('Попробовать снова')).toBeInTheDocument();
      expect(screen.getByText(/Автоматический повтор не удалась/i)).toBeInTheDocument();
    });
  });

  test('экспоненциальное отступление увеличивает задержку', async () => {
    const delays: number[] = [];
    let resolveDelay: (() => void) | null = null;

    jest.spyOn(global, 'setTimeout').mockImplementation((fn, delay) => {
      delays.push(delay as number);
      return setTimeout(() => {
        (fn as () => void)();
        resolveDelay?.();
      }, 0) as any;
    });

    (submitApplication as jest.Mock).mockRejectedValue(
      new NetworkSubmissionError()
    );

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Отправить заявку'));

    jest.runAllTimers();

    await waitFor(() => {
      expect(delays.length).toBeGreaterThan(0);
    });

    // Проверить экспоненциальное отступление: 1s, 2s, 4s
    expect(delays[0]).toBe(1000);
    expect(delays[1]).toBe(2000);
    expect(delays[2]).toBe(4000);
  });
});
```

## Лучшие практики

### 1. Используйте экспоненциальное отступление

```typescript
// ✅ ХОРОШО: Экспоненциальное отступление
{
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
}

// ❌ ПЛОХО: Фиксированная задержка
{
  initialDelay: 1000,
  maxDelay: 1000,
  backoffMultiplier: 1,
}
```

### 2. Ограничьте попытки повтора

```typescript
// ✅ ХОРОШО: Ограниченные попытки
{ maxAttempts: 3 }

// ❌ ПЛОХО: Неограниченные повторы
{ maxAttempts: Infinity }
```

### 3. Повторяйте только подходящие ошибки

```typescript
// ✅ ХОРОШО: Выборочный повтор
shouldRetry: (error) => {
  return error.name === 'NetworkError' || error.statusCode >= 500;
}

// ❌ ПЛОХО: Повторять все
shouldRetry: () => true // Включая ошибки валидации!
```

### 4. Показывайте прогресс повтора

```tsx
// ✅ ХОРОШО: Показать прогресс
<RetryIndicator attempt={attempt} maxAttempts={3} />

// ❌ ПЛОХО: Нет обратной связи
// Пользователь не знает что повтор происходит
```

### 5. Предоставьте ручной повтор

```tsx
// ✅ ХОРОШО: Ручной повтор после сбоя авто-повтора
{manualRetryNeeded && <ManualRetryButton onRetry={retry} />}

// ❌ ПЛОХО: Нет способа повторить
// Пользователь застрял после сбоя авто-повтора
```

## Ключевые моменты

- Реализуйте автоматический повтор с экспоненциальным отступлением
- Ограничьте попытки повтора чтобы предотвратить бесконечные циклы
- Повторяйте только ошибки сети и сервера
- Показывайте прогресс повтора пользователям
- Предоставьте опцию ручного повтора после сбоя авто-повтора
- Тщательно протестируйте логику повтора
- Рассмотрите разные стратегии повтора для разных сценариев

## Что дальше?

Вы реализовали надежную логику повтора! Далее мы добавим **оптимистичные обновления**:

- Немедленные обновления интерфейса перед подтверждением сервера
- Откат при ошибке
- Разрешение конфликтов
- Индикаторы оптимистичности
- Интеграция со списками и кэшами
- Тестирование оптимистичных обновлений

В следующем разделе мы сделаем вашу форму мгновенной при сохранении целостности данных.
