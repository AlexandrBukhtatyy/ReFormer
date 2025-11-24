---
sidebar_position: 6
---

# Обработка Ошибок

Стратегии эффективной обработки и отображения ошибок валидации.

## Базовое Отображение Ошибок

### Встроенные Ошибки Полей

Показывайте ошибки под каждым полем:

```tsx
import { useFormControl } from 'reformer';
import { FieldNode } from 'reformer';

interface TextFieldProps {
  field: FieldNode<string>;
  label: string;
}

export function TextField({ field, label }: TextFieldProps) {
  const control = useFormControl(field);

  const showError = control.touched && control.invalid;

  return (
    <div className="text-field">
      <label>{label}</label>
      <input
        value={control.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        className={showError ? 'error' : ''}
      />
      {showError && control.errors && (
        <span className="error-message">
          {getErrorMessage(control.errors)}
        </span>
      )}
    </div>
  );
}
```

### Преобразователь Сообщений об Ошибках

Централизованная обработка сообщений об ошибках:

```typescript title="utils/error-messages.ts"
export type ErrorKey =
  | 'required'
  | 'email'
  | 'minLength'
  | 'maxLength'
  | 'min'
  | 'max'
  | 'pattern'
  | 'usernameTaken'
  | 'emailTaken'
  | 'passwordMismatch';

export const errorMessages: Record<
  ErrorKey,
  (params: any) => string
> = {
  required: () => 'Это поле обязательно',
  email: () => 'Пожалуйста, введите корректный адрес электронной почты',
  minLength: (p) => `Минимум ${p.required} символов`,
  maxLength: (p) => `Максимум ${p.required} символов`,
  min: (p) => `Минимум ${p.min}`,
  max: (p) => `Максимум ${p.max}`,
  pattern: (p) => p.message || 'Неверный формат',
  usernameTaken: () => 'Это имя пользователя уже занято',
  emailTaken: () => 'Этот email уже зарегистрирован',
  passwordMismatch: () => 'Пароли не совпадают',
};

export function getErrorMessage(errors: Record<string, any>): string {
  const [key, params] = Object.entries(errors)[0];
  const getMessage = errorMessages[key as ErrorKey];
  return getMessage ? getMessage(params) : 'Неверное значение';
}
```

## Обработка Ошибок на Уровне Поля

### Отображение Множественных Ошибок

Показывайте все ошибки для поля:

```tsx
interface ErrorListProps {
  errors: Record<string, any>;
}

export function ErrorList({ errors }: ErrorListProps) {
  if (!errors || Object.keys(errors).length === 0) return null;

  return (
    <ul className="error-list">
      {Object.entries(errors).map(([key, params]) => {
        const message = errorMessages[key as ErrorKey]?.(params) || 'Неверное значение';
        return (
          <li key={key} className="error-list__item">
            {message}
          </li>
        );
      })}
    </ul>
  );
}

// Использование
<TextField field={form.controls.password} label="Пароль" />
{password.touched && password.errors && (
  <ErrorList errors={password.errors} />
)}
```

### Иконки Ошибок

Визуальные индикаторы ошибок:

```tsx
import { XCircle, CheckCircle, Loader } from 'lucide-react';

export function TextField({ field, label }: TextFieldProps) {
  const control = useFormControl(field);

  return (
    <div className="text-field">
      <label>{label}</label>
      <div className="text-field__input-wrapper">
        <input
          value={control.value ?? ''}
          onChange={(e) => control.setValue(e.target.value)}
          onBlur={() => control.markAsTouched()}
        />
        <div className="text-field__icon">
          {control.pending && <Loader className="spin" />}
          {!control.pending && control.touched && control.valid && (
            <CheckCircle className="success" />
          )}
          {!control.pending && control.touched && control.invalid && (
            <XCircle className="error" />
          )}
        </div>
      </div>
      {control.touched && control.errors && (
        <ErrorMessage errors={control.errors} />
      )}
    </div>
  );
}
```

### Ошибки во Всплывающих Подсказках

Показывайте ошибки во всплывающих подсказках:

