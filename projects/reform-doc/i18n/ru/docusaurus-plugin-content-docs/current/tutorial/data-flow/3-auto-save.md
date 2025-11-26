---
sidebar_position: 3
---

# Автосохранение

Автоматическое сохранение прогресса формы для предотвращения потери данных.

## Что мы строим

Мы реализуем систему автосохранения, которая:

- **Автосохраняет** каждые 30 секунд при изменении формы
- **Debounces** для предотвращения избыточных сохранений
- **Показывает статус** (простой, сохранение, сохранено, ошибка)
- **Сохраняет при выгрузке страницы** для предотвращения потери данных
- **Сохраняет в localStorage** и/или API
- **Интегрируется** с существующей загрузкой данных

## Почему автосохранение?

Без автосохранения пользователи могут потерять свой прогресс:

```tsx
// ❌ Пользователь заполняет форму 20 минут
// Браузер падает, отключение электричества, случайное закрытие
// Все данные потеряны!
```

С автосохранением:

```tsx
// ✅ Форма сохраняется каждые 30 секунд автоматически
// Браузер упал? Перезагрузитесь и продолжайте с последнего сохранения
// Случайное закрытие? Предупреждение и данные сохранены
```

Преимущества:
- **Предотвращает потерю данных** - Прогресс сохраняется непрерывно
- **Лучше UX** - Пользователи не беспокоятся о потере работы
- **Восстановление** - Можно возобновить с любого устройства/сеанса
- **Спокойствие** - Автоматическое, не требует ручного действия

## Создание сервиса автосохранения

Сначала создадим основной сервис автосохранения:

```bash
touch src/services/auto-save.service.ts
```

### Реализация

```typescript title="src/services/auto-save.service.ts"
import type { FormNode } from 'reformer';

/**
 * Опции конфигурации автосохранения
 */
export interface AutoSaveOptions {
  /** Задержка debounce в миллисекундах */
  debounce: number;
  /** Функция для сохранения данных формы */
  saveFn: (data: any) => Promise<void>;
  /** Вызывается при успешном сохранении */
  onSaved?: () => void;
  /** Вызывается при ошибке сохранения */
  onError?: (error: Error) => void;
  /** Вызывается при начале сохранения */
  onSaving?: () => void;
}

/**
 * Экземпляр автосохранения
 */
export interface AutoSaveInstance {
  /** Уничтожение автосохранения (очистка) */
  destroy: () => void;
  /** Принудительное сохранение сразу же */
  saveNow: () => Promise<void>;
  /** Приостановка автосохранения */
  pause: () => void;
  /** Возобновление автосохранения */
  resume: () => void;
}

/**
 * Создание сервиса автосохранения для формы
 */
export function createAutoSave(
  form: FormNode,
  options: AutoSaveOptions
): AutoSaveInstance {
  const { debounce, saveFn, onSaved, onError, onSaving } = options;

  let saveTimeout: NodeJS.Timeout | null = null;
  let isPaused = false;
  let isDestroyed = false;

  // Подписка на изменения значения формы
  const subscription = form.value.subscribe((value) => {
    // Пропускаем, если приостановлено или уничтожено
    if (isPaused || isDestroyed) return;

    // Очищаем существующий тайм-аут
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    // Планируем новое сохранение
    saveTimeout = setTimeout(() => {
      performSave(value);
    }, debounce);
  });

  // Выполнение фактического сохранения
  async function performSave(value: any) {
    if (isDestroyed) return;

    try {
      onSaving?.();
      await saveFn(value);
      onSaved?.();
    } catch (error) {
      console.error('Ошибка автосохранения:', error);
      onError?.(error as Error);
    }
  }

  // Принудительное сохранение сразу же
  async function saveNow() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }

    return performSave(form.value.value);
  }

  // Приостановка автосохранения
  function pause() {
    isPaused = true;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  }

  // Возобновление автосохранения
  function resume() {
    isPaused = false;
  }

  // Очистка
  function destroy() {
    isDestroyed = true;
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    subscription.unsubscribe();
  }

  return {
    destroy,
    saveNow,
    pause,
    resume,
  };
}
```

## Создание хука useAutoSave

Создадим React хук для простой интеграции:

```bash
touch src/hooks/useAutoSave.ts
```

