---
sidebar_position: 4
---

# Схема behavior

Behavior — это реактивная логика формы: вычисляемые поля, условная доступность, синхронизация и
реакции на изменения. В M1 behavior описывается декларативно через `defineFormBehavior` и
подключается при сборке формы — `createForm({ ..., behavior })`.

## Определение behavior

Функция-setup получает типобезопасную область `{ model, form, schema, flow }`: модель (значения и
ручки), форму (ноды), схему (узлы разметки по `selector`) и поток шагов. Операторы внутри неё
привязываются к ручкам модели (`model.$.<field>`), а форма сама владеет их жизненным циклом
(отписками):

```typescript
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { defineFormBehavior, compute, enableWhen } from '@reformer/core/behaviors';
import { InputNumber } from '@reformer/ui-kit';

type OrderForm = { price: number; quantity: number; total: number; discount: number };

const orderSchema = (model: FormModel<OrderForm>): FormSchemaNode => ({
  children: [
    { model: model.$.price, component: InputNumber },
    { model: model.$.quantity, component: InputNumber },
    { model: model.$.total, component: InputNumber, disabled: true },
    { model: model.$.discount, component: InputNumber },
  ],
});

const orderBehavior = defineFormBehavior<OrderForm>(({ model }) => {
  // Автовычисление total.
  compute(model.$.total, () => (model.price ?? 0) * (model.quantity ?? 0));

  // Скидка доступна только для крупных заказов.
  enableWhen(model.$.discount, () => model.total > 500);
});

const order = createForm<OrderForm>({
  initial: { price: 100, quantity: 1, total: 0, discount: 0 },
  schema: orderSchema,
  behavior: orderBehavior,
});
```

:::info Два способа писать behavior
**Декларативный DSL** из `@reformer/core/behaviors` (`defineFormBehavior` + операторы) сам
регистрирует отписки и передаётся в `createForm({ behavior })` — это рекомендуемый путь.
**Примитивы** из `@reformer/core/model` (`computeFrom`, `copyFrom`, `watchField`, …) принимают
сигналы, возвращают cleanup-функцию и вызываются императивно (например, в `useEffect`). Подробнее — в
[Обзоре behaviors](../../behaviors/overview).
:::

## Операторы

| Оператор           | Категория     | Назначение                                        |
| ------------------ | ------------- | ------------------------------------------------- |
| `compute`          | вычисляемые   | Значение из других полей (auto-tracking)          |
| `computeFrom`      | вычисляемые   | Значение из явного списка источников              |
| `transformValue`   | вычисляемые   | Идемпотентное преобразование значения при вводе   |
| `enableWhen`       | условные      | Включить/выключить поле по условию                |
| `disableWhen`      | условные      | Инверсия `enableWhen`                             |
| `resetWhen`        | условные      | Сбросить поле при выполнении условия              |
| `hideWhen`         | условные      | Скрыть узел схемы по условию (исполняет рендерер) |
| `copyFrom`         | синхронизация | Скопировать значение из другого поля/группы       |
| `syncFields`       | синхронизация | Двусторонняя синхронизация двух полей             |
| `onChange`         | реакции       | Side-эффект на изменение (async, `AbortSignal`)   |
| `revalidateWhen`   | реакции       | Перезапуск валидации при изменении зависимостей   |
| `onComponentEvent` | реакции       | Обработчик проп-события компонента узла схемы     |
| `apply`            | композиция    | Применить под-схему behavior к группе             |
| `applyEach`        | композиция    | Per-item behavior для строк массива               |

Полные примеры и опции каждого оператора — в разделе [Behaviors](../../behaviors/overview). Ниже —
краткий обзор ключевых.

## Вычисляемые поля

`compute` подписывается на сигналы, прочитанные внутри колбэка, и пишет результат в target. Цель не
входит в источники — цикла нет. Когда нужен явный список зависимостей — `computeFrom` (значения
источников приходят позиционно):

