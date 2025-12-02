# @reformer/core

[![npm version](https://img.shields.io/npm/v/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![npm downloads](https://img.shields.io/npm/dm/@reformer/core.svg)](https://www.npmjs.com/package/@reformer/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

Reactive form state management library for React with signals-based architecture.

## Installation

```bash
npm install @reformer/core
```

## Features

- Signals-based reactive state management
- Declarative form validation
- Dynamic form behaviors
- TypeScript support
- Tree-shakeable exports

## Quick Start

```tsx
import { createForm, useFormControl } from '@reformer/core';

const form = createForm({
  schema: {
    name: { initialValue: '' },
    email: { initialValue: '' }
  }
});

function MyForm() {
  const name = useFormControl(form.controls.name);

  return (
    <input
      value={name.value}
      onChange={(e) => name.setValue(e.target.value)}
    />
  );
}
```

## Documentation

Full documentation is available at [https://alexandrbukhtatyy.github.io/ReFormer/](https://alexandrbukhtatyy.github.io/ReFormer/)

## License

MIT
