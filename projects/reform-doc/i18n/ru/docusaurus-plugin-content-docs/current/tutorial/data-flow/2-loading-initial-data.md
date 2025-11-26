---
sidebar_position: 2
---

# Загрузка начальных данных

Загрузка данных формы из API, localStorage или других источников.

## Что мы строим

Мы создадим систему для загрузки начальных данных в нашу форму кредитного заявления из нескольких источников:

| Источник | Приоритет | Сценарий использования |
|----------|-----------|----------------------|
| API | 1 (Высший) | Редактирование существующего заявления |
| localStorage | 2 | Возобновление сохранённого черновика |
| Профиль пользователя | 3 | Предзаполнение нового заявления |
| По умолчанию | 4 (Низший) | Пустая форма |

## Создание сервиса API

Сначала создадим сервис API для загрузки приложений:

```bash
mkdir -p src/services/api
touch src/services/api/application.api.ts
```

### Реализация

```typescript title="src/services/api/application.api.ts"
import type { CreditApplicationForm } from '@/types';

/**
 * Сервис API для операций с кредитным заявлением
 */

// Базовый URL API
const API_BASE = '/api/applications';

/**
 * Загрузка заявления по ID
 */
export async function loadApplication(id: string): Promise<CreditApplicationForm> {
  const response = await fetch(`${API_BASE}/${id}`);

  if (!response.ok) {
    throw new Error(`Ошибка загрузки заявления: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Проверка, существует ли заявление
 */
export async function applicationExists(id: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/${id}/exists`);
    const result = await response.json();
    return result.exists;
  } catch {
    return false;
  }
}

/**
 * Получение статуса заявления
 */
export async function getApplicationStatus(id: string): Promise<string> {
  const response = await fetch(`${API_BASE}/${id}/status`);
  const result = await response.json();
  return result.status;
}
```

## Создание хука загрузки данных

Создадим хук для обработки загрузки данных с правильным управлением состоянием:

```bash
mkdir -p src/hooks
touch src/hooks/useDataLoader.ts
```

### Реализация

```typescript title="src/hooks/useDataLoader.ts"
import { useState, useEffect } from 'react';
import type { FormNode } from 'reformer';
import { loadApplication } from '@/services/api/application.api';

/**
 * Состояния загрузки
 */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Хук для загрузки начальных данных формы
 */
export function useDataLoader(form: FormNode, applicationId?: string) {
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Нет ID - пропускаем загрузку
    if (!applicationId) {
      setState('idle');
      return;
    }

    // Начинаем загрузку
    setState('loading');
    setError(null);

    loadApplication(applicationId)
      .then((data) => {
        // Патчируем форму загруженными данными
        form.patchValue(data);
        setState('success');
      })
      .catch((err) => {
        console.error('Ошибка загрузки заявления:', err);
        setError(err);
        setState('error');
      });
  }, [applicationId, form]);

  return {
    state,
    loading: state === 'loading',
    error,
    isSuccess: state === 'success',
    isError: state === 'error',
  };
}
```

## Загрузка из localStorage

Создадим сервис для загрузки черновиков из localStorage:

```bash
mkdir -p src/services/storage
touch src/services/storage/draft.storage.ts
```

### Реализация

```typescript title="src/services/storage/draft.storage.ts"
/**
 * Сервис localStorage для черновиков
 */

const DRAFT_KEY_PREFIX = 'credit-application-draft-';

/**
 * Сохранение черновика в localStorage
 */
export function saveDraftToStorage(draftId: string, data: any): void {
  try {
    const key = `${DRAFT_KEY_PREFIX}${draftId}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error('Ошибка сохранения черновика в хранилище:', error);
  }
}

/**
 * Загрузка черновика из localStorage
 */
export function loadDraftFromStorage(draftId: string): any | null {
  try {
    const key = `${DRAFT_KEY_PREFIX}${draftId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Ошибка загрузки черновика из хранилища:', error);
    return null;
  }
}

/**
 * Проверка, существует ли черновик в хранилище
 */
export function draftExistsInStorage(draftId: string): boolean {
  const key = `${DRAFT_KEY_PREFIX}${draftId}`;
  return localStorage.getItem(key) !== null;
}

/**
 * Удаление черновика из хранилища
 */
export function deleteDraftFromStorage(draftId: string): void {
  try {
    const key = `${DRAFT_KEY_PREFIX}${draftId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Ошибка удаления черновика из хранилища:', error);
  }
}

/**
 * Получение всех ID черновиков из хранилища
 */
export function getAllDraftIds(): string[] {
  const ids: string[] = [];

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(DRAFT_KEY_PREFIX)) {
        const id = key.substring(DRAFT_KEY_PREFIX.length);
        ids.push(id);
      }
    }
  } catch (error) {
    console.error('Ошибка получения ID черновиков:', error);
  }

  return ids;
}
```

## Загрузка с приоритетом

Создадим продвинутый загрузчик, который проверяет несколько источников:

```typescript title="src/hooks/useDataLoader.ts"
import { loadDraftFromStorage } from '@/services/storage/draft.storage';

