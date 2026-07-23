---
sidebar_position: 3
---

# Ноды и proxy

**Ноды** — строительные блоки формы. Их не создают вручную через `new` — их строит `createForm`
поверх сигналов модели, а доступ к ним даёт типизированный **proxy**.

| Нода             | Назначение                           | Пример                  |
| ---------------- | ------------------------------------ | ----------------------- |
| `FieldNode`      | одно значение (строка, число, флаг)  | текстовое поле, чекбокс |
| `GroupNode`      | объект с именованными полями         | секция формы, адрес     |
| `ArrayNode`      | динамический список подформ          | телефоны, адреса        |
| `ModelArrayNode` | массив, привязанный к массиву модели | список объектов модели  |

## Доступ через proxy

`createForm` возвращает proxy: к полям обращаются по имени, вложенность — цепочкой.

```typescript
import { createModel, createForm } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

type Form = { firstName: string; address: { city: string } };

const model = createModel<Form>({ firstName: '', address: { city: '' } });

const schema = {
  firstName: { value: model.$.firstName, component: Input },
  address: {
    city: { value: model.$.address.city, component: Input },
  },
};

const form = createForm<Form>({ model, schema });

form.firstName; // FieldNode<string>
form.address; // GroupNode
form.address.city; // FieldNode<string> — вложенный доступ
```

:::warning Proxy не проходит `instanceof`
Не проверяйте тип ноды через `node instanceof FieldNode` — proxy это не пройдёт. Используйте
[type-guards](#type-guards).
:::

## Состояние ноды — сигналы

Свойства ноды `value`, `valid`, `invalid`, `errors`, `touched`, `dirty`, `disabled`, `pending` —
**сигналы** (реактивные, только для чтения). В React их удобнее читать через
[`useFormControl`](../react/hooks); вне React — через методы ниже или `.value` сигнала.

| Свойство (сигнал)   | Тип                 | Описание                                          |
| ------------------- | ------------------- | ------------------------------------------------- |
| `value`             | `T`                 | текущее значение                                  |
| `valid` / `invalid` | `boolean`           | проходит / не проходит валидацию                  |
| `errors`            | `ValidationError[]` | ошибки валидации (`[]` когда валидно)             |
| `touched` / `dirty` | `boolean`           | пользователь взаимодействовал / значение менялось |
| `disabled`          | `boolean`           | поле отключено                                    |
| `pending`           | `boolean`           | идёт асинхронная валидация                        |

## Методы ноды

```typescript
form.firstName.getValue(); // прочитать значение
form.firstName.setValue('John'); // записать значение
form.firstName.patchValue(partial); // частичное обновление (для групп/массивов)
form.firstName.reset(); // сброс к начальному
form.firstName.markAsTouched(); // отметить как «тронутое»
form.firstName.markAsDirty();
form.firstName.disable(); // отключить
form.firstName.enable(); // включить
await form.firstName.validate(); // проверить состояние ноды (schema-валидация — внешняя, см. ниже)
```

Изменение значения через ноду отражается в модели (и наоборот) — это одни и те же сигналы.

:::warning `validate()` ноды не запускает схему валидации
Метод `validate()` (и у поля, и у группы) отражает **собственное** состояние нод и возвращает
`Promise<boolean>` по текущим ошибкам — он **не** прогоняет схему валидации. Правила формы живут в
отдельной `ValidationSchema` и запускаются приложением внешним раннером
[`validateModel(model, schema)`](./schemas/validation-schema) из `@reformer/core/validation`: тот сам
разносит ошибки по нодам через `setErrors`, после чего они видны в сигнале `errors`. Поэтому
`form.validate()` / `submit()` больше **не** прогоняют schema-валидаторы (раньше валидаторы жили на
нодах — теперь layout и валидация разведены по разным каналам).
:::

### FieldNode

Лист дерева. Дополнительно к общим методам:

```typescript
form.email.updateComponentProps({ options: [...] }); // обновить пропсы компонента (например, опции Select)
form.email.componentProps;   // сигнал текущих componentProps
form.email.shouldShowError;  // сигнал: показывать ли ошибку (touched + invalid)
```

### GroupNode

Группирует поля в объект.

```typescript
form.address.getValue(); // { city: '...', zip: '...' }
form.address.touchAll(); // отметить все дочерние поля тронутыми
form.address.getFieldByPath('city'); // доступ по строковому пути
```

### ArrayNode

Динамический список подформ. Сами данные принадлежат модели, поэтому мутации выполняются на
[модели](./model), а нода отражает их реактивно:

```typescript
model.phones.push({ type: 'mobile', number: '' }); // добавить элемент
model.phones.removeAt(0);                           // удалить

form.phones.at(0);                                  // FormProxy элемента
form.phones.map((item, i) => /* ... */);            // обход элементов
```

## Type-guards

Поскольку proxy не проходит `instanceof`, тип ноды определяют через guard-функции:

```typescript
import { isFieldNode, isGroupNode, isArrayNode, getNodeType } from '@reformer/core';

if (isFieldNode(node)) {
  /* лист */
}
if (isGroupNode(node)) {
  /* группа */
}
if (isArrayNode(node)) {
  /* массив */
}

getNodeType(node); // 'field' | 'group' | 'array'
```

## Дальше

- [Схема формы](./schemas/overview) — как описать структуру и привязать ноды к модели.
- [React-хуки](../react/hooks) — читать состояние нод в компонентах.
- [Массивы и динамические формы](../patterns/arrays) — работа с `ArrayNode` на практике.
