---
sidebar_position: 2
---

# Трансформация данных

Трансформация данных формы для соответствия требованиям API и различных форматов данных.

## Обзор

Формы часто требуют трансформации данных перед отправкой:

- **Маппинг имен полей** - Конвертация `camelCase` в `snake_case` или другие соглашения
- **Удаление UI-полей** - Удаление полей, используемых только для UI (вычисляемые, только для отображения)
- **Форматирование дат** - Конвертация дат в ISO строки или пользовательские форматы
- **Выравнивание вложенных объектов** - Выравнивание или реструктуризация вложенных данных
- **Конвертация типов** - Преобразование строк в числа, boolean и т.д.
- **Обработка null/undefined** - Конвертация пустых значений в null или их пропуск

## Базовый маппинг

### Простой маппинг полей

Трансформация имен полей из формата формы в формат API:

```typescript title="src/utils/map-to-api.ts"
import type { CreditApplicationForm } from '../types';

interface ApiCreditApplication {
  loan_type: string;
  loan_amount: number;
  loan_term: number;
  first_name: string;
  last_name: string;
  middle_name: string;
  email: string;
  phone_main: string;
}

export function mapFormToApi(
  formData: CreditApplicationForm
): ApiCreditApplication {
  return {
    loan_type: formData.loanType,
    loan_amount: formData.loanAmount,
    loan_term: formData.loanTerm,
    first_name: formData.firstName,
    last_name: formData.lastName,
    middle_name: formData.middleName,
    email: formData.email,
    phone_main: formData.phoneMain,
  };
}

// Использование
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();

  if (form.valid.value) {
    const apiData = mapFormToApi(form.value.value);
    await submitApplication(apiData);
  }
};
```

### Универсальный конвертер регистра

Автоматическая конвертация camelCase в snake_case:

```typescript title="src/utils/case-converter.ts"
export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function camelToSnake<T extends Record<string, any>>(
  obj: T
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = toSnakeCase(key);

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      // Рекурсивная конвертация вложенных объектов
      result[snakeKey] = camelToSnake(value);
    } else if (Array.isArray(value)) {
      // Конвертация элементов массива, если они объекты
      result[snakeKey] = value.map((item) =>
        item && typeof item === 'object' ? camelToSnake(item) : item
      );
    } else {
      result[snakeKey] = value;
    }
  }

  return result;
}

// Использование
const apiData = camelToSnake(form.value.value);
```

## Удаление UI-полей

### Фильтрация вычисляемых и отображаемых полей

Удаление полей, которые не должны отправляться в API:

```typescript title="src/utils/filter-ui-fields.ts"
interface CreditApplicationForm {
  // Поля API
  loanAmount: number;
  loanTerm: number;
  interestRate: number;

  // UI-поля (вычисляемые)
  monthlyPayment: number; // Вычислено из других полей
  totalAmount: number; // Вычислено из других полей
  fullName: string; // Вычислено из firstName + lastName
  age: number; // Вычислено из birthDate
}

export function removeUiFields(
  formData: CreditApplicationForm
): Partial<CreditApplicationForm> {
  const {
    monthlyPayment,
    totalAmount,
    fullName,
    age,
    ...apiData
  } = formData;

  // Вернуть только поля, необходимые для API
  return apiData;
}

// Использование
const handleSubmit = async () => {
  const formData = form.value.value;
  const apiData = removeUiFields(formData);
  await submitApplication(apiData);
};
```

### Подход с белым списком

Явное указание полей для включения:

```typescript title="src/utils/whitelist-fields.ts"
type ApiFieldName = keyof ApiCreditApplication;

const API_FIELDS: ApiFieldName[] = [
  'loanType',
  'loanAmount',
  'loanTerm',
  'loanPurpose',
  'firstName',
  'lastName',
  'middleName',
  'birthDate',
  'email',
  'phoneMain',
];

export function pickApiFields(
  formData: CreditApplicationForm
): Partial<CreditApplicationForm> {
  const result: Partial<CreditApplicationForm> = {};

  for (const field of API_FIELDS) {
    if (field in formData) {
      result[field] = formData[field];
    }
  }

  return result;
}
```

## Форматирование дат

### Конвертация дат в ISO строки

