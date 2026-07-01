# Overview

`@reformer/cdk` provides headless UI components for `@reformer/core` forms.

## Key Concepts

- **Headless**: No default UI or styles - you build the interface
- **Compound Components**: Composable, declarative API
- **Render Props**: Children as function for full control
- **Context-based**: State shared via React Context

## Components

| Component    | Purpose                                      |
| ------------ | -------------------------------------------- |
| `FormArray`  | Manage dynamic form arrays                   |
| `FormField`  | Accessible field anatomy (label/control/…)   |
| `FormWizard` | Multi-step form wizard                        |

## Installation

```bash
npm install @reformer/cdk @reformer/core
```

## Import Patterns

```typescript
// All components
import { FormArray, FormField, FormWizard } from '@reformer/cdk';

// Tree-shaking (recommended)
import { FormArray, useFormArray } from '@reformer/cdk/form-array';
import { FormField, useFormField } from '@reformer/cdk/form-field';
import { FormWizard, useFormWizard } from '@reformer/cdk/form-wizard';
```
