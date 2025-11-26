---
sidebar_position: 2
---

# Базовая отправка

Реализация отправки формы с автоматической валидацией и преобразованием данных.

## Обзор

Базовая отправка охватывает существенный поток:

- **form.submit()** - Основной метод отправки
- **Автоматическая валидация** - Валидация перед отправкой
- **Преобразование данных** - Сериализация данных формы для API
- **API сервис** - Отправка на сервер
- **Обработка успеха** - Обработка успешного ответа
- **Обработка ошибок** - Обработка сбоев отправки
- **Состояния интерфейса** - Состояния загрузки и отключения

## Метод form.submit()

Метод `form.submit()` - это ядро системы отправки ReFormer. Он автоматически валидирует вашу форму перед вызовом callback отправки.

### Базовое использование

```typescript
const result = await form.submit(async (validData) => {
  // Этот callback выполняется только если валидация прошла успешно
  // validData гарантированно корректны
  return await submitToServer(validData);
});
```

**Ключевые функции**:
- Автоматически валидирует все поля
- Выбрасывает ошибку если валидация не пройдена
- Callback получает только валидированные данные
- Возвращает то, что вернул ваш callback

### Поток отправки

```
┌─────────────────────────────────────┐
│   Пользователь нажимает кнопку      │
│            отправки                 │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   form.submit() вызывается          │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────────────────────┐
│   1. Запустить валидацию            │
│      - Все валидаторы выполняются   │
│      - Проверить обязательные поля  │
│      - Проверить пользовательские   │
│        правила                      │
└──────────┬──────────────────────────┘
           │
           ▼
    ┌──────────────┐
    │  Валидно?    │
    └──┬────────┬──┘
       │ НЕТ    │ ДА
       ▼        ▼
    ┌─────┐  ┌──────────────────────────┐
    │СТОП │  │ 2. Вызвать callback      │
    │Показать│    отправки              │
    │ошибки  │    - Передать корректные │
    └─────┘  │      данные              │
             │    - Выполнить вызов API │
             └──────────┬───────────────┘
                        │
                        ▼
              ┌──────────────────────────┐
              │ 3. Вернуть результат     │
              │    - Успех: результат    │
              │    - Ошибка: выбросить   │
              └──────────────────────────┘
```

## Создание API сервиса

Давайте создадим сервис для отправки заявок на кредит на сервер.

### Определение типов API

```typescript title="src/services/api/submission.api.ts"
/**
 * Полезная нагрузка запроса для отправки заявки на кредит
 */
export interface SubmitApplicationRequest {
  // Информация о кредите
  loanAmount: number;
  loanTerm: number;
  loanType: string;
  loanPurpose: string;

  // Личная информация
  firstName: string;
  lastName: string;
  middleName?: string;
  birthDate: string;
  passportSeries: string;
  passportNumber: string;
  passportIssuer: string;
  passportIssueDate: string;

  // Контактная информация
  email: string;
  phoneMain: string;
  phoneAdditional?: string;

  // Информация об адресе
  registrationAddress: {
    postalCode: string;
    country: string;
    region: string;
    city: string;
    street: string;
    house: string;
    apartment?: string;
  };
  residentialAddress?: {
    postalCode: string;
    country: string;
    region: string;
    city: string;
    street: string;
    house: string;
    apartment?: string;
  };

  // Информация о работе
  employmentType: string;
  companyName?: string;
  position?: string;
  monthlyIncome: number;
  employmentStartDate?: string;

  // Дополнительная информация
  hasActiveLoan: boolean;
  hasBankruptcy: boolean;
  agreeToTerms: boolean;
  agreeToDataProcessing: boolean;
}

/**
 * Ответ от отправки заявки на кредит
 */
export interface SubmitApplicationResponse {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  message: string;
  submittedAt: string;
  estimatedDecisionTime?: string;
}

/**
 * Ошибочный ответ от сервера
 */
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  errors?: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}
```

### Реализация функции API

```typescript title="src/services/api/submission.api.ts"
/**
 * Отправить заявку на кредит на сервер
 * @param data Данные заявки для отправки
 * @returns Результат отправки
 * @throws {Error} Если отправка не удалась
 */
export async function submitApplication(
  data: SubmitApplicationRequest
): Promise<SubmitApplicationResponse> {
  const response = await fetch('/api/applications/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Добавить аутентификацию если нужна
      // 'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  // Обработка ответов не-OK
  if (!response.ok) {
    const errorData: ApiErrorResponse = await response.json();

    // Создать ошибку с данными ответа
    const error = new Error(errorData.message || 'Отправка не удалась');
    (error as any).response = {
      status: response.status,
      data: errorData
    };

    throw error;
  }

  // Разобрать и вернуть успешный ответ
  return await response.json();
}
```

