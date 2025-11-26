---
sidebar_position: 4
---

# Обработка ошибок сервера

Обработка ошибок валидации на сервере и сопоставление их с полями формы.

## Обзор

Ошибки сервера требуют специальной обработки для предоставления полезной обратной связи:

- **Ошибки валидации (422)** - Ошибки валидации для конкретных полей
- **Ошибки сервера (5xx)** - Внутренние ошибки сервера
- **Ошибки аутентификации (401)** - Сеанс истек или неавторизованный доступ
- **Ограничение частоты (429)** - Слишком много запросов
- **Ошибки сети** - Сбои соединения
- **Сопоставление ошибок** - Преобразование ошибок API в ошибки формы
- **Восстановление после ошибок** - Позволить пользователям исправить и отправить заново

## Понимание ошибок сервера

### Типы ошибок

Разные коды состояния HTTP указывают разные типы ошибок:

```typescript
// 400 Неверный запрос - Неверный формат запроса
// 401 Не авторизовано - Требуется аутентификация
// 403 Запрещено - Не разрешено
// 422 Неразбираемая сущность - Ошибки валидации
// 429 Слишком много запросов - Ограничение частоты
// 500 Внутренняя ошибка сервера - Ошибка сервера
// 503 Сервис недоступен - Сервер не работает
```

### Форматы ответов об ошибках

API обычно возвращают ошибки в этих форматах:

```typescript
// Ошибки валидации для конкретных полей
{
  "error": "Валидация не пройдена",
  "statusCode": 422,
  "errors": [
    {
      "field": "email",
      "code": "email_already_exists",
      "message": "Этот email уже зарегистрирован"
    },
    {
      "field": "phoneMain",
      "code": "invalid_format",
      "message": "Номер телефона должен содержать 10 цифр"
    }
  ]
}

// Общая ошибка сервера
{
  "error": "Внутренняя ошибка сервера",
  "statusCode": 500,
  "message": "Произошла неожиданная ошибка"
}

// Ошибка валидации уровня формы
{
  "error": "Нарушение бизнес-правила",
  "statusCode": 422,
  "message": "Ваш доход не соответствует минимальным требованиям",
  "code": "insufficient_income"
}
```

## Создание типов ошибок

Определите типы TypeScript для различных сценариев ошибок.

### Определения типов ошибок

```typescript title="src/errors/submission-errors.ts"
/**
 * Базовая ошибка отправки
 */
export class SubmissionError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string
  ) {
    super(message);
    this.name = 'SubmissionError';
  }
}

/**
 * Ошибка валидации с деталями уровня поля
 */
export class ValidationSubmissionError extends SubmissionError {
  constructor(
    public errors: Array<{
      field: string;
      code: string;
      message: string;
    }>
  ) {
    super('Валидация не пройдена', 422, 'validation_error');
    this.name = 'ValidationSubmissionError';
  }
}

/**
 * Ошибка сервера (5xx)
 */
export class ServerSubmissionError extends SubmissionError {
  constructor(message: string, code?: string) {
    super(message, 500, code);
    this.name = 'ServerSubmissionError';
  }

  get retryable(): boolean {
    return true; // Ошибки сервера обычно повторяемые
  }
}

/**
 * Ошибка сети (нет ответа)
 */
export class NetworkSubmissionError extends SubmissionError {
  constructor(message: string = 'Произошла ошибка сети') {
    super(message, undefined, 'network_error');
    this.name = 'NetworkSubmissionError';
  }

  get retryable(): boolean {
    return true; // Ошибки сети повторяемые
  }
}

/**
 * Ошибка аутентификации (401)
 */
export class AuthenticationError extends SubmissionError {
  constructor(message: string = 'Требуется аутентификация') {
    super(message, 401, 'authentication_required');
    this.name = 'AuthenticationError';
  }

  get retryable(): boolean {
    return false; // Пользователю нужно повторно аутентифицироваться
  }
}

/**
 * Ошибка ограничения частоты (429)
 */
export class RateLimitError extends SubmissionError {
  constructor(
    message: string = 'Слишком много запросов',
    public retryAfter?: number // секунды
  ) {
    super(message, 429, 'rate_limit_exceeded');
    this.name = 'RateLimitError';
  }

  get retryable(): boolean {
    return true; // Можно повторить после ожидания
  }
}
```

