## 9. ARRAY SCHEMA FORMAT

Массивы объектов — **model-owned**: данные принадлежат модели (`model.arrayField` — это
`ModelArray<Item>` с реактивными `push`/`removeAt`/`length`). В схеме массив объявляется узлом
`{ model: model.$.<path>, item: (itemModel) => узел }`, где `item` строит разметку одной строки
из её под-модели (`FormModel<Item>`).

```typescript
import {
  arrayOf,
  createModel,
  createFormFromModel,
  type FormModel,
  type FormSchemaNode,
} from '@reformer/core';
import { FieldArray, Input, InputNumber } from '@reformer/ui-kit';

type Item = { id: string; name: string; price: number };
type MyForm = { items: Item[] };

// arrayOf(blank) — пустой список и шаблон строки для кнопки «Добавить»
const blankItem = (): Item => ({ id: '', name: '', price: 0 });
const model = createModel<MyForm>({ items: arrayOf(blankItem) });

// разметка одной строки (item.$.field — ручка под-модели строки)
const itemRow = (item: FormModel<Item>): FormSchemaNode => ({
  children: [
    { model: item.$.id, component: Input },
    { model: item.$.name, component: Input },
    { model: item.$.price, component: InputNumber },
  ],
});

const schema: FormSchemaNode = {
  children: [{ model: model.$.items, component: FieldArray, item: itemRow }],
};

const form = createFormFromModel<MyForm>({ model, schema });
form.items; // FormArray<Item> — форма каждой строки: form.items.at(i)
```

> Привязка массива — **ручка** `model.$.items`, как у поля и подформы. `item` на привязке, которая
> массивом не является (лист, группа), — ошибка компиляции.

### Массив как ОДНО значение поля

Массив бывает не набором под-форм, а одним значением: мультивыбор, теги, список файлов. Чем он
является, решает **схема**, а не данные: `{ model, item }` — набор под-форм, а узел поля
`{ model: model.$.<путь>, component }` без `item` — одно значение. Массив, к которому в схеме
ничего не привязано, в форму не попадает.

```typescript
type MyForm = { tags: string[] };

const model = createModel<MyForm>({ tags: [] });

const schema: FormSchemaNode = {
  children: [{ model: model.$.tags, component: SelectMulti }], // поле над массивом целиком
};
const form = createFormFromModel<MyForm>({ model, schema });

form.tags.setValue(['a', 'b']); // FormControl<string[]>
model.$.tags.value = ['c']; // ручка значения: заменяет массив целиком
validate(model.$.tags, [required(), maxLength(3)]); // правило получает массив
```

- `model.$.<массив>` — записываемая ручка значения (`PathAwareSignal`): подходит для `model:` в
  схеме, `validate`/`cross`, `enableWhen`/`copyFrom` и для `model.signalAt(path)`.
- Узел-массив хранит только массив: запись `null`/`undefined` даёт `[]`. Нужно отличать «не
  выбирали» от «выбрали ничего» — объявляй поле `T[] | null` с начальным `null`: в рантайме это
  лист, и привязывается он так же.
- **Контейнер с `null` в типе — значение как есть.** `model.files` у поля `File[] | null` — это
  `File[] | null`, а не фасад `ModelArray`; `model.$.files` — лист `PathAwareSignal` без `length` и
  индексов; группа `Address | null` — `Address | null` без под-модели. Такое поле начинают с
  `null`: контейнер, созданный из `[]` или `{}`, в рантайме стал бы фасадом, а тип его не видит.
- Запись в узел-ГРУППУ (`model.$.<группа>.value = …`) — ошибка: группа пишется по полям или через
  `model.patch(...)`.

### Массив в группе и в строке другого массива

Узел `{ model, item }` стоит на любой глубине: массив в группе получает ноду `form.<группа>.<массив>`,
массив в строке — `form.<массив>.at(i).<массив>`. Разметка строки объявляет свои массивы так же.

```typescript
const contactRow = (contact: FormModel<Contact>): FormSchemaNode => ({
  children: [
    { model: contact.$.name, component: Input },
    { model: contact.$.phones, item: phoneRow }, // массив в строке массива
  ],
});

const schema: FormSchemaNode = {
  children: [
    { model: model.$.details.hotlines, item: phoneRow }, // массив в группе
    { model: model.$.contacts, item: contactRow },
  ],
};
```

Поведение строк вложенного массива — `applyEach` внутри схемы строки, см. `21-array-operations.md`.

### Один массив — три слоя (три разных движка)

Одна и та же коллекция описывается **тремя разными формами** — по одной на движок. Их легко
перепутать, но каждая корректна только в своём контексте:

1. **Схема формы** — узел `{ model: model.$.<path>, item: (itemModel) => узел }` среди `children`
   дерева:

   ```typescript
   // узел схемы для createForm / createFormFromModel
   { model: model.$.properties, component: FieldArray, item: propertyRow },
   ```

2. **Схема валидации (`@reformer/core/validation`)** — правила строки объявляются отдельной схемой
   над типом строки и подключаются оператором `applyEach(model.$.<массив>, схема)`. У схемы строки
   своя область: её `cross` получает снимок строки. Запуск — `validateModel(model, schema)`.

   ```typescript
   const propertyRules = defineValidation<Property>(({ model }) => {
     validate(model.$.description, [required()]);
     validate(model.$.estimatedValue, [required(), min(1)]);
   });

   // внутри defineValidation<MyForm>(({ model }) => { ... })
   applyEach(model.$.properties, propertyRules);
   ```

3. **CDK / render** — работают с уже **материализованной** нодой `form.<array>` (`FormArray`),
   а не со схемой: `<FieldArray.Root control={form.properties}>` (CDK) или `FieldArraySection` из
   `@reformer/ui-kit` (`control={form.properties}`, `itemComponent`).

> **Не путай запись по движку.** Схема формы — узел `{ model, item }`; правила строк —
> `applyEach(model.$.<массив>, схема)` в схеме валидации; `FieldArray.Root control={form.x}` (или
> `FieldArraySection`) — рендер. `applyEach` в схеме формы не подхватится, а узел `{ model, item }`
> схема валидации не обходит.

### Array operations — на модели или на ноде

Мутации массива делаются через `ModelArray` (`model.items`) либо через ноду формы `FormArray`
(`form.items`) — нода данными не владеет и передаёт мутацию в тот же массив модели:

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

// та же мутация через ноду формы (у ноды вставка — insert, у модели — insertAt)
form.items.push();                                   // строка по шаблону arrayOf(blank)
form.items.insert(0, { id: '3', name: '', price: 0 });
form.items.removeAt(index);
form.items.length;                                   // число строк (число, не сигнал)
form.items.keyAt(index);                             // стабильный ключ строки
```

Формы строк держатся за под-модели элементов и при `move` / `swap` не пересоздаются; ключ строки
(`keyAt`) не меняется при перестановке — его и берут для React `key`.

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

Каждый элемент массива — под-форма (`FormGroup<Item>`). Итерируй через `form.items.map`:

```tsx
import { useArrayLength } from '@reformer/core/react';

function ItemsList({ form }: { form: FormGroup<MyForm> }) {
  const length = useArrayLength(form.items);

  return (
    <div>
      {form.items.map((item, index) => (
        <div key={form.items.keyAt(index)}>
          <FormField control={item.name} />
          <FormField control={item.price} />
          <button onClick={() => form.items.removeAt(index)}>Remove</button>
        </div>
      ))}

      {length === 0 && <p>No items yet</p>}

      <button onClick={() => form.items.push({ id: crypto.randomUUID(), name: '', price: 0 })}>
        Add Item
      </button>
    </div>
  );
}
```

> В монорепо для массивов используется готовый `FieldArraySection` из `@reformer/ui-kit`
> (`control={form.items}`, `itemComponent`, add/remove/reorder из коробки; шаблон новой строки —
> `arrayOf(blank)` в модели, проп `initialValue` — запасной путь). В схеме массив под-форм рисует
> компонент `FieldArray` узла `{ model, component: FieldArray, item }`.
> См. `find_recipe(topic="field-array")`.

### Array Cross-Validation

Правило над всем массивом пишется оператором `cross` из аргумента схемы: `check` получает снимок
модели области (`model.get()`, плоские значения), ошибка вешается на поле-носитель. Тип снимка
выведен из схемы. Правила строк — `applyEach` (см. выше).

Носитель — любое **скалярное** поле формы (флаг `hasItems`, итоговая сумма и т.п.), у которого
есть ручка `model.$.<field>` и нода в форме:

```typescript
type MyForm = { hasItems: boolean; items: Item[] };

defineValidation<MyForm>(({ model, cross }) => {
  cross(model.$.hasItems, (form) => {
    const names = form.items.map((item) => item.name);
    return names.length !== new Set(names).size
      ? { code: 'items.duplicate' }
      : null;
  });
});
```

## See also

- [03-api-signatures.md](./03-api-signatures.md) — сигнатуры нод `form.<array>` / `ModelArray`, правила строк `applyEach`
- [37-compiled-schema.md](./37-compiled-schema.md) — область строки `#/items[<ключ>]` и `keyAt`
- CDK / ui-kit field-array (`FieldArray.Root`, `FieldArraySection`) — `find_recipe(topic="field-array")`
