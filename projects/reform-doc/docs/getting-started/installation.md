---
sidebar_position: 1
---

# Installation

## Requirements

- Node.js 18+
- React 18+ (for React bindings)

## Install

```bash
npm install reformer
```

## Peer Dependencies

ReFormer uses [Preact Signals](https://preactjs.com/guide/v10/signals/) for reactivity:

```bash
npm install @preact/signals-react
```

### Babel Configuration (React)

For React projects, add the signals transform to your Babel config:

```bash
npm install -D @preact/signals-react-transform
```

```javascript title="babel.config.js"
module.exports = {
  plugins: [['module:@preact/signals-react-transform']],
};
```

Or for Vite:

```typescript title="vite.config.ts"
import react from '@vitejs/plugin-react';

export default {
  plugins: [
    react({
      babel: {
        plugins: [['module:@preact/signals-react-transform']],
      },
    }),
  ],
};
```

## Project Structure

```
your-project/
├── src/
│   ├── forms/           # Form definitions
│   │   └── user-form.ts
│   └── components/      # Form components
│       └── UserForm.tsx
```

## Next Steps

- [Quick Start](/docs/getting-started/quick-start) — Build your first form