## Обновление API сервиса

Обновите API сервис чтобы выбрасывать подходящие типы ошибок.

### Улучшенная функция API

```typescript title="src/services/api/submission.api.ts"
import {
  ValidationSubmissionError,
  ServerSubmissionError,
  NetworkSubmissionError,
  AuthenticationError,
  RateLimitError,
} from '../../errors/submission-errors';

export async function submitApplication(
  data: SubmitApplicationRequest
): Promise<SubmitApplicationResponse> {
  let response: Response;

  try {
    response = await fetch('/api/applications/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
  } catch (error) {
    // Ошибка сети - нет ответа
    throw new NetworkSubmissionError(
      'Не удалось подключиться к серверу. Пожалуйста, проверьте подключение к интернету.'
    );
  }

  // Обработка разных кодов состояния HTTP
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({
      message: 'Произошла ошибка',
    }));

    switch (response.status) {
      case 401:
        // Ошибка аутентификации
        throw new AuthenticationError(
          errorData.message || 'Ваш сеанс истек. Пожалуйста, войдите снова.'
        );

      case 422:
        // Ошибки валидации
        if (errorData.errors && Array.isArray(errorData.errors)) {
          throw new ValidationSubmissionError(errorData.errors);
        }
        // Ошибка валидации уровня формы
        throw new ServerSubmissionError(
          errorData.message || 'Валидация не пройдена',
          errorData.code
        );

      case 429:
        // Ограничение частоты
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
        throw new RateLimitError(
          errorData.message || 'Слишком много запросов. Пожалуйста, попробуйте позже.',
          retryAfter
        );

      case 500:
      case 502:
      case 503:
      case 504:
        // Ошибки сервера
        throw new ServerSubmissionError(
          errorData.message || 'Произошла ошибка сервера. Пожалуйста, попробуйте позже.',
          errorData.code
        );

      default:
        // Другие ошибки
        throw new ServerSubmissionError(
          errorData.message || 'Произошла неожиданная ошибка',
          errorData.code
        );
    }
  }

  return await response.json();
}
```

## Сопоставление ошибок сервера полям формы

Создайте утилиту для сопоставления ошибок валидации сервера полям формы.

### Утилита сопоставления ошибок

