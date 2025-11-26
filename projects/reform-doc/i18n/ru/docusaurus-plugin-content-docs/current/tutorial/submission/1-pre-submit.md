---
sidebar_position: 1
---

# Валидация перед отправкой

Валидация форм перед отправкой для обеспечения качества данных и пользовательского опыта.

## Обзор

Перед отправкой кредитной заявки необходимо:

- **Запустить валидацию** - Выполнить все валидаторы для проверки данных формы
- **Пометить поля как тронутые** - Показать ошибки валидации пользователю
- **Проверить валидность** - Убедиться, что все поля прошли валидацию
- **Обработать ошибки** - Отобразить ошибки и направить пользователя к их исправлению
- **Предотвратить некорректную отправку** - Заблокировать отправку при наличии ошибок валидации

## Базовый flow отправки

### Простой обработчик отправки

Наиболее распространенный паттерн отправки формы:

```typescript title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Пометить все поля как тронутые для показа ошибок валидации
    form.markAsTouched();

    // Запуск валидации
    await form.validate();

    // Проверка, валидна ли форма
    if (form.valid.value) {
      // Форма валидна - переходим к отправке
      const application = form.value.value;
      await submitApplication(application);
    } else {
      // Форма имеет ошибки - пользователь их увидит
      console.log('Форма содержит ошибки валидации');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Поля формы */}
      <button type="submit">Отправить заявку</button>
    </form>
  );
}

async function submitApplication(data: CreditApplicationForm) {
  const response = await fetch('/api/applications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}
```

### Что происходит при отправке

```typescript
// 1. Пометить все поля как тронутые
form.markAsTouched();
// Теперь все ошибки валидации будут видны пользователю

// 2. Запустить валидацию
await form.validate();
// Все валидаторы (синхронные и асинхронные) выполняются

// 3. Проверить валидность
if (form.valid.value) {
  // ✅ Форма прошла все правила валидации
  // Безопасно отправлять
} else {
  // ❌ Форма имеет ошибки валидации
  // Ошибки видны пользователю
}
```

## Валидация перед отправкой

### Синхронная валидация

Для форм только с синхронными валидаторами:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  form.markAsTouched();
  form.validate(); // Не нужен await для синхронной валидации

  if (form.valid.value) {
    await submitApplication(form.value.value);
  }
};
```

### Асинхронная валидация

Для форм с асинхронными валидаторами (проверки API и т.д.):

```typescript title="src/components/CreditApplicationForm.tsx"
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  form.markAsTouched();

  // Ожидание завершения всех асинхронных валидаторов
  await form.validate();

  if (form.valid.value) {
    // Все асинхронные проверки пройдены
    await submitApplication(form.value.value);
  } else {
    // Некоторая асинхронная валидация провалилась
    console.log('Валидация формы провалилась');
  }
};
```

### Показ загрузки во время валидации

```typescript title="src/components/CreditApplicationForm.tsx"
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [isValidating, setIsValidating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    form.markAsTouched();

    setIsValidating(true);
    await form.validate();
    setIsValidating(false);

    if (form.valid.value) {
      await submitApplication(form.value.value);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Поля формы */}
      <button type="submit" disabled={isValidating}>
        {isValidating ? 'Валидация...' : 'Отправить заявку'}
      </button>
    </form>
  );
}
```

## Обработка ошибок валидации

### Показ сводки ошибок

Показать все ошибки валидации в верхней части формы:

```typescript title="src/components/ErrorSummary.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface ErrorSummaryProps {
  form: FormNode<CreditApplicationForm>;
}

