---
sidebar_position: 1
---

# Установка

## Требования

- Node.js 18+
- React 18+ (для React-биндингов)

## Установка

```bash
npm install reformer
```

## Peer-зависимости

ReFormer использует [Preact Signals](https://preactjs.com/guide/v10/signals/) для реактивности:

```bash
npm install @preact/signals-react
```

### Конфигурация Babel (React)

Для React-проектов добавьте signals transform в конфиг Babel:

```bash
npm install -D @preact/signals-react-transform
```

```javascript title="babel.config.js"
module.exports = {
  plugins: [['module:@preact/signals-react-transform']],
};
```

Или для Vite:

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

## Структура проекта

```
your-project/
├── src/
│   ├── forms/           # Определения форм
│   │   └── user-form.ts
│   └── components/      # Компоненты форм
│       └── UserForm.tsx
```

## Следующие шаги

- [Быстрый старт](/docs/getting-started/quick-start) — создайте первую форму
