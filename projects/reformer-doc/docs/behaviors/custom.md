---
sidebar_position: 6
---

# Группы, массивы и свои операторы

Как подключить [поведение](../reference/glossary.md) к вложенной группе и к каждой строке массива,
как связать строки между собой и как написать свой оператор.

## Когда нужно

- Одно поведение адреса нужно для адреса регистрации и адреса проживания.
- В каждой строке заказа сумма считается из цены и количества.
- Среди контактов только один может быть основным.
- Готовых операторов не хватает — нужен свой.

## Пример

```typescript
import { applyEach, compute, defineFormBehavior } from '@reformer/core/behaviors';

type Line = { qty: number; price: number; lineTotal: number };
type Invoice = { lines: Line[] };

// Поведение одной строки: model здесь — под-модель строки.
const lineBehavior = defineFormBehavior<Line>(({ model: line }) => {
  compute(line.$.lineTotal, () => line.qty * line.price);
});

const invoiceBehavior = defineFormBehavior<Invoice>(({ model }) => {
  applyEach(model.$.lines, lineBehavior); // и к строкам, добавленным позже
});
```

## Группы и массивы

### applyEach

`applyEach(массив, поведениеСтроки)` подключает поведение к каждой строке массива. Новые строки
получают его при добавлении, у удалённых оно снимается. Поведение строки получает область строки:
`model` — под-модель строки, `form` — форма строки, `schema` — узлы разметки строки.

- Операторы над значениями (`compute`, `copyFrom`, `transformValue` на `line.$.*`) работают всегда.
- Операторам над нодами (`enableWhen`, `form.*.updateComponentProps`) нужна форма строки: у массива
  должен быть узел `{ model: model.$.lines, item }` в схеме. Без него обращение к `form` строки
  бросит ошибку с подсказкой.
- Массив внутри строки подключают тем же `applyEach` в поведении строки.

### apply

`apply(группа, поведение)` подключает поведение к вложенной группе — или к нескольким группам
одной формы:

```typescript
import { apply, copyFrom, defineFormBehavior } from '@reformer/core/behaviors';

type Address = { country: string; countryCode: string };
type Profile = { registrationAddress: Address; residenceAddress: Address };

const addressBehavior = defineFormBehavior<Address>(({ model: address }) => {
  copyFrom(address.$.country, address.$.countryCode, {
    transform: (country) => country.slice(0, 2).toUpperCase(),
  });
});

const profileBehavior = defineFormBehavior<Profile>(({ model }) => {
  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
});
```

Цель `apply` — группа, `applyEach` — массив. Не тот вид цели в режиме разработки даёт ошибку с
путём поля.

### exclusiveFlag

`exclusiveFlag(массив, (строка) => флаг)` оставляет флаг `true` только у одной строки: когда
пользователь отмечает строку, у остальных флаг снимается.

```typescript
import { defineFormBehavior, exclusiveFlag } from '@reformer/core/behaviors';

type Contacts = { contacts: { name: string; primary: boolean }[] };

const contactsBehavior = defineFormBehavior<Contacts>(({ model }) => {
  exclusiveFlag(model.$.contacts, (row) => row.$.primary);
});
```

Строка, которая пришла сразу с `true` — из начальных данных или добавленная, — прежний выбор не
снимает: флаг сбрасывается у неё самой. Из нескольких таких строк в начальных данных остаётся первая.

### aggregateInto

`aggregateInto(массив, derive)` пишет в строки по итогу всех строк. `derive` получает снимок строк и
возвращает список `{ index, patch }`. Записи собираются в один проход по итоговому состоянию,
поэтому добавление строк в цикле не вызывает каскад пересчётов.

```typescript
import { aggregateInto, defineFormBehavior } from '@reformer/core/behaviors';

type Split = { rows: { percent: number }[] };

const splitBehavior = defineFormBehavior<Split>(({ model }) => {
  // последняя строка — остаток до 100 %
  aggregateInto(model.$.rows, (rows) => {
    if (rows.length === 0) return [];
    const others = rows.slice(0, -1).reduce((sum, row) => sum + row.percent, 0);
    return [{ index: rows.length - 1, patch: { percent: 100 - others } }];
  });
});
```

`derive` должна сходиться: на итоговом состоянии возвращать те же значения. Если записи не
сходятся больше 50 проходов, оператор останавливается с ошибкой.

## Свой оператор

Внутри `defineFormBehavior` доступны функции, из которых построены встроенные операторы:

| Функция              | Что делает                                                                 |
| -------------------- | -------------------------------------------------------------------------- |
| `effect(fn)`         | реактивный эффект; снимается вместе с формой; `fn` может вернуть отписку   |
| `defer(fn)`          | выполнить запись на микрозадаче, вне эффекта — так запись не зацикливается |
| `onDispose(cleanup)` | выполнить `cleanup`, когда форму снимают                                   |
| `getScope<T>()`      | текущая область `{ model, form, schema, flow }`                            |

Свой оператор читает в `effect` и пишет в `defer`:

```typescript
import { defer, defineFormBehavior, effect, type Signal } from '@reformer/core/behaviors';

// Копирует источник в цель — как упрощённый copyFrom.
function mirror<T>(source: Signal<T>, target: Signal<T>): void {
  effect(() => {
    const value = source.value; // чтение подписывает эффект на источник
    defer(() => {
      target.value = value; // запись вне эффекта
    });
  });
}

const formBehavior = defineFormBehavior<MyForm>(({ model }) => {
  mirror(model.$.a, model.$.b);
});
```

Внешний ресурс — таймер, подписку — снимайте через `onDispose`:

```typescript
import { defineFormBehavior, onDispose } from '@reformer/core/behaviors';

const autosaveBehavior = defineFormBehavior<MyForm>(({ model }) => {
  const timer = setInterval(() => saveDraft(model.get()), 5000);
  onDispose(() => clearInterval(timer));
});
```

Отписки поведения срабатывают, когда форму снимают: сборку — `bundle.dispose()` (в React это
делает `useFormBundle` при размонтировании), форму из `createFormFromModel` — `disposeForm(form)`.

### Дождаться записей поведения

Операторы пишут на микрозадаче, поэтому сразу после правки модели их записи ещё не дошли.
`deferredWritesSettled()` из `@reformer/core/model` возвращает промис, который выполнится, когда
отработают отложенные записи текущего такта, или `undefined`, если ждать нечего. Записи после паузы
`debounce` и после `await` в колбэке сюда не входят. Проверка и отправка формы ждут их сами.

`deepEqual(a, b)` оттуда же сравнивает значения модели так же, как `isDirty()`: объекты и массивы —
по содержимому, даты — по времени, `NaN` равен себе, остальное — по ссылке.

```typescript
import { deepEqual, deferredWritesSettled } from '@reformer/core/model';

model.loanType = 'mortgage'; // поведение допишет зависимые поля на микрозадаче
await deferredWritesSettled();
const changedSinceSave = !deepEqual(model.get(), savedValues);
```

## Подводные камни

- **Запись прямо в `effect` зацикливается.** Эффект, который читает и пишет один сигнал, вызывает
  сам себя. Пишите через `defer`.
- **`applyEach` без узла массива в схеме** — только для операторов над значениями.
- **`aggregateInto` с несходящимся `derive`** останавливается ошибкой после 50 проходов.

## См. также

- [Массивы и динамические формы](../patterns/arrays.mdx) — узел массива, отрисовка, правила строк.
- [Вычисляемые поля](./computed.mdx) — сумма по строкам через `model.<массив>.map`.
- [Реакции на изменения](./watch.md) — `onChange`, `watchField`.
