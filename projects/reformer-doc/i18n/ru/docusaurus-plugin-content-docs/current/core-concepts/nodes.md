---
sidebar_position: 3
---

# Ноды формы

**Ноды** — строительные блоки формы. Их не создают вручную через `new` — их строит `createForm`
поверх сигналов модели, а прикладной код работает с ними через интерфейсы:

| Нода          | Назначение                                       | Пример                        |
| ------------- | ------------------------------------------------ | ----------------------------- |
| `FormControl` | одно значение (строка, число, флаг, мультивыбор) | текстовое поле, чекбокс, теги |
| `FormGroup`   | объект с именованными полями                     | вся форма, секция, адрес      |
| `FormArray`   | динамический список под-форм                     | телефоны, созаёмщики          |

Все три расширяют общий контракт `FormNode<T>`. Классы реализации — внутренние: типы для
аннотаций берите из `@reformer/core` (`FormControl`, `FormGroup`, `FormArray`, `FormNode`).

## Доступ к полям

`createForm` возвращает в сборке корневую группу `form`: к полям обращаются по имени, к вложенным —
цепочкой. Нода есть у каждого поля модели; вид ноды определяет вид узла модели: лист — поле,
объект — группа, массив объектов — массив под-форм (если схема описала его строку узлом с `item`).

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { Input } from '@reformer/ui-kit';

type Profile = { firstName: string; address: { city: string } };

const profileSchema = (model: FormModel<Profile>): FormSchemaNode => ({
  children: [
    { model: model.$.firstName, component: Input },
    { model: model.$.address.city, component: Input },
  ],
});

const { form } = createForm<Profile>({
  initial: { firstName: '', address: { city: '' } },
  schema: profileSchema,
});

form.firstName; // FormControl<string>
form.address; // FormGroup<{ city: string }>
form.address.city; // FormControl<string> — вложенный доступ
```

### Поля с именами членов ноды — `form.$`

Точкой доступны все поля, кроме тех, чьё имя занято членом `FormNode` (`value`, `issues`, `reset`,
`disabled`, …). Такое поле достаётся через пространство `form.$`, где перечислены **все** поля
группы. Остальные имена (`id`, `status`, `fields`, `submit`, …) ничем не затенены.

```typescript
type Order = { status: string; value: number };

const { form } = createForm<Order>({ initial: { status: 'new', value: 0 } });

