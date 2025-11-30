# ReFormer

Reactive form state management library for React with signals-based architecture.

[![npm version](https://img.shields.io/npm/v/reform.svg)](https://www.npmjs.com/package/reform)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Links

[Documentation](https://alexandrbukhtatyy.github.io/ReFormer/) - Full documentation and tutorials

[Playground](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer?file=projects/react-playground/src/App.tsx) - Try ReFormer in StackBlitz

## Features

- Signals-based reactive state (@preact/signals-core)
- Declarative form validation
- Dynamic form behaviors (computed fields, conditional logic)
- Full TypeScript support with type inference
- Tree-shakeable exports
- Multi-step form support
- React 18 and 19 compatible

## Installation

```bash
npm install reform@beta
```

## Quick Start

```tsx
import { createForm, useFormControl } from 'reform';

interface LoginForm {
  email: string;
  password: string;
}

const form = createForm<LoginForm>({
  form: {
    email: { value: '' },
    password: { value: '' },
  },
});

function LoginForm() {
  const email = useFormControl(form.email);
  const password = useFormControl(form.password);

  const handleSubmit = async () => {
    await form.validate();
    if (form.valid.value) {
      console.log(form.getValue());
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <input value={email.value} onChange={(e) => form.email.setValue(e.target.value)} />
      <input
        type="password"
        value={password.value}
        onChange={(e) => form.password.setValue(e.target.value)}
      />
      <button type="submit">Login</button>
    </form>
  );
}
```

## Monorepo Structure

- `packages/reformer` - Core library
- `projects/reformer-doc` - Documentation site (Docusaurus)
- `projects/reformer-tutorial` - Tutorial source code

## Development

```bash
# Install dependencies
npm install

# Build library
npm run build -w reformer

# Run playground
npm run dev -w react-playground

# Run documentation
npm run start -w reformer-doc
```

## License

MIT