```tsx
import { Tooltip } from '@radix-ui/react-tooltip';

export function TextField({ field, label }: TextFieldProps) {
  const control = useFormControl(field);

  const showError = control.touched && control.invalid;

  return (
    <div className="text-field">
      <label>{label}</label>
      <Tooltip open={showError}>
        <Tooltip.Trigger asChild>
          <input
            value={control.value ?? ''}
            onChange={(e) => control.setValue(e.target.value)}
            onBlur={() => control.markAsTouched()}
            className={showError ? 'error' : ''}
          />
        </Tooltip.Trigger>
        {showError && control.errors && (
          <Tooltip.Content className="tooltip-error">
            {getErrorMessage(control.errors)}
          </Tooltip.Content>
        )}
      </Tooltip>
    </div>
  );
}
```

## Обработка Ошибок на Уровне Формы

### Сводка Ошибок

Отображайте все ошибки формы вверху:

```tsx
interface ErrorSummaryProps {
  form: GroupNode<any>;
}

export function ErrorSummary({ form }: ErrorSummaryProps) {
  const formErrors = useFormControl(form).errors;

  if (!formErrors) return null;

  const allErrors = collectAllErrors(form);

  if (allErrors.length === 0) return null;

  return (
    <div className="error-summary" role="alert">
      <h3>Пожалуйста, исправьте следующие ошибки:</h3>
      <ul>
        {allErrors.map((error, index) => (
          <li key={index}>
            <a href={`#field-${error.fieldName}`}>
              {error.fieldLabel}: {error.message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Вспомогательная функция для сбора всех ошибок
function collectAllErrors(form: GroupNode<any>) {
  const errors: Array<{
    fieldName: string;
    fieldLabel: string;
    message: string;
  }> = [];

  // Рекурсивный сбор ошибок из всех полей
  const collectFromNode = (node: any, path: string[] = []) => {
    if (node.errors?.value) {
      const fieldName = path.join('.');
      const message = getErrorMessage(node.errors.value);
      errors.push({
        fieldName,
        fieldLabel: path[path.length - 1],
        message,
      });
    }

    if (node.controls) {
      Object.entries(node.controls).forEach(([key, child]) => {
        collectFromNode(child, [...path, key]);
      });
    }
  };

  collectFromNode(form);
  return errors;
}
```

### Toast Уведомления

Показывайте ошибки в виде toast уведомлений:

```tsx
import { toast } from 'react-hot-toast';

export function FormWithToasts() {
  const form = useMemo(() => createMyForm(), []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.invalid.value) {
      const errors = collectAllErrors(form);
      errors.forEach((error) => {
        toast.error(`${error.fieldLabel}: ${error.message}`);
      });
      return;
    }

    // Отправка формы
    console.log('Валидно:', form.getValue());
  };

  return <form onSubmit={handleSubmit}>{/* поля */}</form>;
}
```

### Модальное Окно с Ошибками

Показывайте ошибки в модальном окне:

```tsx
import { Dialog } from '@radix-ui/react-dialog';
import { useState } from 'react';

export function FormWithErrorModal() {
  const form = useMemo(() => createMyForm(), []);
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<any[]>([]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.invalid.value) {
      const allErrors = collectAllErrors(form);
      setErrors(allErrors);
      setShowErrors(true);
      return;
    }

    // Отправка формы
  };

  return (
    <>
      <form onSubmit={handleSubmit}>{/* поля */}</form>

      <Dialog open={showErrors} onOpenChange={setShowErrors}>
        <Dialog.Content>
          <Dialog.Title>Ошибки формы</Dialog.Title>
          <Dialog.Description>
            Пожалуйста, исправьте следующие ошибки:
          </Dialog.Description>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>
                <strong>{error.fieldLabel}:</strong> {error.message}
              </li>
            ))}
          </ul>
          <Dialog.Close asChild>
            <button>Закрыть</button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog>
    </>
  );
}
```

## Обработка Серверных Ошибок

### Установка Серверных Ошибок

Обработка ошибок с сервера:

```tsx
const form = useMemo(() => createRegistrationForm(), []);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  form.markAllAsTouched();

  if (form.invalid.value) return;

  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      body: JSON.stringify(form.getValue()),
    });

    if (!response.ok) {
      const errors = await response.json();

      // Установка серверных ошибок на полях
      if (errors.username) {
        form.controls.username.setErrors({ serverError: errors.username });
      }
      if (errors.email) {
        form.controls.email.setErrors({ serverError: errors.email });
      }

      return;
    }

    // Успех
    console.log('Зарегистрировано!');
  } catch (error) {
    console.error('Ошибка сети:', error);
  }
};
```

### Общая Серверная Ошибка

Показ общей серверной ошибки:

```tsx
const [serverError, setServerError] = useState<string | null>(null);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setServerError(null);
  form.markAllAsTouched();

  if (form.invalid.value) return;

  try {
    const response = await fetch('/api/submit', {
      method: 'POST',
      body: JSON.stringify(form.getValue()),
    });

    if (!response.ok) {
      const error = await response.json();
      setServerError(error.message || 'Произошла ошибка');
      return;
    }

    // Успех
  } catch (error) {
    setServerError('Ошибка сети. Пожалуйста, попробуйте снова.');
  }
};

