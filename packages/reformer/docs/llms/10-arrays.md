## 9. ARRAY SCHEMA FORMAT

**Array items are sub-forms!** Each array element is a complete sub-form with its own fields, validation, and behavior.

```typescript
// CORRECT - use tuple format for arrays
// The template item defines the sub-form schema for each array element
const itemSchema = {
  id: { value: '', component: Input },
  name: { value: '', component: Input },
  price: { value: 0, component: Input, componentProps: { type: 'number' } },
};

const schema: FormSchema<MyForm> = {
  items: [itemSchema],  // Array of sub-forms
};
```

> **Type constraint:** the element interface used as `T` in `Array<T>` / `ArrayNode<T>`
> must be assignable to `FormFields = Record<string, FormValue>`. Either declare the
> item interface as `interface Item extends FormFields { … }` or add an explicit
> `[key: string]: FormValue` index signature. Without it TS reports
> *"Type 'Item' does not satisfy the constraint 'FormFields'"* on `ArrayNode<Item>`.

> **Do NOT use `enableWhen(path.someArray, …, { resetOnDisable: true })` on a whole
> ArrayNode.** The combination triggers a reactive cycle on mount that prevents
> `DOMContentLoaded` (the browser hangs and has to be restarted). For
> "show array conditionally" — gate the rendering in JSX:
>
> ```tsx
> {form.hasItems.value && (
>   <ArrayUI array={form.items} />
> )}
> ```
>
> `enableWhen` on individual `FieldNode` targets inside an array item template is fine.

```typescript

// Each array item is a GroupNode (sub-form) with its own controls:
form.items.map((item) => {
  // item is a sub-form (GroupNode) - access fields like nested form
  item.name.setValue('New Name');
  item.price.value.value;  // Get current value
});
```

```typescript
// WRONG - object format is NOT supported
const schema = {
  items: { schema: itemSchema, initialItems: [] }, // This will NOT work
};
```

### Array Item as Sub-Form

```typescript
// Validation for array items (each item is a sub-form)
validateItems(path.items, (itemPath) => {
  // itemPath provides paths to sub-form fields
  required(itemPath.name);
  min(itemPath.price, 0);
});

// Render array items - each item is a sub-form
{form.items.map((item, index) => (
  <div key={item.id}>
    {/* item is a sub-form - use FormField for each field */}
    <FormField control={item.name} />
    <FormField control={item.price} />
    <button onClick={() => form.items.removeAt(index)}>Remove</button>
  </div>
))}
```
