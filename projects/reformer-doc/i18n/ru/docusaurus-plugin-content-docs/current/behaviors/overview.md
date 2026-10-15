---
sidebar_position: 1
---

# Behaviors — обзор

**Behaviors** — реактивная логика формы поверх сигналов модели: вычисляемые поля, условная
доступность полей, синхронизация значений, реакции на изменения и правила узлов схемы. Это
отдельный слой — он отвечает за **«как данные реагируют»**, тогда как валидация отвечает за
**«правильны ли данные»**.

## Два способа писать behaviors

Behaviors работают на сигналах модели. Есть две поверхности API — декларативная и императивная.

### 1. Декларативный DSL — `@reformer/core/behaviors`

Рекомендуемый путь. Операторы (`compute`, `enableWhen`, `onChange`, …) вызываются внутри
`defineFormBehavior(({ model, form, schema, flow }) => { … })` и **сами регистрируют свои
отписки** — автор не видит ни массива cleanup'ов, ни ручного управления жизненным циклом. Готовое
поведение подключается к сборке полем `behavior` — форма владеет его жизненным циклом.

```typescript
import { createForm } from '@reformer/core';
import { defineFormBehavior, compute, enableWhen } from '@reformer/core/behaviors';

type OrderForm = {
  price: number;
  quantity: number;
  total: number;
  discount: number | null;
};

const orderBehavior = defineFormBehavior<OrderForm>(({ model }) => {
  // Вычисляемое поле — зависимости отслеживаются по прочитанным сигналам
  compute(model.$.total, () => model.price * model.quantity);

  // Условная доступность — условие читает model.* реактивно
  enableWhen(model.$.discount, () => model.total > 500, { resetOnDisable: true });
});

// schema — дерево разметки (см. «Быстрый старт»)
const order = createForm<OrderForm>({
  initial: { price: 100, quantity: 1, total: 0, discount: null },
  schema: orderSchema,
  behavior: orderBehavior,
});
```

Область поведения: `model` — модель, `form` — ноды формы, `schema` — узлы схемы своей области
(`schema.node(selector)`), `flow` — поток шагов сборки (без `flow` в конфиге — `undefined`).

### 2. Императивные примитивы — `@reformer/core/model`

Операции над значениями доступны отдельными функциями из `@reformer/core/model`: `computeFrom`,
`copyFrom`, `watchField`, `transformValue`, `resetWhen`, `syncFields`, `revalidateWhen`. Они
принимают **сигналы** (`model.$.field`), **возвращают cleanup** и вызываются императивно —
например, в `useEffect`. Это escape-hatch, когда не нужно целое поведение. Примитива для `compute`
нет — его роль играет `computeFrom`; для `onChange` — `watchField`. Операции над нодами
(`enableWhen`, `disableWhen`) есть только в DSL.

```typescript
import { useEffect } from 'react';
import { copyFrom, watchField } from '@reformer/core/model';

useEffect(() => {
  const cleanups = [
    copyFrom(model.$.email, model.$.emailAdditional, { when: () => model.sameEmail === true }),
    watchField(model.$.country, () => {
      model.city = '';
    }),
  ];
  return () => cleanups.forEach((cleanup) => cleanup());
}, []);
```

:::info Что выбрать
DSL из `@reformer/core/behaviors` — по умолчанию: одно поведение, автоматические отписки,
подключение одним `createForm({ behavior })`. Примитивы из `@reformer/core/model` — когда нужна
точечная реакция без полного поведения (или вне React-дерева).
:::

## Операторы DSL

