## 15. NON-EXISTENT API (DO NOT USE)

**The following APIs do NOT exist in @reformer/core:**

| Wrong | Correct | Notes |
|----------|-----------|-------|
| `useForm` | `createForm` | There is no useForm hook |
| `FieldSchema` | `FieldConfig<T>` | Type for individual field config |
| `when()` | `applyWhen()` | Conditional validation function |
| `FormFields` | `FieldNode<T>` | Type for field nodes |
| `FormInstance<T>` | `FormProxy<T>` | Form type for component props |
| `useArrayField()` | `form.items.push/map/removeAt` | Use ArrayNode methods directly |
| `FormProvider` | `<Component form={form} />` | Pass form via props, no context |
| `formState` | `form.valid`, `form.dirty`, etc. | Separate signals on form |
| `control` prop | Not needed | Form IS the control |
| `register('field')` | `useFormControl(form.field)` | Type-safe field access |
| `getFieldValue()` | `ctx.form.field.value.value` | Read via signals |

### Common Import Errors

```typescript
// WRONG - These do NOT exist
import { useForm } from '@reformer/core';           // NO!
import { when } from '@reformer/core/validators';   // NO!
import type { FieldSchema } from '@reformer/core';  // NO!
import type { FormFields } from '@reformer/core';   // NO!

// CORRECT
import { createForm, useFormControl } from '@reformer/core';
import { applyWhen } from '@reformer/core/validators';
import type { FieldConfig, FieldNode } from '@reformer/core';
```

### FormSchema Common Mistakes

```typescript
// WRONG - Simple values don't work
const schema = {
  name: '',           // Missing { value, component }
  email: '',          // Missing { value, component }
};

// CORRECT - Every field needs value and component
const schema: FormSchema<MyForm> = {
  name: {
    value: '',
    component: Input,
    componentProps: { label: 'Name' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
  },
};
```
