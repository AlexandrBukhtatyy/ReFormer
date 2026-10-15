# ReFormer

Библиотека реактивного управления состоянием форм для React на сигнальной архитектуре.

[![npm version](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![npm downloads](https://img.shields.io/npm/dm/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Ссылки

- [Документация](https://alexandrbukhtatyy.github.io/ReFormer/) — полная документация и справочник по API
- [Песочница](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer?file=projects/react-playground/src/App.tsx) — попробуйте ReFormer в StackBlitz

## Команды

### Основные команды

```
# Установить зависимости для @reformer/core
npm install -w @reformer/core

# Собрать @reformer/core
npm run build -w @reformer/core


# Установить зависимости для @reformer/cdk
npm install -w @reformer/cdk

# Собрать @reformer/cdk
npm run build -w @reformer/cdk


# Установить зависимости для @reformer/renderer-react
npm install -w @reformer/renderer-react

# Собрать @reformer/renderer-react
npm run build -w @reformer/renderer-react


# Установить зависимости для react-playground
npm install -w react-playground

# Собрать react-playground
npm run build -w react-playground

# Запустить react-playground в режиме разработки
npm run dev -w react-playground
```

### Запуск тестов

Инструкции по настройке, команды тестов и полный справочник команд — в [README.md](./projects/react-playground-e2e/README.md).

E2E визуального билдера — отдельный проект: [reformer-builder-playground-e2e](./projects/reformer-builder-playground-e2e/README.md) открывает в билдере каталог-образец [reformer-builder-playground](./projects/reformer-builder-playground/README.md).

## Пакеты

| Пакет                                                          | Описание                                                                 | Версия                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [@reformer/core](./packages/reformer)                          | Ядро управления состоянием форм на сигнальной архитектуре                | [![npm](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)                     |
| [@reformer/cdk](./packages/reformer-cdk)                       | Headless-составные компоненты — `FieldArray`, `FormWizard`, `FormField`  | [![npm](https://img.shields.io/npm/v/@reformer/cdk.svg)](https://www.npmjs.com/package/@reformer/cdk)                       |
| [@reformer/ui-kit](./packages/reformer-ui-kit)                 | 72 компонента на shadcn/ui (new-york, Tailwind CSS v4), готовые для форм | [![npm](https://img.shields.io/npm/v/@reformer/ui-kit.svg)](https://www.npmjs.com/package/@reformer/ui-kit)                 |
| [@reformer/renderer-react](./packages/reformer-renderer-react) | React-рендерер сборки — TS-дерево схемы формы → JSX                      | [![npm](https://img.shields.io/npm/v/@reformer/renderer-react.svg)](https://www.npmjs.com/package/@reformer/renderer-react) |
| [@reformer/renderer-json](./packages/reformer-renderer-json)   | Рендерер на основе JSON — `JsonFormSchema` + реестр компонентов          | [![npm](https://img.shields.io/npm/v/@reformer/renderer-json.svg)](https://www.npmjs.com/package/@reformer/renderer-json)   |
| [@reformer/mcp](./packages/reformer-mcp)                       | MCP-сервер — отдаёт документацию, рецепты и JSDoc-символы ИИ-ассистентам | [![npm](https://img.shields.io/npm/v/@reformer/mcp.svg)](https://www.npmjs.com/package/@reformer/mcp)                       |

## Возможности

- **Дружелюбие к ИИ** — есть LLMs.txt для ИИ-ассистентов, доступен MCP-сервер
- **На сигналах** — реактивное состояние на @preact/signals-core
- **Декларативная валидация** — встроенные валидаторы + поддержка кастомных sync/async
- **Динамические поведения** — вычисляемые поля, условная логика, наблюдатели за полями
- **TypeScript-first** — полный вывод типов и типобезопасность
- **Tree-shaking** — импортируйте только то, что нужно
- **Многошаговые формы** — поддержка мастера с валидацией по шагам
- **Динамические массивы** — добавление/удаление элементов формы через FieldArray
- **React с 16.8 по 19** — широкая совместимость

## Установка

```bash
# Ядро библиотеки
npm install @reformer/core

# Стилизованные инпуты + обёртка FormField (используются в «Быстром старте» ниже)
npm install @reformer/ui-kit

# Опционально: headless-составные компоненты (FieldArray, FormWizard)
npm install @reformer/cdk

# Опционально: рендеринг на основе схемы (выберите один — см. «Рендеринг: три подхода»)
npm install @reformer/renderer-react   # разметка как типобезопасное TS-дерево
npm install @reformer/renderer-json    # разметка как чистый JSON + реестр
```

## Быстрый старт

Значения формы живут в **модели**, разметка — в **схеме формы**: дереве узлов, где узел поля
привязан к ручке модели (`model: model.$.email`) и несёт `component` и `componentProps`.
**Правил в схеме нет** — валидация отдельный слой (`defineValidation`, см. [Валидаторы](#валидаторы)).
`createForm` собирает модель, форму, правила и отправку одним вызовом, а `useFormBundle` держит
сборку стабильной между рендерами. В JSX на поле — один `<FormField control={form.x} />`.

```tsx
import type { FormEvent } from 'react';
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { Button, FormField, Input, InputPassword } from '@reformer/ui-kit';

type LoginForm = {
  email: string;
  password: string;
};

// Схема формы: узел поля привязан к ручке модели и несёт компонент с пропсами. Правил в ней нет.
const loginSchema = (model: FormModel<LoginForm>): FormSchemaNode => ({
  children: [
    {
      model: model.$.email,
      component: Input,
      componentProps: { label: 'Email', placeholder: 'you@example.com' },
    },
    { model: model.$.password, component: InputPassword, componentProps: { label: 'Пароль' } },
  ],
});

// Правила — отдельный слой над той же моделью. Ссылка уровня модуля: на ней держится отмена
// устаревших прогонов.
const loginValidation = defineValidation<LoginForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
});

// Одна сборка: модель из начальных значений, форма по схеме, правила и отправка.
const createLogin = () =>
  createForm<LoginForm>({
    initial: { email: '', password: '' },
    schema: loginSchema,
    validation: loginValidation,
  });

function LoginFormExample() {
  // Фабрика вызывается ровно один раз — введённое переживает ререндеры.
  const bundle = useFormBundle(createLogin);
  const { form } = bundle;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    // Один прогон всех правил. При замечаниях обработчик не вызывается, а вся форма помечается
    // тронутой — ошибки видны у каждого поля. Обработчик получает значения модели.
    const outcome = await bundle.submission.submit((values) =>
      console.log('Данные формы:', values)
    );
    if (outcome.status === 'submitted') form.reset();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* FormField рисует подпись, поле и ошибку и подключает к полю значение и события ноды */}
      <FormField control={form.email} testId="email" />
      <FormField control={form.password} testId="password" />
      <Button type="submit">Войти</Button>
    </form>
  );
}
```

`bundle.submission.submit(handler)` возвращает `SubmitResult`: `submitted` (с ответом
обработчика), `invalid`, `error` или `cancelled` (с результатом проверки, обработчик не вызывался)
либо `failed` (обработчик бросил исключение). Пока работает обработчик, `bundle.submission.submitting`
— `true`. Вне React владелец снимает сборку сам — `bundle.dispose()`, когда форма больше не нужна.

> Не хотите `@reformer/ui-kit`? В `component` / `componentProps` можно передать любой
> React-компонент (вашу собственную дизайн-систему) или написать тонкую обёртку поля вокруг
> `useFormControl(control)` — см. [README @reformer/core](./packages/reformer/README.md).

## Валидаторы

Валидация — **отдельный слой**, а не часть схемы формы. Правила объявляются схемой
`defineValidation<T>(({ model, cross }) => …)` над той же моделью; операторы импортируются из
`@reformer/core/validation`. Сборка прогоняет правила **по требованию**: `bundle.validate()` — вся
форма, `bundle.validateStep(id)` — шаг мастера, `bundle.submission.submit(handler)` — отправка.
Прогон разносит замечания по нодам (поле само подсветится), гасит поля, ставшие валидными, а правило
с `severity: 'warning'` отправку не блокирует. Устаревший прогон тех же правил отменяется
автоматически, `AbortSignal` прокидывается в async-правила. Для модели без сборки есть отдельный
раннер `validateModel(model, rules)` → `boolean`.

Операторы (работают только внутри схемы правил):

- `validate(handle, [rules])` — синхронные правила поля; правило — фабрика или `Rule<T>` `(value) => ValidationIssue | null`.
- `validateAsync(handle, [asyncRules])` — асинхронные правила `(value, { signal }) => Promise<…>` (прогон их дожидается; сетевой сбой → верните `null`).
- `validateWhen(() => condition, () => { … })` — условная валидация: правила внутри активны, пока условие истинно (включение и сброс поля — дело поведения `enableWhen`, не валидации).
- `cross(handle, (values) => issue | null)` — правило на несколько полей; берётся из аргумента схемы (`({ model, cross }) => …`), не импортируется. `values` — снимок модели своей области, соседние поля читаются из него.
- `applyEach(model.$.items, itemRules)` — правила для каждой строки массива: `itemRules` — такая же схема над строкой.
- `apply(...schemas)` — композиция под-схем над той же моделью (например, «вся форма = все шаги»); `apply(model.$.address, addressRules)` — под-схема над группой.

```tsx
import {
  createForm,
  type FormModel,
  type FormSchemaNode,
  type ValidationIssue,
} from '@reformer/core';
import {
  defineValidation,
  validate,
  validateAsync,
  validateWhen,
  type Rule,
  type AsyncRule,
} from '@reformer/core/validation';
import { required, email, minLength, min, max } from '@reformer/core/validators';
import { Input, InputNumber, InputPassword } from '@reformer/ui-kit';

type RegistrationForm = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  age: number;
  loanType: 'personal' | 'mortgage';
  propertyValue: number;
};

// Своё правило значения — `Rule<T>`: `(value) => ValidationIssue | null`. Правило несёт код,
// текст по коду даёт словарь формы (`defineIssueMessages` из `@reformer/core/i18n`).
const strongPassword: Rule<string> = (value) =>
  value && !/\d/.test(value) ? { code: 'password.weak' } : null;

// Правило на несколько полей — обычная функция над СНИМКОМ модели.
const passwordsMatch = (values: RegistrationForm): ValidationIssue | null =>
  values.confirmPassword && values.confirmPassword !== values.password
    ? { code: 'confirmPassword.mismatch' }
    : null;

// Async-правило — `AsyncRule<T>`: `(value, { signal }) => Promise<…>`. Сетевой сбой не блокирует.
const usernameAvailable: AsyncRule<string> = async (value, { signal }) => {
  if (!value || value.length < 3) return null;
  try {
    const response = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`, { signal });
    return (await response.json()).available ? null : { code: 'username.taken' };
  } catch {
    return null; // отмена и сбой сети отправку не валят
  }
};

// Схема ПРАВИЛ над моделью — ссылка уровня модуля (отмена устаревших прогонов ключится по ней).
const registrationValidation = defineValidation<RegistrationForm>(({ model, cross }) => {
  validate(model.$.username, [required(), minLength(3)]);
  validateAsync(model.$.username, [usernameAvailable]);

  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8), strongPassword]);

  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch);

  validate(model.$.age, [min(18), max(120)]);

  // Условная валидация: правила propertyValue действуют только для ипотеки.
  validateWhen(
    () => model.loanType === 'mortgage',
    () => validate(model.$.propertyValue, [required(), min(100000)])
  );
});

// Схема формы — только привязка полей; её ноды примут замечания прогона.
const registrationSchema = (model: FormModel<RegistrationForm>): FormSchemaNode => ({
  children: [
    { model: model.$.username, component: Input },
    { model: model.$.email, component: Input },
    { model: model.$.password, component: InputPassword },
    { model: model.$.confirmPassword, component: InputPassword },
    { model: model.$.age, component: InputNumber },
    { model: model.$.loanType, component: Input },
    { model: model.$.propertyValue, component: InputNumber },
  ],
});

const registration = createForm<RegistrationForm>({
  initial: {
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: 0,
    loanType: 'personal',
    propertyValue: 0,
  },
  schema: registrationSchema,
  validation: registrationValidation,
});

// Проверка по требованию: результат со статусом, замечания уже лежат на нодах формы.
const result = await registration.validate();
console.log(result.status); // 'valid' | 'invalid' | 'error' | 'cancelled'
```

**Встроенные фабрики** (`@reformer/core/validators`, каждая принимает опц. `{ code }` и корректно
обрабатывает пустое значение — `null` / `undefined` / `''`):
`required`, `minLength`, `maxLength`, `min`, `max`, `pattern`, `email`, `url`, `phone` ·
числовые: `isNumber`, `integer`, `multipleOf`, `nonNegative`, `nonZero` ·
даты: `isDate`, `minDate`, `maxDate`, `pastDate`, `futureDate`, `minAge`, `maxAge`.

## Поведения

Реактивное поведение описывается декларативной схемой `defineFormBehavior<T>(({ model, form }) => …)`
и подключается к сборке — `createForm({ …, behavior })`. Сборка владеет его жизненным циклом:
подписки, очистка и защита от циклов внутри каждого оператора. Операции значений (`compute`,
`computeFrom`, `copyFrom`) пишут сигналы модели (`model.$`), а операции состояния и UI
(`enableWhen`, `onChange` + `updateComponentProps`) — ноды формы (`form.*`).

```tsx
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import {
  defineFormBehavior,
  compute,
  computeFrom,
  copyFrom,
  enableWhen,
  onChange,
} from '@reformer/core/behaviors';
import { Input, InputNumber, Select } from '@reformer/ui-kit';

type OrderForm = {
  price: number;
  quantity: number;
  discount: number;
  total: number;
  grandTotal: number;
  email: string;
  sameEmail: boolean;
  emailCopy: string;
  needsShipping: boolean;
  shippingAddress: string;
  country: string;
  city: string;
};

declare function fetchCities(
  country: string,
  signal: AbortSignal
): Promise<{ value: string; label: string }[]>;

const orderBehavior = defineFormBehavior<OrderForm>(({ model, form }) => {
  // Вычисляемое поле. `compute(target, () => …)` отслеживает зависимости по чтению model.*;
  // `computeFrom([...sources], target, fn)` — явный список источников-сигналов.
  compute(model.$.total, () => model.price * model.quantity);
  computeFrom(
    [model.$.total, model.$.discount],
    model.$.grandTotal,
    (total: number, discount: number) => total - discount
  );

  // Копирование source → target, условно (скаляр или группа целиком).
  copyFrom(model.$.email, model.$.emailCopy, { when: () => model.sameEmail === true });

  // Условное включение поля; resetOnDisable возвращает значение при выключении.
  enableWhen(model.$.shippingAddress, () => model.needsShipping === true, { resetOnDisable: true });

  // Реакция на изменение (можно async; 2-й аргумент колбэка — { signal } для отмены устаревших
  // запросов). Колбэк исполняется вне effect-контекста — можно писать ноды формы.
  onChange(model.$.country, async (country, { signal }) => {
    const cities = await fetchCities(country, signal);
    form.city.updateComponentProps({ options: cities });
  });
});

const orderSchema = (model: FormModel<OrderForm>): FormSchemaNode => ({
  children: [
    { model: model.$.price, component: InputNumber },
    { model: model.$.quantity, component: InputNumber },
    { model: model.$.country, component: Input },
    { model: model.$.city, component: Select },
    { model: model.$.shippingAddress, component: Input },
  ],
});

const order = createForm<OrderForm>({
  initial: {
    price: 0,
    quantity: 1,
    discount: 0,
    total: 0,
    grandTotal: 0,
    email: '',
    sameEmail: false,
    emailCopy: '',
    needsShipping: false,
    shippingAddress: '',
    country: '',
    city: '',
  },
  schema: orderSchema,
  behavior: orderBehavior,
});
```

> Полный набор операторов: `compute`, `computeFrom`, `copyFrom`, `onChange`, `enableWhen` /
> `disableWhen`, `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`, а также `apply`
> (под-схема для группы) и `applyEach` (на каждую строку массива). Правила узлов схемы —
> `hideWhen`, `onComponentEvent`, `renderEffect`, `onMount` — пишутся в том же поведении через
> `schema.node(selector)`.

> Мост «поведение → валидация»: поведение само правила не прогоняет, поэтому перепроверку поля,
> которое пишет поведение, вешают через
> `revalidateWhen([model.$.dependency], () => void validateModel(model, rules))`.

## Массивы и многошаговые формы

### FieldArray

Массивы объектов принадлежат модели. Шаблон новой строки объявляется там же, где начальные
значения, — `arrayOf(blank)`: его берёт кнопка «Добавить». В схеме формы массив — узел
`{ model: model.$.items, item: (row) => rowSchema }`: без него формы строк не строятся. UI строится
либо стилизованным `FieldArraySection` (типизированный `itemComponent` — **канонический вариант**),
либо headless-составным `FieldArray.*` из `@reformer/cdk/field-array`.

```tsx
// Канонический вариант: типизированная стилизованная секция из @reformer/ui-kit/field-array.
import type { FC } from 'react';
import { arrayOf, createForm, type FormGroup, type FormModel } from '@reformer/core';
import { FormField, Input, InputNumber } from '@reformer/ui-kit';
import { FieldArraySection } from '@reformer/ui-kit/field-array';

type Property = { type: string; estimatedValue: number };
type PropertiesForm = { properties: Property[] };

const blankProperty = (): Property => ({ type: 'apartment', estimatedValue: 0 });

const assets = createForm<PropertiesForm>({
  initial: { properties: arrayOf(blankProperty) },
  schema: (model: FormModel<PropertiesForm>) => ({
    children: [
      {
        model: model.$.properties,
        item: (row: FormModel<Property>) => ({
          children: [
            { model: row.$.type, component: Input },
            { model: row.$.estimatedValue, component: InputNumber },
          ],
        }),
      },
    ],
  }),
});

// itemComponent получает типизированную форму строки: FormGroup<Property>.
const PropertyForm: FC<{ control: FormGroup<Property> }> = ({ control }) => (
  <>
    <FormField control={control.type} />
    <FormField control={control.estimatedValue} />
  </>
);

<FieldArraySection
  control={assets.form.properties}
  itemComponent={PropertyForm}
  title="Имущество"
/>;
```

```tsx
// Headless-составной вариант: полный контроль над разметкой (@reformer/cdk/field-array).
// Тип строки <Property> на List даёт типизированную форму строки.
import { FieldArray } from '@reformer/cdk/field-array';

<FieldArray.Root control={assets.form.properties}>
  <FieldArray.Empty>
    <p>Пока нет элементов</p>
  </FieldArray.Empty>

  <FieldArray.List<Property>>
    {({ control, id, index, remove }) => (
      <div key={id}>
        <h4>Элемент №{index + 1}</h4>
        <FormField control={control.type} />
        <button type="button" onClick={remove}>
          Удалить
        </button>
      </div>
    )}
  </FieldArray.List>

  <FieldArray.AddButton>Добавить элемент</FieldArray.AddButton>
</FieldArray.Root>;
```

### FormWizard (многошаговый мастер)

Шаги, их порядок и проверку держит **поток шагов** сборки: `createForm({ flow: { steps } })`, где
у шага есть `id` и свои правила. «Далее» проверяет правила текущего шага (`bundle.flow.next()`),
отправка — всю форму: правила шагов и `validation.extras`. `@reformer/ui-kit/form-wizard` —
стилизованный мастер-адаптер потока: в разметке JSX ему передают форму, поток и список шагов
(`{ number, title, icon, body }`, по порядку шагов потока). Внутри `FormRenderer` мастер — обычный
узел схемы и берёт форму и поток из сборки сам, см. [обзор @reformer/ui-kit](./packages/reformer-ui-kit/README.md).

```tsx
import { createForm, type FormGroup } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Input, InputPassword } from '@reformer/ui-kit';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';

type SignupForm = { email: string; password: string };

// Правила каждого шага — отдельная схема; полный набор сборка собирает из шагов сама.
const accountRules = defineValidation<SignupForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});
const securityRules = defineValidation<SignupForm>(({ model }) => {
  validate(model.$.password, [required(), minLength(8)]);
});

const createSignup = () =>
  createForm<SignupForm>({
    initial: { email: '', password: '' },
    schema: (model) => ({
      children: [
        { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
        { model: model.$.password, component: InputPassword, componentProps: { label: 'Пароль' } },
      ],
    }),
    flow: {
      steps: [
        { id: 'account', rules: accountRules },
        { id: 'security', rules: securityRules },
      ],
    },
  });

const AccountStep = ({ control }: { control: FormGroup<SignupForm> }) => (
  <FormField control={control.email} />
);
const SecurityStep = ({ control }: { control: FormGroup<SignupForm> }) => (
  <FormField control={control.password} />
);

// Порядок записей = порядок шагов потока: STEPS[i] — шаг flow.steps[i].
const STEPS: FormWizardStep<SignupForm>[] = [
  { number: 1, title: 'Аккаунт', icon: '📧', body: AccountStep },
  { number: 2, title: 'Пароль', icon: '🔒', body: SecurityStep },
];

function SignupWizard() {
  const signup = useFormBundle(createSignup);

  // Вне FormRenderer мастер зовёт колбэк по нажатию: проверку и отправку делает сборка.
  const submit = async () => {
    const outcome = await signup.submission.submit((values) => console.log('отправка', values));
    if (outcome.status === 'invalid') console.warn('Проверьте заполнение формы');
  };

  return <FormWizard form={signup.form} flow={signup.flow} steps={STEPS} onSubmit={submit} />;
}
```

## Рендеринг: три подхода

Одна и та же форма рендерится **тремя** способами — выбирайте по тому, где живёт описание
разметки:

| Подход                         | Разметка описывается          | Когда выбирать                                                      |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------------- |
| **Императивный JSX**           | вручную в JSX (`<FormField>`) | обычные формы; максимальный контроль над разметкой                  |
| **`@reformer/renderer-react`** | TS-дерево схемы формы         | разметка как данные, но типобезопасно (переход к определению в IDE) |
| **`@reformer/renderer-json`**  | чистый JSON + реестр          | схема из БД / CMS / приходит строкой с сервера                      |

Первый способ — это [Быстрый старт](#быстрый-старт) выше (`<FormField control={form.x} />` руками).
Ниже — два варианта на основе схемы. Во всех трёх **сборка одна и та же** — `createForm`: модель,
правила, поведение, поток шагов и отправка. Меняется только вид схемы (билдер TS-дерева или JSON
с реестром) и то, кто рисует результат.

### @reformer/renderer-react

Разметка — TS-дерево схемы формы: узлы полей несут `model: model.$.x` (ручку модели) и
`component`. **Одно дерево** служит и форме (ноды полей), и рендеру: `<FormRenderer form={bundle} />`
рисует сборку целиком.

```tsx
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { FormRenderer } from '@reformer/renderer-react';
import { Box, FormField, Input, InputPassword } from '@reformer/ui-kit';

type LoginForm = { email: string; password: string };

// Схема формы: контейнер и поля, у поля — ручка модели, компонент и пропсы. Без правил.
const loginTree = (model: FormModel<LoginForm>): FormSchemaNode => ({
  component: Box,
  componentProps: { className: 'space-y-4' },
  children: [
    {
      selector: 'email',
      model: model.$.email,
      component: Input,
      componentProps: { label: 'Email' },
    },
    { model: model.$.password, component: InputPassword, componentProps: { label: 'Пароль' } },
  ],
});

// Валидация — отдельный слой над той же моделью (как в «Валидаторах»).
const loginValidation = defineValidation<LoginForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
});

function LoginPage() {
  const bundle = useFormBundle(() =>
    createForm<LoginForm>({
      initial: { email: '', password: '' },
      schema: loginTree,
      validation: loginValidation,
    })
  );

  // Программное управление узлом по selector: bundle.render.node('email').setHidden(true).
  // fieldWrapper — обёртка каждого поля (подпись → поле → ошибка).
  return <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
}
```

> Разметка как данные, но типобезопасно: `model.$.email` — типизированная ручка (переход к
> определению в IDE, безопасный рефакторинг). Подробнее —
> [обзор @reformer/renderer-react](./packages/reformer-renderer-react/README.md).

### @reformer/renderer-json

Разметка — **чистый JSON** формата 2: привязки кодируются строками-операторами (`$model(...)`,
`$component(...)`, `$dataSource(...)`), поэтому схему можно положить в `.json` или принять строкой
с сервера или из CMS. Компоненты и данные разрешаются через **реестр** (`defineRegistry`), который
передаётся в ту же сборку `createForm`; рисует результат тот же `FormRenderer`. Правил в JSON нет —
они живут отдельной TS-схемой над моделью.

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { defineJsonSchema, defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import { Box, FormField, Input, InputPassword } from '@reformer/ui-kit';

type LoginForm = { email: string; password: string };

// 1. Разметка как ЧИСТЫЙ JSON (могла прийти строкой с сервера, из CMS или БД).
//    Поле: model '$model(path)' + component '$component(Name)'; контейнер: children.
//    defineJsonSchema<T> сужает пути '$model(...)' до полей модели.
const loginDocument = defineJsonSchema<LoginForm>({
  format: 2,
  root: {
    component: '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [
      {
        selector: 'email',
        model: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
      },
      {
        model: '$model(password)',
        component: '$component(InputPassword)',
        componentProps: { label: 'Пароль' },
      },
    ],
  },
});

// 2. Реестр: имена-строки из JSON → React-компоненты и данные. FIELD_WRAPPER — обёртка поля.
const registry = defineRegistry((registration) => {
  registration.component('Box', Box);
  registration.component('Input', Input);
  registration.component('InputPassword', InputPassword);
  registration.component(FIELD_WRAPPER, FormField);
});

function LoginPage() {
  // 3. Одна сборка: реестр строит дерево из документа; обёртка поля едет в сборке.
  const bundle = useFormBundle(() =>
    createForm<LoginForm>({
      initial: { email: '', password: '' },
      schema: loginDocument,
      registry,
    })
  );

  return <FormRenderer form={bundle} />;
}
```

> Голые строки не разрешаются: нужны операторы — `component: '$component(Input)'`,
> `model: '$model(email)'`. `selector` — идентификатор узла для правил узлов в поведении, а не путь
> к полю. Документ прежнего формата переводит `migrateJsonSchema`. Полный язык (`$dataSource`, `$fn`,
> `$part`, массивы) — [обзор @reformer/renderer-json](./packages/reformer-renderer-json/README.md).

## MCP-сервер (интеграция с ИИ)

Для ИИ-ассистентов вроде Claude установите MCP-сервер:

```bash
npm install -g @reformer/mcp
```

Добавьте в конфиг Claude:

```json
{
  "mcpServers": {
    "reformer": {
      "command": "reformer-mcp"
    }
  }
}
```

## Лицензия

MIT