```typescript title="src/utils/map-server-errors.ts"
import type { FormNode } from 'reformer';
import type { ValidationSubmissionError } from '../errors/submission-errors';

/**
 * Сопоставить названия полей API с путями полей формы
 * API использует snake_case, форма использует camelCase
 */
const fieldNameMap: Record<string, string> = {
  // Информация о кредите
  loan_amount: 'step1.loanAmount',
  loan_term: 'step1.loanTerm',
  loan_type: 'step1.loanType',
  loan_purpose: 'step1.loanPurpose',

  // Личная информация
  first_name: 'step2.personalData.firstName',
  last_name: 'step2.personalData.lastName',
  middle_name: 'step2.personalData.middleName',
  birth_date: 'step2.personalData.birthDate',

  // Паспорт
  passport_series: 'step2.passportData.passportSeries',
  passport_number: 'step2.passportData.passportNumber',
  passport_issuer: 'step2.passportData.passportIssuer',
  passport_issue_date: 'step2.passportData.passportIssueDate',

  // Контакт
  email: 'step3.email',
  phone_main: 'step3.phoneMain',
  phone_additional: 'step3.phoneAdditional',

  // Работа
  employment_type: 'step4.employmentType',
  company_name: 'step4.companyName',
  position: 'step4.position',
  monthly_income: 'step4.monthlyIncome',
  employment_start_date: 'step4.employmentStartDate',
};

/**
 * Получить поле формы по пути
 */
function getFieldByPath(form: FormNode, path: string): any {
  const parts = path.split('.');
  let current: any = form;

  for (const part of parts) {
    current = current.field?.(part) || current.group?.(part);
    if (!current) {
      console.warn(`Поле не найдено: ${path}`);
      return null;
    }
  }

  return current;
}

/**
 * Сопоставить ошибки валидации сервера полям формы
 */
export function mapServerErrors(
  form: FormNode,
  error: ValidationSubmissionError
): void {
  // Сначала очистить существующие ошибки сервера
  form.clearErrors();

  error.errors.forEach(({ field, code, message }) => {
    // Сопоставить название поля API с путем поля формы
    const formFieldPath = fieldNameMap[field] || field;

    // Получить поле формы
    const formField = getFieldByPath(form, formFieldPath);

    if (formField) {
      // Установить ошибку на поле
      formField.setErrors([
        {
          type: code,
          message: message,
        },
      ]);

      console.log(`Ошибка сопоставлена ${formFieldPath}:`, message);
    } else {
      console.warn(`Не удалось сопоставить ошибку сервера с полем формы: ${field}`);
    }
  });
}
```

## Обработка различных типов ошибок

Обновите обработчик отправки чтобы обрабатывать все типы ошибок.

### Улучшенный обработчик отправки

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { mapServerErrors } from '../utils/map-server-errors';
import {
  ValidationSubmissionError,
  ServerSubmissionError,
  NetworkSubmissionError,
  AuthenticationError,
  RateLimitError,
} from '../errors/submission-errors';
import { useSubmissionState } from '../hooks/useSubmissionState';