function ErrorSummary({ form }: ErrorSummaryProps) {
  const { value: errors } = useFormControl(form.errors);
  const { value: touched } = useFormControl(form.touched);

  // Показывать ошибки только если форма была тронута (попытка отправки была)
  if (!touched || !errors || Object.keys(errors).length === 0) {
    return null;
  }

  const errorMessages = Object.entries(errors).map(([field, error]) => ({
    field,
    message: error.message || 'Некорректное значение',
  }));

  return (
    <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
      <h3 className="text-red-800 font-semibold mb-2">
        Пожалуйста, исправьте следующие ошибки:
      </h3>
      <ul className="list-disc list-inside text-red-700">
        {errorMessages.map(({ field, message }) => (
          <li key={field}>
            <strong>{field}:</strong> {message}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Использование
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  return (
    <form onSubmit={handleSubmit}>
      <ErrorSummary form={form} />
      {/* Поля формы */}
    </form>
  );
}
```

### Прокрутка к первой ошибке

Автоматическая прокрутка к первому полю с ошибкой:

```typescript title="src/utils/scroll-to-error.ts"
import type { FormNode } from 'reformer';

export function scrollToFirstError(form: FormNode<any>) {
  const errors = form.errors.value;
  if (!errors || Object.keys(errors).length === 0) return;

  // Получить первое поле с ошибкой
  const firstErrorField = Object.keys(errors)[0];

  // Найти элемент input по имени или id
  const element = document.querySelector(
    `[name="${firstErrorField}"], #${firstErrorField}`
  );

  if (element) {
    // Прокрутить в видимую область с плавным поведением
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });

    // Фокус на поле
    (element as HTMLElement).focus();
  }
}

// Использование в обработчике отправки
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  form.markAsTouched();
  await form.validate();

  if (!form.valid.value) {
    scrollToFirstError(form);
    return;
  }

  await submitApplication(form.value.value);
};
```

### Улучшенная прокрутка с метками полей

```typescript title="src/utils/scroll-to-error-with-labels.ts"
interface FieldLabels {
  [key: string]: string;
}

const fieldLabels: FieldLabels = {
  loanAmount: 'Сумма кредита',
  loanTerm: 'Срок кредита',
  firstName: 'Имя',
  lastName: 'Фамилия',
  email: 'Email адрес',
  phoneMain: 'Номер телефона',
};

export function scrollToFirstErrorWithMessage(
  form: FormNode<any>,
  showToast: (message: string) => void
) {
  const errors = form.errors.value;
  if (!errors || Object.keys(errors).length === 0) return;

  const firstErrorField = Object.keys(errors)[0];
  const errorMessage = errors[firstErrorField]?.message || 'Некорректное значение';
  const fieldLabel = fieldLabels[firstErrorField] || firstErrorField;

  // Показать toast уведомление
  showToast(`${fieldLabel}: ${errorMessage}`);

  // Прокрутить к полю
  const element = document.querySelector(
    `[name="${firstErrorField}"], #${firstErrorField}`
  );

  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    (element as HTMLElement).focus();
  }
}
```

## Состояния кнопки отправки

### Отключение кнопки при невалидности

```typescript title="src/components/SubmitButton.tsx"
import { useFormControl } from 'reformer';

interface SubmitButtonProps {
  form: FormNode<CreditApplicationForm>;
  isSubmitting?: boolean;
}

