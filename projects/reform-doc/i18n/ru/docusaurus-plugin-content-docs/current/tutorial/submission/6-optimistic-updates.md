---
sidebar_position: 6
---

# Оптимистичные обновления

Реализация оптимистичных обновлений интерфейса для мгновенной обратной связи пользователю.

## Обзор

Оптимистичные обновления делают вашу форму мгновенной путем обновления интерфейса перед подтверждением сервера:

- **Немедленная обратная связь** - Обновить интерфейс мгновенно при отправке
- **Откат при ошибке** - Вернуть изменения если отправка не удалась
- **Индикаторы оптимистичности** - Показать какие данные ожидают
- **Разрешение конфликтов** - Обработать изменения на сервере
- **Интеграция кэша** - Обновить кэшированные данные оптимистично
- **Уверенность пользователя** - Улучшить воспринимаемую производительность

## Понимание оптимистичных обновлений

### Оптимистичный поток

```
ПОЛЬЗОВАТЕЛЬ ОТПРАВЛЯЕТ ФОРМУ
    ↓
НЕМЕДЛЕННОЕ ОБНОВЛЕНИЕ ИНТЕРФЕЙСА (оптимистично)
    ↓
ОТПРАВИТЬ НА СЕРВЕР (в фоне)
    ↓
    ├─ УСПЕХ
    │   └─ Подтвердить оптимистичное обновление
    │
    └─ ОШИБКА
        └─ Откатить к предыдущему состоянию
```

### Когда использовать оптимистичные обновления

```typescript
// ✅ ХОРОШИЕ случаи использования оптимистичных обновлений
- Добавление элементов в список
- Обновление информации профиля
- Пометка задач как завершенные
- Лайки/добавление в избранное
- Простые изменения статуса

// ❌ НЕ используйте оптимистичные обновления для
- Финансовых транзакций
- Критических изменений данных
- Сложных валидаций
- Операций с непредсказуемыми результатами
```

## Создание хука useOptimistic

Создайте хук для безопасного управления оптимистичными обновлениями.

### Реализация хука

```typescript title="src/hooks/useOptimistic.ts"
import { useState, useCallback, useRef } from 'react';
import type { FormNode } from 'reformer';

export interface OptimisticOptions<T> {
  /**
   * Генерировать оптимистичные данные из данных формы
   */
  getOptimisticData: (formData: any) => T;

  /**
   * Вызывается когда оптимистичное обновление применено
   */
  onOptimisticUpdate: (data: T) => void;

  /**
   * Вызывается когда оптимистичное обновление подтверждено
   */
  onConfirm?: (actualData: T) => void;

  /**
   * Вызывается когда оптимистичное обновление откачено
   */
  onRollback: (optimisticData: T) => void;

  /**
   * Вызывается при любой ошибке во время отправки
   */
  onError?: (error: Error) => void;
}

export interface UseOptimisticResult<T> {
  submit: () => Promise<T>;
  isOptimistic: boolean;
  optimisticData: T | null;
}

/**
 * Хук для обработки оптимистичных обновлений
 */
export function useOptimistic<T>(
  form: FormNode,
  submitFn: (data: any) => Promise<T>,
  options: OptimisticOptions<T>
): UseOptimisticResult<T> {
  const [isOptimistic, setIsOptimistic] = useState(false);
  const [optimisticData, setOptimisticData] = useState<T | null>(null);

  // Отслеживать снимок формы для отката
  const snapshotRef = useRef<any>(null);

  const submit = useCallback(async (): Promise<T> => {
    // Сохранить текущее состояние формы для потенциального отката
    snapshotRef.current = form.value.value;

    // Генерировать оптимистичные данные
    const optimistic = options.getOptimisticData(snapshotRef.current);
    setOptimisticData(optimistic);
    setIsOptimistic(true);

    // Применить оптимистичное обновление немедленно
    options.onOptimisticUpdate(optimistic);

    try {
      // Выполнить фактическую отправку
      const result = await form.submit(submitFn);

      // Подтвердить оптимистичное обновление
      setIsOptimistic(false);
      setOptimisticData(null);

      if (options.onConfirm) {
        options.onConfirm(result);
      }

      return result;
    } catch (error) {
      // Откатить при ошибке
      setIsOptimistic(false);
      setOptimisticData(null);

      // Восстановить форму к предыдущему состоянию
      if (snapshotRef.current) {
        form.patchValue(snapshotRef.current);
      }

      // Откатить изменения интерфейса
      options.onRollback(optimistic);

      // Вызвать обработчик ошибок
      if (options.onError) {
        options.onError(error as Error);
      }

      throw error;
    }
  }, [form, submitFn, options]);

  return {
    submit,
    isOptimistic,
    optimisticData,
  };
}
```

