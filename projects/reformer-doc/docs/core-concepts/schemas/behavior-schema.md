---
sidebar_position: 4
---

# Схема behavior

Behavior — это реактивная логика формы: вычисляемые поля, условная доступность, синхронизация и
реакции на изменения. В M1 behavior описывается декларативно через `defineFormBehavior` и
подключается при сборке формы — `createForm({ model, schema, behavior })`.

## Определение behavior

Функция-setup получает типобезопасный scope `{ model, form }`. Операторы внутри неё привязываются к
сигналам модели (`model.$.<field>`), а форма сама владеет их жизненным циклом (отписками):

```typescript
import { createModel, createForm } from '@reformer/core';
import { defineFormBehavior, compute, enableWhen } from '@reformer/core/behaviors';
import { Input } from '@reformer/ui-kit';

type OrderForm = { price: number; quantity: number; total: number; discount: number };

const model = createModel<OrderForm>({ price: 100, quantity: 1, total: 0, discount: 0 });

const schema = {
  price: { value: model.$.price, component: Input, componentProps: { type: 'number' } },
  quantity: { value: model.$.quantity, component: Input, componentProps: { type: 'number' } },
  total: {
    value: model.$.total,
    component: Input,
    componentProps: { type: 'number' },
    disabled: true,
  },
  discount: { value: model.$.discount, component: Input, componentProps: { type: 'number' } },
};

const behavior = defineFormBehavior<OrderForm>(({ model }) => {
  // Автовычисление total.
  compute(model.$.total, () => (model.price ?? 0) * (model.quantity ?? 0));

  // Скидка доступна только для крупных заказов.
  enableWhen(model.$.discount, () => model.total > 500);
});

const form = createForm<OrderForm>({ model, schema, behavior });
```

:::info Два способа писать behavior
**Декларативный DSL** из `@reformer/core/behaviors` (`defineFormBehavior` + операторы) сам
регистрирует отписки и передаётся в `createForm({ behavior })` — это рекомендуемый путь.
**Примитивы** из `@reformer/core` (`computeFrom`, `copyFrom`, `watchField`, …) принимают сигналы,
возвращают cleanup-функцию и вызываются императивно (например, в `useEffect`). Подробнее — в
[Обзоре behaviors](../../behaviors/overview).
:::

## Операторы

| Оператор         | Категория     | Назначение                                      |
| ---------------- | ------------- | ----------------------------------------------- |
| `compute`        | вычисляемые   | Значение из других полей (auto-tracking)        |
| `computeFrom`    | вычисляемые   | Значение из явного списка источников            |
| `transformValue` | вычисляемые   | Идемпотентное преобразование значения при вводе |
| `enableWhen`     | условные      | Включить/выключить поле по условию              |
| `disableWhen`    | условные      | Инверсия `enableWhen`                           |
| `resetWhen`      | условные      | Сбросить поле при выполнении условия            |
| `copyFrom`       | синхронизация | Скопировать значение из другого поля/группы     |
| `syncFields`     | синхронизация | Двусторонняя синхронизация двух полей           |
| `onChange`       | реакции       | Side-эффект на изменение (async, `AbortSignal`) |
| `revalidateWhen` | реакции       | Перезапуск валидации при изменении зависимостей |
| `apply`          | композиция    | Применить под-схему behavior к группе           |
| `applyEach`      | композиция    | Per-item behavior для элементов массива         |

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

:::warning Не читайте `model.get()` внутри `compute` / `when`
`model.get()` — нереактивный снимок: зависимость не отследится, пересчёта не будет. Читайте поля по
отдельности (`model.field` или `model.$.field.value`). `model.get()` — только вне реактивного
контекста (в `onChange`, обработчиках событий).
:::

## Условная доступность

`enableWhen` включает/выключает поле по условию, читаемому реактивно. Опция `resetOnDisable`
сбрасывает значение при выключении:

```typescript
import { defineFormBehavior, enableWhen } from '@reformer/core/behaviors';

const behavior = defineFormBehavior<Form>(({ model }) => {
  enableWhen(model.$.discount, () => model.userType === 'premium', { resetOnDisable: true });
});
```

:::info Видимость полей
Методов `.show()` / `.hide()` / `.visible` в API нет. Для условной **доступности** используйте
`enableWhen`, для условного **показа** — обычный условный рендер в JSX по значению модели.
:::

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

## Переиспользуемые наборы behavior

Набор behavior выносится в функцию, принимающую под-модель группы (`FormModel<Sub>` — с `.$` и
API), и вызывается по разу на под-модель внутри `defineFormBehavior`:

```typescript
import type { FormModel } from '@reformer/core';
import { defineFormBehavior, transformValue } from '@reformer/core/behaviors';

function addressBehaviors(m: FormModel<Address>) {
  transformValue(m.$.zip, (value) => (value ?? '').trim());
}

const behavior = defineFormBehavior<Order>(({ model }) => {
  addressBehaviors(model.billing);
  addressBehaviors(model.shipping);
});
```

Операторы композиции `apply` (переиспользовать под-схему на группе) и `applyEach` (per-item behavior
массива) — в [Композиции](./composition).

## Behavior и валидация

| Аспект        | Валидация                 | Behavior             |
| ------------- | ------------------------- | -------------------- |
| **Цель**      | Проверка корректности     | Реакция на изменения |
| **Результат** | Ошибки                    | Side-эффекты         |
| **Владелец**  | Слой валидации (`errors`) | Форма (`createForm`) |

## Дальше

- [Обзор behaviors](../../behaviors/overview) — подробный гайд.
- [Вычисляемые поля](../../behaviors/computed) — `compute`, `computeFrom`, `transformValue`.
- [Условная логика](../../behaviors/conditional) — `enableWhen`, `resetWhen`.
- [Композиция](./composition) — переиспользование наборов behavior.
