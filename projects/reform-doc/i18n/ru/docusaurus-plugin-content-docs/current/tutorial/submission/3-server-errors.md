---
sidebar_position: 3
---

# Обработка серверных ошибок

Обработка серверных ошибок валидации и их отображение в форме.

## Обзор

Серверные ошибки требуют специальной обработки:

- **Ошибки конкретных полей** - API возвращает ошибки для конкретных полей
- **Глобальные ошибки** - API возвращает общие ошибки уровня формы
- **Маппинг ошибок** - Преобразование формата ошибок API в формат ошибок формы
- **Отображение ошибок** - Четкое отображение ошибок пользователям
- **Восстановление от ошибок** - Возможность пользователям исправить ошибки и повторить отправку

## Базовая обработка ошибок

### Простой ответ с ошибкой

Обработка базового ответа с ошибкой от API:

```typescript title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';

interface ApiErrorResponse {
  errors: {
    field: string;
    message: string;
  }[];
}

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      return;
    }

    try {
      await submitApplication(form.value.value);
      // Успех
      form.reset();
    } catch (error: any) {
      // Обработка серверной ошибки
      if (error.response?.data?.errors) {
        const serverErrors = error.response.data.errors;
        handleServerErrors(serverErrors);
      } else {
        setGlobalError('Не удалось отправить. Пожалуйста, попробуйте снова.');
      }
    }
  };

  const handleServerErrors = (errors: ApiErrorResponse['errors']) => {
    errors.forEach(({ field, message }) => {
      // Установка ошибки на конкретное поле
      const formField = form.field(field as any);
      if (formField) {
        formField.setErrors([{ message }]);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {globalError && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {globalError}
        </div>
      )}
      {/* Поля формы */}
      <button type="submit">Отправить заявку</button>
    </form>
  );
}
```

## Использование setErrors

### Установка ошибок на одно поле

```typescript
// Установка ошибки на поле email
form.field('email').setErrors([
  { message: 'Этот email уже зарегистрирован' }
]);

// Установка нескольких ошибок на одно поле
form.field('passportNumber').setErrors([
  { message: 'Неверный формат паспорта' },
  { message: 'Номер паспорта должен быть уникальным' }
]);
```

### Установка ошибок на несколько полей

```typescript
// Установка ошибок на несколько полей сразу
form.setErrors({
  email: [{ message: 'Email уже существует' }],
  phoneMain: [{ message: 'Неверный номер телефона' }],
  passportNumber: [{ message: 'Паспорт уже зарегистрирован' }],
});
```

### Очистка ошибок конкретного поля

```typescript
// Очистка ошибок поля, когда пользователь исправляет его
form.field('email').clearErrors();

// Или очистка всех ошибок формы
form.clearErrors();
```

## Маппинг серверных ошибок

### Преобразование формата ошибок API в ошибки формы

Разные API возвращают ошибки в разных форматах. Создайте функцию преобразования:

```typescript title="src/utils/map-server-errors.ts"
import type { FormNode } from 'reformer';

// API возвращает ошибки в этом формате
interface ApiFieldError {
  field: string;
  code: string;
  message: string;
}

interface ApiErrorResponse {
  status: 'error';
  errors: ApiFieldError[];
}

// Преобразование snake_case имен полей API в camelCase имена полей формы
const fieldNameMap: Record<string, string> = {
  loan_amount: 'loanAmount',
  loan_term: 'loanTerm',
  first_name: 'firstName',
  last_name: 'lastName',
  middle_name: 'middleName',
  email: 'email',
  phone_main: 'phoneMain',
  passport_number: 'passportNumber',
  birth_date: 'birthDate',
};

export function mapServerErrors(
  form: FormNode<any>,
  apiResponse: ApiErrorResponse
): void {
  // Сначала очистка существующих ошибок
  form.clearErrors();

  apiResponse.errors.forEach((error) => {
    // Преобразование имени поля API в имя поля формы
    const formFieldName = fieldNameMap[error.field] || error.field;

    // Получение поля формы
    const field = form.field(formFieldName);

    if (field) {
      // Установка ошибки на поле
      field.setErrors([{ message: error.message }]);
    } else {
      console.warn(`Неизвестное поле в серверной ошибке: ${error.field}`);
    }
  });
}

// Использование
try {
  await submitApplication(form.value.value);
} catch (error: any) {
  if (error.response?.data) {
    mapServerErrors(form, error.response.data);
  }
}
```

