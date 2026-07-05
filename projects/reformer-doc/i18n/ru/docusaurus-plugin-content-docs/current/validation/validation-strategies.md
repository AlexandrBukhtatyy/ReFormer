---
sidebar_position: 5
---

# Стратегии Валидации

Продвинутые паттерны и стратегии валидации для сложных форм.

## Время Валидации

Тайминг для каждого поля управляется опцией `updateOn` в узле схемы
(`'change' | 'blur' | 'submit'`, по умолчанию `'blur'`). Полная проверка данных запускается
по требованию через `validateFormModel(model, schema)`.

### Валидация при Изменении

Мгновенная обратная связь во время ввода:

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, minLength } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ username: string }>({ username: '' });

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    validators: [required(), minLength(3)],
    updateOn: 'change', // валидируем при каждом нажатии клавиши
  },
};

const form = createForm({ model, schema });
```

**Подходит для:**

- Простых полей (текст, числа)
- Обратной связи в реальном времени
- Клиентской валидации

**Избегайте для:**

- Дорогих валидаций
- API вызовов

### Валидация при Потере Фокуса

Валидация при потере фокуса полем:

```typescript
import { createModel, createForm } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ email: string }>({ email: '' });

const schema = {
  email: {
    value: model.$.email,
    component: Input,
    validators: [required(), email()],
    updateOn: 'blur', // валидируем при потере фокуса (по умолчанию)
  },
};

const form = createForm({ model, schema });
```

**Подходит для:**

- Большинства полей формы
- Лучшего UX (менее навязчиво)
- Асинхронной валидации с debounce

### Валидация при Отправке

Валидация только при отправке формы:

```typescript
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, minLength } from '@reformer/core/validators';
import { Textarea } from '@reformer/ui-kit';

const model = createModel<{ feedback: string }>({ feedback: '' });

const schema = {
  feedback: {
    value: model.$.feedback,
    component: Textarea,
    validators: [required(), minLength(10)],
    updateOn: 'submit', // валидируем только при submit
  },
};

const form = createForm({ model, schema });

// Запуск валидации вручную
const handleSubmit = async () => {
  form.markAsTouched(); // показать ошибки в UI
  const { valid } = await validateFormModel(model, schema);
  if (valid) {
    console.log('Валидно:', model.get());
  }
};
```

**Подходит для:**

- Необязательных полей
- Больших текстовых областей
- Сложных форм, где валидация в реальном времени отвлекает

## Синхронная vs Асинхронная Валидация

### Стратегия Сначала Синхронная

Синхронные фабрики выполняются первыми (в порядке массива); асинхронная проверка объявляется
отдельно и сама себя ограничивает, поэтому не делает работу, пока не выполнены базовые условия:

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { required, minLength, maxLength, pattern } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ username: string }>({ username: '' });

// Асинхронная проверка — выполняется после синхронных фабрик; ранний return это ограничитель «только если синхронная прошла»
const usernameAvailable: ModelValidator<string> = async (value) => {
  if (!value || value.length < 3) return null;

  const response = await fetch(`/api/check-username?username=${value}`);
  const { available } = await response.json();

  return available ? null : { code: 'usernameTaken', message: 'Имя пользователя уже занято' };
};

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    // Сначала синхронные валидаторы
    validators: [
      required(),
      minLength(3),
      maxLength(20),
      pattern(/^[a-zA-Z0-9_]+$/, { message: 'Недопустимые символы' }),
    ],
    // Асинхронный валидатор объявляется отдельно, с debounce
    asyncValidators: [usernameAvailable],
    debounce: 500,
  },
};

const form = createForm({ model, schema });
```

**Преимущества:**

- Быстрая обратная связь для базовых ошибок
- Сокращение ненужных API вызовов
- Лучшая производительность

### Параллельная Асинхронная Валидация

`validateFormModel` прогоняет асинхронные валидаторы полей параллельно (`Promise.all`):

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ username: string; email: string }>({ username: '', email: '' });

// Проверка доступности имени пользователя
const usernameAvailable: ModelValidator<string> = async (value) => {
  const response = await fetch(`/api/check-username?username=${value}`);
  const { available } = await response.json();
  return available ? null : { code: 'usernameTaken', message: 'Имя пользователя занято' };
};