## Преобразование данных

Перед отправкой преобразуйте данные формы в соответствии с форматом API.

### Создание трансформатора

```typescript title="src/utils/credit-application-transformer.ts"
import type { CreditApplicationFormValue } from '../schemas/credit-application-schema';
import type { SubmitApplicationRequest } from '../services/api/submission.api';

/**
 * Преобразовать данные формы в формат API
 */
export const creditApplicationTransformer = {
  /**
   * Сериализация: Форма → API
   */
  serialize(formData: CreditApplicationFormValue): SubmitApplicationRequest {
    return {
      // Информация о кредите
      loanAmount: formData.step1.loanAmount,
      loanTerm: formData.step1.loanTerm,
      loanType: formData.step1.loanType,
      loanPurpose: formData.step1.loanPurpose,

      // Личная информация
      firstName: formData.step2.personalData.firstName,
      lastName: formData.step2.personalData.lastName,
      middleName: formData.step2.personalData.middleName || undefined,
      birthDate: formData.step2.personalData.birthDate,
      passportSeries: formData.step2.passportData.passportSeries,
      passportNumber: formData.step2.passportData.passportNumber,
      passportIssuer: formData.step2.passportData.passportIssuer,
      passportIssueDate: formData.step2.passportData.passportIssueDate,

      // Контактная информация
      email: formData.step3.email,
      phoneMain: formData.step3.phoneMain,
      phoneAdditional: formData.step3.phoneAdditional || undefined,

      // Адрес регистрации
      registrationAddress: {
        postalCode: formData.step3.registrationAddress.postalCode,
        country: formData.step3.registrationAddress.country,
        region: formData.step3.registrationAddress.region,
        city: formData.step3.registrationAddress.city,
        street: formData.step3.registrationAddress.street,
        house: formData.step3.registrationAddress.house,
        apartment: formData.step3.registrationAddress.apartment || undefined,
      },

      // Адрес проживания (если отличается)
      residentialAddress: formData.step3.sameAsRegistration
        ? undefined
        : formData.step3.residentialAddress
        ? {
            postalCode: formData.step3.residentialAddress.postalCode,
            country: formData.step3.residentialAddress.country,
            region: formData.step3.residentialAddress.region,
            city: formData.step3.residentialAddress.city,
            street: formData.step3.residentialAddress.street,
            house: formData.step3.residentialAddress.house,
            apartment: formData.step3.residentialAddress.apartment || undefined,
          }
        : undefined,

      // Информация о работе
      employmentType: formData.step4.employmentType,
      companyName: formData.step4.companyName || undefined,
      position: formData.step4.position || undefined,
      monthlyIncome: formData.step4.monthlyIncome,
      employmentStartDate: formData.step4.employmentStartDate || undefined,

      // Дополнительная информация
      hasActiveLoan: formData.step5.hasActiveLoan,
      hasBankruptcy: formData.step5.hasBankruptcy,
      agreeToTerms: formData.step5.agreeToTerms,
      agreeToDataProcessing: formData.step5.agreeToDataProcessing,
    };
  },

  /**
   * Десериализация: API → Форма (для загрузки существующих заявок)
   */
  deserialize(apiData: SubmitApplicationRequest): CreditApplicationFormValue {
    return {
      step1: {
        loanAmount: apiData.loanAmount,
        loanTerm: apiData.loanTerm,
        loanType: apiData.loanType,
        loanPurpose: apiData.loanPurpose,
      },
      step2: {
        personalData: {
          firstName: apiData.firstName,
          lastName: apiData.lastName,
          middleName: apiData.middleName || '',
          birthDate: apiData.birthDate,
        },
        passportData: {
          passportSeries: apiData.passportSeries,
          passportNumber: apiData.passportNumber,
          passportIssuer: apiData.passportIssuer,
          passportIssueDate: apiData.passportIssueDate,
        },
      },
      step3: {
        email: apiData.email,
        phoneMain: apiData.phoneMain,
        phoneAdditional: apiData.phoneAdditional || '',
        registrationAddress: apiData.registrationAddress,
        sameAsRegistration: !apiData.residentialAddress,
        residentialAddress: apiData.residentialAddress || {
          postalCode: '',
          country: '',
          region: '',
          city: '',
          street: '',
          house: '',
          apartment: '',
        },
      },
      step4: {
        employmentType: apiData.employmentType,
        companyName: apiData.companyName || '',
        position: apiData.position || '',
        monthlyIncome: apiData.monthlyIncome,
        employmentStartDate: apiData.employmentStartDate || '',
      },
      step5: {
        hasActiveLoan: apiData.hasActiveLoan,
        hasBankruptcy: apiData.hasBankruptcy,
        agreeToTerms: apiData.agreeToTerms,
        agreeToDataProcessing: apiData.agreeToDataProcessing,
      },
    };
  },
};
```