### Реализация

```typescript title="src/hooks/useAutoSave.ts"
import { useEffect, useState, useRef } from 'react';
import type { FormNode } from 'reformer';
import { createAutoSave } from '@/services/auto-save.service';
import type { AutoSaveOptions } from '@/services/auto-save.service';

/**
 * Состояния статуса сохранения
 */
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * Тип возврата хука
 */
export interface UseAutoSaveReturn {
  /** Текущий статус сохранения */
  status: SaveStatus;
  /** Ошибка, если сохранение не удалось */
  error: Error | null;
  /** Принудительное сохранение сейчас */
  saveNow: () => Promise<void>;
  /** Приостановка автосохранения */
  pause: () => void;
  /** Возобновление автосохранения */
  resume: () => void;
}

/**
 * Хук для автосохранения данных формы
 */
export function useAutoSave(
  form: FormNode,
  options: AutoSaveOptions
): UseAutoSaveReturn {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const autoSaveRef = useRef<ReturnType<typeof createAutoSave> | null>(null);

  useEffect(() => {
    // Создание экземпляра автосохранения
    const autoSave = createAutoSave(form, {
      ...options,
      saveFn: async (data) => {
        setStatus('saving');
        setError(null);

        try {
          await options.saveFn(data);
          setStatus('saved');

          // Возврат в простое состояние через 2 секунды
          setTimeout(() => {
            setStatus('idle');
          }, 2000);
        } catch (err) {
          console.error('Ошибка автосохранения:', err);
          setStatus('error');
          setError(err as Error);
          throw err;
        }
      },
    });

    autoSaveRef.current = autoSave;

    // Сохранение при выгрузке страницы
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Сохраняем только если форма изменилась
      if (form.isDirty.value) {
        // Сохраняем сразу же
        autoSave.saveNow();

        // Предупреждаем пользователя
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Очистка
    return () => {
      autoSave.destroy();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [form, options]);

  // Принудительное сохранение сейчас
  const saveNow = async () => {
    if (autoSaveRef.current) {
      return autoSaveRef.current.saveNow();
    }
  };

  // Приостановка автосохранения
  const pause = () => {
    autoSaveRef.current?.pause();
  };

  // Возобновление автосохранения
  const resume = () => {
    autoSaveRef.current?.resume();
  };

  return {
    status,
    error,
    saveNow,
    pause,
    resume,
  };
}
```

## Создание индикатора статуса сохранения

Создадим компонент UI для показа статуса сохранения:

```bash
touch src/components/AutoSaveIndicator.tsx
```

### Реализация

```tsx title="src/components/AutoSaveIndicator.tsx"
import { SaveStatus } from '@/hooks/useAutoSave';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
  error?: Error | null;
}

export function AutoSaveIndicator({ status, error }: AutoSaveIndicatorProps) {
  return (
    <div className="auto-save-indicator">
      {status === 'saving' && (
        <div className="flex items-center text-blue-600">
          <Spinner className="w-4 h-4 mr-2" />
          <span>Сохранение...</span>
        </div>
      )}

      {status === 'saved' && (
        <div className="flex items-center text-green-600">
          <CheckIcon className="w-4 h-4 mr-2" />
          <span>Сохранено</span>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-center text-red-600">
          <ErrorIcon className="w-4 h-4 mr-2" />
          <span>Ошибка сохранения</span>
          {error && (
            <span className="text-sm ml-2">({error.message})</span>
          )}
        </div>
      )}

      {status === 'idle' && (
        <div className="flex items-center text-gray-400">
          <ClockIcon className="w-4 h-4 mr-2" />
          <span>Автосохранение включено</span>
        </div>
      )}
    </div>
  );
}

// Компоненты иконок (используйте вашу предпочитаемую библиотеку иконок)
function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="10" strokeWidth={2} />
      <path strokeLinecap="round" strokeWidth={2} d="M12 6v6l4 2" />
    </svg>
  );
}
```

## Сохранение в localStorage

Создадим функцию для сохранения черновиков в localStorage:

