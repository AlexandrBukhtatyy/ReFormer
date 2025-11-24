---
sidebar_position: 1
---

# Project Structure

## Recommended Organization

```
your-project/
├── src/
│   └── components/                # Components
│       └── Form/
│           ├── index.tsx
│           ├── form.ts           # Form structure
│           ├── validation.ts     # Validation
│           ├── behaviors.ts      # Behaviors
│           ├── sections/          # Nested sections
│           │   ├── Section1.tsx
│           │   ├── Section2.tsx
│           │   └── Section3.tsx
│           └── steps/             # Form steps (wizard)
│               ├── Step1.tsx
│               ├── Step2.tsx
│               └── Step3.tsx
```

This structure keeps form logic and components together, making it easier to maintain and understand.

## Key Files

- **form.ts** — Contains the form structure definition (nodes, schema)
- **validation.ts** — Contains validation rules and validators
- **behaviors.ts** — Contains form behaviors (computed fields, conditional logic)
- **sections/** — Components for nested form sections
- **steps/** — Components for wizard-style multi-step forms