### Обработка ошибок вложенных полей

Преобразование ошибок для вложенных структур формы:

```typescript title="src/utils/map-nested-errors.ts"
// Формат ошибок API для вложенных полей
interface ApiNestedError {
  'personalData.firstName': string;
  'personalData.lastName': string;
  'registrationAddress.city': string;
}

export function mapNestedServerErrors(
  form: FormNode<any>,
  errors: Record<string, string>
): void {
  for (const [fieldPath, message] of Object.entries(errors)) {
    // Преобразование точечной нотации в путь поля
    const field = getFieldByPath(form, fieldPath);

    if (field) {
      field.setErrors([{ message }]);
    }
  }
}

function getFieldByPath(form: FormNode<any>, path: string): any {
  const parts = path.split('.');
  let current: any = form;

  for (const part of parts) {
    current = current.field?.(part);
    if (!current) break;
  }

  return current;
}

// Использование
const errors = {
  'personalData.firstName': 'Имя обязательно',
  'personalData.lastName': 'Фамилия слишком длинная',
  'registrationAddress.city': 'Неверный город',
};

mapNestedServerErrors(form, errors);
```

### Обработка ошибок полей массивов

Преобразование ошибок для полей массивов, таких как созаемщики:

```typescript title="src/utils/map-array-errors.ts"
// API возвращает ошибки вида: "coBorrowers[0].email": "Неверный email"
interface ArrayFieldError {
  field: string; // например, "coBorrowers[0].email"
  message: string;
}

export function mapArrayFieldErrors(
  form: FormNode<any>,
  errors: ArrayFieldError[]
): void {
  errors.forEach(({ field, message }) => {
    // Разбор: "coBorrowers[0].email" → массив: "coBorrowers", индекс: 0, поле: "email"
    const match = field.match(/^(\w+)\[(\d+)\]\.(\w+)$/);

    if (match) {
      const [, arrayName, indexStr, fieldName] = match;
      const index = parseInt(indexStr, 10);

      // Получение поля массива
      const arrayField = form.field(arrayName);
      if (arrayField) {
        // Получение конкретного элемента в массиве
        const itemField = arrayField.at(index);
        if (itemField) {
          // Установка ошибки на вложенное поле
          const nestedField = itemField.field(fieldName);
          if (nestedField) {
            nestedField.setErrors([{ message }]);
          }
        }
      }
    }
  });
}

// Использование
const errors = [
  { field: 'coBorrowers[0].email', message: 'Email обязателен' },
  { field: 'coBorrowers[0].monthlyIncome', message: 'Доход должен быть положительным' },
  { field: 'coBorrowers[1].phoneMain', message: 'Неверный формат телефона' },
];

mapArrayFieldErrors(form, errors);
```

## Отображение ошибок

### Отображение ошибок на уровне поля

Ошибки автоматически отображаются, если компоненты полей читают свойство `errors`:

```tsx title="src/components/FormField.tsx"
import { useFormControl } from 'reformer';

function FormField({ control }: { control: any }) {
  const { value, errors } = useFormControl(control);

  return (
    <div className="mb-4">
      <input
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        className={errors ? 'border-red-500' : 'border-gray-300'}
      />
      {errors && (
        <div className="text-red-600 text-sm mt-1">
          {errors.map((err: any, i: number) => (
            <div key={i}>{err.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Глобальная сводка ошибок

Отображение всех ошибок формы в одном месте:

```tsx title="src/components/GlobalErrorSummary.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface GlobalErrorSummaryProps {
  form: FormNode<any>;
}