// Проверка доступности email
const emailAvailable: ModelValidator<string> = async (value) => {
  const response = await fetch(`/api/check-email?email=${value}`);
  const { available } = await response.json();
  return available ? null : { code: 'emailTaken', message: 'Email уже занят' };
};

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    asyncValidators: [usernameAvailable],
    debounce: 500,
  },
  email: {
    value: model.$.email,
    component: Input,
    asyncValidators: [emailAvailable],
    debounce: 500,
  },
};

const form = createForm({ model, schema });
```

## Условная Валидация

Правила, действующие только в ветке, задаются нативным branch-узлом
`{ when: (scope, root) => boolean, children: [...] }` в дереве схемы. `validateFormModel`
валидирует `children`, когда `when` истинно; когда ложно — поддерево пропускается, а ошибки
его полей очищаются.

### Простое Условие

Валидация на основе другого поля:

```typescript
import { createModel, validateFormModel } from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';

const model = createModel<{
  hasCompany: boolean;
  companyName: string;
  companyTaxId: string;
}>({ hasCompany: false, companyName: '', companyTaxId: '' });

const schema = {
  children: [
    { value: model.$.hasCompany },
    {
      // Валидировать поля компании только если hasCompany истинно
      when: (_scope, root) => root.hasCompany === true,
      children: [
        { value: model.$.companyName, validators: [required()] },
        {
          value: model.$.companyTaxId,
          validators: [required(), pattern(/^\d{10}$/, { message: 'Неверный ИНН' })],
        },
      ],
    },
  ],
};

const { valid, errors } = await validateFormModel(model, schema);
```

### Сложное Условие

Множественные условия:

```typescript
import { createModel, validateFormModel } from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';

const model = createModel<{
  accountType: 'personal' | 'business';
  businessName: string;
  ein: string;
  ssn: string;
}>({ accountType: 'personal', businessName: '', ein: '', ssn: '' });

const schema = {
  children: [
    { value: model.$.accountType, validators: [required()] },

    // Валидация бизнес-аккаунта
    {
      when: (_scope, root) => root.accountType === 'business',
      children: [
        { value: model.$.businessName, validators: [required()] },
        {
          value: model.$.ein,
          validators: [required(), pattern(/^\d{10}$/, { message: 'Неверный ИНН' })],
        },
      ],
    },

    // Валидация личного аккаунта
    {
      when: (_scope, root) => root.accountType === 'personal',
      children: [
        {
          value: model.$.ssn,
          validators: [required(), pattern(/^\d{3}-\d{2}-\d{4}$/, { message: 'Неверный СНИЛС' })],
        },
      ],
    },
  ],
};

const { valid, errors } = await validateFormModel(model, schema);
```

## Валидация Зависимых Полей

Cross-field правила — это обычные `ModelValidator`, которые читают соседние поля через `root`
и вешаются на поле-носитель ошибки. Чтобы перепроверять их при изменении зависимости,
подключите `revalidateWhen` в behavior.

### Последовательная Валидация

Валидация на основе предыдущего поля:

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required, minLength } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type PasswordForm = { password: string; confirmPassword: string };

const model = createModel<PasswordForm>({ password: '', confirmPassword: '' });

// confirmPassword должен совпадать с password — читаем соседа через `root`
const passwordsMatch: ModelValidator<string, unknown, PasswordForm> = (value, _scope, root) =>
  value && root.password && value !== root.password
    ? { code: 'passwordMismatch', message: 'Пароли не совпадают' }
    : null;

const schema = {
  password: {
    value: model.$.password,
    component: Input,
    validators: [required(), minLength(8)],
  },
  confirmPassword: {
    value: model.$.confirmPassword,
    component: Input,
    validators: [required(), passwordsMatch],
  },
};

// Перевалидируем, чтобы confirmPassword перепроверялся при изменении password
const behavior = defineFormBehavior<PasswordForm>(({ model }) => {
  revalidateWhen([model.$.password], () => {
    void validateFormModel(model, schema);
  });
});

const form = createForm({ model, schema, behavior });
```

### Валидация Диапазона Дат

Валидация диапазонов дат:

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';

type DateRangeForm = { startDate: Date | null; endDate: Date | null };

const model = createModel<DateRangeForm>({ startDate: null, endDate: null });