return (
  <form onSubmit={handleSubmit}>
    {serverError && (
      <div className="alert alert-error" role="alert">
        {serverError}
      </div>
    )}
    {/* поля */}
  </form>
);
```

## Локализация Ошибок

### Локализованные Сообщения об Ошибках

Поддержка нескольких языков:

```typescript title="utils/error-messages-i18n.ts"
type Locale = 'ru' | 'en' | 'es';

const errorMessagesLocalized: Record<
  Locale,
  Record<ErrorKey, (params: any) => string>
> = {
  ru: {
    required: () => 'Это поле обязательно',
    email: () => 'Пожалуйста, введите корректный email',
    minLength: (p) => `Минимум ${p.required} символов`,
    // ...
  },
  en: {
    required: () => 'This field is required',
    email: () => 'Please enter a valid email',
    minLength: (p) => `Must be at least ${p.required} characters`,
    // ...
  },
  es: {
    required: () => 'Este campo es obligatorio',
    email: () => 'Por favor ingrese un email válido',
    minLength: (p) => `Debe tener al menos ${p.required} caracteres`,
    // ...
  },
};

export function getLocalizedErrorMessage(
  errors: Record<string, any>,
  locale: Locale = 'ru'
): string {
  const [key, params] = Object.entries(errors)[0];
  const getMessage = errorMessagesLocalized[locale][key as ErrorKey];
  return getMessage ? getMessage(params) : 'Неверное значение';
}
```

### Использование с React Context

```tsx
import { createContext, useContext } from 'react';

const LocaleContext = createContext<Locale>('ru');

export function ErrorMessage({ errors }: { errors: Record<string, any> }) {
  const locale = useContext(LocaleContext);
  const message = getLocalizedErrorMessage(errors, locale);

  return <span className="error-message">{message}</span>;
}

// Обертка приложения
<LocaleContext.Provider value="en">
  <MyForm />
</LocaleContext.Provider>
```

## Стилизация Ошибок

### CSS Классы

Стилизация ошибок с помощью CSS:

```css
/* Поле с ошибкой */
.input-error {
  border-color: #dc2626;
  background-color: #fef2f2;
}

.input-error:focus {
  outline-color: #dc2626;
  border-color: #dc2626;
}

