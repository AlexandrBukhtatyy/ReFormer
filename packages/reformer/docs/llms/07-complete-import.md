## Import Patterns

```typescript
// Types - always from @reformer/core
import type {
  FormProxy,
  FieldNode,
  FieldPath,
  FormFields, // = Record<string, FormValue>
  FormValue, // primitive | nested | array element of any form
  FormSchema, // schema literal type for createForm<T>
  FieldConfig, // shape of a single field: { value, component, componentProps?, ... }
  ValidationSchemaFn,
  BehaviorSchemaFn,
} from '@reformer/core';

// Core functions and hooks
import {
  createForm,
  useFormControl,
  useFormControlValue,
  useArrayLength,
  useHiddenCondition,
  validateForm,
} from '@reformer/core';

// Validators - from /validators submodule
import { required, min, max, email, validate, applyWhen } from '@reformer/core/validators';

// Behaviors - from /behaviors submodule
import { computeFrom, enableWhen, watchField, copyFrom } from '@reformer/core/behaviors';
```

### Constraint to remember when typing nested forms

The proxy returned by `createForm<T>` and the `ArrayNode<U>` / `GroupNode<U>` types
require any form-shape generic to be assignable to `FormFields = Record<string, FormValue>`.
Plain interfaces work as long as every property is a valid `FormValue` (primitive,
nested object of `FormFields`, or array of `FormFields`). If TS complains
"Type 'X' does not satisfy the constraint 'FormFields'", add an index signature
or extend `FormFields` directly:

```typescript
interface AddressForm extends FormFields {
  street: string;
  city: string;
}

// or, if you can't extend (e.g. union), inline the index signature:
interface CoBorrower {
  fullName: string;
  phone: string;
  [key: string]: FormValue; // <- the constraint
}
```
