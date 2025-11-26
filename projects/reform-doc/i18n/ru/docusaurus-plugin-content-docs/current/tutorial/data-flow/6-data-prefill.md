---
sidebar_position: 6
---

# Предзаполнение данных

Предварительное заполнение полей формы из внешних источников данных, таких как профили пользователей.

## Что мы строим

Интеллектуальная система предзаполнения, которая:

- **Загружает профиль пользователя** из API
- **Выборочно предзаполняет** определённые поля
- **Умное объединение** - не перезаписывает заполненные поля
- **Настраиваемая** - выберите, какие поля предзаполнять
- **Ручное срабатывание** - пользователь контролирует предзаполнение
- **Предпросмотр изменений** - покажите, что будет заполнено
- **Отмена предзаполнения** - реверт если нежелательно

## Почему предзаполнение?

Предзаполнение улучшает пользовательский опыт:

- **Экономит время** - Нет повторного ввода известной информации
- **Снижает ошибки** - Точные данные из профиля
- **Удобство** - Заполнение формы одним щелчком
- **Согласованность** - Одни и те же данные во всех приложениях

Пример: Форма кредитного заявления может предзаполнять:
- Личные данные (имя, дата рождения)
- Контактная информация (телефон, email, адрес)
- Документы (паспорт, ИНН, СНИЛС)
- Трудоустройство (компания, должность)

## Структура данных профиля пользователя

Определим интерфейс профиля:

```typescript title="src/types/user-profile.types.ts"
/**
 * Данные профиля пользователя
 */
export interface UserProfile {
  /** Личная информация */
  personalData: {
    firstName: string;
    lastName: string;
    middleName?: string;
    birthDate: string; // ISO строка даты
    gender?: 'male' | 'female';
  };

  /** Контактная информация */
  contacts: {
    phone: string;
    email: string;
    registrationAddress: Address;
    residenceAddress?: Address;
  };

  /** Данные паспорта */
  passport?: {
    series: string;
    number: string;
    issuedBy: string;
    issueDate: string;
    departmentCode: string;
    birthPlace: string;
  };

  /** Номер налогоплательщика */
  inn?: string;

  /** Страховой номер */
  snils?: string;

  /** Информация о трудоустройстве */
  employment?: {
    company: string;
    position: string;
    startDate: string;
    income: number;
  };
}

/**
 * Структура адреса
 */
export interface Address {
  postalCode: string;
  country: string;
  region: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
}
```

## Создание сервиса API профиля пользователя

Создадим сервис API для загрузки профиля пользователя:

```bash
touch src/services/api/user-profile.api.ts
```

### Реализация

```typescript title="src/services/api/user-profile.api.ts"
import type { UserProfile } from '@/types/user-profile.types';

/**
 * Базовый URL API для профиля пользователя
 */
const API_BASE = '/api/user/profile';

/**
 * Загрузка профиля пользователя
 */
export async function loadUserProfile(): Promise<UserProfile> {
  const response = await fetch(API_BASE);

  if (!response.ok) {
    throw new Error(`Ошибка загрузки профиля пользователя: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Проверка, есть ли профиль у пользователя
 */