// Дата окончания должна быть после даты начала
const endAfterStart: ModelValidator<Date | null, unknown, DateRangeForm> = (
  value,
  _scope,
  root
) => {
  const startDate = root.startDate;
  if (!value || !startDate) return null;

  return new Date(value) < new Date(startDate)
    ? { code: 'endBeforeStart', message: 'Дата окончания должна быть позже даты начала' }
    : null;
};

// Диапазон не более 1 года
const rangeUnderOneYear: ModelValidator<Date | null, unknown, DateRangeForm> = (
  value,
  _scope,
  root
) => {
  const startDate = root.startDate;
  if (!value || !startDate) return null;

  const diffDays =
    (new Date(value).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24);

  return diffDays > 365
    ? { code: 'rangeTooLong', message: 'Диапазон не должен превышать 1 год' }
    : null;
};

const schema = {
  startDate: { value: model.$.startDate, validators: [required()] },
  endDate: { value: model.$.endDate, validators: [required(), endAfterStart, rangeUnderOneYear] },
};

// Перепроверяем правила endDate при изменении startDate
const behavior = defineFormBehavior<DateRangeForm>(({ model }) => {
  revalidateWhen([model.$.startDate], () => {
    void validateFormModel(model, schema);
  });
});

const form = createForm({ model, schema, behavior });
```

## Множественная Валидация Полей

### Кросс-Полевая Валидация

Валидация нескольких полей вместе:

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required, min } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';

type PriceForm = { minPrice: number; maxPrice: number };

const model = createModel<PriceForm>({ minPrice: 0, maxPrice: 0 });

// Правило диапазона цен — читает minPrice через `root`
const maxAboveMin: ModelValidator<number, unknown, PriceForm> = (value, _scope, root) =>
  value && root.minPrice && value < root.minPrice
    ? { code: 'invalidRange', message: 'Максимальная цена должна быть больше минимальной' }
    : null;

const schema = {
  minPrice: { value: model.$.minPrice, validators: [required(), min(0)] },
  maxPrice: { value: model.$.maxPrice, validators: [required(), min(0), maxAboveMin] },
};

const behavior = defineFormBehavior<PriceForm>(({ model }) => {
  revalidateWhen([model.$.minPrice], () => void validateFormModel(model, schema));
});

const form = createForm({ model, schema, behavior });
```

### Валидация на Уровне Формы

Валидация всей формы:

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { required } from '@reformer/core/validators';

type PaymentForm = { paymentMethod: 'card' | 'bank'; cardNumber: string; bankAccount: string };

const model = createModel<PaymentForm>({ paymentMethod: 'card', cardNumber: '', bankAccount: '' });

// Cross-field правило: вешаем на поле-носитель ошибки, читаем соседей через `root`
const cardRequiredWhenCard: ModelValidator<string, unknown, PaymentForm> = (value, _scope, root) =>
  root.paymentMethod === 'card' && !value
    ? { code: 'required', message: 'Номер карты обязателен' }
    : null;

const bankRequiredWhenBank: ModelValidator<string, unknown, PaymentForm> = (value, _scope, root) =>
  root.paymentMethod === 'bank' && !value
    ? { code: 'required', message: 'Реквизиты счёта обязательны' }
    : null;

const schema = {
  paymentMethod: { value: model.$.paymentMethod, validators: [required()] },
  cardNumber: { value: model.$.cardNumber, validators: [cardRequiredWhenCard] },
  bankAccount: { value: model.$.bankAccount, validators: [bankRequiredWhenBank] },
};

const form = createForm({ model, schema });
```

## Стратегии Валидации Массивов

Секции массива в схеме валидации объявляются через
`{ componentProps: { control: model.<array>, itemComponent: (item) => subSchema } }`;
`validateFormModel` обходит их поэлементно. Правила по всему массиву — это `ModelValidator`,
читающие весь массив через `root`.

### Валидация Всех Элементов

```typescript
import { createModel, validateFormModel, type FormModel } from '@reformer/core';
import { required, email } from '@reformer/core/validators';

type EmailItem = { address: string };
type MyForm = { emails: EmailItem[] };

const model = createModel<MyForm>({ emails: [{ address: '' }] });

