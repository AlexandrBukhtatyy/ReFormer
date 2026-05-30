# ReFormer

Reactive form state management library for React with signals-based architecture.

[![npm version](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![npm downloads](https://img.shields.io/npm/dm/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Links

- [Documentation](https://alexandrbukhtatyy.github.io/ReFormer/) - Full documentation and API reference
- [Playground](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer?file=projects/react-playground/src/App.tsx) - Try ReFormer in StackBlitz

## Commands

### Общие команды

```
# Установка зависимостей @reformer/core
npm install -w @reformer/core

# Сборка пакета @reformer/core
npm run build -w @reformer/core


# Установка зависимостей @reformer/cdk
npm install -w @reformer/cdk

# Сборка пакета @reformer/cdk
npm run build -w @reformer/cdk


# Установка зависимостей @reformer/renderer-reac
npm install -w @reformer/renderer-react

# Сборка пакета @reformer/renderer-react
npm run build -w @reformer/renderer-react


# Установка зависимостей react-playground
npm install -w react-playground

# Сборка проекта react-playground
npm run build -w react-playground

# Запуск проекта react-playground в режиме разработки
npm run dev -w react-playground
```

### Запуск тестов:

Инструкция по настройке, запуску тестов и полный перечень команд находится в [README.md](./projects/react-playground-e2e/README.md)

## Packages

| Package                                  | Description                                    | Version                                                                                                 |
| ---------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [@reformer/core](./packages/reformer)    | Core form state management                     | [![npm](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core) |
| [@reformer/cdk](./packages/reformer-cdk) | Headless UI components (FormArray, FormWizard) | [![npm](https://img.shields.io/npm/v/@reformer/cdk.svg)](https://www.npmjs.com/package/@reformer/cdk)   |
| [@reformer/mcp](./packages/reformer-mcp) | MCP server for AI assistants                   | [![npm](https://img.shields.io/npm/v/@reformer/mcp.svg)](https://www.npmjs.com/package/@reformer/mcp)   |

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

# Optional: Headless UI components
npm install @reformer/cdk
```

## Quick Start

```tsx
import { useMemo } from 'react';
import { createForm, useFormControl, required, email } from '@reformer/core';

interface LoginForm {
  email: string;
  password: string;
}

function LoginFormExample() {
  const form = useMemo(
    () =>
      createForm<LoginForm>({
        form: {
          email: { value: '' },
          password: { value: '' },
        },
        validation: (path) => {
          required(path.email);
          email(path.email);
          required(path.password);
        },
      }),
    []
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await form.validate();
    if (form.valid.value) {
      console.log('Form data:', form.getValue());
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <EmailField control={form.email} />
      <PasswordField control={form.password} />
      <button type="submit">Login</button>
    </form>
  );
}

function EmailField({ control }) {
  const { value, errors } = useFormControl(control);
  return (
    <div>
      <input
        type="email"
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {errors[0] && <span>{errors[0].message}</span>}
    </div>
  );
}
```

## Validators

```tsx
import { required, email, minLength, pattern, validate } from '@reformer/core';

validation: (path) => {
  required(path.username);
  email(path.email);
  minLength(path.password, 8);
  pattern(path.phone, /^\+?[0-9]{10,14}$/);

  // Custom cross-field validation: вешается на поле-носитель ошибки, соседнее поле читается через `root`
  validate(path.confirmPassword, (value, _control, root) => {
    if (value !== root.password.value.value) {
      return { code: 'mismatch', message: 'Passwords do not match' };
    }
    return null;
  });
};
```

## Behaviors

```tsx
import { computeFrom, enableWhen, watchField } from '@reformer/core';

behavior: (path) => {
  // Computed field
  computeFrom([path.price, path.quantity], path.total, ({ price, quantity }) => price * quantity);

  // Conditional enable/disable
  enableWhen(path.shipping, (form) => form.needsShipping);

  // Watch field changes
  watchField(path.country, (value, ctx) => {
    ctx.form.state.setValue('');
  });
};
```

## Headless UI Components

### FormArray

```tsx
import { FormArray } from '@reformer/cdk/form-array';

<FormArray.Root control={form.items}>
  <FormArray.Empty>No items</FormArray.Empty>
  <FormArray.List>
    {({ control, remove }) => (
      <div>
        <ItemFields control={control} />
        <button onClick={remove}>Remove</button>
      </div>
    )}
  </FormArray.List>
  <FormArray.AddButton>Add Item</FormArray.AddButton>
</FormArray.Root>;
```

### FormWizard (Multi-step Wizard)

```tsx
import { FormWizard } from '@reformer/cdk/form-wizard';

<FormWizard form={form} config={config}>
  <FormWizard.Step component={Step1} control={form} />
  <FormWizard.Step component={Step2} control={form} />

  <FormWizard.Actions onSubmit={handleSubmit}>
    {({ prev, next, submit, isLastStep }) => (
      <>
        <button {...prev}>Back</button>
        {isLastStep ? <button {...submit}>Submit</button> : <button {...next}>Next</button>}
      </>
    )}
  </FormWizard.Actions>
</FormWizard>;
```

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