## Использование оптимистичных обновлений

### Базовый пример - список заявок

```tsx title="src/components/ApplicationsList.tsx"
import { useState, useMemo } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useOptimistic } from '../hooks/useOptimistic';

interface Application {
  id: string;
  status: string;
  loanAmount: number;
  submittedAt: string;
  _optimistic?: boolean;
}

export function ApplicationsList() {
  const [applications, setApplications] = useState<Application[]>([]);
  const form = useMemo(() => createCreditApplicationForm(), []);

  const { submit, isOptimistic, optimisticData } = useOptimistic(
    form,
    async (data) => {
      const apiData = creditApplicationTransformer.serialize(data);
      return await submitApplication(apiData);
    },
    {
      getOptimisticData: (formData) => ({
        id: `temp-${Date.now()}`,
        status: 'pending',
        loanAmount: formData.step1.loanAmount,
        submittedAt: new Date().toISOString(),
        _optimistic: true,
      }),
      onOptimisticUpdate: (optimisticApp) => {
        // Добавить оптимистичную заявку в список немедленно
        setApplications((prev) => [optimisticApp, ...prev]);
      },
      onConfirm: (actualApp) => {
        // Заменить оптимистичную на фактические данные
        setApplications((prev) =>
          prev.map((app) =>
            app._optimistic ? actualApp : app
          )
        );
      },
      onRollback: (optimisticApp) => {
        // Удалить оптимистичную заявку
        setApplications((prev) =>
          prev.filter((app) => app.id !== optimisticApp.id)
        );
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submit();
      form.reset();
    } catch (error) {
      console.error('Отправка не удалась:', error);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <FormRenderer form={form} />
        <button type="submit">Отправить заявку</button>
      </form>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">Ваши заявки</h2>
        <div className="space-y-4">
          {applications.map((app) => (
            <ApplicationCard
              key={app.id}
              application={app}
              isOptimistic={app._optimistic}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
```

### Карточка заявки с индикатором оптимистичности

```tsx title="src/components/ApplicationCard.tsx"
interface ApplicationCardProps {
  application: {
    id: string;
    status: string;
    loanAmount: number;
    submittedAt: string;
    _optimistic?: boolean;
  };
  isOptimistic?: boolean;
}

export function ApplicationCard({ application, isOptimistic }: ApplicationCardProps) {
  return (
    <div
      className={`
        border rounded-lg p-4
        ${isOptimistic ? 'opacity-60 bg-blue-50' : 'bg-white'}
      `}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">
            Заявка {application.id}
            {isOptimistic && (
              <span className="ml-2 text-xs text-blue-600 font-normal">
                Отправляется...
              </span>
            )}
          </h3>
          <p className="text-sm text-gray-600">
            Сумма кредита: ${application.loanAmount.toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">
            Статус: {application.status}
          </p>
        </div>

        {isOptimistic && (
          <svg
            className="animate-spin h-5 w-5 text-blue-600"
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
      </div>
    </div>
  );
}
```

## Паттерны оптимистичных обновлений

### Паттерн 1: Добавить в список

```typescript
// Добавить элемент оптимистично в список
onOptimisticUpdate: (optimisticItem) => {
  setItems((prev) => [...prev, optimisticItem]);
},
onConfirm: (actualItem) => {
  setItems((prev) =>
    prev.map((item) =>
      item._optimistic ? actualItem : item
    )
  );
},
onRollback: (optimisticItem) => {
  setItems((prev) =>
    prev.filter((item) => item.id !== optimisticItem.id)
  );
}
```

### Паттерн 2: Обновить элемент в списке