```typescript title="src/services/storage/draft.storage.ts"
// Добавить к существующему файлу

/**
 * Сохранение текущего черновика
 */
export function saveCurrentDraft(data: any): void {
  saveDraftToStorage('current', {
    data,
    timestamp: Date.now(),
  });
}

/**
 * Загрузка текущего черновика
 */
export function loadCurrentDraft(): any | null {
  const draft = loadDraftFromStorage('current');
  return draft?.data || null;
}

/**
 * Очистка текущего черновика
 */
export function clearCurrentDraft(): void {
  deleteDraftFromStorage('current');
}
```

## Сохранение в API

Создадим сервис API для сохранения черновиков:

```typescript title="src/services/api/application.api.ts"
// Добавить к существующему файлу

/**
 * Сохранение черновика заявления
 */
export async function saveDraft(data: any): Promise<void> {
  const response = await fetch(`${API_BASE}/draft`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Ошибка сохранения черновика: ${response.statusText}`);
  }
}

/**
 * Обновление существующего заявления
 */
export async function updateApplication(id: string, data: any): Promise<void> {
  const response = await fetch(`${API_BASE}/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Ошибка обновления заявления: ${response.statusText}`);
  }
}
```

## Интеграция с компонентом формы

Теперь интегрируем автосохранение с формой:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { useDataLoader } from '@/hooks/useDataLoader';
import { useAutoSave } from '@/hooks/useAutoSave';
import { saveCurrentDraft } from '@/services/storage/draft.storage';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';

interface CreditApplicationFormProps {
  applicationId?: string;
}

export function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  // Создание формы
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Загрузка начальных данных
  const { loading, error } = useDataLoader(form, applicationId);

  // Автосохранение
  const { status, error: saveError, saveNow } = useAutoSave(form, {
    debounce: 30000, // 30 секунд
    saveFn: async (data) => {
      // Сохранение в localStorage
      saveCurrentDraft(data);

      // При необходимости сохранение в API
      if (applicationId) {
        await updateApplication(applicationId, data);
      }
    },
  });

  // Состояние загрузки
  if (loading) {
    return <LoadingSpinner />;
  }

  // Состояние ошибки
  if (error) {
    return <ErrorMessage error={error} />;
  }

  return (
    <div className="form-container">
      {/* Индикатор автосохранения */}
      <div className="form-header">
        <h1>{applicationId ? 'Редактирование заявления' : 'Новое заявление'}</h1>
        <AutoSaveIndicator status={status} error={saveError} />
      </div>

      {/* Форма */}
      <FormRenderer form={form} />

      {/* Кнопка ручного сохранения (опционально) */}
      <button
        onClick={saveNow}
        disabled={status === 'saving'}
        className="save-button"
      >
        {status === 'saving' ? 'Сохранение...' : 'Сохранить сейчас'}
      </button>
    </div>
  );
}
```

## Двойная стратегия хранения

Сохранение в localStorage (мгновенно) и API (надёжно):

```typescript title="src/hooks/useAutoSave.ts"
export function useDualAutoSave(
  form: FormNode,
  applicationId?: string
) {
  return useAutoSave(form, {
    debounce: 30000,
    saveFn: async (data) => {
      // Сохранение в localStorage мгновенно (быстро, работает офлайн)
      try {
        saveCurrentDraft(data);
      } catch (error) {
        console.error('Ошибка сохранения в localStorage:', error);
      }

      // Сохранение в API (надёжно, кроссустройство)
      try {
        if (applicationId) {
          await updateApplication(applicationId, data);
        } else {
          await saveDraft(data);
        }
      } catch (error) {
        console.error('Ошибка сохранения в API:', error);
        // Не выбрасываем - сохранение в localStorage успешно
      }
    },
  });
}
```

## Продвинутое: Приостановка/возобновление автосохранения

Контроль автосохранения во время определённых операций:

```tsx title="src/components/CreditApplicationForm.tsx"
export function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const { status, pause, resume, saveNow } = useAutoSave(form, {
    debounce: 30000,
    saveFn: async (data) => saveCurrentDraft(data),
  });

  // Приостановка автосохранения во время отправки
  const handleSubmit = async () => {
    // Приостановка автосохранения
    pause();

    try {
      // Валидация
      await form.validateTree();

      if (form.isValid.value) {
        // Отправка
        await submitApplication(form.value.value);
        // Очистка черновика после успешной отправки
        clearCurrentDraft();
      }
    } finally {
      // Возобновление автосохранения
      resume();
    }
  };

  return (
    <div className="form-container">
      <AutoSaveIndicator status={status} />
      <FormRenderer form={form} />
      <button onClick={handleSubmit}>Отправить заявление</button>
    </div>
  );
}
```