```typescript title="src/utils/format-dates.ts"
interface CreditApplicationForm {
  birthDate: string; // Из формы: "2025-01-15" или объект Date
  passportIssueDate: string;
  employmentStartDate: string;
}

export function formatDatesForApi(
  formData: CreditApplicationForm
): CreditApplicationForm {
  return {
    ...formData,
    birthDate: formatDate(formData.birthDate),
    passportIssueDate: formatDate(formData.passportIssueDate),
    employmentStartDate: formatDate(formData.employmentStartDate),
  };
}

function formatDate(date: string | Date | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Вернуть ISO строку: "2025-01-15T00:00:00.000Z"
  return dateObj.toISOString();
}

// Использование
const handleSubmit = async () => {
  const formData = form.value.value;
  const withFormattedDates = formatDatesForApi(formData);
  await submitApplication(withFormattedDates);
};
```

### Пользовательский формат даты

```typescript title="src/utils/custom-date-format.ts"
function formatDateCustom(date: string | Date | undefined): string {
  if (!date) return '';

  const dateObj = typeof date === 'string' ? new Date(date) : date;

  // Вернуть формат: "DD.MM.YYYY" (российский формат)
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();

  return `${day}.${month}.${year}`;
}

export function formatDatesRussian(
  formData: CreditApplicationForm
): CreditApplicationForm {
  return {
    ...formData,
    birthDate: formatDateCustom(formData.birthDate),
    passportIssueDate: formatDateCustom(formData.passportIssueDate),
    employmentStartDate: formatDateCustom(formData.employmentStartDate),
  };
}
```

## Трансформация вложенных объектов

### Выравнивание вложенной структуры

Конвертация вложенной структуры формы в плоскую структуру API:

```typescript title="src/utils/flatten-nested.ts"
// Структура формы (вложенная)
interface CreditApplicationForm {
  personalData: {
    firstName: string;
    lastName: string;
    middleName: string;
    birthDate: string;
  };
  registrationAddress: {
    city: string;
    street: string;
    building: string;
    apartment: string;
  };
}

// Структура API (плоская)
interface ApiCreditApplication {
  first_name: string;
  last_name: string;
  middle_name: string;
  birth_date: string;
  registration_city: string;
  registration_street: string;
  registration_building: string;
  registration_apartment: string;
}

export function flattenFormData(
  formData: CreditApplicationForm
): ApiCreditApplication {
  return {
    first_name: formData.personalData.firstName,
    last_name: formData.personalData.lastName,
    middle_name: formData.personalData.middleName,
    birth_date: formData.personalData.birthDate,
    registration_city: formData.registrationAddress.city,
    registration_street: formData.registrationAddress.street,
    registration_building: formData.registrationAddress.building,
    registration_apartment: formData.registrationAddress.apartment,
  };
}
```

### Вложение плоской структуры

Конвертация плоской формы во вложенную структуру API:

```typescript title="src/utils/nest-flat.ts"
// Структура формы (плоская)
interface CreditApplicationForm {
  firstName: string;
  lastName: string;
  city: string;
  street: string;
}

// Структура API (вложенная)
interface ApiCreditApplication {
  applicant: {
    first_name: string;
    last_name: string;
  };
  address: {
    city: string;
    street: string;
  };
}

export function nestFormData(
  formData: CreditApplicationForm
): ApiCreditApplication {
  return {
    applicant: {
      first_name: formData.firstName,
      last_name: formData.lastName,
    },
    address: {
      city: formData.city,
      street: formData.street,
    },
  };
}
```

## Трансформация массивов

### Трансформация элементов массива

Маппинг массивов формы в формат API:

```typescript title="src/utils/transform-arrays.ts"
interface FormCoBorrower {
  firstName: string;
  lastName: string;
  monthlyIncome: number;
  relationshipType: string;
}

interface ApiCoBorrower {
  first_name: string;
  last_name: string;
  monthly_income: number;
  relationship_type: string;
}

export function transformCoBorrowers(
  coBorrowers: FormCoBorrower[]
): ApiCoBorrower[] {
  return coBorrowers.map((cb) => ({
    first_name: cb.firstName,
    last_name: cb.lastName,
    monthly_income: cb.monthlyIncome,
    relationship_type: cb.relationshipType,
  }));
}

// Использование
const handleSubmit = async () => {
  const formData = form.value.value;

  const apiData = {
    ...mapFormToApi(formData),
    co_borrowers: transformCoBorrowers(formData.coBorrowers),
  };

  await submitApplication(apiData);
};
```

