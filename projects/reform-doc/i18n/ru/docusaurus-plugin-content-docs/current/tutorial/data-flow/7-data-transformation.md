---
sidebar_position: 7
---

# Преобразование данных

Преобразование данных между форматами формы и API.

## Что мы строим

Двусторонняя система преобразования данных:

- **Сериализация** - Преобразование данных формы для API (Форма → API)
- **Десериализация** - Преобразование данных API для формы (API → Форма)
- **Обработка дат** - Преобразование между объектами Date и ISO строками
- **Нормализация** - Очистка и форматирование данных
- **Вычисляемые поля** - Удаление вычисленных значений
- **Пользовательские преобразования** - Специфичные для домена преобразования

## Почему преобразовывать данные?

Формы и API часто используют разные форматы:

| Формат формы | Формат API | Причина |
|---------------|-----------|---------|
| `Date` объект | ISO строка | JSON сериализация |
| `"+7 (999) 123-45-67"` | `"79991234567"` | Формат хранения |
| `"John Doe"` (вычислено) | Не отправляется | Вычисляемое поле |
| `null` значения | Не отправляется | Чистая нагрузка |
| Вложенные объекты | Плоская структура | Дизайн API |

## Интерфейс преобразователя данных

Определим интерфейс преобразователя:

```typescript title="src/types/transformer.types.ts"
/**
 * Интерфейс преобразователя данных
 */
export interface DataTransformer<TForm = any, TApi = any> {
  /**
   * Преобразование данных формы в формат API
   */
  serialize: (formData: TForm) => TApi;

  /**
   * Преобразование данных API в формат формы
   */
  deserialize: (apiData: TApi) => TForm;
}

/**
 * Опции преобразования
 */
export interface TransformOptions {
  /** Удалить null значения */
  removeNulls?: boolean;
  /** Удалить undefined значения */
  removeUndefined?: boolean;
  /** Удалить пустые строки */
  removeEmptyStrings?: boolean;
  /** Удалить вычисляемые поля */
  removeComputed?: boolean;
  /** Поля для исключения */
  exclude?: string[];
  /** Поля для включения (если указано, только они включаются) */
  include?: string[];
}
```

## Создание базового преобразователя

Создадим вспомогательные функции для общих преобразований:

```bash
touch src/services/data-transform.service.ts
```

### Реализация

```typescript title="src/services/data-transform.service.ts"
import type { TransformOptions } from '@/types/transformer.types';

/**
 * Удаление пустых/null/undefined значений из объекта
 */
export function removeEmptyValues(
  obj: any,
  options: TransformOptions = {}
): any {
  const {
    removeNulls = true,
    removeUndefined = true,
    removeEmptyStrings = false,
  } = options;

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => removeEmptyValues(item, options));
  }

  if (typeof obj === 'object') {
    const result: any = {};

    for (const key in obj) {
      const value = obj[key];

      // Пропускаем в зависимости от опций
      if (removeNulls && value === null) continue;
      if (removeUndefined && value === undefined) continue;
      if (removeEmptyStrings && value === '') continue;

      result[key] = removeEmptyValues(value, options);
    }

    return result;
  }

  return obj;
}

/**
 * Преобразование объектов Date в ISO строки
 */
export function datesToISOStrings(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => datesToISOStrings(item));
  }

  if (typeof obj === 'object') {
    const result: any = {};

    for (const key in obj) {
      result[key] = datesToISOStrings(obj[key]);
    }

    return result;
  }

  return obj;
}

/**
 * Преобразование ISO строк в объекты Date
 */
export function isoStringsToDates(obj: any, dateFields: string[] = []): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => isoStringsToDates(item, dateFields));
  }

  if (typeof obj === 'object') {
    const result: any = {};

    for (const key in obj) {
      const value = obj[key];

      // Проверяем, должно ли это поле преобразоваться в Date
      if (dateFields.includes(key) && typeof value === 'string') {
        try {
          result[key] = new Date(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = isoStringsToDates(value, dateFields);
      }
    }

    return result;
  }

  return obj;
}

/**
 * Исключение полей из объекта
 */
export function excludeFields(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: any = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (!fields.includes(key)) {
      result[key] = obj[key];
    }
  }

  return result;
}

/**
 * Включение только указанных полей
 */
export function includeFields(obj: any, fields: string[]): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: any = {};

  for (const field of fields) {
    if (field in obj) {
      result[field] = obj[field];
    }
  }

  return result;
}

/**
 * Нормализация номера телефона (удаление форматирования)
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Форматирование номера телефона для отображения
 */
export function formatPhone(phone: string): string {
  const cleaned = normalizePhone(phone);

  if (cleaned.length === 11 && cleaned.startsWith('7')) {
    return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7, 9)}-${cleaned.slice(9)}`;
  }

  if (cleaned.length === 10) {
    return `+7 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 8)}-${cleaned.slice(8)}`;
  }

  return phone;
}

