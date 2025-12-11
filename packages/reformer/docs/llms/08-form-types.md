## 7. FORM TYPE DEFINITION

```typescript
// CORRECT form type definition
interface MyForm {
  // Required fields
  name: string;
  email: string;

  // Optional fields - use undefined, not null
  phone?: string;
  age?: number;

  // Enum/union types
  status: 'active' | 'inactive';

  // Nested objects
  address: {
    street: string;
    city: string;
  };

  // Arrays - use tuple format for schema
  items: Array<{
    id: string;
    name: string;
  }>;
}
```