```typescript
// Обновить существующий элемент оптимистично
onOptimisticUpdate: (updatedItem) => {
  setItems((prev) =>
    prev.map((item) =>
      item.id === updatedItem.id
        ? { ...updatedItem, _optimistic: true }
        : item
    )
  );
},
onConfirm: (actualItem) => {
  setItems((prev) =>
    prev.map((item) =>
      item.id === actualItem.id ? actualItem : item
    )
  );
},
onRollback: (optimisticItem) => {
  // Восстановить из снимка
  setItems(snapshotItems);
}
```

### Паттерн 3: Удалить из списка

```typescript
// Удалить элемент оптимистично
onOptimisticUpdate: (itemToDelete) => {
  setItems((prev) =>
    prev.map((item) =>
      item.id === itemToDelete.id
        ? { ...item, _optimistic: true, _deleted: true }
        : item
    )
  );
},
onConfirm: (deletedItem) => {
  setItems((prev) =>
    prev.filter((item) => item.id !== deletedItem.id)
  );
},
onRollback: (itemToDelete) => {
  setItems((prev) =>
    prev.map((item) =>
      item.id === itemToDelete.id
        ? { ...item, _optimistic: false, _deleted: false }
        : item
    )
  );
}
```

## Разрешение конфликтов

Обработайте случаи когда данные сервера отличаются от оптимистичных данных.

### Обнаружение конфликтов

```typescript title="src/hooks/useOptimisticWithConflictResolution.ts"
import { useOptimistic } from './useOptimistic';
import type { OptimisticOptions } from './useOptimistic';

export interface ConflictResolutionStrategy<T> {
  /**
   * Обнаружить конфликт между оптимистичными и фактическими данными
   */
  detectConflict: (optimistic: T, actual: T) => boolean;

  /**
   * Разрешить конфликт
   * @returns Разрешенные данные для использования
   */
  resolveConflict: (optimistic: T, actual: T) => T;

  /**
   * Вызывается когда обнаружен конфликт
   */
  onConflict?: (optimistic: T, actual: T, resolved: T) => void;
}

export function useOptimisticWithConflictResolution<T>(
  form: FormNode,
  submitFn: (data: any) => Promise<T>,
  options: OptimisticOptions<T>,
  conflictStrategy: ConflictResolutionStrategy<T>
) {
  return useOptimistic(form, submitFn, {
    ...options,
    onConfirm: (actualData) => {
      const optimistic = options.getOptimisticData(form.value.value);

      // Проверить конфликты
      if (conflictStrategy.detectConflict(optimistic, actualData)) {
        console.warn('Обнаружен конфликт между оптимистичными и фактическими данными');

        // Разрешить конфликт
        const resolved = conflictStrategy.resolveConflict(optimistic, actualData);

        // Уведомить
        if (conflictStrategy.onConflict) {
          conflictStrategy.onConflict(optimistic, actualData, resolved);
        }

        // Использовать разрешенные данные
        options.onConfirm?.(resolved);
      } else {
        // Нет конфликта, использовать фактические данные
        options.onConfirm?.(actualData);
      }
    },
  });
}
```

### Использование разрешения конфликтов

```tsx title="src/components/ApplicationsList.tsx"
const { submit } = useOptimisticWithConflictResolution(
  form,
  submitFn,
  {
    getOptimisticData: (formData) => ({
      id: `temp-${Date.now()}`,
      status: 'pending',
      loanAmount: formData.step1.loanAmount,
    }),
    onOptimisticUpdate: (data) => {
      setApplications((prev) => [data, ...prev]);
    },
    onConfirm: (data) => {
      setApplications((prev) =>
        prev.map((app) => (app._optimistic ? data : app))
      );
    },
    onRollback: (data) => {
      setApplications((prev) =>
        prev.filter((app) => app.id !== data.id)
      );
    },
  },
  {
    detectConflict: (optimistic, actual) => {
      // Проверить если сервер назначил другой статус
      return optimistic.status !== actual.status;
    },
    resolveConflict: (optimistic, actual) => {
      // Сервер выигрывает
      return actual;
    },
    onConflict: (optimistic, actual, resolved) => {
      console.log('Конфликт разрешен:', { optimistic, actual, resolved });
      // Опционально показать уведомление пользователю
      showNotification('Статус заявки был обновлен сервером');
    },
  }
);
```