/**
 * Нормализация email (нижний регистр, обрезка)
 */
export function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

/**
 * Обрезка всех строковых значений в объекте
 */
export function trimStrings(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return obj.trim();
  }

  if (Array.isArray(obj)) {
    return obj.map(item => trimStrings(item));
  }

  if (typeof obj === 'object') {
    const result: any = {};

    for (const key in obj) {
      result[key] = trimStrings(obj[key]);
    }

    return result;
  }

  return obj;
}
```

## Создание преобразователя для кредитного заявления

Создадим преобразователь, специфичный для кредитного заявления:

```typescript title="src/services/transformers/credit-application.transformer.ts"
import type { DataTransformer } from '@/types/transformer.types';
import {
  removeEmptyValues,
  datesToISOStrings,
  isoStringsToDates,
  excludeFields,
  normalizePhone,
  formatPhone,
  normalizeEmail,
  trimStrings,
} from '@/services/data-transform.service';

/**
 * Список вычисляемых/рассчитанных полей, которые не должны отправляться в API
 */
const COMPUTED_FIELDS = [
  'fullName',
  'age',
  'monthlyPayment',
  'totalPayment',
  'interestRate',
  'totalIncome',
  'coBorrowersIncome',
  'paymentToIncomeRatio',
  'debtToIncomeRatio',
];

/**
 * Поля дат, требующие преобразования
 */
const DATE_FIELDS = [
  'birthDate',
  'issueDate',
  'startDate',
  'endDate',
];

/**
 * Преобразователь данных кредитного заявления
 */
export const creditApplicationTransformer: DataTransformer = {
  /**
   * Сериализация: Форма → API
   */
  serialize: (formData: any) => {
    // Начинаем с данных формы
    let data = { ...formData };

    // 1. Обрезаем все строки
    data = trimStrings(data);

    // 2. Нормализуем email
    if (data.email) {
      data.email = normalizeEmail(data.email);
    }

    // 3. Нормализуем телефоны
    if (data.phoneMain) {
      data.phoneMain = normalizePhone(data.phoneMain);
    }
    if (data.phoneAdditional) {
      data.phoneAdditional = normalizePhone(data.phoneAdditional);
    }

    // 4. Преобразуем даты в ISO строки
    data = datesToISOStrings(data);

    // 5. Удаляем вычисляемые поля
    data = excludeFields(data, COMPUTED_FIELDS);

    // 6. Удаляем пустые значения
    data = removeEmptyValues(data, {
      removeNulls: true,
      removeUndefined: true,
      removeEmptyStrings: true,
    });

    return data;
  },

  /**
   * Десериализация: API → Форма
   */
  deserialize: (apiData: any) => {
    // Начинаем с данных API
    let data = { ...apiData };

    // 1. Преобразуем ISO строки в объекты Date
    data = convertDatesInObject(data);

    // 2. Форматируем телефоны для отображения
    if (data.phoneMain) {
      data.phoneMain = formatPhone(data.phoneMain);
    }
    if (data.phoneAdditional) {
      data.phoneAdditional = formatPhone(data.phoneAdditional);
    }

    // 3. Обеспечиваем наличие вложенных объектов
    data.personalData = data.personalData || {};
    data.passportData = data.passportData || {};
    data.registrationAddress = data.registrationAddress || {};
    data.employment = data.employment || {};

    return data;
  },
};

/**
 * Преобразование полей дат во вложенном объекте
 */
function convertDatesInObject(obj: any, path: string = ''): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) =>
      convertDatesInObject(item, `${path}[${index}]`)
    );
  }

  if (typeof obj === 'object') {
    const result: any = {};

    for (const key in obj) {
      const value = obj[key];
      const fieldPath = path ? `${path}.${key}` : key;

      // Проверяем, является ли это поле или его родитель полем даты
      const isDateField = DATE_FIELDS.some(dateField =>
        fieldPath.includes(dateField)
      );

      if (isDateField && typeof value === 'string') {
        try {
          result[key] = new Date(value);
        } catch {
          result[key] = value;
        }
      } else {
        result[key] = convertDatesInObject(value, fieldPath);
      }
    }

    return result;
  }

  return obj;
}
```

## Создание пользовательских преобразователей

Создадим преобразователи для конкретных сценариев:

```typescript title="src/services/transformers/draft.transformer.ts"
import type { DataTransformer } from '@/types/transformer.types';
import { datesToISOStrings, isoStringsToDates } from '@/services/data-transform.service';