### Фильтрация пустых элементов массива

Удаление неполных или пустых элементов:

```typescript title="src/utils/filter-array-items.ts"
export function filterEmptyCoBorrowers(
  coBorrowers: FormCoBorrower[]
): FormCoBorrower[] {
  return coBorrowers.filter((cb) => {
    // Оставить только элементы с хотя бы именем и фамилией
    return cb.firstName && cb.lastName;
  });
}

// Использование
const apiData = {
  ...formData,
  coBorrowers: filterEmptyCoBorrowers(formData.coBorrowers),
};
```

## Обработка Null и Undefined

### Конвертация пустых строк в Null

```typescript title="src/utils/handle-empty-values.ts"
export function emptyStringsToNull<T extends Record<string, any>>(
  obj: T
): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === '') {
      result[key] = null;
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = emptyStringsToNull(value);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        item && typeof item === 'object' ? emptyStringsToNull(item) : item
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

// Использование
const apiData = emptyStringsToNull(form.value.value);
```

### Пропуск Null/Undefined значений

Удаление полей со значениями null или undefined:

```typescript title="src/utils/omit-nullish.ts"
export function omitNullish<T extends Record<string, any>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== null && value !== undefined) {
      result[key as keyof T] = value;
    }
  }

  return result;
}

// Использование
const apiData = omitNullish(form.value.value);
// Отправляются только поля с фактическими значениями
```

### Конвертация Undefined в значения по умолчанию

```typescript title="src/utils/default-values.ts"
interface CreditApplicationForm {
  loanAmount: number | undefined;
  loanTerm: number | undefined;
  initialPaymentPercent: number | undefined;
}

export function applyDefaults(
  formData: CreditApplicationForm
): Required<CreditApplicationForm> {
  return {
    loanAmount: formData.loanAmount ?? 0,
    loanTerm: formData.loanTerm ?? 12,
    initialPaymentPercent: formData.initialPaymentPercent ?? 0,
  };
}
```

## Полный pipeline трансформации

### Композиция функций трансформации

Цепочка нескольких трансформаций:

```typescript title="src/utils/transform-pipeline.ts"
export function transformForApi(
  formData: CreditApplicationForm
): ApiCreditApplication {
  // Шаг 1: Удалить UI-поля
  const withoutUiFields = removeUiFields(formData);

  // Шаг 2: Форматировать даты
  const withFormattedDates = formatDatesForApi(withoutUiFields);

  // Шаг 3: Конвертировать в snake_case
  const snakeCaseData = camelToSnake(withFormattedDates);

  // Шаг 4: Обработать пустые значения
  const withNulls = emptyStringsToNull(snakeCaseData);

  // Шаг 5: Трансформировать массивы
  const final = {
    ...withNulls,
    co_borrowers: transformCoBorrowers(formData.coBorrowers || []),
  };

  return final as ApiCreditApplication;
}

// Использование
const handleSubmit = async () => {
  form.markAsTouched();
  await form.validate();

  if (form.valid.value) {
    const apiData = transformForApi(form.value.value);
    await submitApplication(apiData);
  }
};
```

### Pipeline с композицией функций

```typescript title="src/utils/compose-transforms.ts"
type TransformFn<T, R> = (data: T) => R;

export function compose<T>(...fns: TransformFn<any, any>[]) {
  return (data: T) => {
    return fns.reduce((result, fn) => fn(result), data);
  };
}

// Определить отдельные трансформации
const removeUi = (data: any) => removeUiFields(data);
const formatDates = (data: any) => formatDatesForApi(data);
const toSnake = (data: any) => camelToSnake(data);
const handleNulls = (data: any) => emptyStringsToNull(data);

// Скомпоновать pipeline
const transformPipeline = compose(
  removeUi,
  formatDates,
  toSnake,
  handleNulls
);

// Использование
const apiData = transformPipeline(form.value.value);
```

## Частичная отправка

### Отправка только измененных полей

Отправка только грязных (модифицированных) полей в API:

```typescript title="src/utils/get-dirty-fields.ts"
import type { FormNode } from 'reformer';

export function getDirtyValues<T extends Record<string, any>>(
  form: FormNode<T>
): Partial<T> {
  const dirtyFields: Partial<T> = {};
  const value = form.value.value;

  // Итерация по всем полям
  for (const key in value) {
    const field = form.field(key as keyof T);

    if (field && field.dirty?.value) {
      dirtyFields[key] = value[key];
    }
  }

  return dirtyFields;
}

// Использование - PATCH endpoint
const handleSaveChanges = async () => {
  const changedFields = getDirtyValues(form);

  if (Object.keys(changedFields).length === 0) {
    console.log('Нет изменений для сохранения');
    return;
  }

  await patchApplication(applicationId, changedFields);
};
```

### Отправка конкретных секций

Отправка только релевантных частей формы:

```typescript title="src/utils/extract-section.ts"
export function extractLoanDetails(
  formData: CreditApplicationForm
): Partial<CreditApplicationForm> {
  return {
    loanType: formData.loanType,
    loanAmount: formData.loanAmount,
    loanTerm: formData.loanTerm,
    loanPurpose: formData.loanPurpose,
    initialPaymentPercent: formData.initialPaymentPercent,
  };
}

export function extractPersonalInfo(
  formData: CreditApplicationForm
): Partial<CreditApplicationForm> {
  return {
    firstName: formData.firstName,
    lastName: formData.lastName,
    middleName: formData.middleName,
    birthDate: formData.birthDate,
    birthPlace: formData.birthPlace,
  };
}

// Использование - многошаговая отправка
const handleSaveStep1 = async () => {
  const loanDetails = extractLoanDetails(form.value.value);
  await saveStep('loan-details', loanDetails);
};

const handleSaveStep2 = async () => {
  const personalInfo = extractPersonalInfo(form.value.value);
  await saveStep('personal-info', personalInfo);
};
```

## Загрузка файлов

### Подготовка файлов для загрузки

```typescript title="src/utils/prepare-files.ts"
interface CreditApplicationForm {
  passportScan: File | null;
  incomeCertificate: File | null;
  additionalDocuments: File[];
}

export async function prepareFormWithFiles(
  formData: CreditApplicationForm
): Promise<FormData> {
  const apiFormData = new FormData();

  // Добавить обычные поля
  apiFormData.append('loanAmount', String(formData.loanAmount));
  apiFormData.append('loanTerm', String(formData.loanTerm));
  apiFormData.append('firstName', formData.firstName);
  apiFormData.append('lastName', formData.lastName);

  // Добавить поля файлов
  if (formData.passportScan) {
    apiFormData.append('passport_scan', formData.passportScan);
  }

  if (formData.incomeCertificate) {
    apiFormData.append('income_certificate', formData.incomeCertificate);
  }

  // Добавить несколько файлов
  formData.additionalDocuments.forEach((file, index) => {
    apiFormData.append(`additional_document_${index}`, file);
  });

  return apiFormData;
}

// Использование
const handleSubmit = async () => {
  const formDataWithFiles = await prepareFormWithFiles(form.value.value);

  await fetch('/api/applications', {
    method: 'POST',
    body: formDataWithFiles,
    // Не устанавливайте Content-Type - браузер установит его с boundary
  });
};
```

### Конвертация файлов в Base64

```typescript title="src/utils/file-to-base64.ts"
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

export async function prepareFilesAsBase64(
  formData: CreditApplicationForm
): Promise<any> {
  const apiData = { ...formData };

  if (formData.passportScan) {
    apiData.passportScan = await fileToBase64(formData.passportScan);
  }

  if (formData.incomeCertificate) {
    apiData.incomeCertificate = await fileToBase64(formData.incomeCertificate);
  }

  return apiData;
}
```

## Лучшие практики

### 1. Создавайте переиспользуемые функции трансформации

```typescript
// ✅ ХОРОШО: Отдельные, тестируемые функции
const removeUiFields = (data: any) => { /* ... */ };
const formatDates = (data: any) => { /* ... */ };
const toSnakeCase = (data: any) => { /* ... */ };

const apiData = toSnakeCase(formatDates(removeUiFields(formData)));

// ❌ ПЛОХО: Inline трансформации
const apiData = {
  loan_amount: formData.loanAmount,
  loan_term: formData.loanTerm,
  first_name: formData.firstName,
  // ... повторяется в каждом обработчике отправки
};
```