/* Сообщение об ошибке */
.error-message {
  color: #dc2626;
  font-size: 0.875rem;
  margin-top: 0.25rem;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Иконка ошибки */
.error-icon {
  color: #dc2626;
  width: 1rem;
  height: 1rem;
}

/* Состояние успеха */
.input-success {
  border-color: #16a34a;
}

.success-icon {
  color: #16a34a;
}

/* Сводка ошибок */
.error-summary {
  background-color: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: 0.5rem;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.error-summary h3 {
  color: #dc2626;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.error-summary ul {
  list-style: disc;
  padding-left: 1.5rem;
}

.error-summary a {
  color: #dc2626;
  text-decoration: underline;
}
```

### Tailwind CSS

Используйте утилитарные классы Tailwind:

```tsx
export function TextField({ field, label }: TextFieldProps) {
  const control = useFormControl(field);
  const showError = control.touched && control.invalid;

  return (
    <div className="space-y-1">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        value={control.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        className={`
          block w-full rounded-md px-3 py-2
          focus:outline-none focus:ring-2
          ${
            showError
              ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500'
          }
        `}
      />
      {showError && control.errors && (
        <p className="text-sm text-red-600 flex items-center gap-1">
          <XCircle className="h-4 w-4" />
          {getErrorMessage(control.errors)}
        </p>
      )}
    </div>
  );
}
```

## Доступность

### ARIA Атрибуты

Сделайте ошибки доступными:

```tsx
export function TextField({ field, label }: TextFieldProps) {
  const control = useFormControl(field);
  const showError = control.touched && control.invalid;
  const errorId = `${field.id}-error`;

  return (
    <div className="text-field">
      <label htmlFor={field.id}>{label}</label>
      <input
        id={field.id}
        value={control.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        aria-invalid={showError}
        aria-describedby={showError ? errorId : undefined}
      />
      {showError && control.errors && (
        <span id={errorId} className="error-message" role="alert">
          {getErrorMessage(control.errors)}
        </span>
      )}
    </div>
  );
}
```

### Управление Фокусом

Автоматический фокус на первой ошибке:

```tsx
import { useEffect, useRef } from 'react';

export function FormWithAutoFocus() {
  const form = useMemo(() => createMyForm(), []);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.invalid.value) {
      // Фокус на первой ошибке
      setTimeout(() => {
        const firstError = formRef.current?.querySelector(
          '[aria-invalid="true"]'
        ) as HTMLElement;
        firstError?.focus();
      }, 0);
      return;
    }

    // Отправка
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit}>
      {/* поля */}
    </form>
  );
}
```

### Объявления для Скринридеров

Объявляйте ошибки для скринридеров:

```tsx
import { useEffect } from 'react';

export function FormWithAnnouncements() {
  const form = useMemo(() => createMyForm(), []);
  const [announcement, setAnnouncement] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    form.markAllAsTouched();

    if (form.invalid.value) {
      const errors = collectAllErrors(form);
      setAnnouncement(
        `В форме ${errors.length} ошибок${errors.length > 1 ? 'и' : 'а'}. Пожалуйста, исправьте их и попробуйте снова.`
      );
      return;
    }

    setAnnouncement('Форма успешно отправлена');
  };

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcement}
      </div>
      <form onSubmit={handleSubmit}>{/* поля */}</form>
    </>
  );
}
```

## Лучшие Практики

### 1. Показывайте Ошибки После Взаимодействия

```tsx
// ✅ Хорошо - показывать после touched
{control.touched && control.errors && (
  <ErrorMessage errors={control.errors} />
)}

// ❌ Плохо - показывать сразу
{control.errors && <ErrorMessage errors={control.errors} />}
```

### 2. Предоставляйте Полезные Сообщения

```typescript
// ✅ Хорошо - конкретно и полезно
return { passwordTooWeak: {
  message: 'Пароль должен содержать заглавную букву, строчную букву, цифру и быть не менее 8 символов'
}};

// ❌ Плохо - расплывчато
return { invalid: true };
```

### 3. Используйте Визуальные Индикаторы

```tsx
// ✅ Хорошо - множественные индикаторы
<input className={showError ? 'error' : ''} aria-invalid={showError} />
{showError && <XCircle className="error-icon" />}
{showError && <ErrorMessage />}

// ❌ Плохо - только текст
{showError && <span>Ошибка</span>}
```

### 4. Обрабатывайте Серверные Ошибки Изящно

```typescript
// ✅ Хорошо - устанавливать ошибки для конкретных полей
if (serverErrors.username) {
  form.controls.username.setErrors({ serverError: serverErrors.username });
}

// ❌ Плохо - общий alert
alert('Ошибка сервера');
```

### 5. Делайте Ошибки Доступными

```tsx
// ✅ Хорошо - ARIA атрибуты
<input
  aria-invalid={showError}
  aria-describedby={errorId}
/>
<span id={errorId} role="alert">
  {errorMessage}
</span>

// ❌ Плохо - без доступности
<input className={showError ? 'error' : ''} />
<span>{errorMessage}</span>
```

## Следующие Шаги

- [Стратегии Валидации](/docs/patterns/validation-strategies) — Продвинутые паттерны валидации
- [Кастомные Валидаторы](/docs/validation/custom) — Создание кастомной логики валидации
- [Композиция Форм](/docs/patterns/form-composition) — Построение сложных форм
