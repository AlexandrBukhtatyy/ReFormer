---
sidebar_position: 3
---

# Ноды формы

[Нода](/docs/reference/glossary) — состояние поля, группы или массива в форме: значение, касание,
замечания, доступность. Ноды строит `createForm` поверх сигналов [модели](./model.mdx). Сами
значения хранит модель, нода их только читает и пишет.

## Когда нужно

С нодами работают, когда нужно:

- показать в компоненте значение и замечания поля — хуки React читают именно ноду;
- отметить поля тронутыми, выключить поле, поставить замечание от сервера;
- перебрать и переставить строки массива в разметке.

## Минимальный пример

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

form.firstName; // FormControl<string> — нода поля
form.address; // FormGroup<{ city: string }> — нода группы
form.address.city.setValue('Казань'); // запись уходит в модель
form.address.city.touched.value; // false — состояние читается через сигнал
```

## Три вида нод

| Нода          | Что описывает                                    | Пример                        |
| ------------- | ------------------------------------------------ | ----------------------------- |
| `FormControl` | одно значение: строку, число, флаг, список тегов | текстовое поле, чекбокс, теги |
| `FormGroup`   | объект с именованными полями                     | вся форма, секция, адрес      |
| `FormArray`   | список строк, каждая строка — `FormGroup`        | телефоны, созаёмщики          |

Вид ноды определяет поле модели и то, как его описала [схема формы](./schemas/form-schema.md):

- простое значение (строка, число, дата) — `FormControl`;
- вложенный объект — `FormGroup`;
- массив, строку которого схема описала узлом с `item`, — `FormArray`;
- массив, к которому схема привязала компонент целиком (теги, мультивыбор), — `FormControl`.

Типы для аннотаций — `FormControl`, `FormGroup`, `FormArray` и общий `FormNode` из
`@reformer/core`.

## Состояние ноды

Состояние ноды — сигналы только для чтения. В React их читают хуком
[`useFormControl`](/docs/react/hooks), вне React — через `.value`.

| Сигнал              | Тип                          | Что значит                                                 |
| ------------------- | ---------------------------- | ---------------------------------------------------------- |
| `value`             | `T`                          | текущее значение из модели                                 |
| `valid` / `invalid` | `boolean`                    | блокирующих замечаний нет / есть                           |
| `issues`            | `readonly ValidationIssue[]` | замечания; у группы и массива — вместе с замечаниями полей |
| `ownIssues`         | `readonly ValidationIssue[]` | замечания самой ноды, без полей (например, длина массива)  |
| `touched`           | `boolean`                    | пользователь трогал поле                                   |
| `dirty`             | `boolean`                    | значение меняли через поле после создания или сброса       |
| `disabled`          | `boolean`                    | нода выключена: замечаний нет, в проверку не входит        |
| `pending`           | `boolean`                    | идёт асинхронная проверка                                  |

Выключенная нода и нода, у которой идёт асинхронная проверка, — ни `valid`, ни `invalid`: оба
сигнала `false`. Поэтому кнопка с `disabled={!form.valid.value}` недоступна и у формы, выключенной
на время отправки. На родителя выключенное поле не влияет: в его `valid` оно не входит.

## Методы

Общие для всех нод:

```typescript
form.firstName.getValue(); // значение без подписки
form.firstName.setValue('Анна'); // записать значение в модель
form.firstName.reset(); // значение — к точке отсчёта модели, замечания и касание сняты
form.firstName.reset('Анна'); // …или к переданному значению
form.firstName.markAsTouched(); // у группы — все её поля
form.firstName.markAsUntouched();
form.firstName.disable();
form.firstName.enable();
form.firstName.setIssues([{ code: 'taken' }]); // замечание извне, например от сервера
form.firstName.clearIssues();
```

### Поле — `FormControl`

У поля есть ещё состояние его компонента из узла схемы:

```typescript
form.email.component; // компонент из узла схемы
form.email.componentProps.value; // текущие пропсы компонента
form.email.updateComponentProps({ placeholder: 'name@example.com' }); // дописать пропсы
form.email.shouldShowError.value; // показывать ли состояние ошибки: invalid и поле трогали или меняли
form.email.shouldShowIssues.value; // показывать ли тексты замечаний, включая предупреждения
```

### Массив — `FormArray`

Каждая строка — `FormGroup` над элементом массива модели. Изменения уходят в массив модели, а ноды
строк при перестановке не пересоздаются.

```typescript
form.phones.length; // число строк
form.phones.at(0); // FormGroup первой строки
form.phones.map((row, index) => row.number); // обход строк
form.phones.keyAt(0); // ключ строки для React: не меняется при move и swap

form.phones.push(); // строка по шаблону arrayOf из модели
form.phones.push({ number: '' }); // …или со значением
form.phones.insert(0, { number: '' });
form.phones.removeAt(1);
form.phones.move(0, 2);
form.phones.swap(0, 1);
form.phones.clear();
```

Строки в React рисуют с ключом `keyAt(index)`, длину читают хуком
[`useArrayLength`](/docs/react/hooks). Подробнее — в [Массивах](/docs/patterns/arrays).

## Поле с именем члена ноды — `form.$`

Через точку доступны все поля, кроме тех, чьё имя совпадает с членом ноды: `value`, `issues`,
`reset`, `disabled` и т. п. Такое поле берут из `form.$`, где перечислены все поля группы.

```typescript
type Order = { status: string; value: number };

const { form } = createForm<Order>({ initial: { status: 'new', value: 0 } });

form.status.setValue('paid'); // обычное поле
form.value; // сигнал значения самой группы
form.$.value.setValue(100); // поле данных с именем value
```

## Как узнать вид ноды

Классы нод не экспортируются, поэтому `instanceof` не работает. Вид ноды проверяют функциями:

```typescript
import { isFormArray, isFormControl, isFormGroup, isFormNode } from '@reformer/core';

if (isFormControl(node)) node.updateComponentProps({ hint: 'Обязательно' });
if (isFormGroup(node)) node.markAsTouched();
if (isFormArray(node)) node.push();
isFormNode(value); // любая нода формы
```

## Подводные камни

- **Нода не проверяет правила.** Проверку запускает сборка формы: `bundle.validate()`,
  `bundle.submission.submit(handler)`, шаг потока. Замечания она сама раскладывает по нодам. См.
  [Обзор валидации](/docs/validation/overview).
- **У массива без узла в схеме ноды нет.** Если схема не описала массив ни узлом с `item`, ни
  привязкой компонента, `form.<массив>` в рантайме — `undefined`. Строки такого массива меняют на
  модели: `model.items.push()`.
- **Несколько полей сразу — через модель.** У ноды нет частичной записи; для неё есть
  `model.patch({ … })`.
- **`dirty` ноды и `model.isDirty()` — разное.** `dirty` ноды ставит запись через поле: ввод
  пользователя или `setValue`. Запись прямо в модель (`model.name = …`, `model.patch`) его не
  ставит. `model.isDirty()` сравнивает значения с точкой отсчёта, кто бы их ни записал.

## См. также

- [Модель данных](./model.mdx) — где хранятся значения.
- [Схема формы](./schemas/form-schema.md) — как поля модели становятся нодами.
- [React-хуки](/docs/react/hooks) — состояние нод в компонентах.
- [Массивы и динамические формы](/docs/patterns/arrays) — `FormArray` на практике.