function SubmitButton({ form, isSubmitting = false }: SubmitButtonProps) {
  const { value: valid } = useFormControl(form.valid);
  const { value: dirty } = useFormControl(form.dirty);

  const isDisabled = !valid || !dirty || isSubmitting;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      className={`px-4 py-2 rounded ${
        isDisabled
          ? 'bg-gray-300 cursor-not-allowed'
          : 'bg-blue-600 hover:bg-blue-700 text-white'
      }`}
    >
      {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
    </button>
  );
}
```

### Динамическая кнопка со статусом валидации

```typescript title="src/components/DynamicSubmitButton.tsx"
function DynamicSubmitButton({ form, onSubmit }: Props) {
  const { value: valid } = useFormControl(form.valid);
  const { value: touched } = useFormControl(form.touched);
  const { value: errors } = useFormControl(form.errors);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const errorCount = errors ? Object.keys(errors).length : 0;

  const handleClick = async () => {
    setIsSubmitting(true);
    await onSubmit();
    setIsSubmitting(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!valid || isSubmitting}
      className="px-6 py-3 rounded font-semibold"
    >
      {isSubmitting ? (
        <>
          <Spinner className="mr-2" />
          Отправка...
        </>
      ) : !valid && touched ? (
        `Исправьте ${errorCount} ошибк${errorCount !== 1 ? 'и' : 'у'}`
      ) : (
        'Отправить заявку'
      )}
    </button>
  );
}
```

## Валидация многошаговой формы

### Валидация текущего шага

```typescript title="src/components/MultiStepForm.tsx"
function MultiStepForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [currentStep, setCurrentStep] = useState(1);

  const validateCurrentStep = async (): Promise<boolean> => {
    // Определить, какие поля принадлежат каждому шагу
    const stepFields: Record<number, (keyof CreditApplicationForm)[]> = {
      1: ['loanType', 'loanAmount', 'loanTerm', 'loanPurpose'],
      2: ['firstName', 'lastName', 'middleName', 'birthDate', 'birthPlace'],
      3: ['email', 'phoneMain', 'phoneAdditional'],
      4: ['employmentStatus', 'monthlyIncome', 'employerName'],
    };

    const fieldsToValidate = stepFields[currentStep] || [];

    // Пометить поля шага как тронутые
    fieldsToValidate.forEach((fieldName) => {
      form.field(fieldName).markAsTouched();
    });

    // Валидация всей формы
    await form.validate();

    // Проверить, валидны ли поля текущего шага
    const stepIsValid = fieldsToValidate.every((fieldName) => {
      const field = form.field(fieldName);
      const errors = field.errors.value;
      return !errors || Object.keys(errors).length === 0;
    });

    return stepIsValid;
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();

    if (isValid) {
      setCurrentStep((prev) => prev + 1);
    } else {
      console.log('Пожалуйста, исправьте ошибки перед продолжением');
    }
  };

  const handleSubmit = async () => {
    // Валидация всех шагов
    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      await submitApplication(form.value.value);
    } else {
      // Вернуться к первому шагу с ошибками
      const firstStepWithError = findFirstStepWithError(form);
      setCurrentStep(firstStepWithError);
    }
  };

  return (
    <div>
      <StepContent step={currentStep} form={form} />

      {currentStep < 4 ? (
        <button onClick={handleNext}>Следующий шаг</button>
      ) : (
        <button onClick={handleSubmit}>Отправить заявку</button>
      )}
    </div>
  );
}
```

### Поиск первого шага с ошибками

```typescript title="src/utils/find-first-step-with-error.ts"
function findFirstStepWithError(form: FormNode<CreditApplicationForm>): number {
  const errors = form.errors.value;
  if (!errors) return 1;

  const stepFields: Record<number, (keyof CreditApplicationForm)[]> = {
    1: ['loanType', 'loanAmount', 'loanTerm', 'loanPurpose'],
    2: ['firstName', 'lastName', 'middleName', 'birthDate', 'birthPlace'],
    3: ['email', 'phoneMain', 'phoneAdditional'],
    4: ['employmentStatus', 'monthlyIncome', 'employerName'],
  };

  for (const [step, fields] of Object.entries(stepFields)) {
    const hasError = fields.some((field) => errors[field]);
    if (hasError) {
      return parseInt(step);
    }
  }

  return 1;
}
```

## Предотвращение дублирующих отправок

### Отключение отправки во время обработки

```typescript title="src/components/CreditApplicationForm.tsx"
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Предотвращение дублирующих отправок
    if (isSubmitting) return;

    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      return;
    }

    setIsSubmitting(true);

    try {
      await submitApplication(form.value.value);
      // Обработка успеха
      form.reset();
    } catch (error) {
      // Обработка ошибки
      console.error('Отправка провалилась:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Поля формы */}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Отправка...' : 'Отправить заявку'}
      </button>
    </form>
  );
}
```

### Дебаунс кнопки отправки

```typescript title="src/hooks/useDebouncedSubmit.ts"
import { useCallback, useRef } from 'react';

export function useDebouncedSubmit(
  onSubmit: () => Promise<void>,
  delay: number = 1000
) {
  const timeoutRef = useRef<NodeJS.Timeout>();
  const isProcessing = useRef(false);

  const debouncedSubmit = useCallback(async () => {
    // Очистить предыдущий таймаут
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Не позволять новую отправку, если идет обработка
    if (isProcessing.current) {
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      isProcessing.current = true;
      await onSubmit();
      isProcessing.current = false;
    }, delay);
  }, [onSubmit, delay]);

  return debouncedSubmit;
}

// Использование
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const submitForm = async () => {
    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      await submitApplication(form.value.value);
    }
  };

  const handleSubmit = useDebouncedSubmit(submitForm, 500);

  return (
    <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
      {/* Поля формы */}
    </form>
  );
}
```

## Лучшие практики

### 1. Всегда помечайте как тронутое перед валидацией

```typescript
// ✅ ХОРОШО: Пометка как тронутое для показа ошибок
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();

  if (form.valid.value) {
    await submitApplication(form.value.value);
  }
};

// ❌ ПЛОХО: Пользователь не увидит ошибки валидации
const handleSubmit = async () => {
  await form.validate();

  if (form.valid.value) {
    await submitApplication(form.value.value);
  }
  // Ошибки существуют, но не видны пользователю!
};
```

### 2. Ожидайте асинхронную валидацию

```typescript
// ✅ ХОРОШО: Ожидание асинхронных валидаторов
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate(); // Await асинхронной валидации

  if (form.valid.value) {
    await submitApplication(form.value.value);
  }
};

// ❌ ПЛОХО: Не await - может отправить невалидные данные
const handleSubmit = async () => {
  form.markAsTouched();
  form.validate(); // Отсутствует await!

  if (form.valid.value) {
    // Может быть true до завершения асинхронных валидаторов!
    await submitApplication(form.value.value);
  }
};
```

### 3. Предотвращайте дублирующие отправки

```typescript
// ✅ ХОРОШО: Отслеживание состояния отправки
const [isSubmitting, setIsSubmitting] = useState(false);

