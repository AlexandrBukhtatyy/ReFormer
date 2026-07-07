---
sidebar_position: 1
---

# Behaviors — обзор

**Behaviors** — реактивная логика формы поверх сигналов модели: вычисляемые поля, условная
доступность полей, синхронизация значений и реакции на изменения. Это отдельный слой M1 — он
отвечает за **«как данные реагируют»**, тогда как валидаторы отвечают за **«правильны ли данные»**.

## Два способа писать behaviors

Под M1 behaviors работают на сигналах модели. Есть две поверхности API — декларативная и
императивная.

### 1. Декларативный DSL — `@reformer/core/behaviors`

Рекомендуемый путь. Операторы (`compute`, `enableWhen`, `onChange`, …) вызываются внутри
`defineFormBehavior(({ model, form }) => { … })` и **сами регистрируют свои отписки** — автор
схемы не видит ни массива cleanup'ов, ни ручного управления жизненным циклом. Готовый behavior
подключается к форме через `createForm({ model, schema, behavior })` — форма владеет его
жизненным циклом.

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, compute, enableWhen } from '@reformer/core/behaviors';

type OrderForm = {
  price: number;
  quantity: number;
  total: number;
  discount: number | null;
};

const model = createModel<OrderForm>({ price: 100, quantity: 1, total: 0, discount: null });

const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  // Вычисляемое поле — auto-tracking по прочитанным сигналам
  compute(model.$.total, () => model.price * model.quantity);

  // Условная доступность — условие читает model.* реактивно
  enableWhen(model.$.discount, () => model.total > 500, { resetOnDisable: true });
});

// schema привязывает поля к компонентам (см. «Быстрый старт»)
const form = createForm<OrderForm>({ model, schema, behavior });
```

### 2. Императивные примитивы — `@reformer/core`

Большинство операций доступны как отдельные функции-примитивы из `@reformer/core`. Они принимают
**сигналы** (`model.$.field`), **возвращают cleanup** и вызываются императивно — например, в
`useEffect`. Escape-hatch, когда не строишь целую схему поведения. Не у каждого DSL-оператора есть
одноимённый примитив: примитив для `compute` — это `computeFrom`, для `onChange` — `watchField`.

```typescript
import { useEffect } from 'react';
import { copyFrom, enableWhen } from '@reformer/core';

useEffect(() => {
  const cleanups = [
    copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true }),
    enableWhen(model.$.city, () => Boolean(model.country)),
  ];
  return () => cleanups.forEach((c) => c());
}, []);
```

:::info Что выбрать
DSL из `@reformer/core/behaviors` — по умолчанию: единый `behavior`, ambient auto-dispose,
подключение одним `createForm({ behavior })`. Примитивы из `@reformer/core` — когда нужна точечная
реакция без полной схемы (или вне React-дерева).
:::

## Операторы DSL

| Оператор                                   | Назначение                                            |
| ------------------------------------------ | ----------------------------------------------------- |
| [`compute`](./computed#compute)            | Производное значение с auto-tracking                  |
| [`computeFrom`](./computed#computefrom)    | Производное значение с явными зависимостями           |
| [`copyFrom`](./sync#copyfrom)              | Копирование значения (скаляр или группа) по условию   |
| [`syncFields`](./sync#syncfields)          | Двусторонняя синхронизация двух полей                 |
| [`transformValue`](./sync#transformvalue)  | Идемпотентная трансформация значения на месте         |
| [`enableWhen`](./conditional#enablewhen)   | Условное включение поля / полей / группы              |
| [`disableWhen`](./conditional#disablewhen) | Условное выключение (инверсия `enableWhen`)           |
| [`resetWhen`](./conditional#resetwhen)     | Сброс значения по условию                             |
| [`onChange`](./watch#onchange)             | Реакция на изменение (async, debounce, AbortSignal)   |
| [`revalidateWhen`](./watch#revalidatewhen) | Ревалидация схемы при изменении зависимостей          |
| [`apply`](./custom#apply)                  | Применить под-схему к полю-группе (переиспользование) |
| [`applyEach`](./custom#applyeach)          | Применить под-схему к каждому элементу массива        |
| [`exclusiveFlag`](./custom#exclusiveflag)  | Взаимное исключение булева флага среди строк массива  |
| [`aggregateInto`](./custom#aggregateinto)  | Агрегатная запись в строки массива                    |

:::tip Как читать поля в behaviors
Внутри `compute` / `onChange` / условий `when` читай поля как `model.field` — подписка на сигнал
происходит автоматически. **Не** читай `model.get()` в реактивном контексте: это нереактивный
снимок, зависимость не отследится. Примитивы (`computeFrom` / `copyFrom` / `enableWhen`) принимают
**сигналы** `model.$.field`, а не строковые пути.
:::

## Как это работает

1. Объяви операторы внутри `defineFormBehavior(({ model, form }) => { … })`.
2. Передай результат в `createForm({ model, schema, behavior })`.
3. Форма запускает поведение после построения нод: операторы подписываются на сигналы модели и
   срабатывают при изменениях, а их отписки собираются автоматически и вызываются при уничтожении
   формы.

```typescript
// Когда price или quantity меняется → total пересчитывается
compute(model.$.total, () => model.price * model.quantity);
```

## Behavior vs Валидация

| Аспект    | Валидация                          | Behavior                                |
| --------- | ---------------------------------- | --------------------------------------- |
| Задача    | Проверить корректность             | Реагировать на изменения                |
| Результат | Ошибки                             | Побочные эффекты / производные значения |
| Запуск    | `validateFormModel(model, schema)` | Реактивно, автоматически                |
| Владелец  | Слой валидации (`errors`)          | Форма (жизненный цикл behavior)         |

## Дальше

- [Вычисляемые поля](./computed) — `compute`, `computeFrom`.
- [Условная логика](./conditional) — `enableWhen`, `disableWhen`, `resetWhen`.
- [Синхронизация полей](./sync) — `copyFrom`, `syncFields`, `transformValue`.
- [Реакции на изменения](./watch) — `onChange`, `watchField`, `revalidateWhen`.
- [Продвинутые behaviors](./custom) — примитивы vs DSL, массивные операторы, низкоуровневый авторинг.