// Под-схема одного элемента — валидируется для каждого элемента
const emailItem = (item: FormModel<EmailItem>) => ({
  address: { value: item.$.address, validators: [required(), email()] },
});

const schema = {
  emails: { componentProps: { control: model.emails, itemComponent: emailItem } },
};

const { valid, errors } = await validateFormModel(model, schema);
```

### Валидация Длины Массива

```typescript
import {
  createModel,
  validateFormModel,
  type ModelValidator,
  type FormModel,
} from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';

type PhoneItem = { number: string };
type MyForm = { phoneNumbers: PhoneItem[] };

const model = createModel<MyForm>({ phoneNumbers: [{ number: '' }] });

const phoneItem = (item: FormModel<PhoneItem>) => ({
  number: {
    value: item.$.number,
    validators: [required(), pattern(/^\d{10}$/, { message: 'Неверный телефон' })],
  },
});

// Правило длины массива — читает весь массив через `root`
const phoneCountInRange: ModelValidator<PhoneItem[], unknown, MyForm> = (_value, _scope, root) => {
  const count = root.phoneNumbers.length;

  if (count < 1) {
    return { code: 'minItems', message: 'Нужен хотя бы один телефон' };
  }
  if (count > 5) {
    return { code: 'maxItems', message: 'Не более 5 телефонов' };
  }
  return null;
};

const schema = {
  phoneNumbers: { componentProps: { control: model.phoneNumbers, itemComponent: phoneItem } },
  // Правило по всему массиву, привязанное к сигналу массива
  phoneNumbersRule: { value: model.$.phoneNumbers, validators: [phoneCountInRange] },
};

const { valid, errors } = await validateFormModel(model, schema);
```

### Валидация Уникальности Элементов

```typescript
import {
  createModel,
  validateFormModel,
  type ModelValidator,
  type FormModel,
} from '@reformer/core';
import { required } from '@reformer/core/validators';

type TagItem = { label: string };
type MyForm = { tags: TagItem[] };

const model = createModel<MyForm>({ tags: [{ label: '' }] });

const tagItem = (item: FormModel<TagItem>) => ({
  label: { value: item.$.label, validators: [required()] },
});

// Теги должны быть уникальными — читаем элементы через `root`
const uniqueTags: ModelValidator<TagItem[], unknown, MyForm> = (_value, _scope, root) => {
  const labels = root.tags.map((t) => t.label);

  return labels.length !== new Set(labels).size
    ? { code: 'notUnique', message: 'Теги должны быть уникальными' }
    : null;
};

const schema = {
  tags: { componentProps: { control: model.tags, itemComponent: tagItem } },
  tagsRule: { value: model.$.tags, validators: [uniqueTags] },
};

const { valid, errors } = await validateFormModel(model, schema);
```

## Оптимизация Производительности

### Debounce Асинхронной Валидации

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ username: string }>({ username: '' });

const usernameAvailable: ModelValidator<string> = async (value) => {
  const response = await fetch(`/api/check-username?username=${value}`);
  const { available } = await response.json();
  return available ? null : { code: 'usernameTaken', message: 'Имя пользователя занято' };
};

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    // Debounce дорогих API вызовов
    asyncValidators: [usernameAvailable],
    debounce: 500, // Ждать 500мс после остановки ввода
  },
};

const form = createForm({ model, schema });
```

### Отмена Предыдущих Асинхронных Валидаций

ReFormer автоматически отменяет предыдущие асинхронные валидации при запуске новых — когда
прогон начинается до завершения предыдущего, устаревший прогон прерывается (`AbortController`),
поэтому применяется только последний результат:

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

const model = createModel<{ search: string }>({ search: '' });

const hasResults: ModelValidator<string> = async (value) => {
  // Эта валидация автоматически отменяется,
  // если значение меняется снова до её завершения
  const results = await searchAPI(value);
  return results.length > 0 ? null : { code: 'noResults', message: 'Ничего не найдено' };
};

const schema = {
  search: {
    value: model.$.search,
    component: Input,
    asyncValidators: [hasResults],
    debounce: 300,
  },
};

const form = createForm({ model, schema });
```

### Ленивая Валидация

Валидируйте только при необходимости — оберните секцию в branch-узел:

```typescript
import { createModel, validateFormModel } from '@reformer/core';
import { required } from '@reformer/core/validators';

