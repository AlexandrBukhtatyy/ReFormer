## 18. ARRAY OPERATIONS

Массивы объектов — model-owned. Мутации делаются через `ModelArray` (`model.arrayField`);
рендер — через ноду формы (`form.items.map` / `.at`).

### Array Access

```typescript
// Через ModelArray (данные)
model.items.at(0);              // FormModel<Item> | undefined (под-модель элемента)
model.items.map((item, i) => item.name);  // item — FormModel<Item>
model.items.length;             // реактивная длина
model.items.toArray();          // снимок значений

// Через ноду формы (рендер / доступ к нодам полей)
form.items.at(0);               // FormProxy<Item> | undefined
form.items.map((item, i) => …); // item — FormProxy<Item>
```

### Array Methods (на модели)

```typescript
model.items.push({ name: '', price: 0 });        // добавить в конец (ПЛОСКИЕ значения!)
model.items.insertAt(0, { name: '', price: 0 }); // вставить по индексу
model.items.removeAt(index);                     // удалить по индексу
model.items.move(fromIndex, toIndex);            // переместить
model.items.swap(a, b);                          // поменять местами
model.items.clear();                             // очистить
```

> **push принимает ПЛОСКИЕ значения** (`{ name, price }`), а НЕ FieldConfig-шаблон
> (`{ value, component }`). Component/componentProps берутся из `item`-фабрики схемы.
> Передача FieldConfig-объектов сломает рендер (`[object Object]` в инпутах).

### Rendering Arrays

```tsx
import { useArrayLength } from '@reformer/core';

function ItemsList({ form }: { form: FormProxy<MyForm> }) {
  const length = useArrayLength(form.items);

  return (
    <div>
      {form.items.map((item, index) => (
        <div key={index}>
          <FormField control={item.name} />
          <FormField control={item.price} />
          <button onClick={() => model.items.removeAt(index)}>Remove</button>
        </div>
      ))}
      {length === 0 && <p>No items yet</p>}
      <button onClick={() => model.items.push({ name: '', price: 0 })}>Add Item</button>
    </div>
  );
}
```

> В монорепо используется `FormArraySection` из `@reformer/ui-kit`: `control={form.items}`,
> `itemComponent`, `initialValue`, add/remove/reorder из коробки. См. `find_recipe(topic="form-array")`.

### Per-item behavior — applyEach

Чтобы применить поведение к КАЖДОМУ элементу (реагируя на add/remove), используй `applyEach`:

```typescript
import { defineFormBehavior, applyEach, compute } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  applyEach(
    model.$.items,
    defineFormBehavior<Item>(({ model: row }) => {
      compute(row.$.lineTotal, () => row.qty * row.price); // per-row value-op
    })
  );
});
```

### Aggregate write — aggregateInto

Агрегатная запись в строки (например, «последняя строка = 100 − Σ остальных»):

```typescript
import { aggregateInto } from '@reformer/core/behaviors';

aggregateInto(model.$.rows, (rows) => {
  const n = rows.length;
  if (n === 0) return [];
  const others = rows.slice(0, n - 1).reduce((s, r) => s + r.percent, 0);
  return [{ index: n - 1, patch: { percent: 100 - others } }]; // derive должна сходиться
});
```

### Array Cross-Validation

Whole-array правило — оператор `cross(sig, (f) => ...)` из `@reformer/core/validation`:
`f` — снапшот `model.get()`, ошибка вешается на скалярное поле-носитель `sig`. Per-item
правила — `each(model.<array>, (im) => ...)`.

```typescript
import { cross } from '@reformer/core/validation';
import type { ValidationError } from '@reformer/core';

const percentagesSumTo100 = (f: MyForm): ValidationError | null => {
  const total = f.items.reduce((sum, i) => sum + (i.percentage || 0), 0);
  return Math.abs(total - 100) > 0.01
    ? { code: 'invalid_total', message: 'Percentages must sum to 100%' }
    : null;
};

// внутри defineValidationSchema<MyForm>(({ model }) => { ... })
cross(model.$.totalPercent, percentagesSumTo100); // носитель — скалярное поле формы
```
