---
sidebar_position: 2
---

# Модель данных

**Модель** — источник истины для значений формы. Это сердце архитектуры M1: значения принадлежат
модели, а форма и её ноды лишь строятся поверх сигналов модели.

## createModel

`createModel<T>(initial)` создаёт реактивную модель из обычного объекта начальных значений.

```typescript
import { createModel } from '@reformer/core';

type ProfileForm = {
  firstName: string;
  lastName: string;
  age: number | null;
  address: { city: string; zip: string };
};

const model = createModel<ProfileForm>({
  firstName: '',
  lastName: '',
  age: null,
  address: { city: '', zip: '' },
});
```

:::tip Опциональные поля
Числа, которые пользователь может очистить, объявляйте как `number | null` (конвенция «поле
пустое»). Строки по умолчанию — пустая строка `''`.
:::

## Два способа доступа

У модели есть два «лица» — value-proxy и signal-proxy.

### value-proxy — `model.field`

Читается и пишется как обычный объект. Внутри реактивного контекста (`effect`, `computed`, behaviors)
чтение автоматически подписывается на сигнал.

```typescript
model.firstName; // читать
model.firstName = 'John'; // писать
model.address.city; // вложенное поле
model.address.city = 'NYC'; // вложенная запись
```

### signal-proxy — `model.$.field`

Escape-hatch к самому сигналу. Нужен там, где API ждёт сигнал: привязка поля в схеме
(`value: model.$.field`) и примитивы behaviors.

```typescript
model.$.firstName; // PathAwareSignal<string> — сам сигнал
model.$.firstName.value; // реактивное чтение/запись
model.$.firstName.peek(); // нереактивный снимок (без подписки)
model.$.address.city; // сигнал вложенного поля
```

:::info Когда что использовать

- **`model.$.field`** — в схеме (`value: model.$.field`) и в примитивах behaviors, принимающих сигналы.
- **`model.field`** — внутри `compute` / `onChange` / условий `when` (подписка автоматическая) и в обработчиках событий.
- **`model.get()`** — снимок всего объекта для отправки; читать **вне** реактивного контекста.
  :::

## API модели

| Метод                    | Назначение                                                          |
| ------------------------ | ------------------------------------------------------------------- |
| `model.get()`            | снимок всех значений `{ ... }` — например, для отправки             |
| `model.patch(partial)`   | частичное слияние: обновляет указанные поля, остальные не трогает   |
| `model.reset()`          | сброс к начальным значениям (или к захваченному `captureInitial`)   |
| `model.isDirty()`        | изменялись ли значения относительно начальных                       |
| `model.captureInitial()` | зафиксировать текущее состояние как новое «начальное» (для `reset`) |
| `model.signalAt(path)`   | получить сигнал по строковому пути (динамический доступ)            |

```typescript
model.patch({ firstName: 'Jane', age: 30 }); // только эти поля
model.get(); // { firstName: 'Jane', lastName: '', age: 30, address: {...} }
model.isDirty(); // true
model.reset(); // назад к начальным значениям
```

:::warning `model.set()` устарел
Используйте `model.patch(...)` для частичного обновления. `model.set()` — устаревший алиас `patch`
(частичное слияние, а не полная замена объекта).
:::

## Массивы модели

Массивы объектов принадлежат модели. Операции над ними выполняются на модели напрямую — форма
подхватывает изменения реактивно.

```typescript
type Order = { items: { title: string; qty: number }[] };
const model = createModel<Order>({ items: [] });

model.items.push({ title: 'Book', qty: 1 }); // добавить
model.items.insertAt(0, { title: 'Pen', qty: 5 });
model.items.removeAt(1); // удалить по индексу
model.items.move(0, 2); // переместить
model.items.swap(0, 1); // поменять местами
model.items.clear(); // очистить
model.items.at(0); // элемент по индексу
model.items.length; // реактивная длина
model.items.map((it) => it.qty); // обход как значений (реактивно)
```

Реактивную длину массива в React читайте через [`useArrayLength`](../react/hooks). Подробнее о
динамических списках — в рецепте [Массивы и динамические формы](../patterns/arrays).

## Дальше

- [Ноды и proxy](./nodes) — что форма строит поверх модели.
- [Схема формы](./schemas/overview) — как модель связывается с компонентами.
- [Чтение значений](../react/hooks) — хуки для React-компонентов.