## Индикаторы оптимистичных обновлений

Визуальные индикаторы для отображения оптимистичного состояния.

### Оптимистичный значок

```tsx title="src/components/OptimisticBadge.tsx"
export function OptimisticBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
      <svg
        className="animate-spin h-3 w-3"
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
      Сохранение...
    </span>
  );
}
```

### Оптимистичный оверлей

```tsx title="src/components/OptimisticOverlay.tsx"
interface OptimisticOverlayProps {
  isOptimistic: boolean;
  children: React.ReactNode;
}

export function OptimisticOverlay({
  isOptimistic,
  children
}: OptimisticOverlayProps) {
  return (
    <div className="relative">
      {children}
      {isOptimistic && (
        <div className="absolute inset-0 bg-blue-50 bg-opacity-50 rounded-lg flex items-center justify-center">
          <div className="bg-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <svg
              className="animate-spin h-4 w-4 text-blue-600"
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
            <span className="text-sm text-gray-700">Отправляется...</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

## Полный пример

```tsx title="src/components/CreditApplicationForm.tsx"
import { useState, useMemo } from 'react';
import { createCreditApplicationForm } from '../schemas/create-form';
import { creditApplicationTransformer } from '../utils/credit-application-transformer';
import { submitApplication } from '../services/api/submission.api';
import { useOptimistic } from '../hooks/useOptimistic';
import { OptimisticOverlay } from './OptimisticOverlay';
import { FormRenderer } from './FormRenderer';

interface Application {
  id: string;
  status: string;
  loanAmount: number;
  submittedAt: string;
  _optimistic?: boolean;
}

