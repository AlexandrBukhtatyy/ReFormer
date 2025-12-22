## 8. FORMSCHEMA FORMAT (CRITICALLY IMPORTANT)

**Every field MUST have `value` and `component` properties!**

### FieldConfig Interface

```typescript
interface FieldConfig<T> {
  value: T | null;              // Initial value (REQUIRED)
  component: ComponentType;     // React component (REQUIRED)
  componentProps?: object;      // Props passed to component
  disabled?: boolean;           // Disable field initially
  validators?: ValidatorFn[];   // Sync validators
  asyncValidators?: AsyncValidatorFn[]; // Async validators
  updateOn?: 'change' | 'blur' | 'submit';
  debounce?: number;
}
```

### Primitive Fields

```typescript
import { Input, Select, Checkbox } from '@/components/ui';

const schema: FormSchema<MyForm> = {
  // String field
  name: {
    value: '',                    // Initial value (REQUIRED)
    component: Input,             // React component (REQUIRED)
    componentProps: {
      label: 'Name',
      placeholder: 'Enter name',
    },
  },

  // Number field (optional)
  age: {
    value: undefined,             // Use undefined, NOT null
    component: Input,
    componentProps: { type: 'number', label: 'Age' },
  },

  // Boolean field
  agree: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'I agree to terms' },
  },

  // Enum/Select field
  status: {
    value: 'active',
    component: Select,
    componentProps: {
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  },
};
```

### Nested Objects

```typescript
const schema: FormSchema<MyForm> = {
  address: {
    street: { value: '', component: Input, componentProps: { label: 'Street' } },
    city: { value: '', component: Input, componentProps: { label: 'City' } },
    zip: { value: '', component: Input, componentProps: { label: 'ZIP' } },
  },
};
```

### Arrays (Tuple Format)

```typescript
const itemSchema = {
  id: { value: '', component: Input, componentProps: { label: 'ID' } },
  name: { value: '', component: Input, componentProps: { label: 'Name' } },
};

const schema: FormSchema<MyForm> = {
  items: [itemSchema],  // Array with ONE template item
};
```

### WRONG - This will NOT compile

```typescript
// Missing value and component - TypeScript will error!
const schema = {
  name: '',           // Wrong
  email: '',          // Wrong
};
```

### createForm API

```typescript
// Full config with behavior and validation
const form = createForm<MyForm>({
  form: formSchema,              // Required: form schema with FieldConfig
  behavior: behaviorSchema,      // Optional: behavior rules
  validation: validationSchema,  // Optional: validation rules
});

// Access form controls
form.name.setValue('John');
form.address.city.value.value; // Get current value
form.items.push({ id: '1', name: 'Item' }); // Array operations
```

### createForm Returns a Proxy

```typescript
// createForm() returns FormProxy<T> (a Proxy wrapper around GroupNode)
// This enables type-safe field access:
const form = createForm<MyForm>({...});

form.email           // FieldNode<string> - TypeScript knows the type!
form.address.city    // FieldNode<string> - nested access works
form.items.at(0)     // FormProxy<ItemType> - array items

// IMPORTANT: Proxy doesn't pass instanceof checks!
// Use type guards instead:
import { isFieldNode, isGroupNode, isArrayNode } from '@reformer/core';

if (isFieldNode(node)) { /* ... */ }   // Works with Proxy
if (node instanceof FieldNode) { /* ... */ } // Fails with Proxy!
```
