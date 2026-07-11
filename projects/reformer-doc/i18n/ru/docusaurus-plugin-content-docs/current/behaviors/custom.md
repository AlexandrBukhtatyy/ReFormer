---
sidebar_position: 6
---

# Продвинутые behaviors

Разница между примитивами и DSL, низкоуровневый авторинг (`effect`, `defer`, `onDispose`,
`getScope`) и операторы для динамических массивов (`apply`, `applyEach`, `exclusiveFlag`,
`aggregateInto`).

## Примитивы vs DSL

Оба слоя работают на одних и тех же сигналах модели, но управляют жизненным циклом по-разному.

|                | Примитивы (`@reformer/core`) | DSL (`@reformer/core/behaviors`)           |
| -------------- | ---------------------------- | ------------------------------------------ |
| Возвращают     | cleanup-функцию              | ничего (авто-регистрация отписки)          |
| Жизненный цикл | вызываешь cleanup сам        | владеет форма (`createForm({ behavior })`) |
| Где вызывать   | императивно (`useEffect`)    | внутри `defineFormBehavior`                |
| Аргументы      | сигналы `model.$.x`          | сигналы `model.$.x`                        |

Встроенные DSL-операторы — тонкие обёртки над примитивами слоя данных. Собственные операторы пишутся
так же и неотличимы от встроенных.

## Низкоуровневый авторинг

Внутри `defineFormBehavior` доступны примитивы построения собственных операторов из
`@reformer/core/behaviors`:

| Функция              | Назначение                                                                      |
| -------------------- | ------------------------------------------------------------------------------- |
| `effect(fn)`         | реактивный эффект с авто-dispose; `fn` может вернуть свой cleanup               |
| `defer(fn)`          | отложенная запись вне effect-контекста (микротаск) — защита от «Cycle detected» |
| `onDispose(cleanup)` | зарегистрировать произвольную отписку в активной схеме                          |
| `getScope<T>()`      | текущий scope `{ model, form }` (escape-hatch для кросс-операторов)             |

Собственный оператор строится из `effect` (реактивное чтение) и `defer` (cycle-safe запись) — ровно
так же, как встроенный `copyFrom`:

```typescript
import { defineFormBehavior, effect, defer } from '@reformer/core/behaviors';
import type { Signal } from '@reformer/core/behaviors';

// Свой оператор поверх effect + defer — неотличим от встроенного
function mirror<T>(source: Signal<T>, target: Signal<T>): void {
  effect(() => {
    const value = source.value; // подписка на источник
    defer(() => {
      target.value = value; // запись вне effect-контекста
    });
  });
}

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  mirror(model.$.a, model.$.b);
});
```

`onDispose` регистрирует произвольную отписку — например, внешний таймер или подписку, которую нужно
снять при уничтожении формы:

```typescript
import { defineFormBehavior, onDispose } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<MyForm>(({ model }) => {
  const id = setInterval(() => console.log(model.get()), 5000);
  onDispose(() => clearInterval(id)); // вызовется при teardown формы
});
```

## Операторы динамических массивов

Массивы объектов принадлежат модели: мутации — `model.<array>.push/insertAt/removeAt/...`, реактивная
длина в React — [`useArrayLength`](../react/hooks). Массивные операторы поведения работают поверх этих
сигналов и реагируют на добавление/удаление строк.

### applyEach

`applyEach(array, itemSchema)` применяет под-схему к **каждому** элементу массива, реагируя на
add/remove: новым строкам поведение применяется, удалённым — отписывается. Под-схема получает scope
строки — `model` (под-модель строки, `row.$.field`) и `form` (нода строки).

```typescript
import { defineFormBehavior, applyEach, compute } from '@reformer/core/behaviors';

type LineItem = { qty: number; price: number; lineTotal: number };
type Invoice = { items: LineItem[] };

const behavior = defineFormBehavior<Invoice>(({ model }) => {
  applyEach(
    model.$.items,
    defineFormBehavior<LineItem>(({ model: row }) => {
      compute(row.$.lineTotal, () => row.qty * row.price); // per-row value-операция
    })
  );
});
```

:::info Value-операции vs node-операции в строке
Value-операции (`compute` / `copyFrom` / `transformValue` на `row.$.*`) работают всегда.
Node-операции (`enableWhen` / `updateComponentProps` / `reset` через `form.*`) требуют, чтобы массив
был **материализован** в схеме формы (узел `{ array, item }`) — иначе доступ к `form.*` строки бросит
понятную ошибку.
:::

### apply

`apply(targets, subSchema)` применяет переиспользуемую под-схему к одному или нескольким
полям-группам:

```typescript
import { defineFormBehavior, apply, copyFrom } from '@reformer/core/behaviors';

type Address = { country: string; countryCode: string };
type ProfileForm = { registrationAddress: Address; residenceAddress: Address };

// Переиспользуемая под-схема для группы-адреса
const addressBehavior = defineFormBehavior<Address>(({ model: addr }) => {
  copyFrom(addr.$.country, addr.$.countryCode, {
    transform: (c) => (c ?? '').slice(0, 2).toUpperCase(),
  });
});

const behavior = defineFormBehavior<ProfileForm>(({ model }) => {
  apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior);
});
```

### exclusiveFlag

`exclusiveFlag(array, getFlag)` реализует взаимное исключение булева флага среди строк массива
(single-selection — «единственный primary»): когда флаг строки становится `true`, у остальных строк
он сбрасывается в `false`.

```typescript
import { defineFormBehavior, exclusiveFlag } from '@reformer/core/behaviors';

type ContactsForm = { contacts: { name: string; primary: boolean }[] };

const behavior = defineFormBehavior<ContactsForm>(({ model }) => {
  exclusiveFlag(model.$.contacts, (row) => row.$.primary);
});
```

### aggregateInto

`aggregateInto(array, derive)` делает агрегатную запись в строки: `derive(snapshot)` получает снимок
строк и возвращает список `{ index, patch }`, который применяется к строкам. Записи коалесцируются в
один отложенный проход на финальном состоянии; `derive` должна **сходиться** (на фикспоинте возвращать
те же значения).

```typescript
import { defineFormBehavior, aggregateInto } from '@reformer/core/behaviors';

type SplitForm = { rows: { percent: number }[] };

const behavior = defineFormBehavior<SplitForm>(({ model }) => {
  // последняя строка = 100 − Σ(остальные)
  aggregateInto(model.$.rows, (rows) => {
    const n = rows.length;
    if (n === 0) return [];
    const others = rows.slice(0, n - 1).reduce((sum, r) => sum + r.percent, 0);
    return [{ index: n - 1, patch: { percent: 100 - others } }];
  });
});
```

## Дальше

- [Реакции на изменения](./watch) — `onChange`, `watchField`.
- [Вычисляемые поля](./computed) — `compute` по массиву через `model.<array>.map`.
- [Массивы и динамические формы](../patterns/arrays) — рендер и мутации массивов.