const handleSubmit = async () => {
  if (isSubmitting) return;

  setIsSubmitting(true);
  await submitApplication(form.value.value);
  setIsSubmitting(false);
};

// ❌ ПЛОХО: Пользователь может отправить несколько раз
const handleSubmit = async () => {
  await submitApplication(form.value.value);
  // Пользователь может снова нажать отправку во время обработки!
};
```

### 4. Обрабатывайте ошибки отправки корректно

```typescript
// ✅ ХОРОШО: Try-catch с правильной обработкой ошибок
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();

  if (!form.valid.value) {
    scrollToFirstError(form);
    return;
  }

  try {
    await submitApplication(form.value.value);
    showSuccessMessage('Заявка отправлена!');
    form.reset();
  } catch (error) {
    showErrorMessage('Отправка провалилась. Пожалуйста, попробуйте снова.');
    console.error('Ошибка отправки:', error);
  }
};

// ❌ ПЛОХО: Нет обработки ошибок
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();

  if (form.valid.value) {
    await submitApplication(form.value.value);
    // Что если это провалится?
  }
};
```

### 5. Предоставляйте обратную связь пользователю

```typescript
// ✅ ХОРОШО: Четкая обратная связь на каждом этапе
const handleSubmit = async () => {
  form.markAsTouched();

  setStatus('validating');
  await form.validate();

  if (!form.valid.value) {
    setStatus('invalid');
    scrollToFirstError(form);
    showToast('Пожалуйста, исправьте ошибки валидации');
    return;
  }

  setStatus('submitting');
  try {
    await submitApplication(form.value.value);
    setStatus('success');
    showToast('Заявка успешно отправлена!');
  } catch (error) {
    setStatus('error');
    showToast('Отправка провалилась. Пожалуйста, попробуйте снова.');
  }
};

// ❌ ПЛОХО: Нет обратной связи - пользователь не знает, что происходит
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();
  if (form.valid.value) {
    await submitApplication(form.value.value);
  }
};
```

## Распространенные паттерны

### Отправка с подтверждением

```typescript
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      setShowConfirmDialog(true);
    }
  };

  const confirmSubmit = async () => {
    setShowConfirmDialog(false);
    await submitApplication(form.value.value);
  };

  return (
    <>
      <form onSubmit={handleSubmit}>
        {/* Поля формы */}
        <button type="submit">Отправить заявку</button>
      </form>

      <ConfirmDialog
        open={showConfirmDialog}
        onClose={() => setShowConfirmDialog(false)}
        onConfirm={confirmSubmit}
        title="Отправить заявку?"
        message="Пожалуйста, подтвердите, что хотите отправить эту кредитную заявку."
      />
    </>
  );
}
```

### Отправка с индикатором прогресса

```typescript
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submitProgress, setSubmitProgress] = useState<
    'idle' | 'validating' | 'submitting' | 'success' | 'error'
  >('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitProgress('validating');
    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      setSubmitProgress('error');
      return;
    }

    setSubmitProgress('submitting');
    try {
      await submitApplication(form.value.value);
      setSubmitProgress('success');
      setTimeout(() => {
        form.reset();
        setSubmitProgress('idle');
      }, 2000);
    } catch (error) {
      setSubmitProgress('error');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Поля формы */}

      {submitProgress === 'validating' && (
        <div className="text-blue-600">Валидация формы...</div>
      )}
      {submitProgress === 'submitting' && (
        <div className="text-blue-600">Отправка заявки...</div>
      )}
      {submitProgress === 'success' && (
        <div className="text-green-600">Заявка успешно отправлена!</div>
      )}
      {submitProgress === 'error' && (
        <div className="text-red-600">Пожалуйста, исправьте ошибки и попробуйте снова</div>
      )}

      <button
        type="submit"
        disabled={submitProgress === 'validating' || submitProgress === 'submitting'}
      >
        Отправить заявку
      </button>
    </form>
  );
}
```

### Авто-сохранение перед отправкой

```typescript
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Сохранить черновик перед валидацией
    const draftData = form.value.value;
    localStorage.setItem('credit-application-draft', JSON.stringify(draftData));

    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) {
      console.log('Форма невалидна - черновик сохранен');
      return;
    }

    try {
      await submitApplication(form.value.value);
      // Очистить черновик при успешной отправке
      localStorage.removeItem('credit-application-draft');
      form.reset();
    } catch (error) {
      console.error('Отправка провалилась - черновик сохранен');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Поля формы */}
    </form>
  );
}
```

## Следующий шаг

Теперь, когда вы понимаете валидацию перед отправкой, давайте изучим, как маппировать данные формы для отправки в API и обрабатывать различные форматы данных.
