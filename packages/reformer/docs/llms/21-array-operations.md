## 18. ARRAY OPERATIONS

### Array Access - CRITICAL

```typescript
// WRONG - bracket notation does NOT work!
const first = form.items[0]; // undefined or error
const second = form.items[1]; // undefined or error

// CORRECT - use .at() method
const first = form.items.at(0); // FormProxy<ItemType> | undefined
const second = form.items.at(1); // FormProxy<ItemType> | undefined

// CORRECT - iterate with map (most common pattern)
form.items.map((item, index) => {
  // item is fully typed GroupNode
  item.name.setValue('New Name');
  item.price.value.value; // read value
});
```

### Array Methods

```typescript
// Add items
form.items.push({ name: '', price: 0 });           // Add to end
form.items.insert(0, { name: '', price: 0 });      // Insert at index

// Remove items
form.items.removeAt(index);                         // Remove by index
form.items.clear();                                 // Remove all items

// Reorder
form.items.move(fromIndex, toIndex);                // Move item

// Access (use .at(), NOT brackets!)
form.items.length.value;                            // Current length (Signal)
form.items.map((item, index) => ...);               // Iterate items
form.items.at(index);                               // Get item at index (NOT items[index]!)
```

### Rendering Arrays

```tsx
function ItemsList({ form }: { form: FormProxy<MyForm> }) {
  const { length } = useFormControl(form.items);

  return (
    <div>
      {form.items.map((item, index) => (
        // item is GroupNode (sub-form) - each field is a control
        <div key={item.id || index}>
          <FormField control={item.name} />
          <FormField control={item.price} />
          <button onClick={() => form.items.removeAt(index)}>Remove</button>
        </div>
      ))}

      {length === 0 && <p>No items yet</p>}

      <button onClick={() => form.items.push({ name: '', price: 0 })}>Add Item</button>
    </div>
  );
}
```

### Array Cross-Validation

```typescript
// Validate uniqueness across array items
validateTree(
  (ctx: { form: MyForm }) => {
    const items = ctx.form.items;
    const names = items.map((item) => item.name.value.value);
    const uniqueNames = new Set(names);

    if (names.length !== uniqueNames.size) {
      return { code: 'duplicate', message: 'Item names must be unique' };
    }
    return null;
  },
  { targetField: 'items' }
);

// Validate sum of percentages
validateTree(
  (ctx: { form: MyForm }) => {
    const items = ctx.form.items;
    const totalPercent = items.reduce((sum, item) => sum + (item.percentage.value.value || 0), 0);

    if (Math.abs(totalPercent - 100) > 0.01) {
      return { code: 'invalid_total', message: 'Percentages must sum to 100%' };
    }
    return null;
  },
  { targetField: 'items' }
);
```
