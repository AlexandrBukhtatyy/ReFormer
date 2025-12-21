## 6. COMPLETE IMPORT EXAMPLE

```typescript
// Types - always from @reformer/core
import type {
  ValidationSchemaFn,
  BehaviorSchemaFn,
  FieldPath,
  GroupNodeWithControls,
  FieldNode,
} from '@reformer/core';

// Core functions
import { createForm, useFormControl } from '@reformer/core';

// Validators - from /validators submodule
import { required, min, max, email, validate, applyWhen } from '@reformer/core/validators';

// Behaviors - from /behaviors submodule
import { computeFrom, enableWhen, watchField, copyFrom } from '@reformer/core/behaviors';
```
