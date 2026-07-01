## 9. ARRAY SCHEMA FORMAT

Массивы объектов — **model-owned**: данные принадлежат модели (`model.arrayField` — это
`ModelArray<Item>` с реактивными `push`/`removeAt`/`length`). В схеме массив объявляется узлом
`{ array: model.<path>, item: (itemModel) => subSchema }`, где `item` строит под-схему одного
элемента из его под-модели (`FormModel<Item>`).

```typescript
import { createModel, createForm, type FormModel } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

type Item = { id: string; name: string; price: number };
type MyForm = { items: Item[] };

const model = createModel<MyForm>({ items: [] });

// под-схема одного элемента (item.$.field — сигнал под-модели)
const itemSchema = (item: FormModel<Item>) => ({
  id:    { value: item.$.id,    component: Input },
  name:  { value: item.$.name,  component: Input },
  price: { value: item.$.price, component: Input, componentProps: { type: 'number' } },
});

const schema = {
  items: { array: model.items, item: itemSchema },
};

const form = createForm<MyForm>({ model, schema });
```

> **Type constraint:** тип элемента `Item` объявляй через `type`-alias (не `interface`) — иначе
> он не совместим с `Record<string, FormValue>` и `ArrayNode<Item>` его отвергнет.
> См. `30-type-safety-recipes.md`.

### Array operations — на модели

Мутации массива делаются через `ModelArray` (`model.items`), а не через ноду формы:

```typescript
model.items.push({ id: '1', name: '', price: 0 });   // добавить в конец (плоские значения!)
model.items.insertAt(0, { id: '2', name: '', price: 0 });
model.items.removeAt(index);
model.items.move(from, to);
model.items.swap(a, b);
model.items.clear();
model.items.length;                                  // реактивная длина
model.items.at(0);                                   // под-модель элемента (FormModel<Item>)
model.items.map((item, i) => item.name);             // item — FormModel<Item>
```

> **Плоские значения при push.** В `push`/`insertAt` передавай payload из **плоских значений**
> (`{ id, name, price }`), а НЕ FieldConfig-шаблон (`{ value, component }`). Component/componentProps
> берутся из `item`-фабрики схемы автоматически.

### Rendering Arrays

Каждый элемент массива — под-форма (`FormProxy<Item>`). Итерируй через `form.items.map`:

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

      <button onClick={() => model.items.push({ id: crypto.randomUUID(), name: '', price: 0 })}>
        Add Item
      </button>
    </div>
  );
}
```

> В монорепо для массивов используется готовый `FormArraySection` из `@reformer/ui-kit`
> (`control={form.items}`, `itemComponent`, `initialValue`, add/remove/reorder из коробки).
> См. `find_recipe(topic="form-array")`.

### Array Cross-Validation

Cross-field правило по массиву пишется как `ModelValidator`, читает элементы через `root`,
вешается на поле-носитель ошибки (или на первый элемент). Секции массива в схеме валидации
обходятся per-item движком `validateFormModel` (см. `03-api-signatures.md`).

```typescript
import type { ModelValidator } from '@reformer/core';

// уникальность имён по массиву
const uniqueNames: ModelValidator<unknown, unknown, MyForm> = (_value, _scope, root) => {
  const names = root.items.map((i) => i.name);
  return names.length !== new Set(names).size
    ? { code: 'duplicate', message: 'Item names must be unique' }
    : null;
};
```