type MyForm = { enabled: boolean; field1: string; field2: string };

const model = createModel<MyForm>({ enabled: false, field1: '', field2: '' });

const schema = {
  children: [
    { value: model.$.enabled },
    {
      // Валидировать только если поле-флаг включено (напр. `enabled: boolean` в форме)
      when: (_scope, root) => root.enabled === true,
      children: [
        { value: model.$.field1, validators: [required()] },
        { value: model.$.field2, validators: [required()] },
      ],
    },
  ],
};

const { valid, errors } = await validateFormModel(model, schema);
```

## Стратегии Валидации по Случаям Использования

### Форма Регистрации

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required, minLength, email } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type RegistrationForm = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
};

const model = createModel<RegistrationForm>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
});

const checkUsernameAvailability: ModelValidator<string> = async (value) => {
  if (!value) return null;
  const { available } = await (await fetch(`/api/check-username?username=${value}`)).json();
  return available ? null : { code: 'usernameTaken', message: 'Имя пользователя занято' };
};

const checkEmailAvailability: ModelValidator<string> = async (value) => {
  if (!value) return null;
  const { available } = await (await fetch(`/api/check-email?email=${value}`)).json();
  return available ? null : { code: 'emailTaken', message: 'Email уже занят' };
};

const strongPassword: ModelValidator<string> = (value) =>
  value && !/(?=.*[A-Z])(?=.*\d)/.test(value)
    ? { code: 'weakPassword', message: 'Добавьте заглавную букву и цифру' }
    : null;

const matchesPassword: ModelValidator<string, unknown, RegistrationForm> = (value, _scope, root) =>
  value && root.password && value !== root.password
    ? { code: 'passwordMismatch', message: 'Пароли не совпадают' }
    : null;

const schema = {
  // Username: синхронная + асинхронная, при blur
  username: {
    value: model.$.username,
    component: Input,
    validators: [required(), minLength(3)],
    asyncValidators: [checkUsernameAvailability],
    updateOn: 'blur',
    debounce: 500,
  },
  // Email: синхронная + асинхронная, при blur
  email: {
    value: model.$.email,
    component: Input,
    validators: [required(), email()],
    asyncValidators: [checkEmailAvailability],
    updateOn: 'blur',
    debounce: 500,
  },
  // Password: только синхронная, при change
  password: {
    value: model.$.password,
    component: Input,
    validators: [required(), minLength(8), strongPassword],
    updateOn: 'change',
  },
  // Confirm password: синхронная зависимая, при change
  confirmPassword: {
    value: model.$.confirmPassword,
    component: Input,
    validators: [required(), matchesPassword],
    updateOn: 'change',
  },
};

const behavior = defineFormBehavior<RegistrationForm>(({ model }) => {
  // Перепроверяем confirmPassword при изменении password
  revalidateWhen([model.$.password], () => void validateFormModel(model, schema));
});

const form = createForm({ model, schema, behavior });
```

### Форма Поиска

```typescript
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { minLength, min } from '@reformer/core/validators';
import { defineFormBehavior, revalidateWhen } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type SearchForm = {
  query: string;
  filters: { category: string; minPrice: number; maxPrice: number };
};

const model = createModel<SearchForm>({
  query: '',
  filters: { category: '', minPrice: 0, maxPrice: 0 },
});

const maxAboveMin: ModelValidator<number, unknown, SearchForm> = (value, _scope, root) =>
  value && root.filters.minPrice && value < root.filters.minPrice
    ? { code: 'invalidRange', message: 'Максимальная цена должна быть больше минимальной' }
    : null;

const schema = {
  // Запрос: минимальная валидация, мгновенная
  query: {
    value: model.$.query,
    component: Input,
    validators: [minLength(2)],
    updateOn: 'change',
  },
  // Фильтры: валидировать при отправке
  filters: {
    category: { value: model.$.filters.category, component: Input },
    minPrice: {
      value: model.$.filters.minPrice,
      component: Input,
      validators: [min(0)],
      updateOn: 'submit',
    },
    maxPrice: {
      value: model.$.filters.maxPrice,
      component: Input,
      validators: [min(0), maxAboveMin],
      updateOn: 'submit',
    },
  },
};

const behavior = defineFormBehavior<SearchForm>(({ model }) => {
  revalidateWhen([model.$.filters.minPrice], () => void validateFormModel(model, schema));
});

const form = createForm({ model, schema, behavior });
```

