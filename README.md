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
| [@reformer/ui-kit](./packages/reformer-ui-kit)                 | Стилизованные компоненты форм на Tailwind CSS + Radix UI                 | [![npm](https://img.shields.io/npm/v/@reformer/ui-kit.svg)](https://www.npmjs.com/package/@reformer/ui-kit)                 |
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
значений, затем **форма** (`createForm({ model, schema })`), где схема привязывает каждое поле к
сигналу модели (`model.$.field`), несёт его `component` + `componentProps` и список `validators`.
В JSX рендерится один универсальный `<FormField control={form.x} />` на поле — без обёрток на каждое поле.

```tsx
import { useMemo } from 'react';
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { Button, FormField, Input, InputPassword } from '@reformer/ui-kit';

// Тип формы — `type` alias (структурная совместимость с generic-ограничением внутри библиотеки).
type LoginForm = {
  email: string;
  password: string;
};

function LoginFormExample() {
  // model + schema + form создаются ОДИН раз (useMemo, пустой массив зависимостей) —
  // иначе форма пересоздаётся на каждый рендер.
  const { model, form, schema } = useMemo(() => {
    // 1. Модель — источник истины значений.
    const model = createModel<LoginForm>({ email: '', password: '' });

    // 2. Схема: поле привязано к сигналу (model.$.field) + component/componentProps + validators.
    //    Валидаторы (`required()`, `email()`, …) — чистые фабрики из `@reformer/core/validators`.
    const schema = {
      email: {
        value: model.$.email,
        component: Input,
        componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
        validators: [required(), email()],
      },
      password: {
        value: model.$.password,
        component: InputPassword,
        componentProps: { label: 'Пароль' },
        validators: [required(), minLength(8)],
      },
    };

    // 3. Форма — реактивные ноды поверх сигналов модели.
    const form = createForm<LoginForm>({ model, schema });
    return { model, form, schema };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Флоу отправки M1: markAsTouched (показать ошибки) → validateFormModel → model.get().
    // Именно validateFormModel исполняет `validators` листьев схемы (sync + async).
    form.markAsTouched();
    const result = await validateFormModel(model, schema);
    if (!result.valid) return;

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

Валидаторы объявляются прямо в поле схемы — массивом `validators: [...]`. Встроенные фабрики
(`required()`, `email()`, …) — чистые функции `(value) => ValidationError | null`. Кастомные и
кросс-полевые правила — это `ModelValidator<TValue, TModel>`: `(value, model) => ValidationError | null`,
где соседние поля читаются из `model`. Async-валидатор — просто `async` `ModelValidator`.
Исполняет все правила `validateFormModel(model, schema)` (при отправке); `form.validate()` по нодам
НЕ запустит схемные правила.

```tsx
import { createModel, createForm, validateFormModel, type ModelValidator } from '@reformer/core';
import { required, email, minLength, min, max, pattern } from '@reformer/core/validators';
import { Input, InputPassword } from '@reformer/ui-kit';

type RegistrationForm = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  age: number;
  loanType: 'personal' | 'mortgage';
  propertyValue: number;
};

// Кросс-полевое правило — читаем соседнее поле из `model`.
const passwordsMatch: ModelValidator<string, RegistrationForm> = (value, model) =>
  value && value !== model.password ? { code: 'mismatch', message: 'Пароли не совпадают' } : null;

// Условная валидация — без спец-оператора: просто проверяем `model` внутри правила.
// (Для условного ВКЛючения/сброса самого поля — поведение `enableWhen`, см. ниже.)
const propertyValueForMortgage: ModelValidator<number, RegistrationForm> = (value, model) =>
  model.loanType === 'mortgage' && (!value || value < 100000)
    ? { code: 'min', message: 'Стоимость имущества — не менее 100000' }
    : null;

// Async-правило — async ModelValidator; сетевой сбой не должен блокировать (верните null).
const usernameAvailable: ModelValidator<string> = async (value) => {
  if (!value || value.length < 3) return null;
  const res = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`);
  return (await res.json()).available
    ? null
    : { code: 'taken', message: 'Имя пользователя занято' };
};

const model = createModel<RegistrationForm>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  age: 0,
  loanType: 'personal',
  propertyValue: 0,
});

const schema = {
  username: {
    value: model.$.username,
    component: Input,
    validators: [required(), minLength(3), usernameAvailable],
  },
  email: { value: model.$.email, component: Input, validators: [required(), email()] },
  password: {
    value: model.$.password,
    component: InputPassword,
    validators: [required(), minLength(8)],
  },
  confirmPassword: {
    value: model.$.confirmPassword,
    component: InputPassword,
    validators: [required(), passwordsMatch],
  },
  age: { value: model.$.age, component: Input, validators: [min(18), max(120)] },
  propertyValue: {
    value: model.$.propertyValue,
    component: Input,
    validators: [propertyValueForMortgage],
  },
};

const form = createForm<RegistrationForm>({ model, schema });

// Исполняет ВСЕ validators листьев (sync + async) и обновляет статусы нод:
const result = await validateFormModel(model, schema); // → { valid: boolean, ... }
```

**Встроенные фабрики** (`@reformer/core/validators`, каждая принимает опц. `{ message }`):
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
колбэка возвращают `boolean | Promise<boolean>`. Канон M1 — валидировать через
`validateFormModel(model, …)`. `body` шага полиморфен: FC (`{ control }`), готовый `ReactNode`
или `RenderNode` (для рендерер-флоу, см. ниже).

```tsx
import { useMemo, type FC } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardConfig } from '@reformer/cdk/form-wizard';
import { createModel, createForm, validateFormModel, type FormProxy } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Input, InputPassword } from '@reformer/ui-kit';

type SignupForm = { email: string; password: string };

// Компоненты шагов получают control={form} через ui-kit FormWizard.
const StepAccount: FC<{ control: FormProxy<SignupForm> }> = ({ control }) => (
  <FormField control={control.email} />
);
const StepSecurity: FC<{ control: FormProxy<SignupForm> }> = ({ control }) => (
  <FormField control={control.password} />
);

function SignupWizard() {
  const { model, form, schema } = useMemo(() => {
    const model = createModel<SignupForm>({ email: '', password: '' });
    const schema = {
      children: [
        {
          value: model.$.email,
          component: Input,
          componentProps: { label: 'Email' },
          validators: [required(), email()],
        },
        {
          value: model.$.password,
          component: InputPassword,
          componentProps: { label: 'Пароль' },
          validators: [required(), minLength(8)],
        },
      ],
    };
    const form = createForm<SignupForm>({ model, schema });
    return { model, form, schema };
  }, []);

  const steps: FormWizardStep<SignupForm>[] = [
    { number: 1, title: 'Аккаунт', icon: '📧', body: StepAccount },
    { number: 2, title: 'Пароль', icon: '🔒', body: StepSecurity },
  ];

  // config — это колбэки, а не схемы. Валидируем подмножество полей шага через validateFormModel.
  const config: FormWizardConfig = {
    validateStep: async (step) => {
      const stepSchema = { children: [schema.children[step - 1]] };
      return (await validateFormModel(model, stepSchema)).valid;
    },
    validateAll: async () => (await validateFormModel(model, schema)).valid,
  };

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
Ниже — два варианта на основе схемы. Во всех трёх **модель и валидация одинаковы** (M1: `createModel` +
`validators` в схеме + `validateFormModel`) — меняется только описание разметки.

### @reformer/renderer-react

Разметка — TS-дерево `RenderNode<T>`: листья несут `value: model.$.x` (сигнал модели) + `component`.
**Одно дерево** служит и форме (`createForm({ model, schema })` строит ноды), и рендеру
(`createRenderSchema(() => tree)` → `<FormRenderer />`). Аргумент `path` больше не нужен, обёртка
`FormRoot` — тоже (привязка идёт через сигналы, а не через контекст-форму).

```tsx
import { useMemo } from 'react';
import { createModel, createForm, type FormModel } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { FormRenderer, createRenderSchema, type RenderNode } from '@reformer/renderer-react';
import { Box, FormField, Input, InputPassword } from '@reformer/ui-kit';

type LoginForm = { email: string; password: string };

// Единое дерево M1: листья — { value: model.$.x, component, componentProps, validators }.
function buildTree(model: FormModel<LoginForm>): RenderNode<LoginForm> {
  return {
    component: Box,
    componentProps: { className: 'space-y-4' },
    children: [
      {
        value: model.$.email,
        component: Input,
        componentProps: { label: 'Email', type: 'email' },
        validators: [required(), email()],
      },
      {
        value: model.$.password,
        component: InputPassword,
        componentProps: { label: 'Пароль' },
        validators: [required(), minLength(8)],
      },
    ],
  };
}

function LoginPage() {
  const { schema } = useMemo(() => {
    const model = createModel<LoginForm>({ email: '', password: '' });
    const tree = buildTree(model);

    // createForm строит форму из того же дерева (сбор листьев по сигналу).
    // form используется для отправки (validateFormModel) — как в «Быстром старте».
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
JSON нет — валидация значений живёт в отдельной TS-схеме над моделью (`validateFormModel`).

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
import { Box, FormField, Input, InputPassword } from '@reformer/ui-kit';

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
      reg.component('Input', Input);
      reg.component('InputPassword', InputPassword);
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
