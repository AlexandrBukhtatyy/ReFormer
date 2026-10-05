## 9. ARRAY SCHEMA FORMAT

Массивы объектов — **model-owned**: данные принадлежат модели (`model.arrayField` — это
`ModelArray<Item>` с реактивными `push`/`removeAt`/`length`). В схеме массив объявляется узлом
`{ array: model.<path>, item: (itemModel) => subSchema }`, где `item` строит под-схему одного
элемента из его под-модели (`FormModel<Item>`).

```typescript
import { createModel, createFormFromModel, type FormModel } from '@reformer/core';
import { Input, InputNumber } from '@reformer/ui-kit';

type Item = { id: string; name: string; price: number };
type MyForm = { items: Item[] };

const model = createModel<MyForm>({ items: [] });

// под-схема одного элемента (item.$.field — сигнал под-модели)
const itemSchema = (item: FormModel<Item>) => ({
  id:    { value: item.$.id,    component: Input },
  name:  { value: item.$.name,  component: Input },
  price: { value: item.$.price, component: InputNumber },
});

const schema = {
  items: { array: model.items, item: itemSchema },
};

const form = createFormFromModel<MyForm>({ model, schema });
```

> **Type constraint:** тип элемента `Item` объявляй через `type`-alias (не `interface`) — иначе
> он не совместим с `Record<string, FormValue>` и `ArrayNode<Item>` его отвергнет.
> См. `30-type-safety-recipes.md`.

### Массив как ОДНО значение поля

Массив бывает не набором под-форм, а одним значением: мультивыбор, теги, список файлов. Чем он
является, решает **схема**, а не данные: `{ array, item }` — набор под-форм, а узел поля
`{ value: model.$.<путь>, component }` — одно значение. Массив, к которому в схеме ничего не
привязано, в форму не попадает.

```typescript
type MyForm = { tags: string[] };

const model = createModel<MyForm>({ tags: [] });

const schema = {
  tags: { value: model.$.tags, component: SelectMulti }, // поле над массивом целиком
};
const form = createFormFromModel<MyForm>({ model, schema });

form.tags.setValue(['a', 'b']); // FieldNode<string[]>
model.$.tags.value = ['c']; // ручка значения: заменяет массив целиком
validate(model.$.tags, [required(), maxLength(3)]); // правило получает массив
```

- `model.$.<массив>` — записываемая ручка значения (`PathAwareSignal`): подходит для `value:` в
  схеме, `validate`/`cross`, `enableWhen`/`copyFrom` и для `model.signalAt(path)`.
- Узел-массив хранит только массив: запись `null`/`undefined` даёт `[]`. Нужно отличать «не
  выбирали» от «выбрали ничего» — объявляй поле `T[] | null` с начальным `null`: в рантайме это
  лист, и привязывается он так же.
- Запись в узел-ГРУППУ (`model.$.<группа>.value = …`) — ошибка: группа пишется по полям или через
  `model.patch(...)`.

### Массив в группе и в строке другого массива

Узел `{ array, item }` стоит на любой глубине: массив в группе получает ноду `form.<группа>.<массив>`,
массив в строке — `form.<массив>.at(i).<массив>`. Под-схема строки объявляет свои массивы так же.

```typescript
const contactItem = (contact: FormModel<Contact>) => ({
  name: { value: contact.$.name, component: Input },
  phones: { array: contact.phones, item: phoneItem }, // массив в строке массива
});

const schema = {
  hotlines: { array: model.details.hotlines, item: phoneItem }, // массив в группе
  contacts: { array: model.contacts, item: contactItem },
};
```

Поведение строк вложенного массива — `applyEach` внутри схемы строки, см. `21-array-operations.md`.

### Один массив — три слоя (три разных движка)

Одна и та же коллекция описывается **тремя разными формами** — по одной на движок. Их легко
перепутать, но каждая корректна только в своём контексте:

1. **Layout-схема `createForm`** — единственная форма, которую ест `createForm`:
   `{ array: model.<path>, item: (itemModel) => subSchema }`. Массив связывается через
   **value-proxy** `model.properties` (он несёт `__path`), а **не** через сигнальный
   `model.$.properties`.

   ```typescript
   // узел схемы для createFormFromModel({ model, schema })
   properties: { array: model.properties, item: propertyItem },
   ```

2. **Validation-схема (`@reformer/core/validation`)** — per-item правила пишутся оператором
   `each(arr, (im) => {...})` внутри `defineValidationSchema`; `im` — под-модель элемента
   (`im.$.field` — его сигналы). Запуск — внешним `validateModel(model, schema)`.

   ```typescript
   // внутри defineValidationSchema<MyForm>(({ model }) => { ... })
   each(model.properties, (im) => {
     validate(im.$.description, [required()]);
     validate(im.$.estimatedValue, [required(), min(1)]);
   });
   ```

3. **CDK / render** — работают с уже **материализованной** нодой `form.<array>` (`ModelArrayNode`),
   а не со схемой: `<FormArray.Root control={form.properties}>` (CDK) или `FormArraySection` из
   `@reformer/ui-kit` (`control={form.properties}`, `itemComponent`).

> **Не путай форму по движку.** `createForm` принимает **только** `{ array, item }`;
> per-item валидация — это `each(model.<array>, (im) => ...)` в validation-схеме; `FormArray.Root
> control={form.x}` (или `FormArraySection`) — рендер. `each` в layout-схеме `createForm`
> не подхватится, а `{ array, item }` в validation-схеме не обходится.

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

> **Очистка массива в behavior.** Тот же `model.<array>.clear()` (см. список операций выше) —
> способ очистить коллекцию **вне React**, из behavior: он мутирует модель напрямую, минуя ноды
> формы. Типичный случай — сбросить массив при выключении флага:
>
> ```typescript
> onChange(model.$.hasProperty, (on) => {
>   if (!on) model.properties.clear();
> });
> ```

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

Whole-array правило пишется оператором `cross(sig, (f) => ...)`: `f` — снапшот `model.get()`
(плоские значения), ошибка вешается на поле-носитель `sig`. Per-item правила — `each`
(см. выше, оба — из `@reformer/core/validation`).

Носитель — любое **скалярное** поле формы (флаг `hasItems`, итоговая сумма и т.п.), у которого
есть сигнал `model.$.<field>` и нода в форме:

```typescript
import { cross } from '@reformer/core/validation';

type MyForm = { hasItems: boolean; items: Item[] };

// внутри defineValidationSchema<MyForm>(({ model }) => { ... })
cross(model.$.hasItems, (f: MyForm) => {
  const names = f.items.map((i) => i.name);
  return names.length !== new Set(names).size
    ? { code: 'duplicate', message: 'Item names must be unique' }
    : null;
});
```

## See also

- [03-api-signatures.md](./03-api-signatures.md) — сигнатуры нод `form.<array>` / `ModelArray`, per-item валидация `each`
- CDK / ui-kit form-array (`FormArray.Root`, `FormArraySection`) — `find_recipe(topic="form-array")`