### Форма Оплаты

```typescript
import { createModel, createForm, type ModelValidator } from '@reformer/core';
import { required, pattern } from '@reformer/core/validators';
import { Input } from '@reformer/ui-kit';

type PaymentForm = { cardNumber: string; expiryDate: string; cvv: string; billingZip: string };

const model = createModel<PaymentForm>({ cardNumber: '', expiryDate: '', cvv: '', billingZip: '' });

const creditCard: ModelValidator<string> = (value) =>
  value && !/^\d{13,19}$/.test(value.replace(/\s/g, ''))
    ? { code: 'invalidCard', message: 'Неверный номер карты' }
    : null;

const validateCardWithBank: ModelValidator<string> = async (value) => {
  if (!value) return null;
  const { accepted } = await (await fetch(`/api/validate-card?number=${value}`)).json();
  return accepted ? null : { code: 'cardRejected', message: 'Карта отклонена' };
};

const notExpired: ModelValidator<string> = (value) => {
  // ... проверка, что MM/YY в будущем
  return value ? null : null;
};

const schema = {
  // Номер карты: синхронная + асинхронная
  cardNumber: {
    value: model.$.cardNumber,
    component: Input,
    validators: [required(), creditCard],
    asyncValidators: [validateCardWithBank],
    updateOn: 'blur',
    debounce: 1000,
  },
  // Срок действия: только синхронная
  expiryDate: {
    value: model.$.expiryDate,
    component: Input,
    validators: [required(), notExpired],
    updateOn: 'blur',
  },
  // CVV: только синхронная
  cvv: {
    value: model.$.cvv,
    component: Input,
    validators: [required(), pattern(/^\d{3,4}$/, { message: 'Неверный CVV' })],
    updateOn: 'blur',
  },
  // Индекс: только синхронная
  billingZip: {
    value: model.$.billingZip,
    component: Input,
    validators: [required(), pattern(/^\d{6}$/, { message: 'Неверный индекс' })],
    updateOn: 'blur',
  },
};

const form = createForm({ model, schema });
```

## Лучшие Практики

### 1. Валидируйте Рано, Валидируйте Часто

```typescript
// ✅ Хорошо - несколько сфокусированных валидаторов
password: {
  value: model.$.password,
  validators: [required(), minLength(8), strongPassword],
},

// ❌ Плохо - единая общая валидация
const generic: ModelValidator<string> = (value) =>
  !value || value.length < 8 || !isStrong(value) ? { code: 'invalid', message: 'Некорректно' } : null;
password: { value: model.$.password, validators: [generic] },
```

### 2. Предоставляйте Конкретные Сообщения об Ошибках

```typescript
// Внутри тела ModelValidator:

// ✅ Хорошо - конкретные ошибки
if (value.length < 8) return { code: 'tooShort', message: 'Минимум 8 символов' };
if (!/[A-Z]/.test(value)) return { code: 'noUppercase', message: 'Добавьте заглавную букву' };
if (!/[0-9]/.test(value)) return { code: 'noNumber', message: 'Добавьте цифру' };

// ❌ Плохо - общая ошибка
if (!isValid(value)) return { code: 'invalid', message: 'Некорректно' };
```

### 3. Используйте Debounce для Дорогих Операций

```typescript
// ✅ Хорошо - debounced асинхронная валидация
username: { value: model.$.username, asyncValidators: [checkAvailability], debounce: 500 },

// ❌ Плохо - валидация при каждом нажатии клавиши
username: { value: model.$.username, asyncValidators: [checkAvailability], updateOn: 'change' },
```

### 4. Используйте Условную Валидацию

```typescript
// ✅ Хорошо - валидировать только при необходимости (branch-узел)
{
  when: (_scope, root) => root.hasCompany === true,
  children: [{ value: model.$.companyName, validators: [required()] }],
}

// ❌ Плохо - всегда валидировать, скрывать ошибки
companyName: { value: model.$.companyName, validators: [required()] },
// Затем скрывать ошибки в UI - расточительно
```

### 5. Разделяйте Синхронную и Асинхронную