/**
 * Преобразователь черновика (сохраняет все данные, включая вычисляемые поля)
 */
export const draftTransformer: DataTransformer = {
  serialize: (formData: any) => {
    // Сохраняем всё, просто преобразуем даты
    return datesToISOStrings(formData);
  },

  deserialize: (draftData: any) => {
    // Преобразуем даты обратно
    return isoStringsToDates(draftData, [
      'birthDate',
      'issueDate',
      'startDate',
      'endDate',
    ]);
  },
};
```

```typescript title="src/services/transformers/submission.transformer.ts"
import type { DataTransformer } from '@/types/transformer.types';
import { creditApplicationTransformer } from './credit-application.transformer';

/**
 * Преобразователь отправки (дополнительная валидация и очистка)
 */
export const submissionTransformer: DataTransformer = {
  serialize: (formData: any) => {
    // Используем базовый преобразователь
    let data = creditApplicationTransformer.serialize(formData);

    // Добавляем метаданные отправки
    data = {
      ...data,
      submittedAt: new Date().toISOString(),
      version: '1.0',
    };

    // Удаляем поля только для черновика
    delete data.draftId;
    delete data.autoSavedAt;

    return data;
  },

  deserialize: (apiData: any) => {
    return creditApplicationTransformer.deserialize(apiData);
  },
};
```

## Использование преобразователей при загрузке данных

Интеграция с загрузкой данных:

```typescript title="src/hooks/useDataLoader.ts"
import { creditApplicationTransformer } from '@/services/transformers/credit-application.transformer';

export function useDataLoader(form: FormNode, applicationId?: string) {
  const [state, setState] = useState<LoadingState>('idle');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!applicationId) return;

    setState('loading');

    loadApplication(applicationId)
      .then((apiData) => {
        // Десериализация данных API
        const formData = creditApplicationTransformer.deserialize(apiData);

        // Патчирование формы
        form.patchValue(formData);

        setState('success');
      })
      .catch((err) => {
        setError(err);
        setState('error');
      });
  }, [applicationId, form]);

  return { state, loading: state === 'loading', error };
}
```

## Использование преобразователей при автосохранении

Интеграция с автосохранением:

```typescript title="src/hooks/useAutoSave.ts"
import { draftTransformer } from '@/services/transformers/draft.transformer';

export function useAutoSave(form: FormNode, options: AutoSaveOptions) {
  return useAutoSaveBase(form, {
    ...options,
    saveFn: async (formData) => {
      // Сериализация для хранения
      const draftData = draftTransformer.serialize(formData);

      // Сохранение
      await options.saveFn(draftData);
    },
  });
}
```

## Использование преобразователей при отправке

Интеграция с отправкой формы:

```typescript title="src/hooks/useFormSubmission.ts"
import { useState, useCallback } from 'react';
import type { FormNode } from 'reformer';
import { submissionTransformer } from '@/services/transformers/submission.transformer';
import { submitApplication } from '@/services/api/application.api';

export function useFormSubmission(form: FormNode) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      // Валидация
      await form.validateTree();

      if (!form.isValid.value) {
        throw new Error('Форма содержит ошибки валидации');
      }

      // Получение данных формы
      const formData = form.value.value;

      // Сериализация для отправки
      const apiData = submissionTransformer.serialize(formData);

      // Отправка в API
      await submitApplication(apiData);

      setSubmitting(false);
      return true;
    } catch (err) {
      console.error('Ошибка отправки:', err);
      setError(err as Error);
      setSubmitting(false);
      return false;
    }
  }, [form]);

  return { submit, submitting, error };
}
```

## Валидация с преобразователями

Валидация сериализованных данных перед отправкой:

```typescript title="src/services/transformers/validation.ts"
/**
 * Валидация сериализованных данных
 */
export function validateSerializedData(data: any): string[] {
  const errors: string[] = [];

  // Проверка обязательных полей
  if (!data.personalData?.firstName) {
    errors.push('Имя обязательно');
  }

  // Проверка формата телефона
  if (data.phoneMain && !/^\d{10,11}$/.test(data.phoneMain)) {
    errors.push('Номер телефона должен быть 10-11 цифр');
  }

  // Проверка формата email
  if (data.email && !data.email.includes('@')) {
    errors.push('Неверный формат email');
  }

  // Проверка дат в формате ISO строк
  if (data.birthDate && typeof data.birthDate !== 'string') {
    errors.push('Дата рождения должна быть ISO строкой');
  }

  return errors;
}
```

## Тестирование преобразований

Создадим тесты для преобразователей:

```typescript title="src/services/transformers/__tests__/credit-application.transformer.test.ts"
import { creditApplicationTransformer } from '../credit-application.transformer';

