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

### Add/remove items — `initialValue` MUST be PLAIN leaf values

`FormArray.AddButton initialValue` (and the imperative `array.push(...)` /
`array.add(...)`) expect a payload of **plain leaf values**, NOT a fresh
FieldConfig template (`{ value, component, componentProps }`).

If you pass FieldConfig objects, the runtime stores them verbatim into the
new sub-form fields and silently breaks rendering: text fields show
`[object Object]`, checkboxes flip to truthy `true`, selects show empty.

```typescript
// ❌ WRONG — produces [object Object] in textareas, checkbox auto-true
const wrongPropertyTemplate = () => ({
  type: { value: 'apartment', component: Select, componentProps: { /* ... */ } },
  description: { value: '', component: Textarea, componentProps: { rows: 2 } },
  estimatedValue: { value: 0, component: Input },
  hasEncumbrance: { value: false, component: Checkbox },
});

// ✅ RIGHT — plain leaf values matching the item interface
const propertyTemplate = (): PropertyItem => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});

// Either with the compound:
<FormArray.AddButton initialValue={propertyTemplate()} />

// Or imperative:
form.step5.properties.push(propertyTemplate());
```

The FieldConfig SHAPE (with `component`, `componentProps`, etc.) belongs
ONLY in the *initial* schema literal passed to `createForm({...})`. New
items pushed at runtime reuse the same component+props that the schema's
template item declared — `initialValue` only fills the field VALUES.

> **Symptom checklist** (if you see these, you're passing FieldConfig):
> - `[object Object]` rendered in a Textarea/Input.
> - Boolean checkbox shows checked even though `value: false` was provided.
> - Select shows empty placeholder even though `value: 'apartment'` was provided.

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