form.status.setValue('paid'); // обычное поле данных
form.value; // сигнал значения самой группы (член FormNode)
form.$.value.setValue(100); // поле данных «value» — через form.$
```

:::warning Проверяйте вид ноды гардами, а не `instanceof`
Классы нод внутренние, поэтому `node instanceof …` не работает. Используйте
[type-guards](#type-guards).
:::

## Состояние ноды — сигналы

Свойства ноды `value`, `valid`, `invalid`, `issues`, `touched`, `dirty`, `disabled`, `pending` —
**сигналы** (реактивные, только для чтения). В React их удобнее читать через
[`useFormControl`](../react/hooks); вне React — через `.value` сигнала или методы ниже.

| Свойство (сигнал)   | Тип                          | Описание                                                    |
| ------------------- | ---------------------------- | ----------------------------------------------------------- |
| `value`             | `T`                          | текущее значение (источник — модель)                        |
| `valid` / `invalid` | `boolean`                    | нет / есть блокирующие замечания                            |
| `issues`            | `readonly ValidationIssue[]` | замечания валидации; у группы и массива — свои и всех детей |
| `touched` / `dirty` | `boolean`                    | пользователь взаимодействовал / значение менялось           |
| `disabled`          | `boolean`                    | нода отключена: замечания сняты, в проверку не входит       |
| `pending`           | `boolean`                    | идёт асинхронная проверка поля                              |

Статуса-строки у ноды нет: состояние читается флагами `valid` / `invalid` / `pending` /
`disabled`.

## Методы ноды

Общие для поля, группы и массива:

```typescript
form.firstName.getValue(); // прочитать значение без подписки
form.firstName.setValue('John'); // записать значение в модель
form.firstName.reset(); // вернуть значение и состояние к начальным
form.firstName.reset('Jane'); // …или к переданному значению
form.firstName.markAsTouched(); // отметить «тронутым» (у группы — все поля)
form.firstName.markAsUntouched();
form.firstName.disable(); // отключить
form.firstName.enable(); // включить
form.firstName.setIssues([{ code: 'taken' }]); // поставить замечания извне (ответ сервера)
form.firstName.clearIssues(); // снять замечания
```

Изменение значения через ноду отражается в модели (и наоборот) — это одни и те же сигналы.
Частичное обновление нескольких полей делается на модели: `model.patch({ ... })` (см.
[Модель данных](./model#set-против-patch)).

:::info Нода не проверяет правила
Правила формы живут в отдельной `ValidationDefinition` и запускаются сборкой — `bundle.validate()`,
`bundle.submit(handler)` — или раннером [`validateModel(model, rules)`](./schemas/validation-schema).
Раннер сам разносит замечания по нодам (`setIssues`), после чего они видны в сигнале `issues`.
Метода `validate()` у ноды нет.
:::

### FormControl

Лист дерева. Дополнительно к общим методам — состояние компонента из узла схемы:

```typescript
form.email.component; // компонент из узла схемы
form.email.componentProps; // сигнал текущих componentProps
form.email.updateComponentProps({ options: [...] }); // слить правку в пропсы (например, опции Select)
form.email.shouldShowError; // сигнал: invalid && (touched || dirty)
```

### FormGroup

Группирует поля в объект: `form` целиком, вложенные группы (`form.address`), строки массива.

```typescript
form.address.getValue(); // { city: '...' }
form.address.markAsTouched(); // отметить все дочерние поля тронутыми
form.address.issues.value; // замечания группы и всех её полей
form.$.address; // та же группа через пространство всех полей
```

### FormArray

Динамический список под-форм: каждая строка — `FormGroup` над элементом массива модели. Данными
массив не владеет — мутации уходят в массив модели, а формы строк держатся за под-модели и при
`move` / `swap` не пересоздаются.

```typescript
form.phones.length; // число строк (чтение в effect/computed подписывает на изменения)
form.phones.at(0); // FormGroup строки
form.phones.map((row, i) => row.number); // обход строк
form.phones.keyAt(0); // стабильный ключ строки для React — не меняется при move/swap

form.phones.push(); // добавить строку по шаблону массива модели (arrayOf)
form.phones.push({ type: 'mobile', number: '' }); // …или значение целиком
form.phones.insert(0, { type: 'home', number: '' });
form.phones.removeAt(1);
form.phones.move(0, 2);
form.phones.swap(0, 1);
form.phones.clear();
```

В React строки рисуют с ключом `keyAt(index)`, а реактивную длину читают через
[`useArrayLength`](../react/hooks).

## Type-guards

Вид ноды определяют функции-гарды:

```typescript
import { isFormNode, isFormControl, isFormGroup, isFormArray } from '@reformer/core';

if (isFormControl(node)) {
  /* поле */
}
if (isFormGroup(node)) {
  /* группа */
}
if (isFormArray(node)) {
  /* массив под-форм */
}
isFormNode(value); // любая нода формы
```

:::note Прежний контракт нод
Удалены: классы `FieldNode`, `GroupNode`, `ModelArrayNode` и тип `FormProxy` (→ `FormGroup`),
`status` / `FieldStatus` (→ флаги `valid` / `invalid` / `pending` / `disabled`), `patchValue`
(→ `model.patch`), `markAsDirty` / `markAsPristine`, `validate()` ноды (→ `bundle.validate()`),
`errors` / `setErrors` / `clearErrors` (→ `issues` / `setIssues` / `clearIssues`), гарды
`isFieldNode` / `isGroupNode` / `isArrayNode` (→ `isFormControl` / `isFormGroup` / `isFormArray`).
`length` массива — число, а не сигнал.
:::

## Дальше

- [Схема формы](./schemas/overview) — как описать структуру и привязать ноды к модели.
- [React-хуки](../react/hooks) — читать состояние нод в компонентах.
- [Массивы и динамические формы](../patterns/arrays) — работа с `FormArray` на практике.
