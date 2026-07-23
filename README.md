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

## Пакеты

| Пакет                                                          | Описание                                                                 | Версия                                                                                                                      |
| -------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| [@reformer/core](./packages/reformer)                          | Ядро управления состоянием форм на сигнальной архитектуре                | [![npm](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)                     |
| [@reformer/cdk](./packages/reformer-cdk)                       | Headless-составные компоненты — `FormArray`, `FormWizard`, `FormField`   | [![npm](https://img.shields.io/npm/v/@reformer/cdk.svg)](https://www.npmjs.com/package/@reformer/cdk)                       |
| [@reformer/ui-kit](./packages/reformer-ui-kit)                 | 72 компонента на shadcn/ui (new-york, Tailwind CSS v4) + form-версии     | [![npm](https://img.shields.io/npm/v/@reformer/ui-kit.svg)](https://www.npmjs.com/package/@reformer/ui-kit)                 |
| [@reformer/renderer-react](./packages/reformer-renderer-react) | React-рендерер на основе схемы — TS `RenderSchema` → JSX                 | [![npm](https://img.shields.io/npm/v/@reformer/renderer-react.svg)](https://www.npmjs.com/package/@reformer/renderer-react) |
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
- **Динамические массивы** — добавление/удаление элементов формы через FormArray
- **React с 16.8 по 19** — широкая совместимость

## Установка

```bash
# Ядро библиотеки
npm install @reformer/core

# Стилизованные инпуты + обёртка FormField (используются в «Быстром старте» ниже)
npm install @reformer/ui-kit

# Опционально: headless-составные компоненты (FormArray, FormWizard)
npm install @reformer/cdk

# Опционально: рендеринг на основе схемы (выберите один — см. «Рендеринг: три подхода»)
npm install @reformer/renderer-react   # разметка как типобезопасное TS-дерево
npm install @reformer/renderer-json    # разметка как чистый JSON + реестр
```

## Быстрый старт

Архитектура **M1**: сначала создаётся **модель данных** (`createModel`) — источник истины
значений, затем **форма** (`createForm({ model, schema })`), где схема (layout) привязывает каждое поле к
сигналу модели (`model.$.field`) и несёт его `component` + `componentProps`. **Валидаторов в layout нет** —
правила живут отдельным слоём (`defineValidationSchema` над той же моделью + раннер `validateModel`,
см. [Валидаторы](#валидаторы)). В JSX рендерится один универсальный `<FormField control={form.x} />` на поле — без обёрток на каждое поле.

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, validateModel } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { Button, FormField, InputField, InputPasswordField } from '@reformer/ui-kit';

// Тип формы — `type` alias (структурная совместимость с generic-ограничением внутри библиотеки).
type LoginForm = {
  email: string;
  password: string;
};

// Схема ПРАВИЛ — отдельный слой над моделью (layout ниже валидаторов НЕ несёт).
// `validate(sig, [rules])` вешает правила на поле; фабрики — из `@reformer/core/validators`.
// Стабильный module-level `const` (важно для отмены устаревших прогонов в `validateModel`).
const loginValidation = defineValidationSchema<LoginForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
});

function LoginFormExample() {
  // model + form создаются ОДИН раз (useMemo, пустой массив зависимостей) —
  // иначе форма пересоздаётся на каждый рендер.
  const { model, form } = useMemo(() => {
    // 1. Модель — источник истины значений.
    const model = createModel<LoginForm>({ email: '', password: '' });

    // 2. Схема (layout): поле → сигнал модели (model.$.field) + component/componentProps. Без validators.
    const schema = {
      email: {
        value: model.$.email,
        component: InputField,
        componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
      },
      password: {
        value: model.$.password,
        component: InputPasswordField,
        componentProps: { label: 'Пароль' },
      },
    };

    // 3. Форма — реактивные ноды поверх сигналов модели.
    const form = createForm<LoginForm>({ model, schema });
    return { model, form };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Флоу отправки M1: markAsTouched (показать ошибки) → validateModel(model, schema) → model.get().
    // Раннер сам разносит ошибки по нодам формы; form.submit()/form.validate() схему НЕ прогоняют.
    form.markAsTouched();
    const valid = await validateModel(model, loginValidation);
    if (!valid) return;

    console.log('Данные формы:', model.get());
    form.reset();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* FormField рендерит Label → Control → Error и подключает value/onChange/onBlur ноды */}
      <FormField control={form.email} testId="email" />
      <FormField control={form.password} testId="password" />

      <Button type="submit" disabled={form.pending.value}>
        {form.pending.value ? 'Проверка…' : 'Войти'}
      </Button>
    </form>
  );
}
```

> Не хотите `@reformer/ui-kit`? В `component` / `componentProps` можно передать любой
> React-компонент (вашу собственную дизайн-систему) или написать тонкую обёртку поля вокруг
> `useFormControl(control)` — см. [README @reformer/core](./packages/reformer/README.md).

## Валидаторы

Валидация — **отдельный слой**, а не часть layout-схемы. Правила объявляются схемой
`defineValidationSchema<T>(({ model }) => …)` над той же моделью; операторы импортируются из
`@reformer/core/validation`. Раннер `validateModel(model, schema)` прогоняет схему **по требованию**
(отправка / шаг мастера): разносит ошибки по нодам формы (поле само подсветится), гасит поля, ставшие
валидными, и возвращает `boolean` (правило с `severity: 'warning'` не блокирует). ⚠️ `form.validate()` /
`form.submit()` схему **не** прогоняют — раннер вызывается явно. Устаревший прогон той же `(model, schema)`
отменяется автоматически, `AbortSignal` прокидывается в async-правила.

Операторы (голые, работают только внутри прогона `validateModel`):

- `validate(sig, [rules])` — синхронные правила поля; `rules` — фабрики или `Rule<T>` `(value) => ValidationError | null`.
- `validateAsync(sig, [asyncRules])` — асинхронные правила `(value, { signal }) => Promise<…>` (раннер их дожидается; сетевой сбой → верните `null`).
- `validateWhen(() => cond, () => { … })` — условная валидация: правила внутри активны/гасятся по `cond` (включение/сброс поля — дело поведения `enableWhen`, не валидации).
- `cross(sig, (f) => err | null)` — cross-field; `f` — снапшот модели scope (`model.get()`), соседние поля читаем из него.
- `each(arr, (im) => { … })` — правила на каждый элемент массива модели (`im` — под-модель элемента).
- `apply(...schemas)` — композиция под-схем над той же моделью (например, «вся форма = все шаги»).

```tsx
import { createModel, createForm, type ValidationError } from '@reformer/core';
import {
  defineValidationSchema,
  validate,
  validateAsync,
  validateWhen,
  cross,
  validateModel,
  type Rule,
  type AsyncRule,
} from '@reformer/core/validation';
import { required, email, minLength, min, max } from '@reformer/core/validators';
import { InputField, InputPasswordField } from '@reformer/ui-kit';

type RegistrationForm = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  age: number;
  loanType: 'personal' | 'mortgage';
  propertyValue: number;
};

// Кастомное правило значения — `Rule<T>`: `(value) => ValidationError | null`.
const strongPassword: Rule<string> = (value) =>
  value && !/\d/.test(value) ? { code: 'weak', message: 'Пароль должен содержать цифру' } : null;

// Cross-field — обычная функция над СНАПШОТОМ модели; соседние поля читаем из снапшота (без каста).
const passwordsMatch = (f: RegistrationForm): ValidationError | null =>
  f.confirmPassword && f.confirmPassword !== f.password
    ? { code: 'mismatch', message: 'Пароли не совпадают' }
    : null;

// Async-правило — `AsyncRule<T>`: `(value, { signal }) => Promise<…>`. Сетевой сбой НЕ блокирует (верните null).
const usernameAvailable: AsyncRule<string> = async (value, { signal }) => {
  if (!value || value.length < 3) return null;
  try {
    const res = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`, { signal });
    return (await res.json()).available
      ? null
      : { code: 'taken', message: 'Имя пользователя занято' };
  } catch {
    return null; // отмена/сбой сети submit не валят
  }
};

// Схема ПРАВИЛ над моделью — стабильный module-level `const`
// (раннер ключит отмену устаревших прогонов по идентичности схемы).
const registrationValidation = defineValidationSchema<RegistrationForm>(({ model }) => {
  validate(model.$.username, [required(), minLength(3)]);
  validateAsync(model.$.username, [usernameAvailable]);

  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8), strongPassword]);

  validate(model.$.confirmPassword, [required()]);
  cross(model.$.confirmPassword, passwordsMatch);

  validate(model.$.age, [min(18), max(120)]);

  // Условная валидация: правила propertyValue активны только для ипотеки; иначе поле гасится.
  validateWhen(
    () => model.loanType === 'mortgage',
    () => validate(model.$.propertyValue, [required(), min(100000)])
  );
});

const model = createModel<RegistrationForm>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  age: 0,
  loanType: 'personal',
  propertyValue: 0,
});

// Layout — только привязка полей (без validators, см. «Быстрый старт»); его ноды примут ошибки раннера.
const schema = {
  username: { value: model.$.username, component: InputField },
  email: { value: model.$.email, component: InputField },
  password: { value: model.$.password, component: InputPasswordField },
  confirmPassword: { value: model.$.confirmPassword, component: InputPasswordField },
  age: { value: model.$.age, component: InputField },
  loanType: { value: model.$.loanType, component: InputField },
  propertyValue: { value: model.$.propertyValue, component: InputField },
};
const form = createForm<RegistrationForm>({ model, schema });

// Прогон по требованию (например, в onSubmit): разносит ошибки по нодам формы, возвращает boolean.
const valid = await validateModel(model, registrationValidation);
```

**Встроенные фабрики** (`@reformer/core/validators`, каждая принимает опц. `{ message }` и корректно
обрабатывает nullable-значение — `null` / `undefined` / `''`):
`required`, `minLength`, `maxLength`, `min`, `max`, `pattern`, `email`, `url`, `phone` ·
числовые: `isNumber`, `integer`, `multipleOf`, `nonNegative`, `nonZero` ·
даты: `isDate`, `minDate`, `maxDate`, `pastDate`, `futureDate`, `minAge`, `maxAge`.

## Поведения

Реактивное поведение описывается декларативной схемой `defineFormBehavior<T>(({ model, form }) => …)`
и подключается через `createForm({ model, schema, behavior })` — форма владеет жизненным циклом
(подписки/очистка/защита от циклов внутри каждого оператора). Операции значений (`compute`,
`computeFrom`, `copyFrom`) пишут сигналы модели (`model.$`), а операции состояния/UI (`enableWhen`,
`onChange` + `updateComponentProps`) — ноды формы (`form.*`).

```tsx
import { createForm } from '@reformer/core';
import {
  defineFormBehavior,
  compute,
  computeFrom,
  copyFrom,
  enableWhen,
  onChange,
} from '@reformer/core/behaviors';

const behavior = defineFormBehavior<OrderForm>(({ model, form }) => {
  // Вычисляемое поле. `compute(target, () => …)` — автоотслеживание зависимостей (по чтению model.*);
  // `computeFrom([...sources], target, fn)` — явный список источников-сигналов (запасной вариант).
  compute(model.$.total, () => model.price * model.quantity);
  computeFrom(
    [model.$.price, model.$.discount],
    model.$.grandTotal,
    (total, discount) => total - discount
  );

  // Копирование source → target, условно (скаляр или группа целиком).
  copyFrom(model.$.email, model.$.emailCopy, { when: () => model.sameEmail === true });

  // Условное включение поля(ей); resetOnDisable очищает значение при выключении.
  enableWhen(model.$.shippingAddress, () => model.needsShipping === true, { resetOnDisable: true });

  // Реакция на изменение (можно async; 2-й аргумент колбэка — { signal } AbortSignal для отмены
  // устаревших запросов). Колбэк исполняется вне effect-контекста — можно писать ноды формы.
  onChange(model.$.country, async (country, { signal }) => {
    const cities = await fetchCities(country, signal);
    form.city.updateComponentProps({ options: cities });
  });
});

const form = createForm<OrderForm>({ model, schema, behavior });
```

> Полный набор DSL-операторов: `compute`, `computeFrom`, `copyFrom`, `onChange`, `enableWhen` /
> `disableWhen`, `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`, а также `apply`
> (под-схема для группы) и `applyEach` (на каждый элемент массива).

> Мост «поведение → валидация»: форма сама схему правил не прогоняет, поэтому реактивный перезапуск
> по зависимостям вешается через `revalidateWhen([model.$.dep], () => void validateModel(model, schema))`.

## Массивы и многошаговые формы

### FormArray

Массивы объектов принадлежат модели (`model.items`) и объявляются в схеме нодой
`{ array: model.items, item: (itemModel) => itemSchema }`. UI строится либо стилизованным
`FormArraySection` (типизированный `itemComponent` — **канонический вариант**), либо
headless-составным `FormArray.*` из `@reformer/cdk/form-array`.

```tsx
// Канонический вариант: типизированная стилизованная секция из @reformer/ui-kit/form-array.
import { FormArraySection } from '@reformer/ui-kit/form-array';
import { FormField } from '@reformer/ui-kit';
import type { FormProxy } from '@reformer/core';
import type { FC } from 'react';

type Property = { type: string; estimatedValue: number };

// itemComponent получает полностью типизированный control: FormProxy<Property>.
const PropertyForm: FC<{ control: FormProxy<Property> }> = ({ control }) => (
  <>
    <FormField control={control.type} />
    <FormField control={control.estimatedValue} />
  </>
);

<FormArraySection
  control={form.properties}
  itemComponent={PropertyForm}
  title="Имущество"
  initialValue={{ type: 'apartment', estimatedValue: 0 }}
/>;
```

```tsx
// Headless-составной вариант: полный контроль над разметкой (@reformer/cdk/form-array).
// Пин типа <Property> на List возвращает типизированный элемент.
import { FormArray } from '@reformer/cdk/form-array';

<FormArray.Root control={form.properties}>
  <FormArray.Empty>
    <p>Пока нет элементов</p>
  </FormArray.Empty>

  <FormArray.List<Property>>
    {({ control, index, remove }) => (
      <div key={control.id}>
        <h4>Элемент №{index + 1}</h4>
        <FormField control={control.type} />
        <button type="button" onClick={remove}>
          Удалить
        </button>
      </div>
    )}
  </FormArray.List>

  <FormArray.AddButton>Добавить элемент</FormArray.AddButton>
</FormArray.Root>;
```

### FormWizard (многошаговый мастер)

`@reformer/ui-kit/form-wizard` — стилизованный мастер: шаги задаются массивом `steps`
(`{ number, title, icon, body }`), а `config` — это `{ validateStep, validateAll }`, где оба
колбэка возвращают `boolean | Promise<boolean>`. Канон — валидировать через `validateModel(model, schema)`:
каждый шаг несёт свою схему правил (`defineValidationSchema`), полная = `apply(...шаги)`. Удобно собрать
оба колбэка фабрикой `makeValidationConfig(model)`. `body` шага полиморфен: FC (`{ control }`), готовый
`ReactNode` или `RenderNode` (для рендерер-флоу, см. ниже).

```tsx
import { useMemo, type FC } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardConfig } from '@reformer/cdk/form-wizard';
import { createModel, createForm, type FormModel, type FormProxy } from '@reformer/core';
import { defineValidationSchema, validate, validateModel, apply } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, InputField, InputPasswordField } from '@reformer/ui-kit';

type SignupForm = { email: string; password: string };

// Компоненты шагов получают control={form} через ui-kit FormWizard.
const StepAccount: FC<{ control: FormProxy<SignupForm> }> = ({ control }) => (
  <FormField control={control.email} />
);
const StepSecurity: FC<{ control: FormProxy<SignupForm> }> = ({ control }) => (
  <FormField control={control.password} />
);

// Схема правил на КАЖДЫЙ шаг (стабильные const); полная форма = apply(...шаги).
const step1Validation = defineValidationSchema<SignupForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
});
const step2Validation = defineValidationSchema<SignupForm>(({ model }) => {
  validate(model.$.password, [required(), minLength(8)]);
});
const STEP_SCHEMAS = [step1Validation, step2Validation];
const fullValidation = defineValidationSchema<SignupForm>(() => apply(...STEP_SCHEMAS));

// Фабрика конфига мастера: per-step и полная валидация через validateModel (возвращает Promise<boolean>).
function makeValidationConfig(model: FormModel<SignupForm>): FormWizardConfig {
  return {
    validateStep: (step) => validateModel(model, STEP_SCHEMAS[step - 1]),
    validateAll: () => validateModel(model, fullValidation),
  };
}

function SignupWizard() {
  const { model, form } = useMemo(() => {
    const model = createModel<SignupForm>({ email: '', password: '' });
    // Layout шагов — только привязка полей (без validators).
    const schema = {
      children: [
        { value: model.$.email, component: InputField, componentProps: { label: 'Email' } },
        {
          value: model.$.password,
          component: InputPasswordField,
          componentProps: { label: 'Пароль' },
        },
      ],
    };
    const form = createForm<SignupForm>({ model, schema });
    return { model, form };
  }, []);

  const config = useMemo(() => makeValidationConfig(model), [model]);

  const steps: FormWizardStep<SignupForm>[] = [
    { number: 1, title: 'Аккаунт', icon: '📧', body: StepAccount },
    { number: 2, title: 'Пароль', icon: '🔒', body: StepSecurity },
  ];

  // onSubmit имеет сигнатуру `() => void | Promise<void>` (без values); значения читаем из модели.
  const handleSubmit = async () => {
    console.log('отправка', model.get());
  };

  return <FormWizard form={form} config={config} steps={steps} onSubmit={handleSubmit} />;
}
```

## Рендеринг: три подхода

Одна и та же форма (модель + схема) рендерится **тремя** способами — выбирайте по тому,
где живёт описание разметки:

| Подход                         | Разметка описывается          | Когда выбирать                                                      |
| ------------------------------ | ----------------------------- | ------------------------------------------------------------------- |
| **Императивный JSX**           | вручную в JSX (`<FormField>`) | обычные формы; максимальный контроль над разметкой                  |
| **`@reformer/renderer-react`** | TS-дерево `RenderNode`        | разметка как данные, но типобезопасно (переход к определению в IDE) |
| **`@reformer/renderer-json`**  | чистый JSON + реестр          | схема из БД / CMS / приходит строкой с сервера                      |

Первый способ — это [Быстрый старт](#быстрый-старт) выше (`<FormField control={form.x} />` руками).
Ниже — два варианта на основе схемы. Во всех трёх **модель и валидация одинаковы**: `createModel` +
отдельная схема правил (`defineValidationSchema` + раннер `validateModel`) — меняется только описание
разметки (layout-дерево / JSON валидаторов не несёт).

### @reformer/renderer-react

Разметка — TS-дерево `RenderNode<T>`: листья несут `value: model.$.x` (сигнал модели) + `component`.
**Одно дерево** служит и форме (`createForm({ model, schema })` строит ноды), и рендеру
(`createRenderSchema(() => tree)` → `<FormRenderer />`). Аргумент `path` больше не нужен, обёртка
`FormRoot` — тоже (привязка идёт через сигналы, а не через контекст-форму).

```tsx
import { useMemo } from 'react';
import { createModel, createForm, type FormModel } from '@reformer/core';
import { defineValidationSchema, validate } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import { FormRenderer, createRenderSchema, type RenderNode } from '@reformer/renderer-react';
import { Box, FormField, InputField, InputPasswordField } from '@reformer/ui-kit';

type LoginForm = { email: string; password: string };

// Единое дерево M1 (layout): листья — { value: model.$.x, component, componentProps }. Без validators.
function buildTree(model: FormModel<LoginForm>): RenderNode<LoginForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        value: model.$.email,
        component: InputField,
        componentProps: { label: 'Email', type: 'email' },
      },
      {
        value: model.$.password,
        component: InputPasswordField,
        componentProps: { label: 'Пароль' },
      },
    ],
  };
}

// Валидация — отдельный слой над той же моделью (как в «Валидаторах»); дерево разметки её не несёт.
const loginValidation = defineValidationSchema<LoginForm>(({ model }) => {
  validate(model.$.email, [required(), email()]);
  validate(model.$.password, [required(), minLength(8)]);
});

function LoginPage() {
  const { schema } = useMemo(() => {
    const model = createModel<LoginForm>({ email: '', password: '' });
    const tree = buildTree(model);

    // createForm строит форму из того же дерева (сбор листьев по сигналу).
    // Отправка валидирует явно: `await validateModel(model, loginValidation)` — как в «Быстром старте».
    const form = createForm<LoginForm>({ model, schema: tree });

    // RenderSchema-прокси для декларативного рендера (+ программное управление нодами:
    // schema.node('id').setHidden(true) / .patchProps({...})).
    const schema = createRenderSchema<LoginForm>(() => tree);
    return { model, form, schema };
  }, []);

  // FormRenderer оборачивает дерево в RenderContextProvider; fieldWrapper = ui-kit FormField.
  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

> Разметка как данные, но типобезопасно: `model.$.email` — типизированный сигнал (переход к
> определению в IDE, безопасный рефакторинг). Подробнее —
> [обзор @reformer/renderer-react](./packages/reformer-renderer-react/README.md).

### @reformer/renderer-json

Разметка — **чистый JSON**: все привязки кодируются строками-операторами (`$model(...)`,
`$component(...)`, `$dataSource(...)`), поэтому схему можно положить в `.json` или принять строкой
с сервера/CMS. Компоненты и данные резолвятся через **реестр** (`defineRegistry`). Валидаторов в
JSON нет — правила живут отдельной TS-схемой над моделью (`defineValidationSchema` + раннер `validateModel`).

```tsx
import { useMemo } from 'react';
import { createModel, createForm } from '@reformer/core';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  convertJsonToM1Tree,
  defineRegistry,
  FIELD_WRAPPER,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { Box, FormField, InputField, InputPasswordField } from '@reformer/ui-kit';

type LoginForm = { email: string; password: string };

// 1. Разметка как ЧИСТЫЙ JSON (мог прийти строкой с сервера / из CMS / БД).
//    поле: value '$model(path)' + component '$component(Name)'; контейнер: children.
const jsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [
      {
        selector: 'email',
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email', type: 'email' },
      },
      {
        selector: 'password',
        value: '$model(password)',
        component: '$component(InputPassword)',
        componentProps: { label: 'Пароль' },
      },
    ],
  },
};

function LoginPage() {
  const { model, form, registry } = useMemo(() => {
    const model = createModel<LoginForm>({ email: '', password: '' });

    // 2. Реестр: имена-строки из JSON → React-компоненты / данные (reg.dataSource для options,
    //    reg.fn для функций). FIELD_WRAPPER — обёртка поля (Label → Control → Error).
    const registry = defineRegistry((reg) => {
      reg.component('Box', Box);
      reg.component('Input', InputField); // имя из JSON ($component(Input)) → field-версия
      reg.component('InputPassword', InputPasswordField);
      reg.component(FIELD_WRAPPER, FormField);
    });

    // 3. convertJsonToM1Tree резолвит операторы против реестра + модели → RenderNode-дерево,
    //    из которого createForm строит форму (+ отдельная TS-схема валидации при необходимости).
    const form = createForm<LoginForm>({
      model,
      schema: convertJsonToM1Tree(jsonSchema, registry, model),
    });
    return { model, form, registry };
  }, []);

  // 4. Провайдер внедряет registry + model (по нему JsonFormRenderer резолвит $model);
  //    fieldWrapper берётся из реестра (FIELD_WRAPPER). `validate` включает панель ошибок схемы.
  return (
    <JsonRendererProvider settings={{ registry, model }}>
      <JsonFormRenderer<LoginForm> schema={jsonSchema} validate={import.meta.env.DEV} />
    </JsonRendererProvider>
  );
}
```

> Голые строки не резолвятся: нужны операторы — `component: '$component(Input)'`, `value: '$model(email)'`
> (типы template-literal отловят это на компиляции). `selector` — id ноды для render-поведения, НЕ путь
> к полю. Полный DSL (`$dataSource`, `$fn`, `$locale`, массивы `item.$template`) —
> [обзор @reformer/renderer-json](./packages/reformer-renderer-json/README.md).

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
