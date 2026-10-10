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

Escape-hatch к самому сигналу — **ручка** поля. Нужна там, где API ждёт сигнал: привязка поля в
схеме (`model: model.$.field`), правила валидации (`validate(model.$.field, [...])`) и операторы
behaviors.

```typescript
model.$.firstName; // PathAwareSignal<string> — сам сигнал
model.$.firstName.value; // реактивное чтение/запись
model.$.firstName.peek(); // нереактивный снимок (без подписки)
model.$.address.city; // сигнал вложенного поля
```

:::info Когда что использовать

- **`model.$.field`** — в схеме (`model: model.$.field`), в схеме валидации и в операторах behaviors, принимающих сигналы.
- **`model.field`** — внутри `compute` / `onChange` / условий `when` (подписка автоматическая) и в обработчиках событий.
- **`model.get()`** — снимок всего объекта для отправки; читать **вне** реактивного контекста.
  :::

## API модели

| Метод                    | Назначение                                                          |
| ------------------------ | ------------------------------------------------------------------- |
| `model.get()`            | снимок всех значений `{ ... }` — например, для отправки             |
| `model.set(value)`       | полная установка: объект целиком, со всеми ключами `T`              |
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

### `set` против `patch`

Оба метода пишут значения в модель и не меняют точку отсчёта `reset`/`isDirty` (её фиксирует
`captureInitial`). Разница — в том, что они ожидают:

- **`model.set(value)`** — полная установка: объект целиком, со всеми ключами `T` (тип это
  проверяет). Если значение пришло без типа (с сервера) и ключей в нём не хватает, эти поля
  остаются прежними, а в dev выводится предупреждение со списком — неполный объект в `set` почти
  всегда ошибка вызывающего кода.
- **`model.patch(partial)`** — частичное обновление: записываются только переданные ключи,
  вложенные группы сливаются так же, массив заменяется целиком.

```typescript
model.set({ firstName: 'Jane', lastName: 'Doe', age: 30, address: { city: 'NYC', zip: '10001' } });
model.patch({ address: { city: 'Boston' } }); // zip остаётся прежним
```

Вычисляемые поля (цели `compute`) ни `set`, ни `patch` не затирают — ими владеет поведение.

## Группы модели

Вложенная объектная группа — это больше, чем value-proxy без `.$`: это полноценная под-модель
`FormModel<Sub>`, доступная как `model.<group>`. Она объединяет оба «лица» и несёт то же API, что и
корневая модель, — симметрично под-моделям элементов массива.

```typescript
model.address.city; // value-доступ (чтение/запись)
model.address.$.city; // сигнал вложенного поля
model.address.get(); // снимок под-объекта { city, zip }
model.address.patch({ city: 'NYC' }); // частичное слияние внутри группы
model.address.isDirty(); // менялась ли группа
model.address.reset(); // сброс группы к начальным
model.address.signalAt('city'); // сигнал по пути внутри группы
```

Сигнал вложенного поля один и тот же, с какой бы стороны к нему ни обращались:

```typescript
model.address.$.city === model.$.address.city; // true — тот же сигнал
```

## Массивы модели

Массивы объектов принадлежат модели. Операции над ними выполняются на модели напрямую — форма
подхватывает изменения реактивно. Шаблон новой строки объявляют прямо в начальных значениях
функцией `arrayOf(blank)` — тогда `push()` без аргумента добавит строку по шаблону.

```typescript
import { arrayOf, createModel } from '@reformer/core';

type Item = { title: string; qty: number };
type Order = { items: Item[] };

const blankItem = (): Item => ({ title: '', qty: 1 });
const model = createModel<Order>({ items: arrayOf(blankItem) });

model.items.push(); // новая строка по шаблону: { title: '', qty: 1 }
model.items.push({ title: 'Book', qty: 1 }); // добавить значение целиком
model.items.insertAt(0, { title: 'Pen', qty: 5 });
model.items.removeAt(1); // удалить по индексу
model.items.move(0, 2); // переместить
model.items.swap(0, 1); // поменять местами
model.items.clear(); // очистить
model.items.at(0); // элемент по индексу
model.items.length; // реактивная длина
model.items.map((it) => it.qty); // обход как значений (реактивно)
model.items.toArray(); // снимок элементов
```

Реактивную длину массива в React читайте через [`useArrayLength`](../react/hooks). Подробнее о
динамических списках — в рецепте [Массивы и динамические формы](../patterns/arrays).

## Дальше

- [Ноды формы](./nodes) — что форма строит поверх модели.
- [Схема формы](./schemas/overview) — как модель связывается с компонентами.
- [Чтение значений](../react/hooks) — хуки для React-компонентов.