/**
 * Загрузка данных из нескольких источников с приоритетом
 */
export function useDataLoaderWithPriority(
  form: FormNode,
  options: {
    applicationId?: string;
    draftId?: string;
    defaultData?: any;
  }
) {
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [source, setSource] = useState<'api' | 'storage' | 'default' | null>(null);

  useEffect(() => {
    const { applicationId, draftId, defaultData } = options;

    async function loadData() {
      setState('loading');
      setError(null);

      try {
        // Приоритет 1: Попытка загрузки из API
        if (applicationId) {
          try {
            const data = await loadApplication(applicationId);
            form.patchValue(data);
            setSource('api');
            setState('success');
            return;
          } catch (apiError) {
            console.warn('Загрузка из API не удалась, пробуем localStorage:', apiError);
          }
        }

        // Приоритет 2: Попытка загрузки из localStorage
        if (draftId) {
          const draftData = loadDraftFromStorage(draftId);
          if (draftData) {
            form.patchValue(draftData);
            setSource('storage');
            setState('success');
            return;
          }
        }

        // Приоритет 3: Использование данных по умолчанию
        if (defaultData) {
          form.patchValue(defaultData);
          setSource('default');
          setState('success');
          return;
        }

        // Данные не загружены
        setState('idle');
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        setError(err as Error);
        setState('error');
      }
    }

    loadData();
  }, [options.applicationId, options.draftId, form]);

  return {
    state,
    loading: state === 'loading',
    error,
    source,
    isSuccess: state === 'success',
    isError: state === 'error',
  };
}
```

## Интеграция с компонентом формы

Теперь интегрируем загрузчик данных с компонентом формы:

```typescript title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { useDataLoader } from '@/hooks/useDataLoader';

interface CreditApplicationFormProps {
  applicationId?: string;
}

export function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  // Создание формы
  const form = useMemo(() => createCreditApplicationForm(), []);

  // Загрузка данных
  const { loading, error } = useDataLoader(form, applicationId);

  // Состояние загрузки
  if (loading) {
    return (
      <div className="loading-container">
        <Spinner />
        <p>Загрузка заявления...</p>
      </div>
    );
  }

  // Состояние ошибки
  if (error) {
    return (
      <div className="error-container">
        <ErrorIcon />
        <h2>Ошибка загрузки заявления</h2>
        <p>{error.message}</p>
        <button onClick={() => window.location.reload()}>Повторить</button>
      </div>
    );
  }

  // Успех - отрисовка формы
  return (
    <div className="form-container">
      <h1>{applicationId ? 'Редактирование заявления' : 'Новое заявление'}</h1>
      <FormRenderer form={form} />
    </div>
  );
}
```

## Продвинутое: Загрузка с преобразованием

Часто данные API требуют преобразования перед загрузкой в форму:

```typescript title="src/hooks/useDataLoader.ts"
import { creditApplicationTransformer } from '@/services/data-transform.service';

export function useDataLoaderWithTransform(
  form: FormNode,
  applicationId?: string
) {
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!applicationId) {
      setState('idle');
      return;
    }

    setState('loading');
    setError(null);

    loadApplication(applicationId)
      .then((apiData) => {
        // Преобразование данных API в формат формы
        const formData = creditApplicationTransformer.deserialize(apiData);

        // Патчирование формы
        form.patchValue(formData);

        setState('success');
      })
      .catch((err) => {
        console.error('Ошибка загрузки заявления:', err);
        setError(err);
        setState('error');
      });
  }, [applicationId, form]);

  return { state, loading: state === 'loading', error };
}
```

## Обработка состояний загрузки в UI

Создадим переиспользуемые компоненты для состояний загрузки:

```tsx title="src/components/LoadingStates.tsx"
import { ReactNode } from 'react';