export function CreditApplicationForm() {
  const [applications, setApplications] = useState<Application[]>([]);
  const form = useMemo(() => createCreditApplicationForm(), []);
  const [error, setError] = useState<string | null>(null);

  const { submit, isOptimistic } = useOptimistic<Application>(
    form,
    async (data) => {
      const apiData = creditApplicationTransformer.serialize(data);
      return await submitApplication(apiData);
    },
    {
      getOptimisticData: (formData) => ({
        id: `temp-${Date.now()}`,
        status: 'pending',
        loanAmount: formData.step1.loanAmount,
        submittedAt: new Date().toISOString(),
        _optimistic: true,
      }),
      onOptimisticUpdate: (optimisticApp) => {
        console.log('Добавление оптимистичной заявки:', optimisticApp);
        setApplications((prev) => [optimisticApp, ...prev]);
        setError(null);
      },
      onConfirm: (actualApp) => {
        console.log('Подтверждение заявки:', actualApp);
        setApplications((prev) =>
          prev.map((app) =>
            app._optimistic ? { ...actualApp, _optimistic: false } : app
          )
        );
      },
      onRollback: (optimisticApp) => {
        console.log('Откат заявки:', optimisticApp);
        setApplications((prev) =>
          prev.filter((app) => app.id !== optimisticApp.id)
        );
      },
      onError: (err) => {
        setError(err.message);
      },
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await submit();
      form.reset();
    } catch (error) {
      console.error('Отправка не удалась:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Заявка на кредит</h1>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <FormRenderer form={form} />

        <button
          type="submit"
          disabled={isOptimistic}
          className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isOptimistic ? 'Отправляется...' : 'Отправить заявку'}
        </button>
      </form>

      <div className="mt-12">
        <h2 className="text-2xl font-bold mb-4">Ваши заявки</h2>

        {applications.length === 0 ? (
          <p className="text-gray-500">Еще нет заявок</p>
        ) : (
          <div className="space-y-4">
            {applications.map((app) => (
              <OptimisticOverlay key={app.id} isOptimistic={!!app._optimistic}>
                <ApplicationCard application={app} />
              </OptimisticOverlay>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

## Тестирование оптимистичных обновлений

```typescript title="src/components/CreditApplicationForm.test.tsx"
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreditApplicationForm } from './CreditApplicationForm';
import { submitApplication } from '../services/api/submission.api';

jest.mock('../services/api/submission.api');

describe('CreditApplicationForm - Оптимистичные обновления', () => {
  test('добавляет заявку оптимистично', async () => {
    (submitApplication as jest.Mock).mockResolvedValue({
      id: 'app-123',
      status: 'approved',
      loanAmount: 50000,
    });

    render(<CreditApplicationForm />);

    // Изначально нет заявок
    expect(screen.getByText('Еще нет заявок')).toBeInTheDocument();

    // Отправить форму
    fireEvent.click(screen.getByText('Отправить заявку'));

    // Должно немедленно показать оптимистичную заявку
    await waitFor(() => {
      expect(screen.queryByText('Еще нет заявок')).not.toBeInTheDocument();
      expect(screen.getByText(/Отправляется.../i)).toBeInTheDocument();
    });
  });

  test('подтверждает оптимистичное обновление при успехе', async () => {
    (submitApplication as jest.Mock).mockResolvedValue({
      id: 'app-123',
      status: 'approved',
      loanAmount: 50000,
    });

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Отправить заявку'));

    // Дождаться подтверждения
    await waitFor(() => {
      expect(screen.queryByText(/Отправляется.../i)).not.toBeInTheDocument();
      expect(screen.getByText(/app-123/i)).toBeInTheDocument();
    });
  });

  test('откатывает оптимистичное обновление при ошибке', async () => {
    (submitApplication as jest.Mock).mockRejectedValue(
      new Error('Ошибка сети')
    );

    render(<CreditApplicationForm />);

    fireEvent.click(screen.getByText('Отправить заявку'));

    // Должно показать оптимистичную заявку
    await waitFor(() => {
      expect(screen.getByText(/Отправляется.../i)).toBeInTheDocument();
    });

    // Должно откатить после ошибки
    await waitFor(() => {
      expect(screen.queryByText(/Отправляется.../i)).not.toBeInTheDocument();
      expect(screen.getByText('Еще нет заявок')).toBeInTheDocument();
      expect(screen.getByText(/Ошибка сети/i)).toBeInTheDocument();
    });
  });
});
```

## Лучшие практики

### 1. Всегда помечайте оптимистичные данные

```typescript
// ✅ ХОРОШО: Пометить флагом _optimistic
{ id: 'temp-123', status: 'pending', _optimistic: true }

// ❌ ПЛОХО: Нет способа идентифицировать оптимистичные данные
{ id: 'temp-123', status: 'pending' }
```

### 2. Используйте временные ID

```typescript
// ✅ ХОРОШО: Уникальный временный ID
id: `temp-${Date.now()}-${Math.random()}`

// ❌ ПЛОХО: Может конфликтовать
id: 'temp'
```

### 3. Всегда реализуйте откат

```typescript
// ✅ ХОРОШО: Правильный откат
onRollback: (optimistic) => {
  setItems(prev => prev.filter(item => item.id !== optimistic.id));
}

// ❌ ПЛОХО: Нет отката
onRollback: () => {} // Оптимистичные данные остаются!
```

### 4. Показывайте визуальные индикаторы

```tsx
// ✅ ХОРОШО: Четкий индикатор оптимистичности
{item._optimistic && <OptimisticBadge />}

// ❌ ПЛОХО: Нет индикации
// Пользователь не может сказать что подтверждено vs ожидает
```

### 5. Не используйте для критических операций

```typescript
// ❌ ПЛОХО: Оптимистично для платежа
onOptimisticUpdate: () => {
  setBalance(prev => prev - amount); // Никогда не делайте это!
}

// ✅ ХОРОШО: Подождите подтверждения
await submit();
setBalance(newBalance); // Только после подтверждения сервером
```

## Ключевые моменты

- Оптимистичные обновления улучшают воспринимаемую производительность
- Всегда помечайте оптимистичные данные флагом
- Реализуйте правильный откат при ошибке
- Используйте визуальные индикаторы для оптимистичного состояния
- Не используйте для критических операций
- Протестируйте оба сценария: успех и откат
- Рассмотрите стратегии разрешения конфликтов

## Что дальше?

Вы реализовали оптимистичные обновления! Далее мы будем обрабатывать **многошаговую отправку**:

- Пошаговая валидация
- Навигация между шагами
- Страница проверки перед отправкой
- Редактирование из проверки
- Индикаторы шагов
- Полный многошаговый рабочий процесс

В следующем разделе мы создадим профессиональный опыт многошаговой формы.