| Оператор                                   | Назначение                                            |
| ------------------------------------------ | ----------------------------------------------------- |
| [`compute`](./computed#compute)            | Производное значение, зависимости — по чтению         |
| [`computeFrom`](./computed#computefrom)    | Производное значение с явными зависимостями           |
| [`copyFrom`](./sync#copyfrom)              | Копирование значения (скаляр или группа) по условию   |
| [`syncFields`](./sync#syncfields)          | Двусторонняя синхронизация двух полей                 |
| [`transformValue`](./sync#transformvalue)  | Идемпотентная трансформация значения на месте         |
| [`enableWhen`](./conditional#enablewhen)   | Условное включение поля / полей / группы              |
| [`disableWhen`](./conditional#disablewhen) | Условное выключение (инверсия `enableWhen`)           |
| [`resetWhen`](./conditional#resetwhen)     | Сброс значения по условию                             |
| [`onChange`](./watch#onchange)             | Реакция на изменение (async, debounce, AbortSignal)   |
| [`revalidateWhen`](./watch#revalidatewhen) | Перепроверка правил при изменении зависимостей        |
| [`apply`](./custom#apply)                  | Применить поведение к полю-группе (переиспользование) |
| [`applyEach`](./custom#applyeach)          | Применить поведение к каждой строке массива           |
| [`exclusiveFlag`](./custom#exclusiveflag)  | Взаимное исключение булева флага среди строк массива  |
| [`aggregateInto`](./custom#aggregateinto)  | Агрегатная запись в строки массива                    |

Операторы над **узлами схемы** записывают правило, а исполняет его рендерер (`FormRenderer`):

| Оператор                                        | Назначение                                         |
| ----------------------------------------------- | -------------------------------------------------- |
| [`hideWhen`](./conditional#скрытие-узлов-схемы) | Скрывать узел, пока условие истинно                |
| `onComponentEvent(node, event, handler)`        | Обработчик события компонента узла (`onSubmit`, …) |
| `renderEffect(schema, fn)`                      | Реактивный эффект, живущий, пока форма отрисована  |
| `onInit` / `onMount` / `onUnmount`              | Жизненный цикл узла                                |

Узел берётся из схемы своей области: `schema.node('mortgage')` — по `selector` узла. Там, где форму
рисуют руками (JSX без рендерера), правила узлов не действуют — видимость и обработчики остаются в
разметке.

:::tip Как читать поля в behaviors
Внутри `compute` / условий `when` / `enableWhen` читай поля как `model.field` — подписка на сигнал
происходит автоматически. **Не** читай `model.get()` в реактивном контексте: это нереактивный
снимок, зависимость не отследится. Цели и источники операторов — **сигналы** `model.$.field`, а не
строковые пути.
:::

## Как это работает

1. Объяви операторы внутри `defineFormBehavior(({ model, form, schema, flow }) => { … })`.
2. Передай результат в сборку: `createForm({ model, schema, behavior })`.
3. Сборка запускает поведение после построения нод: операторы подписываются на сигналы модели и
   срабатывают при изменениях, а их отписки собираются автоматически и вызываются при уничтожении
   формы.

```typescript
// Когда price или quantity меняется → total пересчитывается
compute(model.$.total, () => model.price * model.quantity);
```

## Behavior vs Валидация

| Аспект    | Валидация                                                             | Behavior                                 |
| --------- | --------------------------------------------------------------------- | ---------------------------------------- |
| Задача    | Проверить корректность                                                | Реагировать на изменения                 |
| Результат | Замечания (`issues` нод)                                              | Побочные эффекты / производные значения  |
| Запуск    | `bundle.validate()`, `bundle.submission.submit()`, «Далее», стратегия | Реактивно, автоматически                 |
| Где живёт | `validation` и шаги `flow` сборки (`defineValidation`)                | `behavior` сборки (`defineFormBehavior`) |

## Дальше

- [Вычисляемые поля](./computed) — `compute`, `computeFrom`.
- [Условная логика](./conditional) — `enableWhen`, `disableWhen`, `resetWhen`, `hideWhen`.
- [Синхронизация полей](./sync) — `copyFrom`, `syncFields`, `transformValue`.
- [Реакции на изменения](./watch) — `onChange`, `watchField`, `revalidateWhen`.
- [Продвинутые behaviors](./custom) — примитивы vs DSL, операторы массивов, низкоуровневый авторинг.