### 2. Используйте типобезопасность

```typescript
// ✅ ХОРОШО: Типизированные трансформации
export function mapFormToApi(
  formData: CreditApplicationForm
): ApiCreditApplication {
  return {
    loan_type: formData.loanType,
    loan_amount: formData.loanAmount,
    // TypeScript гарантирует, что все требуемые поля замаплены
  };
}

// ❌ ПЛОХО: Нетипизированные трансформации
export function mapFormToApi(formData: any): any {
  return {
    loan_type: formData.loanType,
    // Легко пропустить поля, опечатки и т.д.
  };
}
```

### 3. Обрабатывайте ошибки в трансформациях

```typescript
// ✅ ХОРОШО: Безопасное форматирование даты
function formatDate(date: string | Date | undefined): string {
  if (!date) return '';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (isNaN(dateObj.getTime())) {
      console.warn('Некорректная дата:', date);
      return '';
    }

    return dateObj.toISOString();
  } catch (error) {
    console.error('Ошибка форматирования даты:', error);
    return '';
  }
}

// ❌ ПЛОХО: Небезопасная трансформация
function formatDate(date: any): string {
  return new Date(date).toISOString(); // Может выбросить исключение!
}
```

### 4. Документируйте маппинги полей

```typescript
// ✅ ХОРОШО: Четкая документация
/**
 * Маппинг данных формы кредитной заявки в формат API
 *
 * Трансформации:
 * - Имена полей: camelCase → snake_case
 * - Даты: объекты Date → ISO строки
 * - Пустые строки → null
 * - Удаляются: fullName, age, monthlyPayment (UI-поля)
 *
 * @param formData - Данные формы из CreditApplicationForm
 * @returns Данные готовые для API в формате ApiCreditApplication
 */
export function mapFormToApi(
  formData: CreditApplicationForm
): ApiCreditApplication {
  // ...
}

// ❌ ПЛОХО: Нет документации
export function transform(data: any): any {
  // Что это делает?
}
```

### 5. Тестируйте трансформации

```typescript
// ✅ ХОРОШО: Юнит-тесты для трансформаций
describe('mapFormToApi', () => {
  it('должен конвертировать camelCase в snake_case', () => {
    const formData = {
      loanAmount: 100000,
      firstName: 'Иван',
    };

    const result = mapFormToApi(formData);

    expect(result).toEqual({
      loan_amount: 100000,
      first_name: 'Иван',
    });
  });

  it('должен форматировать даты в ISO строки', () => {
    const formData = {
      birthDate: new Date('1990-01-15'),
    };

    const result = mapFormToApi(formData);

    expect(result.birth_date).toBe('1990-01-15T00:00:00.000Z');
  });
});
```

## Распространенные паттерны

### Трансформация до и после отправки

```typescript
function CreditApplicationForm() {
  const form = useMemo(() => createCreditApplicationForm(), []);

  const handleSubmit = async () => {
    form.markAsTouched();
    await form.validate();

    if (!form.valid.value) return;

    // Трансформация перед отправкой
    const apiData = transformForApi(form.value.value);

    try {
      // Отправка в API
      const response = await submitApplication(apiData);

      // Трансформация ответа обратно в формат формы
      const updatedFormData = transformFromApi(response.data);
      form.setValue(updatedFormData);

      showSuccessMessage('Заявка отправлена!');
    } catch (error) {
      showErrorMessage('Отправка провалилась');
    }
  };

  return <FormContent form={form} />;
}
```

### Условные трансформации

```typescript
export function transformForApi(
  formData: CreditApplicationForm,
  options: { includeComputed?: boolean } = {}
): ApiCreditApplication {
  let data = { ...formData };

  // Условное включение вычисляемых полей
  if (!options.includeComputed) {
    data = removeUiFields(data);
  }

  // Продолжить трансформации
  return camelToSnake(formatDatesForApi(data));
}

// Использование
// Полная отправка - исключить вычисляемые поля
const fullApiData = transformForApi(formData, { includeComputed: false });

// Сохранение черновика - включить все поля
const draftApiData = transformForApi(formData, { includeComputed: true });
```

## Следующий шаг

Теперь, когда вы понимаете трансформацию данных, давайте изучим, как обрабатывать ошибки валидации со стороны сервера и отображать их в форме.
