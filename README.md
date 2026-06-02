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

| Package                                                            | Description                                                                | Version                                                                                                                     |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [@reformer/core](./packages/reformer)                              | Core form state management with signals-based architecture                 | [![npm](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)                     |
| [@reformer/cdk](./packages/reformer-cdk)                           | Headless compound components — `FormArray`, `FormWizard`, `FormField`      | [![npm](https://img.shields.io/npm/v/@reformer/cdk.svg)](https://www.npmjs.com/package/@reformer/cdk)                       |
| [@reformer/ui-kit](./packages/reformer-ui-kit)                     | Styled form components built on Tailwind CSS + Radix UI                    | [![npm](https://img.shields.io/npm/v/@reformer/ui-kit.svg)](https://www.npmjs.com/package/@reformer/ui-kit)                 |
| [@reformer/renderer-react](./packages/reformer-renderer-react)     | Schema-driven React renderer — TS `RenderSchema` → JSX                     | [![npm](https://img.shields.io/npm/v/@reformer/renderer-react.svg)](https://www.npmjs.com/package/@reformer/renderer-react) |
| [@reformer/renderer-json](./packages/reformer-renderer-json)       | JSON-based renderer — `JsonFormSchema` + component registry                | [![npm](https://img.shields.io/npm/v/@reformer/renderer-json.svg)](https://www.npmjs.com/package/@reformer/renderer-json)   |
| [@reformer/mcp](./packages/reformer-mcp)                           | MCP server — provides docs, recipes and JSDoc symbols to AI assistants     | [![npm](https://img.shields.io/npm/v/@reformer/mcp.svg)](https://www.npmjs.com/package/@reformer/mcp)                       |

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
```

## Quick Start

```tsx
import { useMemo } from 'react';
import { createForm, type FormSchema, type ValidationSchemaFn } from '@reformer/core';
import { validate, required, email, minLength } from '@reformer/core/validators';
import { Button, FormField, Input, InputPassword } from '@reformer/ui-kit';

interface LoginForm {
  email: string;
  password: string;
}

// Schema-driven: each field declares its `component` + `componentProps`.
// In JSX we render a single `<FormField control={form.x} />` per field — no per-field wrappers.
const formSchema: FormSchema<LoginForm> = {
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'you@example.com' },
  },
  password: {
    value: '',
    component: InputPassword,
    componentProps: { label: 'Password' },
  },
};

// `required()`, `email()`, … are factories that return pure Validator functions.
// Register them on a field via the `validate` operator.
const validationSchema: ValidationSchemaFn<LoginForm> = (path) => {
  validate(path.email, required());
  validate(path.email, email());
  validate(path.password, required());
  validate(path.password, minLength(8));
};

function LoginFormExample() {
  const form = useMemo(
    () => createForm<LoginForm>({ form: formSchema, validation: validationSchema }),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Canonical submit flow: markAsTouched → await validate → check valid → getValue
    form.markAsTouched();
    await form.validate();
    if (!form.valid.value) return;

    const payload = form.getValue();
    console.log('Form data:', payload);
    form.reset();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* FormField renders Label → Control → Error and wires value/onChange/onBlur from the FieldNode */}
      <FormField control={form.email} testId="email" />
      <FormField control={form.password} testId="password" />

      <Button type="submit" disabled={form.invalid.value || form.pending.value}>
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

Validators are wired through the **`validate` operator** inside `ValidationSchemaFn`. Factories
(`required()`, `email()`, …) return pure `(value, control, root) => ValidationError | null`
functions; for cross-field rules pass an inline validator and read other fields from `root`.

```tsx
import {
  validate,
  applyWhen,
  required,
  email,
  minLength,
  min,
  max,
  pattern,
} from '@reformer/core/validators';
import type { ValidationSchemaFn } from '@reformer/core';

const validation: ValidationSchemaFn<RegistrationForm> = (path) => {
  // Built-in factories — pass through `validate`
  validate(path.username, required());
  validate(path.email, required());
  validate(path.email, email());
  validate(path.password, minLength(8));
  validate(path.phone, pattern(/^\+?[0-9]{10,14}$/));
  validate(path.age, min(18));
  validate(path.age, max(120));

  // Custom cross-field rule — error lives on the field that owns it; siblings via `root`
  validate(path.confirmPassword, (value, _control, root) => {
    if (value !== root.password.value.value) {
      return { code: 'mismatch', message: 'Passwords do not match' };
    }
    return null;
  });

  // Conditional validation — applyWhen(triggerField, condition, validatorsFn)
  applyWhen(
    path.loanType,
    (type) => type === 'mortgage',
    (p) => {
      validate(p.propertyValue, required());
      validate(p.propertyValue, min(100000));
    }
  );
};
```

## Behaviors

Behaviors live in a separate `BehaviorSchemaFn` and are composed from declarative operators:
`computeFrom`, `enableWhen`, `watchField`, `copyFrom`, `syncFields`, `resetWhen`, `transformValue`,
`revalidateWhen`. Each handles its own subscription cleanup and cycle prevention.

```tsx
import { computeFrom, enableWhen, watchField, copyFrom } from '@reformer/core/behaviors';
import type { BehaviorSchemaFn } from '@reformer/core';

const behavior: BehaviorSchemaFn<OrderForm> = (path) => {
  // Computed field — sources array, target, compute fn receives full form snapshot
  computeFrom(
    [path.price, path.quantity],
    path.total,
    (values) => (values.price ?? 0) * (values.quantity ?? 0)
  );

  // Conditional enable/disable — condition is read from form values, not the field itself
  enableWhen(path.shippingAddress, (form) => form.needsShipping === true, {
    resetOnDisable: true,
  });

  // Watch field — second arg is `ctx: BehaviorContext`, with `ctx.form` to read/write neighbours
  watchField(
    path.country,
    (_country, ctx) => {
      ctx.form.state.setValue('');
    },
    { immediate: false }
  );

  // Copy values declaratively — `copyFrom` handles `runOutsideEffect` for you, no cycle risk
  copyFrom(path.shippingAddress, path.billingAddress, {
    when: (form) => form.useShippingAsBilling === true,
  });
};
```

## Headless UI Components

### FormArray

```tsx
import { FormArray } from '@reformer/cdk/form-array';

<FormArray.Root control={form.items}>
  <FormArray.Empty>
    <p>No items added</p>
  </FormArray.Empty>

  <FormArray.List>
    {({ control, index, remove }) => (
      <div key={control.id}>
        <h4>Item #{index + 1}</h4>
        <ItemFields control={control} />
        <button type="button" onClick={remove}>Remove</button>
      </div>
    )}
  </FormArray.List>

  <FormArray.AddButton>Add Item</FormArray.AddButton>
</FormArray.Root>;
```

### FormWizard (Multi-step Wizard)

`FormWizardConfig` requires `stepValidations` (per-step schemas) and `fullValidation`
(used on final submit). Both follow the same `ValidationSchemaFn<T>` shape as `validation`
in `createForm`.

```tsx
import { FormWizard } from '@reformer/cdk/form-wizard';
import type { FormWizardConfig } from '@reformer/cdk/form-wizard';

const wizardConfig: FormWizardConfig<MyForm> = {
  stepValidations: {
    1: step1Validation,
    2: step2Validation,
  },
  fullValidation: (path) => {
    step1Validation(path);
    step2Validation(path);
  },
};

<FormWizard form={form} config={wizardConfig}>
  <FormWizard.Step component={Step1} control={form} />
  <FormWizard.Step component={Step2} control={form} />

  <FormWizard.Actions onSubmit={handleSubmit}>
    {({ prev, next, submit, isFirstStep, isLastStep, isValidating, isSubmitting }) => (
      <>
        {!isFirstStep && (
          <button onClick={prev.onClick} disabled={prev.disabled}>Back</button>
        )}
        {!isLastStep ? (
          <button onClick={next.onClick} disabled={next.disabled}>
            {isValidating ? 'Validating…' : 'Next'}
          </button>
        ) : (
          <button onClick={submit.onClick} disabled={submit.disabled}>
            {isSubmitting ? 'Submitting…' : 'Submit'}
          </button>
        )}
      </>
    )}
  </FormWizard.Actions>
</FormWizard>;
```

## Schema-driven rendering

When the form layout (sections, columns, nesting, conditional visibility) is itself data —
admin-built forms, A/B-tested layouts, server-driven UI — write a **render schema** instead
of hand-written JSX. Two flavours:

- `@reformer/renderer-react` — render schema is **TypeScript** code (`RenderSchemaFn<T>`).
  Type-safe paths, IDE go-to-definition, refactor-friendly. Good default.
- `@reformer/renderer-json` — render schema is **plain JSON**. Components are referenced by
  string name and resolved through a registry. Good when the schema lives in a database, in a
  CMS, or comes from a server.

Both share the same `RenderNode` tree underneath and the same render pipeline; JSON is just an
extra serialization layer on top. Configuration (form, fieldWrapper, registry) flows down via
**React Context** — `FormRenderer` sets up `RenderContextProvider` automatically;
`JsonRendererProvider` is explicit and required for `JsonFormRenderer`.

### @reformer/renderer-react

```tsx
import { useMemo } from 'react';
import { createForm, type FormProxy, type FormFields } from '@reformer/core';
import {
  FormRenderer,
  RenderNodeComponent,
  createRenderSchema,
  type RenderNode,
  type RenderSchemaFn,
} from '@reformer/renderer-react';
import { Box, FormField, Input, InputPassword } from '@reformer/ui-kit';

type LoginForm = FormFields & { email: string; password: string };

// User-defined root container — receives `form` via componentProps and forwards it down.
// Required because FormRenderer has no `form` prop; without this fields render as null.
function FormRoot<T>({ form, children }: { form: FormProxy<T>; children: RenderNode<T>[] }) {
  return (
    <>
      {children.map((c, i) => (
        <RenderNodeComponent key={i} node={c} form={form} />
      ))}
    </>
  );
}
// Tells the renderer NOT to auto-render children as React elements — we render them ourselves.
(FormRoot as unknown as { __selfManagedChildren: boolean }).__selfManagedChildren = true;

function createLoginRenderSchema(form: FormProxy<LoginForm>): RenderSchemaFn<LoginForm> {
  return (path) => ({
    component: FormRoot,
    componentProps: { form }, // captured via closure — propagates to all field children
    children: [                // NB: `children` is a top-level node property, NOT in componentProps
      {
        component: Box,
        componentProps: { className: 'space-y-4' },
        children: [
          { component: path.email },
          { component: path.password },
        ],
      },
    ],
  });
}

function LoginPage() {
  const form = useMemo(
    () =>
      createForm<LoginForm>({
        form: {
          email: { value: '', component: Input, componentProps: { label: 'Email', type: 'email' } },
          password: { value: '', component: InputPassword, componentProps: { label: 'Password' } },
        },
      }),
    []
  );
  const schema = useMemo(() => createRenderSchema(createLoginRenderSchema(form)), [form]);

  // `fieldWrapper` wraps every field node (Label → Control → Error). Use ui-kit's FormField.
  // FormRenderer internally wraps the tree in <RenderContextProvider value={{ form, settings, path }}>,
  // so every child reads `form`/`settings` from React context — no prop drilling.
  return <FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
}
```

> Two non-obvious requirements: (1) `FormRoot.__selfManagedChildren = true` — otherwise the
> renderer pre-renders `children` to React elements and `RenderNodeComponent` blows up;
> (2) container `children` lives at the **node** level, not inside `componentProps`. Both are
> covered in [@reformer/renderer-react overview](./packages/reformer-renderer-react/README.md).
> Need `RenderContextProvider` explicitly? Only when you bypass `FormRenderer` and mount nodes
> manually with `RenderNodeComponent`.

### @reformer/renderer-json

The canonical mount path is `<JsonRendererProvider settings={{ registry, fieldWrapper }}>` wrapping
`<JsonFormRenderer schema={…} />`. The provider injects the registry and field wrapper through
React Context; `JsonFormRenderer` reads them via `useJsonRendererSettings()` and renders the
schema. The live `form` instance is captured in the registry via a closure on a user-defined
`FormRoot` container — JSON itself stays pure data.

```tsx
import { useMemo, type ReactNode } from 'react';
import { createForm, type FormProxy, type FormFields } from '@reformer/core';
import {
  RenderNodeComponent,
  type RenderNode,
} from '@reformer/renderer-react';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  defineRegistry,
  FIELD_WRAPPER,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { Box, FormField, Input, InputPassword } from '@reformer/ui-kit';

type LoginForm = FormFields & { email: string; password: string };

// 1. Layout schema as plain data — could come from an API / CMS / DB.
const jsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: 'FormRoot',
    children: [
      {
        component: 'Box',
        componentProps: { className: 'space-y-4' },
        children: [
          { selector: 'email', model: 'email', component: 'Input', componentProps: { label: 'Email', type: 'email' } },
          { selector: 'password', model: 'password', component: 'InputPassword', componentProps: { label: 'Password' } },
        ],
      },
    ],
  },
};

// 2. FormRoot — receives `form` via componentProps and forwards it to each child node.
function FormRoot<T>({ form, children }: { form: FormProxy<T>; children: RenderNode<T>[] }) {
  return (
    <>
      {children.map((c, i) => (
        <RenderNodeComponent key={i} node={c} form={form} />
      ))}
    </>
  );
}
(FormRoot as unknown as { __selfManagedChildren: boolean }).__selfManagedChildren = true;

function LoginPage() {
  const form = useMemo(
    () =>
      createForm<LoginForm>({
        form: {
          email: { value: '', component: Input },
          password: { value: '', component: InputPassword },
        },
      }),
    []
  );

  // 3. Registry maps string names → React components. The live `form` is injected
  // into FormRoot via a closure here, so the JSON schema stays form-agnostic.
  const registry = useMemo(
    () =>
      defineRegistry((reg) => {
        reg.container('FormRoot', (props: { children: RenderNode<LoginForm>[] }) => (
          <FormRoot {...props} form={form} />
        ));
        reg.container('Box', Box);
        reg.field('Input', Input);
        reg.field('InputPassword', InputPassword);
        reg.container(FIELD_WRAPPER, FormField);
      }),
    [form]
  );

  // 4. Provider passes registry + fieldWrapper into JsonFormRenderer via React Context.
  return (
    <JsonRendererProvider settings={{ registry, fieldWrapper: FormField }}>
      <JsonFormRenderer<LoginForm> schema={jsonSchema} />
    </JsonRendererProvider>
  );
}
```

> Field nodes use `selector` (unique id), `model` (path into the form), `component` (registry
> key); container nodes drop `selector`/`model` and add `children`. The schema is pure data —
> nothing form- or React-specific lives in it. Need to override settings deeper in the tree?
> Wrap a subtree in another `JsonRendererProvider`; inner settings merge with outer.

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