## Реализация базовой отправки

Теперь давайте реализуем отправку в нашем компоненте формы.

### Обработчик отправки

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Очистить предыдущие ошибки
    setError(null);
    setSubmitting(true);

    try {
      // form.submit() автоматически:
      // 1. Валидирует все поля
      // 2. Выбрасывает если невалидно
      // 3. Вызывает callback с корректными данными
      const result = await form.submit(async (validData) => {
        // Преобразовать данные формы в формат API
        const apiData = creditApplicationTransformer.serialize(validData);

        // Отправить на сервер
        return await submitApplication(apiData);
      });

      // Успех!
      console.log('Заявка отправлена:', result);

      // Показать сообщение об успехе
      alert(`Заявка ${result.id} успешно отправлена!`);

      // Опционально перейти на страницу успеха
      // navigate(`/applications/${result.id}/success`);

    } catch (err) {
      // Обработать ошибки
      console.error('Отправка не удалась:', err);

      const errorMessage = err instanceof Error
        ? err.message
        : 'Не удалось отправить заявку';

      setError(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Сообщение об ошибке */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Поля формы */}
      <FormRenderer form={form} />

      {/* Кнопка отправки */}
      <button
        type="submit"
        disabled={submitting || !form.valid.value}
        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {submitting ? 'Отправка...' : 'Отправить заявку'}
      </button>
    </form>
  );
}
```

### Понимание потока

```typescript
// 1. Пользователь нажимает отправку
handleSubmit() // вызывается

// 2. Валидация происходит автоматически
form.submit(async (validData) => {
  // 3. Этот callback запустится только если валидация прошла

  // 4. Преобразовать данные
  const apiData = transformer.serialize(validData);

  // 5. Отправить на сервер
  return await submitApplication(apiData);
});

// 6. Обработать результат
// - Успех: результат возвращен
// - Ошибка: исключение выброшено
```

## Создание компонента кнопки отправки

Давайте создадим переиспользуемую кнопку отправки с состояниями загрузки.

### Компонент SubmitButton

```tsx title="src/components/SubmitButton.tsx"
import { useFormControl } from 'reformer';
import type { FormNode } from 'reformer';

interface SubmitButtonProps {
  form: FormNode;
  loading?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function SubmitButton({
  form,
  loading = false,
  onClick,
  children = 'Отправить'
}: SubmitButtonProps) {
  const { value: isValid } = useFormControl(form.valid);

  return (
    <button
      type="submit"
      onClick={onClick}
      disabled={loading || !isValid}
      className={`
        px-6 py-3 rounded-lg font-medium
        transition-all duration-200
        ${
          loading || !isValid
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
        }
        text-white
        disabled:opacity-50
      `}
    >
      {loading ? (
        <span className="flex items-center gap-2">
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
        </span>
      ) : (
        children
      )}
    </button>
  );
}
```

### Использование SubmitButton

```tsx title="src/components/CreditApplicationForm.tsx"
import { SubmitButton } from './SubmitButton';

function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const result = await form.submit(async (data) => {
        const apiData = creditApplicationTransformer.serialize(data);
        return await submitApplication(apiData);
      });

      console.log('Успех:', result);
    } catch (error) {
      console.error('Ошибка:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormRenderer form={form} />

      <SubmitButton
        form={form}
        loading={submitting}
      >
        Отправить заявку
      </SubmitButton>
    </form>
  );
}
```

## Полный пример интеграции

Вот полный пример со всеми частями вместе:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo, useState } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { SubmitButton } from './SubmitButton';
import { FormRenderer } from './FormRenderer';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSuccess(false);
    setSubmitting(true);

    try {
      const result = await form.submit(async (validData) => {
        // Преобразовать в формат API
        const apiData = creditApplicationTransformer.serialize(validData);

        // Отправить на сервер
        return await submitApplication(apiData);
      });

      // Успех!
      setSuccess(true);
      console.log('Заявка успешно отправлена:', result);

      // Опционально: Очистить форму после успеха
      // form.reset();

      // Опционально: Перейти на страницу успеха
      // setTimeout(() => {
      //   navigate(`/applications/${result.id}/success`);
      // }, 1500);

    } catch (err) {
      console.error('Ошибка отправки:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось отправить заявку. Пожалуйста, попробуйте еще раз.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Заявка на кредит</h1>

      <form onSubmit={handleSubmit}>
        {/* Сообщение об успехе */}
        {success && (
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
                <p className="text-sm text-green-700">
                  Заявка успешно отправлена! Мы её рассмотрим и вскоре вам ответим.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Сообщение об ошибке */}
        {error && (
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
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Поля формы */}
        <FormRenderer form={form} />

        {/* Кнопка отправки */}
        <div className="mt-6">
          <SubmitButton form={form} loading={submitting}>
            Отправить заявку
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
```

