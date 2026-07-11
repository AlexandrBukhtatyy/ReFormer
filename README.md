# ReFormer

Reactive form state management library for React with signals-based architecture.

[![npm version](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![npm downloads](https://img.shields.io/npm/dm/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Links

- [Documentation](https://alexandrbukhtatyy.github.io/ReFormer/) - Full documentation and API reference
- [Playground](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer?file=projects/react-playground/src/App.tsx) - Try ReFormer in StackBlitz

## Commands

### Common commands

```
# Install dependencies for @reformer/core
npm install -w @reformer/core

# Build @reformer/core
npm run build -w @reformer/core


# Install dependencies for @reformer/cdk
npm install -w @reformer/cdk

# Build @reformer/cdk
npm run build -w @reformer/cdk


# Install dependencies for @reformer/renderer-react
npm install -w @reformer/renderer-react

# Build @reformer/renderer-react
npm run build -w @reformer/renderer-react


# Install dependencies for react-playground
npm install -w react-playground

# Build react-playground
npm run build -w react-playground

# Run react-playground in dev mode
npm run dev -w react-playground
```

### Running tests

Setup instructions, test commands, and the full command reference live in [README.md](./projects/react-playground-e2e/README.md).

## Packages

| Package                                                        | Description                                                            | Version                                                                                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [@reformer/core](./packages/reformer)                          | Core form state management with signals-based architecture             | [![npm](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)                     |
| [@reformer/cdk](./packages/reformer-cdk)                       | Headless compound components — `FormArray`, `FormWizard`, `FormField`  | [![npm](https://img.shields.io/npm/v/@reformer/cdk.svg)](https://www.npmjs.com/package/@reformer/cdk)                       |
| [@reformer/ui-kit](./packages/reformer-ui-kit)                 | Styled form components built on Tailwind CSS + Radix UI                | [![npm](https://img.shields.io/npm/v/@reformer/ui-kit.svg)](https://www.npmjs.com/package/@reformer/ui-kit)                 |
| [@reformer/renderer-react](./packages/reformer-renderer-react) | Schema-driven React renderer — TS `RenderSchema` → JSX                 | [![npm](https://img.shields.io/npm/v/@reformer/renderer-react.svg)](https://www.npmjs.com/package/@reformer/renderer-react) |
| [@reformer/renderer-json](./packages/reformer-renderer-json)   | JSON-based renderer — `JsonFormSchema` + component registry            | [![npm](https://img.shields.io/npm/v/@reformer/renderer-json.svg)](https://www.npmjs.com/package/@reformer/renderer-json)   |
| [@reformer/mcp](./packages/reformer-mcp)                       | MCP server — provides docs, recipes and JSDoc symbols to AI assistants | [![npm](https://img.shields.io/npm/v/@reformer/mcp.svg)](https://www.npmjs.com/package/@reformer/mcp)                       |

## Features

- **AI-friendly** - includes LLMs.txt for AI assistants, MCP server available
- **Signals-based** - reactive state powered by @preact/signals-core
- **Declarative validation** - built-in validators + custom sync/async support
- **Dynamic behaviors** - computed fields, conditional logic, field watchers
- **TypeScript-first** - full type inference and safety
- **Tree-shakeable** - import only what you need
- **Multi-step forms** - wizard support with step validation
- **Dynamic arrays** - add/remove form items with FormArray
- **React 16.8+ to 19** - broad compatibility

## Installation

```bash
# Core library
npm install @reformer/core

# Styled inputs + FormField wrapper (used in Quick Start below)
npm install @reformer/ui-kit

# Optional: Headless compound components (FormArray, FormWizard)
npm install @reformer/cdk

# Optional: schema-driven rendering (choose one — see "Rendering: three approaches")
npm install @reformer/renderer-react   # layout as a type-safe TS tree
npm install @reformer/renderer-json    # layout as plain JSON + registry
```

## Quick Start

Архитектура **M1**: сначала создаётся **модель данных** (`createModel`) — источник истины
значений, затем **форма** (`createForm({ model, schema })`), где схема привязывает каждое поле к
сигналу модели (`model.$.field`), несёт его `component` + `componentProps` и список `validators`.
В JSX рендерится один универсальный `<FormField control={form.x} />` на поле — без per-field обёрток.

```tsx
import { useMemo } from 'react';
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { Button, FormField, Input, InputPassword } from '@reformer/ui-kit';

// Тип формы — `type` alias (structural-совместимость с generic-constraint внутри библиотеки).
type LoginForm = {
  email: string;
  password: string;
};

function LoginFormExample() {
  // model + schema + form создаются ОДИН раз (useMemo, пустые deps) —
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
        componentProps: { label: 'Password' },
        validators: [required(), minLength(8)],
      },
    };

    // 3. Форма — реактивные ноды поверх сигналов модели.
    const form = createForm<LoginForm>({ model, schema });
    return { model, form, schema };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Submit-флоу M1: markAsTouched (показать ошибки) → validateFormModel → model.get().
    // Именно validateFormModel исполняет `validators` листьев схемы (sync + async).
    form.markAsTouched();
    const result = await validateFormModel(model, schema);
    if (!result.valid) return;

    console.log('Form data:', model.get());
    form.reset();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* FormField рендерит Label → Control → Error и подключает value/onChange/onBlur ноды */}
      <FormField control={form.email} testId="email" />
      <FormField control={form.password} testId="password" />

      <Button type="submit" disabled={form.pending.value}>
        {form.pending.value ? 'Checking…' : 'Login'}
      </Button>
    </form>
  );
}
```

> Don't want `@reformer/ui-kit`? You can also pass any React component into `component` /
> `componentProps` (your own design system) or write a thin per-field wrapper around
> `useFormControl(control)` — see [@reformer/core README](./packages/reformer/README.md).

## Validators

Валидаторы объявляются прямо в поле схемы — массивом `validators: [...]`. Встроенные фабрики
(`required()`, `email()`, …) — чистые функции `(value) => ValidationError | null`. Кастомные и
кросс-полевые правила — это `ModelValidator<TValue, TModel>`: `(value, model) => ValidationError | null`,
где соседние поля читаются из `model`. Async-валидатор — просто `async` `ModelValidator`.
Исполняет все правила `validateFormModel(model, schema)` (на submit); `form.validate()` по нодам
схемные правила НЕ запустит.

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
  value && value !== model.password
    ? { code: 'mismatch', message: 'Passwords do not match' }
    : null;

// Условная валидация — без спец-оператора: просто проверяем `model` внутри правила.
// (Для условного ВКЛючения/сброса самого поля — behavior `enableWhen`, см. ниже.)
const propertyValueForMortgage: ModelValidator<number, RegistrationForm> = (value, model) =>
  model.loanType === 'mortgage' && (!value || value < 100000)
    ? { code: 'min', message: 'Property value must be at least 100000' }
    : null;

// Async-правило — async ModelValidator; сетевой сбой не должен блокировать (верните null).
const usernameAvailable: ModelValidator<string> = async (value) => {
  if (!value || value.length < 3) return null;
  const res = await fetch(`/api/check-username?u=${encodeURIComponent(value)}`);
  return (await res.json()).available ? null : { code: 'taken', message: 'Username is taken' };
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

## Behaviors

Реактивное поведение описывается декларативной схемой `defineFormBehavior<T>(({ model, form }) => …)`
и подключается через `createForm({ model, schema, behavior })` — форма владеет жизненным циклом
(подписки/cleanup/защита от циклов внутри каждого оператора). Value-операции (`compute`,
`computeFrom`, `copyFrom`) пишут сигналы модели (`model.$`), state/UI-операции (`enableWhen`,
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
  // Вычисляемое поле. `compute(target, () => …)` — auto-tracking (зависимости по чтению model.*);
  // `computeFrom([...sources], target, fn)` — явный список источников-сигналов (escape hatch).
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
> (под-схема для группы) и `applyEach` (per-item для массива).

## Arrays & Multi-step

### FormArray

Массивы объектов принадлежат модели (`model.items`) и объявляются в схеме узлом
`{ array: model.items, item: (itemModel) => itemSchema }`. UI строится либо стилизованным
`FormArraySection` (типизированный `itemComponent` — **canonical**), либо headless-compound
`FormArray.*` из `@reformer/cdk/form-array`.

```tsx
// Canonical: типизированная стилизованная секция из @reformer/ui-kit/form-array.
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
  title="Properties"
  initialValue={{ type: 'apartment', estimatedValue: 0 }}
/>;
```

```tsx
// Headless-compound: полный контроль над разметкой (@reformer/cdk/form-array).
// Пин типа <Property> на List возвращает типизированный item.
import { FormArray } from '@reformer/cdk/form-array';

<FormArray.Root control={form.properties}>
  <FormArray.Empty>
    <p>No items added</p>
  </FormArray.Empty>

  <FormArray.List<Property>>
    {({ control, index, remove }) => (
      <div key={control.id}>
        <h4>Item #{index + 1}</h4>
        <FormField control={control.type} />
        <button type="button" onClick={remove}>
          Remove
        </button>
      </div>
    )}
  </FormArray.List>

  <FormArray.AddButton>Add Item</FormArray.AddButton>
</FormArray.Root>;
```

### FormWizard (Multi-step Wizard)

`@reformer/ui-kit/form-wizard` — стилизованный wizard: шаги задаются массивом `steps`
(`{ number, title, icon, body }`), а `config` — это `{ validateStep, validateAll }`, где оба
колбэка возвращают `boolean | Promise<boolean>`. Канон M1 — валидировать через
`validateFormModel(model, …)`. `body` шага полиморфен: FC (`{ control }`), готовый `ReactNode`
или `RenderNode` (для renderer-flow, см. ниже).

```tsx
import { useMemo, type FC } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormWizardConfig } from '@reformer/cdk/form-wizard';
import { createModel, createForm, validateFormModel, type FormProxy } from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { FormField, Input, InputPassword } from '@reformer/ui-kit';

type SignupForm = { email: string; password: string };

// Step-компоненты получают control={form} через ui-kit FormWizard.
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

  // config — колбэки, а не схемы. Валидируем подмножество полей шага через validateFormModel.
  const config: FormWizardConfig = {
    validateStep: async (step) => {
      const stepSchema = { children: [schema.children[step - 1]] };
      return (await validateFormModel(model, stepSchema)).valid;
    },
    validateAll: async () => (await validateFormModel(model, schema)).valid,
  };

  // onSubmit — signature `() => void | Promise<void>` (без values); значения читаем из модели.
  const handleSubmit = async () => {
    console.log('submit', model.get());
  };

  return <FormWizard form={form} config={config} steps={steps} onSubmit={handleSubmit} />;
}
```

## Rendering: three approaches

Одна и та же форма (модель + схема) рендерится **тремя** способами — выбирайте по тому,
где живёт описание layout'а:

| Подход                         | Layout описывается            | Когда выбирать                                         |
| ------------------------------ | ----------------------------- | ------------------------------------------------------ |
| **Imperative JSX**             | вручную в JSX (`<FormField>`) | обычные формы; максимальный контроль над разметкой     |
| **`@reformer/renderer-react`** | TS-дерево `RenderNode`        | layout как данные, но type-safe (IDE go-to-definition) |
| **`@reformer/renderer-json`**  | чистый JSON + реестр          | схема из БД / CMS / приходит строкой с сервера         |

Первый способ — это [Quick Start](#quick-start) выше (`<FormField control={form.x} />` руками).
Ниже — два schema-driven варианта. Во всех трёх **модель и валидация одинаковы** (M1: `createModel` +
`validators` в схеме + `validateFormModel`) — меняется только описание layout'а.

### @reformer/renderer-react

Layout — TS-дерево `RenderNode<T>`: листья несут `value: model.$.x` (сигнал модели) + `component`.
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
        componentProps: { label: 'Password' },
        validators: [required(), minLength(8)],
      },
    ],
  };
}

function LoginPage() {
  const { schema } = useMemo(() => {
    const model = createModel<LoginForm>({ email: '', password: '' });
    const tree = buildTree(model);

    // createForm строит форму из того же дерева (harvest листьев по сигналу).
    // form используется для submit (validateFormModel) — как в Quick Start.
    const form = createForm<LoginForm>({ model, schema: tree });

    // RenderSchema-proxy для декларативного рендера (+ программное управление нодами:
    // schema.node('id').setHidden(true) / .patchProps({...})).
    const schema = createRenderSchema<LoginForm>(() => tree);
    return { model, form, schema };
  }, []);

  // FormRenderer оборачивает дерево в RenderContextProvider; fieldWrapper = ui-kit FormField.
  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

> Layout как данные, но type-safe: `model.$.email` — типизированный сигнал (IDE go-to-definition,
> безопасный рефакторинг). Подробнее — [@reformer/renderer-react overview](./packages/reformer-renderer-react/README.md).

### @reformer/renderer-json

Layout — **чистый JSON**: все привязки кодируются строками-операторами (`$model(...)`,
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

// 1. Layout как ЧИСТЫЙ JSON (мог прийти строкой с сервера / из CMS / БД).
//    field-node: value '$model(path)' + component '$component(Name)'; container: children.
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
        componentProps: { label: 'Password' },
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

  // 4. Provider инъектит registry + model (по нему JsonFormRenderer резолвит $model);
  //    fieldWrapper берётся из реестра (FIELD_WRAPPER). `validate` включает панель ошибок схемы.
  return (
    <JsonRendererProvider settings={{ registry, model }}>
      <JsonFormRenderer<LoginForm> schema={jsonSchema} validate={import.meta.env.DEV} />
    </JsonRendererProvider>
  );
}
```

> Голые строки не резолвятся: нужны операторы — `component: '$component(Input)'`, `value: '$model(email)'`
> (template-literal типы отловят это на компиляции). `selector` — id узла для render-behavior, НЕ путь
> к полю. Полный DSL (`$dataSource`, `$fn`, `$locale`, массивы `item.$template`) —
> [@reformer/renderer-json overview](./packages/reformer-renderer-json/README.md).

## MCP Server (AI Integration)

For AI assistants like Claude, install the MCP server:

```bash
npm install -g @reformer/mcp
```

Add to your Claude config:

```json
{
  "mcpServers": {
    "reformer": {
      "command": "reformer-mcp"
    }
  }
}
```

## License

MIT