interface LoadingBoundaryProps {
  loading: boolean;
  error: Error | null;
  loadingComponent?: ReactNode;
  errorComponent?: ReactNode;
  children: ReactNode;
}

export function LoadingBoundary({
  loading,
  error,
  loadingComponent,
  errorComponent,
  children,
}: LoadingBoundaryProps) {
  if (loading) {
    return loadingComponent || <DefaultLoadingComponent />;
  }

  if (error) {
    return errorComponent || <DefaultErrorComponent error={error} />;
  }

  return <>{children}</>;
}

function DefaultLoadingComponent() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center">
        <Spinner className="w-12 h-12 mx-auto mb-4" />
        <p className="text-gray-600">Загрузка...</p>
      </div>
    </div>
  );
}

function DefaultErrorComponent({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="text-center max-w-md">
        <ErrorIcon className="w-12 h-12 mx-auto mb-4 text-red-500" />
        <h2 className="text-xl font-semibold mb-2">Ошибка загрузки</h2>
        <p className="text-gray-600 mb-4">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Повторить
        </button>
      </div>
    </div>
  );
}
```

Использование с LoadingBoundary:

```tsx title="src/components/CreditApplicationForm.tsx"
export function CreditApplicationForm({ applicationId }: CreditApplicationFormProps) {
  const form = useMemo(() => createCreditApplicationForm(), []);
  const { loading, error } = useDataLoader(form, applicationId);

  return (
    <LoadingBoundary loading={loading} error={error}>
      <div className="form-container">
        <FormRenderer form={form} />
      </div>
    </LoadingBoundary>
  );
}
```

## Тестирование сценариев загрузки

Протестируйте эти сценарии:

### Сценарий 1: Загрузка существующего заявления
- [ ] Предоставьте prop `applicationId`
- [ ] Смотрите спиннер загрузки
- [ ] Форма загружается с данными
- [ ] Все поля заполнены правильно
- [ ] Поведения пересчитываются (процентная ставка, ежемесячный платёж)
- [ ] Валидация запускается на загруженных данных

### Сценарий 2: Загрузка из черновика
- [ ] Предоставьте prop `draftId`
- [ ] Данные загружаются из localStorage
- [ ] Форма заполнена данными черновика
- [ ] Можно продолжить редактирование

### Сценарий 3: Новое заявление
- [ ] Нет `applicationId` или `draftId`
- [ ] Форма начинается пустой
- [ ] Нет спиннера загрузки
- [ ] Готово к заполнению

### Сценарий 4: Ошибка API
- [ ] Неверный `applicationId`
- [ ] Смотрите сообщение об ошибке
- [ ] Можно повторить загрузку
- [ ] Форма не падает

### Сценарий 5: Сеть в автономном режиме
- [ ] Нет интернета
- [ ] Откат на сохранённый черновик localStorage
- [ ] Показывает соответствующее сообщение

## Ключевые выводы

1. **patchValue** - Используйте `form.patchValue(data)` для загрузки данных в форму
2. **Состояния загрузки** - Всегда обрабатывайте состояния загрузки, ошибки и успеха
3. **Приоритет** - Загружайте сначала из API, откатывайтесь на localStorage
4. **Преобразование** - Преобразуйте данные API перед загрузкой
5. **Поведения срабатывают** - Вычисляемые поля пересчитываются автоматически
6. **Валидация запускается** - Валидация проверяет загруженные данные

## Распространённые паттерны

### Простая загрузка
```typescript
const { loading, error } = useDataLoader(form, applicationId);
```

### Загрузка с преобразованием
```typescript
const data = await loadApplication(id);
const transformed = transformer.deserialize(data);
form.patchValue(transformed);
```

### Загрузка из нескольких источников
```typescript
const { loading, error, source } = useDataLoaderWithPriority(form, {
  applicationId,
  draftId,
  defaultData,
});
```

### Граница загрузки
```tsx
<LoadingBoundary loading={loading} error={error}>
  <FormRenderer form={form} />
</LoadingBoundary>
```

## Что дальше?

В следующем разделе мы добавим функцию **Автосохранения**:
- Автосохранение каждые 30 секунд
- Сохранение при выгрузке страницы
- Показ индикатора состояния сохранения
- Предотвращение потери данных
- Интеграция с загрузкой

Данные, которые мы загружаем, будут автоматически сохраняться по мере редактирования пользователем!
