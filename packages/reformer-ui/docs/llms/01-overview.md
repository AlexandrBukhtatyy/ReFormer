# Overview

`@reformer/ui` provides headless UI components for `@reformer/core` forms.

## Key Concepts

- **Headless**: No default UI or styles - you build the interface
- **Compound Components**: Composable, declarative API
- **Render Props**: Children as function for full control
- **Context-based**: State shared via React Context

## Components

| Component | Purpose |
|-----------|---------|
| `FormArray` | Manage dynamic form arrays |
| `FormNavigation` | Multi-step form wizard |

## Installation

```bash
npm install @reformer/ui @reformer/core
```

## Import Patterns

```typescript
// All components
import { FormArray, FormNavigation } from '@reformer/ui';

// Tree-shaking (recommended)
import { FormArray, useFormArray } from '@reformer/ui/form-array';
import { FormNavigation, useFormNavigation } from '@reformer/ui/form-navigation';
```