export async function hasUserProfile(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/exists`);
    const result = await response.json();
    return result.exists;
  } catch {
    return false;
  }
}

/**
 * Получение процента заполненности профиля
 */
export async function getProfileCompleteness(): Promise<number> {
  try {
    const response = await fetch(`${API_BASE}/completeness`);
    const result = await response.json();
    return result.percentage;
  } catch {
    return 0;
  }
}
```

## Создание сервиса предзаполнения

Создадим сервис для сопоставления данных профиля с данными формы:

```bash
touch src/services/data-prefill.service.ts
```

### Реализация

```typescript title="src/services/data-prefill.service.ts"
import type { UserProfile } from '@/types/user-profile.types';

/**
 * Опции предзаполнения
 */
export interface PrefillOptions {
  /** Конкретные поля для предзаполнения (если не предоставлено, предзаполняем все) */
  fields?: string[];
  /** Перезаписать существующие значения */
  overwrite?: boolean;
  /** Преобразовать данные перед предзаполнением */
  transform?: (data: any) => any;
}

/**
 * Результат предзаполнения
 */
export interface PrefillResult {
  /** Данные для предзаполнения */
  data: any;
  /** Поля, которые будут изменены */
  changedFields: string[];
  /** Поля, которые были пропущены (уже заполнены) */
  skippedFields: string[];
}

/**
 * Сопоставление профиля пользователя с данными формы
 */
export function mapProfileToFormData(profile: UserProfile): any {
  return {
    // Личные данные
    personalData: {
      firstName: profile.personalData.firstName,
      lastName: profile.personalData.lastName,
      middleName: profile.personalData.middleName,
      birthDate: new Date(profile.personalData.birthDate),
      gender: profile.personalData.gender,
    },

    // Контакты
    phoneMain: profile.contacts.phone,
    email: profile.contacts.email,

    // Адрес регистрации
    registrationAddress: profile.contacts.registrationAddress,

    // Адрес проживания (если такой же как регистрация)
    residenceAddress: profile.contacts.residenceAddress || profile.contacts.registrationAddress,
    isSameAddress: !profile.contacts.residenceAddress,

    // Паспорт
    ...(profile.passport && {
      passportData: {
        series: profile.passport.series,
        number: profile.passport.number,
        issuedBy: profile.passport.issuedBy,
        issueDate: new Date(profile.passport.issueDate),
        departmentCode: profile.passport.departmentCode,
        birthPlace: profile.passport.birthPlace,
      },
    }),

    // ИНН
    ...(profile.inn && { inn: profile.inn }),

    // СНИЛС
    ...(profile.snils && { snils: profile.snils }),

    // Трудоустройство
    ...(profile.employment && {
      employment: {
        company: profile.employment.company,
        position: profile.employment.position,
        startDate: new Date(profile.employment.startDate),
        monthlyIncome: profile.employment.income,
      },
    }),
  };
}

/**
 * Вычисление результата предзаполнения
 */
export function calculatePrefillResult(
  currentData: any,
  profileData: any,
  options: PrefillOptions = {}
): PrefillResult {
  const { fields, overwrite = false } = options;
  const result: PrefillResult = {
    data: {},
    changedFields: [],
    skippedFields: [],
  };

  // Фильтрация полей для предзаполнения
  const fieldsToProcess = fields || Object.keys(profileData);

  for (const field of fieldsToProcess) {
    const profileValue = profileData[field];
    const currentValue = currentData[field];

    // Пропускаем, если нет значения в профиле
    if (profileValue === undefined || profileValue === null) {
      continue;
    }

    // Проверяем, заполнено ли поле
    const isFieldFilled = currentValue !== undefined &&
      currentValue !== null &&
      currentValue !== '' &&
      (typeof currentValue !== 'object' || Object.keys(currentValue).length > 0);

    // Пропускаем, если поле заполнено и перезапись отключена
    if (isFieldFilled && !overwrite) {
      result.skippedFields.push(field);
      continue;
    }

    // Добавляем в данные предзаполнения
    result.data[field] = profileValue;
    result.changedFields.push(field);
  }

  return result;
}

/**
 * Получение названия поля для отображения
 */
export function getFieldLabel(fieldPath: string): string {
  const labels: Record<string, string> = {
    'personalData': 'Личная информация',
    'personalData.firstName': 'Имя',
    'personalData.lastName': 'Фамилия',
    'personalData.middleName': 'Отчество',
    'personalData.birthDate': 'Дата рождения',
    'phoneMain': 'Номер телефона',
    'email': 'Email',
    'registrationAddress': 'Адрес регистрации',
    'residenceAddress': 'Адрес проживания',
    'passportData': 'Информация о паспорте',
    'inn': 'ИНН (Налоговый ID)',
    'snils': 'СНИЛС (Страховой номер)',
    'employment': 'Информация о трудоустройстве',
  };

  return labels[fieldPath] || fieldPath;
}
```

## Создание хука useDataPrefill

Создадим хук для предзаполнения данных:

```bash
touch src/hooks/useDataPrefill.ts
```

### Реализация

```typescript title="src/hooks/useDataPrefill.ts"
import { useState, useCallback } from 'react';
import type { FormNode } from 'reformer';
import { loadUserProfile } from '@/services/api/user-profile.api';
import {
  mapProfileToFormData,
  calculatePrefillResult,
  type PrefillOptions,
  type PrefillResult,
} from '@/services/data-prefill.service';

/**
 * Состояние предзаполнения
 */
export type PrefillState = 'idle' | 'loading' | 'preview' | 'applied' | 'error';

/**
 * Тип возврата хука
 */
export interface UseDataPrefillReturn {
  /** Текущее состояние */
  state: PrefillState;
  /** Ошибка загрузки */
  error: Error | null;
  /** Предпросмотр изменений */
  preview: PrefillResult | null;
  /** Загрузка и предпросмотр предзаполнения */
  loadPreview: (options?: PrefillOptions) => Promise<void>;
  /** Применение предзаполнения */
  apply: () => void;
  /** Отмена предзаполнения */
  cancel: () => void;
  /** Прямое предзаполнение без предпросмотра */
  prefill: (options?: PrefillOptions) => Promise<void>;
}

/**
 * Хук для предзаполнения данных формы из профиля пользователя
 */
export function useDataPrefill(form: FormNode): UseDataPrefillReturn {
  const [state, setState] = useState<PrefillState>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [preview, setPreview] = useState<PrefillResult | null>(null);
  const [pendingOptions, setPendingOptions] = useState<PrefillOptions | null>(null);

  // Загрузка и предпросмотр предзаполнения
  const loadPreview = useCallback(async (options: PrefillOptions = {}) => {
    setState('loading');
    setError(null);
    setPreview(null);

    try {
      // Загрузка профиля пользователя
      const profile = await loadUserProfile();

      // Сопоставление с данными формы
      const profileData = mapProfileToFormData(profile);

      // Вычисление того, что изменится
      const currentData = form.value.value;
      const prefillResult = calculatePrefillResult(currentData, profileData, options);

      // Сохранение предпросмотра
      setPreview(prefillResult);
      setPendingOptions(options);
      setState('preview');
    } catch (err) {
      console.error('Ошибка загрузки предпросмотра предзаполнения:', err);
      setError(err as Error);
      setState('error');
    }
  }, [form]);

  // Применение предзаполнения из предпросмотра
  const apply = useCallback(() => {
    if (!preview || state !== 'preview') {
      console.warn('Нет предпросмотра для применения');
      return;
    }

    // Применение данных в форму
    form.patchValue(preview.data);

    setState('applied');

    // Сброс через 2 секунды
    setTimeout(() => {
      setState('idle');
      setPreview(null);
      setPendingOptions(null);
    }, 2000);
  }, [form, preview, state]);

  // Отмена предзаполнения
  const cancel = useCallback(() => {
    setState('idle');
    setPreview(null);
    setPendingOptions(null);
  }, []);

  // Прямое предзаполнение без предпросмотра
  const prefill = useCallback(async (options: PrefillOptions = {}) => {
    setState('loading');
    setError(null);

    try {
      // Загрузка профиля пользователя
      const profile = await loadUserProfile();

      // Сопоставление с данными формы
      const profileData = mapProfileToFormData(profile);

      // Вычисление того, что предзаполнить
      const currentData = form.value.value;
      const prefillResult = calculatePrefillResult(currentData, profileData, options);

      // Прямое применение
      form.patchValue(prefillResult.data);

      setState('applied');

      // Сброс через 2 секунды
      setTimeout(() => {
        setState('idle');
      }, 2000);
    } catch (err) {
      console.error('Ошибка предзаполнения формы:', err);
      setError(err as Error);
      setState('error');
    }
  }, [form]);

  return {
    state,
    error,
    preview,
    loadPreview,
    apply,
    cancel,
    prefill,
  };
}
```

## Создание UI компонентов предзаполнения

Создадим кнопку для срабатывания предзаполнения:

```tsx title="src/components/PrefillButton.tsx"
import { useDataPrefill } from '@/hooks/useDataPrefill';
import type { FormNode } from 'reformer';

interface PrefillButtonProps {
  form: FormNode;
  showPreview?: boolean;
}

export function PrefillButton({ form, showPreview = true }: PrefillButtonProps) {
  const { state, error, loadPreview, prefill } = useDataPrefill(form);

  const handleClick = () => {
    if (showPreview) {
      loadPreview();
    } else {
      prefill();
    }
  };

  const isLoading = state === 'loading';
  const isApplied = state === 'applied';

  return (
    <button
      onClick={handleClick}
      disabled={isLoading || isApplied}
      className="prefill-button"
    >
      {isLoading && <Spinner className="w-4 h-4 mr-2" />}
      {isApplied && <CheckIcon className="w-4 h-4 mr-2" />}
      {!isLoading && !isApplied && <UserIcon className="w-4 h-4 mr-2" />}

      <span>
        {isLoading && 'Загрузка...'}
        {isApplied && 'Предзаполнено'}
        {!isLoading && !isApplied && 'Заполнить из профиля'}
      </span>
    </button>
  );
}

function Spinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
```

## Создание диалога предпросмотра предзаполнения

Создадим диалог для предпросмотра изменений предзаполнения:

```tsx title="src/components/PrefillPreviewDialog.tsx"
import { getFieldLabel } from '@/services/data-prefill.service';
import type { PrefillResult } from '@/services/data-prefill.service';

interface PrefillPreviewDialogProps {
  preview: PrefillResult;
  onApply: () => void;
  onCancel: () => void;
}

export function PrefillPreviewDialog({
  preview,
  onApply,
  onCancel,
}: PrefillPreviewDialogProps) {
  const hasChanges = preview.changedFields.length > 0;

  return (
    <div className="dialog-overlay">
      <div className="dialog prefill-preview-dialog">
        <h2>Предзаполнение из профиля</h2>

        {hasChanges ? (
          <>
            <p className="dialog-description">
              Следующие поля будут заполнены данными из вашего профиля:
            </p>

            {/* Изменённые поля */}
            <div className="changed-fields-list">
              {preview.changedFields.map(field => (
                <div key={field} className="field-item">
                  <CheckIcon className="w-4 h-4 text-green-600" />
                  <span>{getFieldLabel(field)}</span>
                </div>
              ))}
            </div>

            {/* Пропущенные поля */}
            {preview.skippedFields.length > 0 && (
              <div className="skipped-fields">
                <p className="text-sm text-gray-600">
                  Пропущено {preview.skippedFields.length} поле(й), которые уже имеют значения.
                </p>
              </div>
            )}

            {/* Действия */}
            <div className="dialog-actions">
              <button onClick={onCancel} className="button-secondary">
                Отмена
              </button>
              <button onClick={onApply} className="button-primary">
                Применить
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dialog-description">
              Никакие поля не будут изменены. Все поля уже заполнены.
            </p>

            <div className="dialog-actions">
              <button onClick={onCancel} className="button-primary">
                OK
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
```

## Интеграция с компонентом формы

Полная интеграция:

```tsx title="src/components/CreditApplicationForm.tsx"
import { useMemo } from 'react';
import { createCreditApplicationForm } from '@/schemas/create-form';
import { PrefillWithPreview } from '@/components/PrefillWithPreview';
import { AutoSaveIndicator } from '@/components/AutoSaveIndicator';
import { DraftSelector } from '@/components/DraftSelector';
import { ResetControls } from '@/components/ResetControls';

export function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  return (
    <div className="form-container">
      {/* Заголовок с управлением */}
      <div className="form-header">
        <h1>Кредитное заявление</h1>
        <div className="form-controls">
          <PrefillWithPreview form={form} />
          <AutoSaveIndicator status="idle" />
          <DraftSelector drafts={[]} currentDraftId={null} />
          <ResetControls form={form} />
        </div>
      </div>

      {/* Форма */}
      <FormRenderer form={form} />
    </div>
  );
}
```

## Тестирование предзаполнения данных

Протестируйте эти сценарии:

### Сценарий 1: Базовое предзаполнение
- [ ] Нажмите "Заполнить из профиля"
- [ ] Смотрите диалог предпросмотра
- [ ] Просмотрите изменённые поля
- [ ] Нажмите "Применить"
- [ ] Форма заполнена

### Сценарий 2: Частичное предзаполнение
- [ ] Заполните некоторые поля вручную
- [ ] Нажмите "Заполнить из профиля"
- [ ] Заполненные поля пропущены
- [ ] Пустые поля заполнены
- [ ] Перезаписи не происходит

### Сценарий 3: Предзаполнение с перезаписью
- [ ] Заполните некоторые поля
- [ ] Включите опцию перезаписи
- [ ] Нажмите предзаполнение
- [ ] Все поля обновлены
- [ ] Ручные данные заменены

### Сценарий 4: Выборочное предзаполнение
- [ ] Выберите определённые поля
- [ ] Нажмите предзаполнение
- [ ] Заполнены только выбранные поля
- [ ] Другие поля не изменены

### Сценарий 5: Отмена предзаполнения
- [ ] Нажмите "Заполнить из профиля"
- [ ] Смотрите предпросмотр
- [ ] Нажмите "Отмена"
- [ ] Изменения не применены
- [ ] Форма не изменена

### Сценарий 6: Обработка ошибок
- [ ] Отключите интернет
- [ ] Нажмите предзаполнение
- [ ] Смотрите сообщение об ошибке
- [ ] Форма не изменена
- [ ] Можно повторить попытку

## Ключевые выводы

1. **Умное объединение** - По умолчанию не перезаписываем заполненные поля
2. **Предпросмотр изменений** - Позвольте пользователям видеть, что изменится
3. **Выборочное предзаполнение** - Выберите, какие поля заполнять
4. **Обработка ошибок** - Красиво обрабатывайте ошибки API
5. **Контроль пользователя** - Ручное срабатывание, не автоматическое
6. **Поддержка отмены** - Можно сбросить, если нежелательно

## Распространённые паттерны

### Базовое предзаполнение
```typescript
const { prefill } = useDataPrefill(form);
await prefill();
```

### Предзаполнение с предпросмотром
```typescript
const { loadPreview, apply, preview } = useDataPrefill(form);
await loadPreview();
if (preview) apply();
```

### Выборочное предзаполнение
```typescript
await prefill({
  fields: ['personalData', 'contacts'],
  overwrite: false,
});
```

### Предзаполнение с перезаписью
```typescript
await prefill({ overwrite: true });
```

## Что дальше?

В следующем разделе мы добавим функцию **Преобразование данных**:
- Сериализация данных формы для API
- Десериализация данных API для формы
- Преобразование дат
- Нормализация данных
- Удаление вычисляемых полей
- Пользовательские преобразователи

Мы обеспечим правильный поток данных между формой и API!