describe('creditApplicationTransformer', () => {
  describe('serialize', () => {
    it('should convert dates to ISO strings', () => {
      const formData = {
        personalData: {
          birthDate: new Date('1990-01-01'),
        },
      };

      const result = creditApplicationTransformer.serialize(formData);

      expect(result.personalData.birthDate).toBe('1990-01-01T00:00:00.000Z');
    });

    it('should remove computed fields', () => {
      const formData = {
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe', // вычислено
      };

      const result = creditApplicationTransformer.serialize(formData);

      expect(result.fullName).toBeUndefined();
    });

    it('should normalize phone numbers', () => {
      const formData = {
        phoneMain: '+7 (999) 123-45-67',
      };

      const result = creditApplicationTransformer.serialize(formData);

      expect(result.phoneMain).toBe('79991234567');
    });

    it('should remove empty values', () => {
      const formData = {
        firstName: 'John',
        middleName: null,
        lastName: undefined,
        email: '',
      };

      const result = creditApplicationTransformer.serialize(formData);

      expect(result.middleName).toBeUndefined();
      expect(result.lastName).toBeUndefined();
      expect(result.email).toBeUndefined();
    });
  });

  describe('deserialize', () => {
    it('should convert ISO strings to dates', () => {
      const apiData = {
        personalData: {
          birthDate: '1990-01-01T00:00:00.000Z',
        },
      };

      const result = creditApplicationTransformer.deserialize(apiData);

      expect(result.personalData.birthDate).toBeInstanceOf(Date);
    });

    it('should format phone numbers', () => {
      const apiData = {
        phoneMain: '79991234567',
      };

      const result = creditApplicationTransformer.deserialize(apiData);

      expect(result.phoneMain).toBe('+7 (999) 123-45-67');
    });
  });
});
```

## Тестирование преобразования данных

Протестируйте эти сценарии:

### Сценарий 1: Сериализация для API
- [ ] Создайте форму с данными
- [ ] Сериализуйте данные формы
- [ ] Даты - ISO строки
- [ ] Номера телефонов нормализованы
- [ ] Email в нижнем регистре
- [ ] Вычисляемые поля удалены
- [ ] Пустые значения удалены

### Сценарий 2: Десериализация из API
- [ ] Загрузите данные API
- [ ] Десериализуйте данные
- [ ] ISO строки становятся Date
- [ ] Номера телефонов форматированы
- [ ] Создаются вложенные объекты
- [ ] Форма принимает данные

### Сценарий 3: Полный цикл
- [ ] Начните с данных формы
- [ ] Сериализуйте в API
- [ ] Десериализуйте обратно
- [ ] Данные совпадают с оригиналом (кроме вычисляемых полей)

### Сценарий 4: Сохранение/загрузка черновика
- [ ] Сохраните черновик с вычисляемыми полями
- [ ] Загрузите черновик
- [ ] Все поля восстановлены
- [ ] Вычисляемые поля пересчитываются

### Сценарий 5: Отправка
- [ ] Заполните форму полностью
- [ ] Валидируйте форму
- [ ] Сериализуйте для отправки
- [ ] Нет ошибок валидации на сериализованных данных
- [ ] Успешно отправьте

## Ключевые выводы

1. **Двусторонняя** - Сериализация и десериализация
2. **Обработка дат** - Преобразование между Date и ISO строкой
3. **Нормализация** - Очистка данных для хранения
4. **Вычисляемые поля** - Удаление перед отправкой
5. **Пустые значения** - Очистка null и пустых строк
6. **Типобезопасность** - Используйте интерфейсы TypeScript
7. **Тестирование** - Тестируйте преобразования тщательно

## Распространённые паттерны

### Базовая сериализация
```typescript
const apiData = transformer.serialize(formData);
```

### Базовая десериализация
```typescript
const formData = transformer.deserialize(apiData);
```

### Сохранение с преобразованием
```typescript
const draftData = draftTransformer.serialize(form.value.value);
await saveDraft(draftData);
```

### Загрузка с преобразованием
```typescript
const apiData = await loadApplication(id);
const formData = transformer.deserialize(apiData);
form.patchValue(formData);
```

### Отправка с преобразованием
```typescript
const formData = form.value.value;
const apiData = submissionTransformer.serialize(formData);
await submitApplication(apiData);
```

## Что дальше?

В финальном разделе мы соберём всё вместе в **Полной интеграции**:
- Объединение всех функций Data Flow
- Полный компонент формы
- Панель управления со всеми функциями
- Тестирование всех сценариев вместе
- Лучшие практики
- Соображения производительности

Мы увидим полную картину потока данных в действии!