## Тестирование отправки

### Контрольный список ручного тестирования

Протестируйте эти сценарии:

- [ ] **Корректная отправка** - Заполните форму правильно и отправьте
- [ ] **Неверная отправка** - Попробуйте отправить с ошибками валидации
- [ ] **Пустая форма** - Кнопка отправки должна быть отключена
- [ ] **Состояние загрузки** - Кнопка показывает загрузку при отправке
- [ ] **Успешный ответ** - Появляется сообщение об успехе
- [ ] **Ошибочный ответ** - Появляется сообщение об ошибке
- [ ] **Ошибка сети** - Обработка сбоев соединения
- [ ] **Двойная отправка** - Предотвращение нескольких одновременных отправок

### Пример теста

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';

// Мокировать API
jest.mock('../services/api/submission.api');

describe('CreditApplicationForm - Базовая отправка', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('отправляет форму успешно', async () => {
    // Мокировать успешную отправку
    (submitApplication as jest.Mock).mockResolvedValue({
      id: 'app-123',
      status: 'pending',
      message: 'Заявка получена',
    });

    const { container } = render(<CreditApplicationForm />);

    // Заполнить обязательные поля
    // ... (заполнить поля формы)

    // Нажать отправку
    const submitButton = screen.getByText('Отправить заявку');
    fireEvent.click(submitButton);

    // Должно показать состояние загрузки
    expect(screen.getByText('Отправка...')).toBeInTheDocument();

    // Дождаться завершения отправки
    await waitFor(() => {
      expect(screen.getByText(/успешно отправлена/i)).toBeInTheDocument();
    });

    // API должна быть вызвана
    expect(submitApplication).toHaveBeenCalledTimes(1);
  });

  test('показывает ошибку при сбое отправки', async () => {
    // Мокировать сбой отправки
    (submitApplication as jest.Mock).mockRejectedValue(
      new Error('Ошибка сети')
    );

    const { container } = render(<CreditApplicationForm />);

    // Заполнить и отправить форму
    // ...

    const submitButton = screen.getByText('Отправить заявку');
    fireEvent.click(submitButton);

    // Дождаться сообщения об ошибке
    await waitFor(() => {
      expect(screen.getByText(/Ошибка сети/i)).toBeInTheDocument();
    });
  });

  test('отключает кнопку отправки когда форма невалидна', () => {
    render(<CreditApplicationForm />);

    const submitButton = screen.getByText('Отправить заявку');

    // Должна быть отключена когда форма пустая/невалидна
    expect(submitButton).toBeDisabled();
  });
});
```

## Ключевые моменты

### Паттерн form.submit()

```typescript
// ✅ Правильно: Использовать form.submit()
const result = await form.submit(async (validData) => {
  return await submitToAPI(validData);
});

// ❌ Неправильно: Ручная валидация
const isValid = await form.validate();
if (isValid) {
  const data = form.value.value;
  await submitToAPI(data);
}
```

### Всегда преобразуйте данные

```typescript
// ✅ Правильно: Преобразовать перед отправкой
const result = await form.submit(async (data) => {
  const apiData = transformer.serialize(data);
  return await submitApplication(apiData);
});

// ❌ Неправильно: Отправить необработанные данные формы
const result = await form.submit(async (data) => {
  return await submitApplication(data); // Может не соответствовать формату API
});
```

### Обработайте состояние загрузки

```typescript
// ✅ Правильно: Отслеживать состояние загрузки
const [submitting, setSubmitting] = useState(false);

try {
  setSubmitting(true);
  await form.submit(submitFn);
} finally {
  setSubmitting(false);
}

// ❌ Неправильно: Нет индикации загрузки
await form.submit(submitFn); // Пользователь не знает что происходит отправка
```

### Отключите отправку когда невалидна

```tsx
// ✅ Правильно: Отключить когда невалидна или отправляется
<SubmitButton
  form={form}
  loading={submitting}
/>

// ❌ Неправильно: Всегда включена
<button type="submit">Отправить</button>
```

## Что дальше?

Вы реализовали базовую отправку! Далее мы добавим **состояния отправки** для отслеживания полного жизненного цикла отправки:

- Состояние ожидания (не отправлено)
- Состояние отправки (в процессе)
- Состояние успеха (завершено)
- Состояние ошибки (не удалось)
- Переходы состояний
- Интерфейс для каждого состояния

В следующем разделе мы создадим систему управления состоянием, которая предоставляет лучший пользовательский опыт и более четкую обратную связь при отправке.