## Тестирование автосохранения

Протестируйте эти сценарии:

### Сценарий 1: Базовое автосохранение
- [ ] Заполните поля формы
- [ ] Подождите 30 секунд
- [ ] Смотрите индикатор "Сохранение..."
- [ ] Смотрите индикатор "Сохранено"
- [ ] Данные сохранены в localStorage

### Сценарий 2: Debouncing
- [ ] Непрерывно печатайте в поле
- [ ] Автосохранение не срабатывает во время печати
- [ ] Остановитесь печатать
- [ ] Автосохранение срабатывает через 30 секунд
- [ ] Происходит только одно сохранение

### Сценарий 3: Выгрузка страницы
- [ ] Заполните форму с данными
- [ ] Попытайтесь закрыть вкладку/окно
- [ ] Смотрите предупреждение браузера
- [ ] Подтвердите закрытие
- [ ] Перезагрузите страницу
- [ ] Данные восстановлены

### Сценарий 4: Ошибка сохранения
- [ ] Отключите интернет
- [ ] Заполните форму
- [ ] Подождите автосохранения
- [ ] Смотрите индикатор ошибки
- [ ] Подключитесь к интернету
- [ ] Сохранение успешно

### Сценарий 5: Ручное сохранение
- [ ] Заполните форму
- [ ] Нажмите кнопку "Сохранить сейчас"
- [ ] Мгновенное сохранение (без задержки)
- [ ] Смотрите индикатор "Сохранено"

### Сценарий 6: Приостановка/возобновление
- [ ] Включено автосохранение
- [ ] Приостановите автосохранение
- [ ] Заполните форму
- [ ] Автосохранение не происходит
- [ ] Возобновите автосохранение
- [ ] Автосохранение работает снова

## Ключевые выводы

1. **Debounce** - Предотвращает избыточные сохранения во время печати
2. **Индикатор статуса** - Показывает пользователю, что происходит
3. **Выгрузка страницы** - Сохраняет перед уходом со страницы
4. **Двойное хранилище** - localStorage для скорости, API для надёжности
5. **Обработка ошибок** - Изящно обрабатывает ошибки сохранения
6. **Приостановка/возобновление** - Контроль, когда активно автосохранение
7. **Observable паттерн** - Подписка на изменения значений формы

## Распространённые паттерны

### Базовое автосохранение
```typescript
const { status } = useAutoSave(form, {
  debounce: 30000,
  saveFn: saveCurrentDraft,
});
```

### Автосохранение с API
```typescript
const { status } = useAutoSave(form, {
  debounce: 30000,
  saveFn: async (data) => {
    saveCurrentDraft(data); // localStorage
    await saveDraft(data);   // API
  },
});
```

### Кнопка ручного сохранения
```typescript
const { saveNow, status } = useAutoSave(form, options);

<button onClick={saveNow} disabled={status === 'saving'}>
  Сохранить сейчас
</button>
```

### Приостановка во время операций
```typescript
const { pause, resume } = useAutoSave(form, options);

const handleSubmit = async () => {
  pause();
  try {
    await submitForm();
  } finally {
    resume();
  }
};
```

## Лучшие практики

1. **Выберите подходящую задержку** - 30 секунд - хороший стандарт
2. **Показывайте статус пользователю** - Не сохраняйте в тишине
3. **Обрабатывайте ошибки красиво** - Не блокируйте пользователя
4. **Сохраняйте при выгрузке страницы** - Предотвращайте потерю данных
5. **Используйте localStorage как резервную копию** - Работает офлайн
6. **Приостановьте во время отправки** - Избегайте конфликтов
7. **Очищайте подписки** - Предотвращайте утечки памяти

## Что дальше?

В следующем разделе мы добавим функцию **Управление черновиками**:
- Создание именованных черновиков
- Список всех черновиков
- Загрузка конкретного черновика
- Удаление черновиков
- Автосохранение в текущий черновик
- Переключение между черновиками

Опираясь на автосохранение, мы позволим пользователям управлять несколькими черновиками!