function GlobalErrorSummary({ form }: GlobalErrorSummaryProps) {
  const { value: errors } = useFormControl(form.errors);

  if (!errors || Object.keys(errors).length === 0) {
    return null;
  }

  return (
    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Обнаружено {Object.keys(errors).length}{' '}
            {Object.keys(errors).length === 1 ? 'ошибка' : 'ошибок'}{' '}
            при отправке
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <ul className="list-disc list-inside space-y-1">
              {Object.entries(errors).map(([field, error]: [string, any]) => (
                <li key={field}>
                  <strong>{field}:</strong> {error.message || 'Неверное значение'}
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

### Уведомления-тосты для серверных ошибок

Отображение временных уведомлений:

```typescript title="src/utils/show-server-errors.ts"
import toast from 'react-hot-toast';

export function showServerErrors(errors: { field: string; message: string }[]): void {
  if (errors.length === 0) return;

  if (errors.length === 1) {
    // Одна ошибка - показать как один тост
    toast.error(errors[0].message);
  } else {
    // Несколько ошибок - показать сводку
    toast.error(`Обнаружено ${errors.length} ошибок валидации. Проверьте форму.`);
  }
}

// Использование
try {
  await submitApplication(form.value.value);
} catch (error: any) {
  const serverErrors = error.response?.data?.errors || [];
  mapServerErrors(form, error.response.data);
  showServerErrors(serverErrors);
}
```

## Глобальные и полевые ошибки

### Различие между глобальными и полевыми ошибками

```typescript title="src/utils/categorize-errors.ts"
interface ServerError {
  field?: string;
  message: string;
  code: string;
}

interface CategorizedErrors {
  fieldErrors: Map<string, string[]>;
  globalErrors: string[];
}

export function categorizeServerErrors(
  errors: ServerError[]
): CategorizedErrors {
  const fieldErrors = new Map<string, string[]>();
  const globalErrors: string[] = [];

  errors.forEach((error) => {
    if (error.field) {
      // Ошибка конкретного поля
      const existing = fieldErrors.get(error.field) || [];
      fieldErrors.set(error.field, [...existing, error.message]);
    } else {
      // Глобальная ошибка (поле не указано)
      globalErrors.push(error.message);
    }
  });

  return { fieldErrors, globalErrors };
}

// Использование
const handleServerErrors = (errors: ServerError[]) => {
  const { fieldErrors, globalErrors } = categorizeServerErrors(errors);

  // Установка ошибок полей
  fieldErrors.forEach((messages, field) => {
    const formField = form.field(field as any);
    if (formField) {
      formField.setErrors(messages.map((message) => ({ message })));
    }
  });

  // Отображение глобальных ошибок
  if (globalErrors.length > 0) {
    setGlobalError(globalErrors.join('. '));
  }
};
```

## Восстановление от ошибок

### Автоматическая очистка ошибок при изменении поля

Очистка серверных ошибок, когда пользователь начинает их исправлять:

```typescript title="src/hooks/useAutoClearErrors.ts"
import { useEffect } from 'react';
import type { FormNode } from 'reformer';

export function useAutoClearErrors(form: FormNode<any>): void {
  useEffect(() => {
    // Подписка на изменения значений
    const subscription = form.value.subscribe(() => {
      // Очистка всех серверных ошибок, когда пользователь изменяет любое поле
      // Это позволяет им увидеть, решает ли их исправление проблему
      const errors = form.errors.value;

      if (errors && Object.keys(errors).length > 0) {
        // Опционально: очищать ошибки только для измененных полей
        // Для простоты очищаем все ошибки
        form.clearErrors();
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);
}

// Использование
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Автоочистка серверных ошибок при изменении поля
  useAutoClearErrors(form);

  return <FormContent form={form} />;
}
```

### Повторная отправка

Разрешить пользователям повторить попытку после исправления ошибок:

```typescript title="src/components/CreditApplicationForm.tsx"
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submitAttempts, setSubmitAttempts] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      return;
    }

    setSubmitAttempts((prev) => prev + 1);

    try {
      await submitApplication(form.value.value);
      // Успех
      form.reset();
      setLastError(null);
      setSubmitAttempts(0);
    } catch (error: any) {
      // Обработка ошибки
      if (error.response?.data?.errors) {
        mapServerErrors(form, error.response.data);
        setLastError('Пожалуйста, исправьте ошибки и попробуйте снова.');
      } else {
        setLastError('Не удалось отправить. Попробуйте позже.');
      }
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {lastError && (
        <div className="bg-red-100 text-red-700 p-3 rounded mb-4">
          {lastError}
          {submitAttempts > 1 && (
            <span className="text-sm ml-2">
              (Попытка {submitAttempts})
            </span>
          )}
        </div>
      )}
      {/* Поля формы */}
      <button type="submit">
        {submitAttempts > 0 ? 'Попробовать снова' : 'Отправить заявку'}
      </button>
    </form>
  );
}
```

## Распространенные сценарии ошибок

### Обработка ошибок дублирования записей

```typescript
// API возвращает: { email: 'Email уже существует' }
const handleDuplicateError = (error: any) => {
  if (error.response?.status === 409) {
    // 409 Conflict - дублирование записи
    const field = error.response.data.field;
    const message = error.response.data.message;

    form.field(field).setErrors([{ message }]);

    // Фокус на поле с ошибкой
    const element = document.querySelector(`[name="${field}"]`);
    if (element) {
      (element as HTMLElement).focus();
    }
  }
};
```

### Обработка ограничения скорости

```typescript
const handleRateLimitError = (error: any) => {
  if (error.response?.status === 429) {
    // 429 Too Many Requests
    const retryAfter = error.response.headers['retry-after'];

    setGlobalError(
      `Слишком много попыток. Попробуйте снова через ${retryAfter} секунд.`
    );

    // Временное отключение кнопки отправки
    setSubmitDisabled(true);
    setTimeout(() => {
      setSubmitDisabled(false);
      setGlobalError(null);
    }, parseInt(retryAfter) * 1000);
  }
};
```

### Обработка ошибок аутентификации

```typescript
const handleAuthError = (error: any) => {
  if (error.response?.status === 401) {
    // 401 Unauthorized - сессия истекла
    setGlobalError('Ваша сессия истекла. Пожалуйста, войдите снова.');

    // Перенаправление на логин после задержки
    setTimeout(() => {
      window.location.href = '/login';
    }, 2000);
  }
};
```

### Обработка сетевых ошибок

```typescript
const handleNetworkError = (error: any) => {
  if (error.message === 'Network Error' || !error.response) {
    setGlobalError(
      'Невозможно подключиться к серверу. Проверьте интернет-соединение.'
    );
  }
};
```

## Полный пример обработки ошибок

### Комплексный обработчик отправки

```typescript title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { mapServerErrors } from '../utils/map-server-errors';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Очистка предыдущей глобальной ошибки
    setGlobalError(null);

    // Валидация формы
    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      setGlobalError('Исправьте ошибки валидации перед отправкой.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Отправка на API
      const response = await submitApplication(form.value.value);

      // Успех
      form.reset();
      showSuccessMessage('Заявка успешно отправлена!');

      // Перенаправление или обновление UI
      setTimeout(() => {
        window.location.href = '/applications/success';
      }, 1500);

    } catch (error: any) {
      console.error('Ошибка отправки:', error);

      // Обработка различных типов ошибок
      if (!error.response) {
        // Сетевая ошибка
        setGlobalError(
          'Невозможно подключиться к серверу. Проверьте соединение и попробуйте снова.'
        );
      } else if (error.response.status === 401) {
        // Ошибка аутентификации
        setGlobalError('Ваша сессия истекла. Перенаправление на страницу входа...');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else if (error.response.status === 429) {
        // Ограничение скорости
        const retryAfter = error.response.headers['retry-after'] || '60';
        setGlobalError(
          `Слишком много попыток отправки. Попробуйте снова через ${retryAfter} секунд.`
        );
      } else if (error.response.status === 422 || error.response.status === 400) {
        // Ошибки валидации
        if (error.response.data?.errors) {
          mapServerErrors(form, error.response.data);
          setGlobalError(
            'Исправьте выделенные ниже ошибки и попробуйте снова.'
          );
        } else {
          setGlobalError(
            error.response.data?.message || 'Валидация не прошла. Проверьте введенные данные.'
          );
        }
      } else if (error.response.status === 500) {
        // Серверная ошибка
        setGlobalError(
          'Произошла ошибка сервера. Наша команда уведомлена. Попробуйте позже.'
        );
      } else {
        // Другие ошибки
        setGlobalError(
          error.response.data?.message ||
          'Произошла непредвиденная ошибка. Попробуйте снова.'
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <GlobalErrorSummary form={form} />

      {globalError && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{globalError}</p>
        </div>
      )}

      {/* Поля формы */}
      <FormFields form={form} />

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:bg-gray-400"
      >
        {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
      </button>
    </form>
  );
}
```

## Лучшие практики

### 1. Всегда преобразуйте серверные ошибки в ошибки полей формы

```typescript
// ✅ Хорошо: Преобразование серверных ошибок в ошибки полей формы
try {
  await submitApplication(formData);
} catch (error: any) {
  if (error.response?.data?.errors) {
    mapServerErrors(form, error.response.data);
  }
}

// ❌ Плохо: Просто показать общее сообщение об ошибке
try {
  await submitApplication(formData);
} catch (error) {
  alert('Не удалось отправить'); // Пользователь не знает, что исправить
}
```

### 2. Очищайте ошибки при изменении поля

```typescript
// ✅ Хорошо: Очистка серверных ошибок, когда пользователь редактирует поле
useEffect(() => {
  const subscription = form.value.subscribe(() => {
    form.clearErrors();
  });
  return () => subscription.unsubscribe();
}, [form]);

// ❌ Плохо: Продолжать показывать устаревшие ошибки
// Серверные ошибки остаются даже после того, как пользователь их исправил
```

### 3. Различайте полевые и глобальные ошибки

```typescript
// ✅ Хорошо: Категоризация ошибок
const { fieldErrors, globalErrors } = categorizeServerErrors(errors);

fieldErrors.forEach((messages, field) => {
  form.field(field).setErrors(messages.map(m => ({ message: m })));
});

setGlobalErrors(globalErrors);

// ❌ Плохо: Обрабатывать все ошибки одинаково
setGlobalError(errors.map(e => e.message).join(', '));
```

### 4. Предоставляйте полезные сообщения об ошибках

```typescript
// ✅ Хорошо: Конкретные, действенные сообщения об ошибках
setGlobalError(
  'Введенный вами адрес электронной почты уже зарегистрирован. Используйте другой email или попробуйте войти.'
);

// ❌ Плохо: Неясные сообщения об ошибках
setGlobalError('Произошла ошибка');
```

### 5. Обрабатывайте все сценарии ошибок

```typescript
// ✅ Хорошо: Обработка различных HTTP статус-кодов
if (error.response?.status === 422) {
  // Ошибки валидации
} else if (error.response?.status === 401) {
  // Ошибки аутентификации
} else if (error.response?.status === 429) {
  // Ограничение скорости
} else if (error.response?.status === 500) {
  // Серверные ошибки
} else if (!error.response) {
  // Сетевые ошибки
}

// ❌ Плохо: Общая обработка ошибок
catch (error) {
  setError('Что-то пошло не так');
}
```

## Следующие шаги

Вы завершили раздел отправки! Вот что можно изучить дальше:

- **[Поведения формы](../behaviors/1-computed.md)** - Добавление вычисляемых полей и динамических поведений
- **[Продвинутая валидация](../validation/1-built-in.md)** - Глубокое погружение в стратегии валидации
- **[Производительность](../advanced/performance.md)** - Оптимизация производительности для больших форм
