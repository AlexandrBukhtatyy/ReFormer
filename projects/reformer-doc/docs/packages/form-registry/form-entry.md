---
title: 'Запись формы'
sidebar_label: 'Запись формы'
---

# Запись формы

`FormEntry` описывает форму целиком: из чего она состоит, откуда взять каждую часть, где её
показывать и кому. Запись регистрирует микрофронтенд-поставщик; приложение-хозяин знает о форме
только `id`.

## Когда это нужно

Каждый раз, когда форму показывают через реестр форм: `FormOutlet`, `FormSlot` и `FormRoute`
работают только с записями.

## Пример

```ts
import type { FormEntry } from '@reformer/form-registry';

export const checkoutEntry: FormEntry<CheckoutForm> = {
  id: 'checkout',
  version: '1.0.0',
  owner: 'mfe-orders',

  // Данные
  schema: { kind: 'http', url: '/forms/checkout.json' },
  compatibleSchema: '^1.0.0',
  initial: { kind: 'inline', value: { items: [], delivery: 'pickup' } },

  // Код
  registry: { kind: 'inline', value: checkoutRegistry },
  model: { kind: 'inline', value: createCheckoutModel },
  behavior: { kind: 'module', load: () => import('./checkout/behavior').then((m) => m.default) },
  validation: { kind: 'inline', value: { extras: checkoutCrossRules } },
  flow: {
    kind: 'inline',
    value: { steps: [{ id: 'cart' }, { id: 'delivery', rules: deliveryRules }, { id: 'confirm' }] },
  },

  // Где и кому
  placement: { slots: ['order.sidebar'], routes: ['/orders/:id/checkout'], priority: 10 },
  access: { permissions: ['orders.write'], flags: ['checkout-v2'] },
  meta: { name: 'Оформление заказа', tags: ['orders'] },
};
```

## Поля

| Поле               | Вид    | Зачем                                                                            |
| ------------------ | ------ | -------------------------------------------------------------------------------- |
| `id`               | строка | адрес формы: `<FormOutlet id="checkout" />`                                      |
| `version`          | строка | версия записи; разные версии одной формы живут в реестре рядом                   |
| `owner`            | строка | кто зарегистрировал; входит в ключ кэша и в сообщения о совпадении `id`          |
| `schema`           | данные | JSON-документ формата 2                                                          |
| `compatibleSchema` | строка | диапазон версий схемы, с которыми совместим этот код: `^1.0.0`, `1.x`, `>=1.2.0` |
| `initial`          | данные | начальные значения                                                               |
| `model`            | код    | фабрика модели — если начальные значения вычисляются                             |
| `registry`         | код    | реестр компонентов формы; накладывается поверх базового реестра хозяина          |
| `behavior`         | код    | поведение формы или фабрика поведения от настроек места                          |
| `validation`       | код    | правила формы: `rules` или `extras`, `strategy`                                  |
| `flow`             | код    | поток шагов: `{ steps: [{ id, rules }] }`, `id` равен `selector` узла шага       |
| `placement`        | —      | `slots`, `routes`, `priority` — где форму можно показать                         |
| `access`           | —      | `permissions`, `flags`, `canRender` — кому её показывать                         |
| `meta`             | —      | `name`, `description`, `tags` — для каталогов и поиска                           |

Что делать с этими полями на месте показа — на странице [Монтирование](./mounting.md).

## Откуда берутся части

Части формы делятся на данные и код. У данных три источника, у кода — два:

| Источник                                    | Данные | Код | Что происходит                                                      |
| ------------------------------------------- | ------ | --- | ------------------------------------------------------------------- |
| `{ kind: 'inline', value }`                 | да     | да  | часть уже в бандле                                                  |
| `{ kind: 'module', load: () => import(…) }` | да     | да  | часть — отдельный чанк; грузится при первом показе формы            |
| `{ kind: 'http', url, init? }`              | да     | нет | данные приходят с сервера; см. [Сеть и кэш](./network-and-cache.md) |

Варианта `http` у кода нет намеренно: поведение и правила, скачанные с сервера, означали бы
исполнение чужого кода. Схема ссылается на код по имени, а сам код приезжает с бандлом
микрофронтенда.

`kind: 'module'` — способ лениво загрузить тяжёлые части: реестр с редкими компонентами, поведение с
расчётами, большие правила. Пока части грузятся, место монтирования показывает `fallback`.

## Модель или начальные значения

Нужно хотя бы одно из двух — иначе загрузчик бросит ошибку ещё до сборки.

- `initial` — данные: объект начальных значений.
- `model` — код: фабрика `() => FormModel<T>`. Нужна, если начальное состояние вычисляется. Работу с
  моделью, которую хочется сделать «после сборки», переносите в фабрику: отдельного шага после сборки
  у записи нет.

Приоритет при показе: проп `model` места → `model` записи → проп `initial` места → `initial` записи.

Задавайте `initial`, даже если есть `model`: по нему проверка `unmaterialized-model-paths` находит
поля документа, которых нет в модели. Без `initial` она не запускается — см.
[Проверки](./checks.md).

## Поведение и настройки места

Обработчики вроде «показать результат» принадлежат хозяину: он решает, где и как показать итог.
Запись одна на все места показа, поэтому такие колбэки приходят пропом `behaviorOptions`, а
поведение записи — фабрика, которая получает их аргументом:

```ts
import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';
import type { FormBehaviorFactory } from '@reformer/form-registry';

export const checkoutBehavior: FormBehaviorFactory<CheckoutForm> = (options) =>
  defineFormBehavior<CheckoutForm>(({ schema }) => {
    onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: CheckoutForm) => {
      const result = await submitOrder(values);
      (options.onResult as ((r: unknown) => void) | undefined)?.(result);
    });
  });
```

```tsx
<FormOutlet id="checkout" behaviorOptions={{ onResult: showToast }} />
```

Фабрика вызывается один раз, при сборке формы. Без пропа она получает пустой объект. Готовое
поведение (не фабрика) настроек места не получает.

## Регистрация и совпадение `id`

```ts
const registry = getFormRegistry();

const unregister = registry.register(checkoutEntry); // по умолчанию — ошибка при совпадении id
registry.register(checkoutEntry, { onConflict: 'replace' }); // заменить запись
registry.register(checkoutEntry, { onConflict: 'keep' }); // оставить прежнюю
const unregisterAll = registry.registerAll([checkoutEntry, refundEntry]);
```

- По умолчанию совпадение `id` и версии — исключение с именами обоих владельцев. Молча перезаписать
  чужую форму хуже, чем упасть при старте.
- Повторная регистрация той же записи совпадением не считается — так переживаются StrictMode и
  горячая перезагрузка.
- `register` возвращает функцию снятия. Вызывайте её при размонтировании микрофронтенда. Снятие
  можно вызвать повторно; запись, которую успел заменить другой владелец, оно не удалит.
- Сообщения о совпадениях копятся в `registry.diagnostics`.

## Подводные камни

- **`нужны либо initial, либо model`** — у записи нет ни того, ни другого.
- **`onResult` не вызывается** — `behavior` записи — готовое поведение, а не фабрика.
- **Форма выгруженного микрофронтенда всё ещё видна** — не вызвана функция снятия.
- **Совпадение `id` между командами** — задайте разные `owner` и договоритесь о пространстве имён
  (`orders.checkout`).

## См. также

- [Монтирование](./mounting.md) — как и где запись превращается в форму.
- [Проверки](./checks.md) — что проверяется до сборки.
- [Формат документа](../renderer-json/document-format.md) — что лежит в `schema`.
- [@reformer/form-registry](../form-registry.md) — обзор пакета.