```typescript
import { defineFormBehavior, compute, computeFrom } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  // auto-tracking: читаем нужные поля прямо в колбэке
  compute(model.$.fullName, () => `${model.firstName} ${model.lastName}`.trim());

  // явные источники
  computeFrom(
    [model.$.price, model.$.quantity],
    model.$.total,
    (price, quantity) => price * quantity
  );
});
```

Вычисляемые поля ни `model.set`, ни `model.patch` не затирают — ими владеет `compute`.

:::warning Не читайте `model.get()` внутри `compute` / `when`
`model.get()` — нереактивный снимок: зависимость не отследится, пересчёта не будет. Читайте поля по
отдельности (`model.field` или `model.$.field.value`). `model.get()` — только вне реактивного
контекста (в `onChange`, обработчиках событий).
:::

## Условная доступность и видимость

`enableWhen` включает/выключает поле по условию, читаемому реактивно. Опция `resetOnDisable`
сбрасывает значение при выключении:

```typescript
import { defineFormBehavior, enableWhen } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  enableWhen(model.$.discount, () => model.userType === 'premium', { resetOnDisable: true });
});
```

Условный **показ** — оператор `hideWhen` над узлом схемы с `selector`: узел скрыт, пока условие
истинно. Правило исполняет рендерер (`@reformer/renderer-react`, `@reformer/renderer-json`); в
форме, нарисованной JSX-ом вручную, видимость — обычный условный рендер по значению модели.

```typescript
import { defineFormBehavior, hideWhen } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model, schema }) => {
  hideWhen(schema.node('mortgage'), () => model.loanType !== 'mortgage');
});
```

## Асинхронные реакции

Для загрузки зависимых опций, обновления `componentProps` и других side-эффектов — `onChange`.
Колбэк выполняется вне effect-контекста (можно писать сигналы/ноды), 2-м аргументом приходит
`{ signal }` (`AbortSignal`), который аннулируется при следующей смене значения:

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model, form }) => {
  onChange(
    model.$.country,
    async (country, { signal }) => {
      const cities = await loadCities(country, { signal });
      form.city.updateComponentProps({ options: cities });
    },
    { debounce: 300 }
  );
});
```

## Поток шагов

В пошаговой форме область поведения несёт поток сборки `flow` (без потока — `undefined`): поведение
может перевести форму на шаг, например вернуть на шаг с данными, которые стали неполными.

```typescript
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Credit>(({ model, flow }) => {
  // Тип кредита сменили на шаге подтверждения — вернуть на шаг с параметрами кредита.
  onChange(model.$.loanType, () => {
    if (flow?.current.value === 'confirm') flow.goTo('loan');
  });
});
```

## Переиспользуемые наборы behavior

Набор behavior для группы оформляется самостоятельной схемой `defineFormBehavior` над типом группы
и подключается оператором `apply` — к одной группе или к нескольким сразу. В области под-схемы
`model` — под-модель группы, `form` — нода группы:

```typescript
import { defineFormBehavior, apply, transformValue } from '@reformer/core/behaviors';

const addressBehavior = defineFormBehavior<Address>(({ model }) => {
  transformValue(model.$.zip, (value) => (value ?? '').trim());
});

const behavior = defineFormBehavior<Order>(({ model }) => {
  apply([model.$.billing, model.$.shipping], addressBehavior);
});
```

Операторы композиции `apply` (под-схема на группе) и `applyEach` (per-item behavior массива) — в
[Композиции](./composition).

## Behavior и валидация

| Аспект        | Валидация                  | Behavior                  |
| ------------- | -------------------------- | ------------------------- |
| **Цель**      | Проверка корректности      | Реакция на изменения      |
| **Результат** | Замечания (`issues` нод)   | Side-эффекты              |
| **Запуск**    | по требованию: submit, шаг | реактивно, живые подписки |
| **Владелец**  | Слой валидации             | Форма (`createForm`)      |

## Дальше

- [Обзор behaviors](../../behaviors/overview) — подробный гайд.
- [Вычисляемые поля](../../behaviors/computed) — `compute`, `computeFrom`, `transformValue`.
- [Условная логика](../../behaviors/conditional) — `enableWhen`, `resetWhen`.
- [Композиция](./composition) — переиспользование наборов behavior.
