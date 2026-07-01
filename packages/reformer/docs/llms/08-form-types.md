## 7. FORM TYPE DEFINITION

Form-shape объявляй через `type`-alias (не `interface` — см. `30-type-safety-recipes.md`).
Тип описывает форму ДАННЫХ (то, что кладётся в `createModel`), без узлов/сигналов.

```typescript
// CORRECT form type definition
type MyForm = {
  // Required fields
  name: string;
  email: string;

  // Optional fields — конвенция для форм: null («пользователь очистил»)
  phone: string | null;
  age: number | null;

  // Enum/union types
  status: 'active' | 'inactive';

  // Nested objects
  address: {
    street: string;
    city: string;
  };

  // Arrays of objects — model-owned (см. 10-arrays.md)
  items: Array<{
    id: string;
    name: string;
  }>;
};

// Модель создаётся из initial-значений этого типа
const model = createModel<MyForm>({
  name: '',
  email: '',
  phone: null,
  age: null,
  status: 'active',
  address: { street: '', city: '' },
  items: [],
});
```

`number | null` / `string | null` работают со встроенными валидаторами напрямую —
`min`/`max`/`minLength`/`minDate`/`minAge` пропускают пустые значения внутри, guard `if (v != null)`
не нужен.