export function CreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const { state, submit } = useSubmissionState(form, async (data) => {
    const apiData = creditApplicationTransformer.serialize(data);
    return await submitApplication(apiData);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    try {
      const result = await submit();

      // Успех - перейти после задержки
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`);
      }, 2000);
    } catch (error) {
      console.error('Ошибка отправки:', error);

      if (error instanceof ValidationSubmissionError) {
        // Ошибки валидации для конкретных полей
        mapServerErrors(form, error);
        setGlobalError(
          'Пожалуйста, исправьте выделенные ошибки и попробуйте снова.'
        );
      } else if (error instanceof AuthenticationError) {
        // Сеанс истек
        setGlobalError(
          'Ваш сеанс истек. Перенаправление на вход...'
        );
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else if (error instanceof RateLimitError) {
        // Ограничение частоты
        const retryMessage = error.retryAfter
          ? ` Пожалуйста, попробуйте снова через ${error.retryAfter} секунд.`
          : ' Пожалуйста, попробуйте позже.';
        setGlobalError(error.message + retryMessage);
      } else if (error instanceof NetworkSubmissionError) {
        // Ошибка сети
        setGlobalError(
          'Не удалось подключиться к серверу. Пожалуйста, проверьте подключение к интернету и попробуйте снова.'
        );
      } else if (error instanceof ServerSubmissionError) {
        // Ошибка сервера
        setGlobalError(
          'Произошла ошибка сервера. Наша команда была уведомлена. Пожалуйста, попробуйте позже.'
        );
      } else {
        // Неизвестная ошибка
        setGlobalError(
          'Произошла неожиданная ошибка. Пожалуйста, попробуйте снова.'
        );
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Заявка на кредит</h1>

      {/* Глобальное сообщение об ошибке */}
      {globalError && (
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
              <p className="text-sm text-red-700">{globalError}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <FormRenderer form={form} />

        <SubmitButton form={form} state={state} />
      </form>
    </div>
  );
}
```

## Компоненты отображения ошибок

Создайте компоненты для отображения разных типов ошибок.

### Глобальная сводка ошибок

```tsx title="src/components/GlobalErrorSummary.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface GlobalErrorSummaryProps {
  form: FormNode;
}

export function GlobalErrorSummary({ form }: GlobalErrorSummaryProps) {
  const { value: errors } = useFormControl(form.errors);

  if (!errors || Object.keys(errors).length === 0) {
    return null;
  }

  const errorEntries = Object.entries(errors);

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
            {errorEntries.length === 1 ? 'Имеется' : 'Имеются'} {errorEntries.length}{' '}
            ошибка{errorEntries.length === 1 ? '' : 'ки'} в вашей отправке
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul className="list-disc list-inside space-y-1">
              {errorEntries.map(([field, error]: [string, any]) => (
                <li key={field}>
                  <strong>{field}:</strong>{' '}
                  {Array.isArray(error)
                    ? error[0]?.message || 'Неверное значение'
                    : error?.message || 'Неверное значение'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Компонент оповещения об ошибке

```tsx title="src/components/ErrorAlert.tsx"
import type { SubmissionError } from '../errors/submission-errors';

interface ErrorAlertProps {
  error: SubmissionError;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorAlert({ error, onRetry, onDismiss }: ErrorAlertProps) {
  const isRetryable = 'retryable' in error && error.retryable;

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
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            {error.name.replace(/Error$/, '')}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{error.message}</p>
          </div>
          {(isRetryable || onDismiss) && (
            <div className="mt-4 flex gap-2">
              {isRetryable && onRetry && (
                <button
                  onClick={onRetry}
                  className="bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 text-sm font-medium"
                >
                  Попробовать снова
                </button>
              )}
              {onDismiss && (
                <button
                  onClick={onDismiss}
                  className="text-red-700 px-3 py-1 text-sm font-medium hover:underline"
                >
                  Закрыть
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

## Автоматическое очищение ошибок при изменении поля

Очистите ошибки сервера когда пользователи начинают их исправлять.

### Хук автоматической очистки

```typescript title="src/hooks/useAutoClearErrors.ts"
import { useEffect } from 'react';
import type { FormNode } from 'reformer';

/**
 * Автоматически очистить ошибки сервера когда пользователь изменяет любое поле
 * Это предоставляет немедленную обратную связь что их изменения рассматриваются
 */
export function useAutoClearErrors(form: FormNode): void {
  useEffect(() => {
    // Отслеживать предыдущее значение
    let previousValue = form.value.value;

    // Подписаться на изменения значения
    const subscription = form.value.subscribe((currentValue) => {
      // Очищать только если значение действительно изменилось
      if (currentValue !== previousValue) {
        // Очистить все ошибки (они будут переваливированы при следующей отправке)
        const errors = form.errors.value;
        if (errors && Object.keys(errors).length > 0) {
          form.clearErrors();
        }

        previousValue = currentValue;
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);
}
```

### Использование автоочистки

```tsx title="src/components/CreditApplicationForm.tsx"
import { useAutoClearErrors } from '../hooks/useAutoClearErrors';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Автоматически очищать ошибки сервера когда пользователь редактирует поля
  useAutoClearErrors(form);

  // ... остальная часть компонента
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
import {
  ValidationSubmissionError,
  ServerSubmissionError,
  NetworkSubmissionError,
  AuthenticationError,
  RateLimitError,
  SubmissionError,
} from '../errors/submission-errors';
import { useSubmissionState } from '../hooks/useSubmissionState';
import { useAutoClearErrors } from '../hooks/useAutoClearErrors';
import { GlobalErrorSummary } from './GlobalErrorSummary';
import { ErrorAlert } from './ErrorAlert';
import { SubmitButton } from './SubmitButton';
import { FormRenderer } from './FormRenderer';

export function CreditApplicationForm() {
  const navigate = useNavigate();
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [globalError, setGlobalError] = useState<SubmissionError | null>(null);

  // Автоматически очищать ошибки сервера при изменении поля
  useAutoClearErrors(form);

  const { state, submit, reset } = useSubmissionState(form, async (data) => {
    const apiData = creditApplicationTransformer.serialize(data);
    return await submitApplication(apiData);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);

    try {
      const result = await submit();

      // Успех - перейти на страницу успеха
      setTimeout(() => {
        navigate(`/applications/${result.id}/success`);
      }, 2000);
    } catch (error) {
      console.error('Ошибка отправки:', error);

      if (error instanceof ValidationSubmissionError) {
        // Сопоставить ошибки для конкретных полей
        mapServerErrors(form, error);
        setGlobalError(
          new SubmissionError(
            'Пожалуйста, исправьте ошибки валидации ниже и попробуйте снова.'
          )
        );
      } else if (error instanceof AuthenticationError) {
        // Обработать ошибку аутентификации
        setGlobalError(error);
        setTimeout(() => {
          navigate('/login');
        }, 2000);
      } else if (error instanceof RateLimitError) {
        // Обработать ограничение частоты
        setGlobalError(error);
      } else if (error instanceof NetworkSubmissionError) {
        // Обработать ошибку сети
        setGlobalError(error);
      } else if (error instanceof ServerSubmissionError) {
        // Обработать ошибку сервера
        setGlobalError(error);
      } else {
        // Неизвестная ошибка
        setGlobalError(
          new SubmissionError('Произошла неожиданная ошибка. Пожалуйста, попробуйте снова.')
        );
      }
    }
  };

  const handleRetry = async () => {
    setGlobalError(null);
    try {
      await submit();
    } catch (error) {
      // Обработка ошибок выполняется выше
    }
  };

  const handleDismissError = () => {
    setGlobalError(null);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Заявка на кредит</h1>

      {/* Оповещение об ошибке */}
      {globalError && (
        <ErrorAlert
          error={globalError}
          onRetry={'retryable' in globalError && globalError.retryable ? handleRetry : undefined}
          onDismiss={handleDismissError}
        />
      )}

      {/* Сводка ошибок поля */}
      <GlobalErrorSummary form={form} />

      <form onSubmit={handleSubmit}>
        {/* Поля формы */}
        <FormRenderer form={form} state={state} />

        {/* Кнопка отправки */}
        <div className="mt-6">
          <SubmitButton form={form} state={state} />
        </div>
      </form>
    </div>
  );
}
```

## Тестирование обработки ошибок

### Тестирование различных типов ошибок

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';
import {
  ValidationSubmissionError,
  NetworkSubmissionError,
  RateLimitError,
} from '../errors/submission-errors';

jest.mock('../services/api/submission.api');

describe('CreditApplicationForm - Обработка ошибок', () => {
  test('обрабатывает ошибки валидации', async () => {
    const validationError = new ValidationSubmissionError([
      { field: 'email', code: 'email_exists', message: 'Email уже зарегистрирован' },
      { field: 'phone_main', code: 'invalid_format', message: 'Неверный формат телефона' },
    ]);

    (submitApplication as jest.Mock).mockRejectedValue(validationError);

    render(<CreditApplicationForm />);

    // Отправить форму
    fireEvent.click(screen.getByText('Отправить заявку'));

    // Должно показать ошибки поля
    await waitFor(() => {
      expect(screen.getByText(/Email уже зарегистрирован/i)).toBeInTheDocument();
      expect(screen.getByText(/Неверный формат телефона/i)).toBeInTheDocument();
    });
  });

  test('обрабатывает ошибки сети', async () => {
    const networkError = new NetworkSubmissionError();

    (submitApplication as jest.Mock).mockRejectedValue(networkError);

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Отправить заявку'));

    await waitFor(() => {
      expect(screen.getByText(/Не удалось подключиться/i)).toBeInTheDocument();
      expect(screen.getByText('Попробовать снова')).toBeInTheDocument();
    });
  });

  test('обрабатывает ограничение частоты', async () => {
    const rateLimitError = new RateLimitError('Слишком много запросов', 60);

    (submitApplication as jest.Mock).mockRejectedValue(rateLimitError);

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Отправить заявку'));

    await waitFor(() => {
      expect(screen.getByText(/Слишком много запросов/i)).toBeInTheDocument();
      expect(screen.getByText(/60 секунд/i)).toBeInTheDocument();
    });
  });

  test('автоматически очищает ошибки при изменении поля', async () => {
    const validationError = new ValidationSubmissionError([
      { field: 'email', code: 'required', message: 'Email требуется' },
    ]);

    (submitApplication as jest.Mock).mockRejectedValue(validationError);

    const { container } = render(<CreditApplicationForm />);

    // Отправить и получить ошибку
    fireEvent.click(screen.getByText('Отправить заявку'));

    await waitFor(() => {
      expect(screen.getByText(/Email требуется/i)).toBeInTheDocument();
    });

    // Изменить значение поля
    const emailInput = container.querySelector('[name="email"]');
    fireEvent.change(emailInput!, { target: { value: 'test@example.com' } });

    // Ошибка должна быть очищена
    await waitFor(() => {
      expect(screen.queryByText(/Email требуется/i)).not.toBeInTheDocument();
    });
  });
});
```

## Лучшие практики

### 1. Создавайте специфические типы ошибок

```typescript
// ✅ ХОРОШО: Специфические типы ошибок
throw new ValidationSubmissionError(errors);
throw new NetworkSubmissionError();
throw new RateLimitError(message, retryAfter);

// ❌ ПЛОХО: Универсальные ошибки
throw new Error('Валидация не пройдена');
throw new Error('Ошибка сети');
```

### 2. Сопоставьте все ошибки полей

```typescript
// ✅ ХОРОШО: Сопоставить все названия полей
const fieldNameMap = {
  email: 'step3.email',
  phone_main: 'step3.phoneMain',
  // ... все поля
};

// ❌ ПЛОХО: Частичное сопоставление
const fieldNameMap = {
  email: 'email', // Отсутствует вложенная структура
};
```

### 3. Предоставьте действенные сообщения

```typescript
// ✅ ХОРОШО: Четкое, действенное сообщение
'Этот email уже зарегистрирован. Пожалуйста, используйте другой email или попробуйте войти.'

// ❌ ПЛОХО: Неопределенное сообщение
'Произошла ошибка'
```

### 4. Включите повтор для повторяемых ошибок

```tsx
// ✅ ХОРОШО: Показать повтор для ошибок сети/сервера
{error.retryable && <button onClick={retry}>Попробовать снова</button>}

// ❌ ПЛОХО: Нет опции повтора
{error && <span>Произошла ошибка</span>}
```

### 5. Очищайте устаревшие ошибки

```typescript
// ✅ ХОРОШО: Автоочистка при изменении поля
useAutoClearErrors(form);

// ❌ ПЛОХО: Сохранить устаревшие ошибки
// Старые ошибки сервера все еще показываются после исправления пользователем
```

## Ключевые моменты

- Создавайте специфические типы ошибок для разных сценариев
- Сопоставляйте ошибки валидации сервера полям формы
- Предоставляйте четкие, действенные сообщения об ошибках
- Включите повтор для ошибок сети и сервера
- Автоматически очищайте ошибки когда пользователи их исправляют
- Обработайте все коды состояния HTTP подходящим образом
- Протестируйте все сценарии ошибок

## Что дальше?

Вы реализовали комплексную обработку ошибок сервера! Далее мы добавим **логику повтора**:

- Автоматический повтор с экспоненциальным отступлением
- Максимальное количество попыток повтора
- Индикаторы повтора
- Кнопки повтора вручную
- Повторяемые vs неповторяемые ошибки
- Управление состоянием повтора

В следующем разделе мы сделаем вашу форму устойчивой к временным сбоям сети и ошибкам сервера.