```typescript
// ✅ Хорошо - синхронные валидаторы + асинхронный валидатор
email: {
  value: model.$.email,
  validators: [required(), email()],
  asyncValidators: [checkEmailAvailability],
},

// ❌ Плохо - только асинхронная (медленнее обратная связь)
const emailAllInOne: ModelValidator<string> = async (value) => {
  if (!value) return { code: 'required', message: 'Обязательно' };
  if (!isEmail(value)) return { code: 'email', message: 'Неверный email' };
  const available = await checkAvailability(value);
  return available ? null : { code: 'taken', message: 'Занято' };
};
```

## Извлечение Вложенных Правил

Когда тело cross-field-валидатора или условная ветка разрастается дальше нескольких строк,
вынесите его в **именованную top-level-функцию или константу схемы**, типизированную одним из
публичных типов из `@reformer/core`. Это делает основную схему плоской (читается как оглавление)
и выводит **намерение** каждого правила в его имя.

Используйте существующие публичные типы:

- `FormSchemaNode` — фрагмент схемы: branch-узел `{ when, children }` или группа.
- `ModelValidator<TValue, TModel, TRoot>` — field-level или cross-field валидатор для
  `validators` / `asyncValidators` поля. Cross-field правила пишутся в той же сигнатуре —
  соседние поля читаются через аргумент `root`.

### До — inline callbacks

```typescript
const schema = {
  children: [
    { value: model.$.loanType, validators: [required()] },
    {
      when: (_scope, root) => root.loanType === 'mortgage',
      children: [
        { value: model.$.propertyValue, validators: [required(), min(1_000_000)] },
        {
          value: model.$.initialPayment,
          validators: [
            required(),
            (_value, _scope, root) => {
              if (
                root.initialPayment &&
                root.propertyValue &&
                root.initialPayment > root.propertyValue
              ) {
                return { code: 'initialPaymentTooHigh', message: '...' };
              }
              return null;
            },
          ],
        },
      ],
    },
  ],
};
```

### После — извлечённые именованные функции

```typescript
import { type ModelValidator, type FormSchemaNode } from '@reformer/core';
import { required, min } from '@reformer/core/validators';

const initialPaymentVsPropertyValue: ModelValidator<number, unknown, CreditApplicationForm> = (
  _value,
  _scope,
  root
) => {
  if (root.initialPayment && root.propertyValue && root.initialPayment > root.propertyValue) {
    return { code: 'initialPaymentTooHigh', message: '...' };
  }
  return null;
};

const mortgageFieldsBranch: FormSchemaNode = {
  when: (_scope, root) => (root as CreditApplicationForm).loanType === 'mortgage',
  children: [
    { value: model.$.propertyValue, validators: [required(), min(1_000_000)] },
    { value: model.$.initialPayment, validators: [required(), initialPaymentVsPropertyValue] },
  ],
};

const schema: FormSchemaNode = {
  children: [{ value: model.$.loanType, validators: [required()] }, mortgageFieldsBranch],
};
```

### Конвенция именования

Используйте **смысловые** имена (а не дублирующие название оператора):

- Branch-узел (`FormSchemaNode`) → описывает условную ветку:
  `mortgageFieldsBranch`, `employedFieldsBranch`, `residenceAddressBranch`.
- Cross-field `ModelValidator` → описывает проверяемый инвариант:
  `initialPaymentVsPropertyValue`, `paymentToIncomeUnderHalf`, `currentExperienceVsTotal`.
- Field-level `ModelValidator` → описывает проверку поля:
  `validateAdultAge`, `validatePasswordsMatch`, `validatePassportIssueDateNotFuture`.

### Когда выносить

- **Выносить** любое тело валидатора длиннее ~3 строк или ветку, содержащую вложенную ветку.
- **Оставлять inline** короткие одно-строчные условия ветки —
  `(_scope, root) => root.loanType === 'mortgage'` ничего не выигрывает от именования.

## Следующие Шаги

- [Обработка Ошибок](/docs/validation/error-handling) — Обработка и отображение ошибок валидации
- [Кастомные Валидаторы](/docs/validation/custom) — Создание кастомной логики валидации
- [Асинхронная Валидация](/docs/validation/async) — Паттерны серверной валидации
