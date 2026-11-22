---
sidebar_position: 4
title: Модель как стор приложения
description: Модель ReFormer без формы — состояние всего приложения. Стор с областью жизни реакций, селекторы для React, загрузка данных через resource и сигнал над внешним источником.
---

# Модель как стор приложения

[Модель](./model.mdx) — дерево сигналов, которое читается и пишется как обычный объект. Форма ей не
нужна. В модели держат и состояние приложения: пользователя, корзину, настройки, вкладки. Форму
потом собирают над частью этой модели, и данные не копируются туда и обратно.

Отдельного пакета для стора нет. Всё нужное лежит во входах `@reformer/core/model`,
`@reformer/core/signals`, `@reformer/core/resource` и `@reformer/core/react`.

## Когда нужно

- Состояние нужно нескольким экранам: пользователь, корзина, настройки интерфейса.
- Форма правит часть общего состояния, и шапка должна видеть ввод сразу.
- У экрана есть реакции — таймеры, подписки, эффекты, — и их нужно снять вместе с экраном.
- Данные грузятся по параметрам из модели, и ответы на устаревшие запросы нужно отбрасывать.

## Из чего состоит

| Что                                            | Вход                      | Зачем                                                               |
| ---------------------------------------------- | ------------------------- | ------------------------------------------------------------------- |
| `createModel(initial)`                         | `@reformer/core/model`    | значения и сигналы полей: `app.user.name`, `app.$.user.name`        |
| `computed`                                     | `@reformer/core/signals`  | производное значение                                                |
| `createStore(setup)`                           | `@reformer/core/model`    | стор: API из `setup` и `dispose()`, который снимает созданное в нём |
| `createScope()`, `onScopeDispose(cleanup)`     | `@reformer/core/model`    | область жизни реакций без стора, своя очистка в области             |
| `resource(options)`                            | `@reformer/core/resource` | загрузка по реактивному ключу с отменой устаревших запросов         |
| `signalFrom(read, subscribe)`                  | `@reformer/core/model`    | сигнал над событийным источником                                    |
| `useComputed`, `useSignalSnapshot`, `useStore` | `@reformer/core/react`    | чтение в компоненте и стор, которым владеет компонент               |

## Модель приложения

Модель приложения создают в модуле один раз. Производные значения — `computed`. Компонент читает
модель хуком [`useComputed`](../react/hooks.md#usecomputed) и перерисовывается, только когда
меняется результат селектора.

```tsx
import { arrayOf, createModel, shallowEqual } from '@reformer/core/model';
import { computed } from '@reformer/core/signals';
import { useComputed } from '@reformer/core/react';

interface CartItem {
  id: string;
  title: string;
  price: number;
  qty: number;
}
interface App {
  user: { name: string; email: string };
  cart: { items: CartItem[] };
  ui: { theme: 'light' | 'dark' };
}

export const app = createModel<App>({
  user: { name: '', email: '' },
  cart: { items: arrayOf((): CartItem => ({ id: '', title: '', price: 0, qty: 1 })) },
  ui: { theme: 'light' },
});

export const cartTotal = computed(() =>
  app.$.cart.items.value.reduce((sum, item) => sum + item.price * item.qty, 0)
);

app.ui.theme = 'dark';
app.cart.items.push({ id: 'p1', title: 'Книга', price: 500, qty: 1 });

function CartLine({ id }: { id: string }) {
  // Перерисовка — только когда меняется эта строка, а не вся корзина.
  const line = useComputed(
    () => app.$.cart.items.value.find((item) => item.id === id),
    [id],
    shallowEqual
  );
  return line ? (
    <div>
      {line.title} × {line.qty}
    </div>
  ) : null;
}

function CartTotal() {
  return <span>{useComputed(() => cartTotal.value)} ₽</span>;
}
```

## Стор: реакции и их снятие

Реакция — то, что работает само: оператор модели (`watchField`, `computeFrom`, `copyFrom`), эффект,
таймер, подписка. Её нужно снять, когда экран или виджет больше не нужен. Для этого реакции создают
внутри `createStore(setup)`: `setup` выполняется в новой **области**, и `store.dispose()` снимает
всё, что в ней создано.

```typescript
import { createModel, createStore, onScopeDispose, watchField } from '@reformer/core/model';
import { computed } from '@reformer/core/signals';

export function createCartStore() {
  return createStore((scope) => {
    const model = createModel({ items: [] as CartItem[], coupon: '', discount: 0 });
    const total = computed(() =>
      model.$.items.value.reduce((sum, item) => sum + item.price * item.qty, 0)
    );

    // Реакции принадлежат стору — их снимет cart.dispose().
    watchField(model.$.coupon, (code) => {
      model.discount = code === 'SALE' ? 10 : 0;
    });
    scope.effect(() => {
      document.title = `Корзина: ${model.$.items.value.length}`;
    });
    const timer = setInterval(() => void syncCart(model.get()), 30_000);
    onScopeDispose(() => clearInterval(timer));

    return {
      model,
      total,
      add: (item: CartItem) => model.items.push(item),
    };
  });
}

const cart = createCartStore();
cart.add({ id: 'p1', title: 'Книга', price: 500, qty: 1 });
cart.dispose(); // watchField, эффект и таймер сняты
```

`setup` возвращает API стора: модель, вычисляемые значения, команды. К нему добавляется
`dispose()`.

**Что снимает стор.** Операторы модели, `scope.effect`, `resource`, `signalFrom`, вложенные
области и очистки `onScopeDispose`, если они созданы синхронно внутри `setup`.

**Что не снимает.** Созданное в колбэке эффекта или после `await`: в этот момент области уже нет.
Форму, собранную внутри стора, снимает она сама — `bundle.dispose()`. Чтобы она ушла вместе со
стором, добавьте очистку: `onScopeDispose(() => profile.dispose())`.

Область без стора даёт `createScope()`:

```typescript
import { createScope, watchField } from '@reformer/core/model';

const scope = createScope();
scope.run(() => {
  watchField(app.$.user.email, (email) => trackEmail(email));
});
scope.effect(() => {
  document.title = app.user.name;
});

scope.dispose(); // watchField и эффект сняты
```

## Стор компонента

Стор одного экрана или виджета — фильтры списка, черновик, загрузку — держат хуком
[`useStore`](../react/hooks.md#usestore). Фабрика вызывается один раз, стор снимается после
размонтирования. Повторный монтаж в StrictMode и Fast Refresh стор не убивает.

```tsx
import { createModel, createStore } from '@reformer/core/model';
import { useComputed, useStore } from '@reformer/core/react';

const createFilters = () =>
  createStore(() => {
    const model = createModel({ query: '', onlyActive: false });
    return { model };
  });

function Filters() {
  const filters = useStore(createFilters); // один стор на компонент
  const query = useComputed(() => filters.model.$.query.value, [filters]);
  return <input value={query} onChange={(e) => (filters.model.query = e.target.value)} />;
}
```

## Загрузка данных — resource {#resource}

`resource()` из `@reformer/core/resource` грузит данные по реактивному ключу. Функция `key` читает
сигналы модели. Когда они меняются, ресурс запускает новую загрузку, а прежний запрос отменяет
через `AbortSignal`. Ответ устаревшего запроса не применяется, даже если `load` сигнал отмены не
слушает.

```typescript
import { createModel, createStore } from '@reformer/core/model';
import { resource } from '@reformer/core/resource';

export const page = createStore(() => {
  const model = createModel({ userId: 0 });
  const user = resource({
    key: () => (model.userId > 0 ? model.userId : null), // null — грузить нечего
    load: (id, { signal }) => fetch(`/api/users/${id}`, { signal }).then((r) => r.json()),
  });
  return { model, user };
});

page.model.userId = 7; // запрос /api/users/7
// …позже, пока ответ ещё не пришёл:
page.model.userId = 8; // запрос за 7 отменён, уходит /api/users/8
```

В компоненте состояние читают одним сигналом `state`:

```tsx
import { useSignalSnapshot } from '@reformer/core/react';

function UserCard() {
  const { status, data, refreshing } = useSignalSnapshot(page.user.state);
  if (status === 'loading') return <Spinner />;
  if (status === 'error') return <button onClick={() => page.user.reload()}>Повторить</button>;
  return <p aria-busy={refreshing}>{data?.name}</p>;
}
```

Что важно знать:

- **Состояние** — сигналы `status` (`idle`, `loading`, `ready`, `error`), `data`, `error`,
  `refreshing` и `isFetching`, а также `state` — всё сразу.
- **Несколько смен ключа в одном тике дают один запрос** — с последним ключом. Фильтр и сброс
  страницы не отправят два запроса.
- **Прежние данные остаются на экране**, пока грузятся данные нового ключа: статус `ready`,
  `refreshing` — `true`. Чтобы новый ключ сбрасывал данные и показывал `loading`, передайте
  `keepPrevious: false`.
- **Команды** — `reload()`, `abort()`, `mutate(next)` для оптимистичного обновления и
  `settled()`, чтобы дождаться всех запросов (в тестах).
- **Ресурс принадлежит текущей области** и снимается вместе со стором. Вне `createStore` его
  снимает `user.dispose()`.

Остальные опции — `enabled`, `initialData`, `equals`, `toError`, `onSuccess`, `onError` — в
[справочнике API](/docs/api/resource). На `resource` стоит серверный режим
[таблицы](./levels.mdx#ui-levels).

## Внешний источник — signalFrom {#signal-from}

Состояние, которое живёт вне модели и сообщает об изменениях событием, превращает в сигнал
`signalFrom(read, subscribe)`. `read` отдаёт текущее значение, `subscribe` подписывается на
изменения и возвращает отписку.

```typescript
import { createStore, signalFrom } from '@reformer/core/model';
import { computed } from '@reformer/core/signals';

export const network = createStore(() => {
  const online = signalFrom(
    () => navigator.onLine,
    (onChange) => {
      window.addEventListener('online', onChange);
      window.addEventListener('offline', onChange);
      return () => {
        window.removeEventListener('online', onChange);
        window.removeEventListener('offline', onChange);
      };
    }
  );
  const canSync = computed(() => online.value && app.cart.items.length > 0);
  return { online, canSync };
});
```

Сигнал только читается: запись `online.value` бросает ошибку. Подписка принадлежит области и
снимается вместе со стором. Так же в модель приходит состояние чужого стора с методами
`getState` и `subscribe`.

## Стор на запрос при SSR

Стор, созданный в модуле, на сервере общий для всех запросов. На сервере создавайте стор на запрос и
передавайте его обычным контекстом React:

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

const CartContext = createContext<ReturnType<typeof createCartStore> | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart] = useState(createCartStore); // один стор на дерево — на запрос при SSR
  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('useCart: нет CartProvider выше по дереву');
  return cart;
}
```

## Форма над частью модели

Форму собирают над частью модели приложения, и ввод в её поля сразу видят все, кто читает модель:

```typescript
import { createForm } from '@reformer/core';

const profile = createForm<App['user']>({ model: app.user, schema: userSchema });

await profile.submission.submit(async (values) => {
  await saveUser(values); // значения уже в модели приложения
});
```

Несколько форм над одной моделью, сброс и точка отсчёта — в разделе
[Модель приложения и формы](./levels.mdx#модель-приложения-и-формы). Готовые уровни над моделью —
тема, язык, таблица — и правила между ними — в разделе
[Уровни UI](./levels.mdx#ui-levels).

## Подводные камни

- **`setup` возвращает API стора, а не модель.** `createStore(() => createModel({ count: 0 }))`
  бросит `TypeError`: модель не принимает новых полей, и `dispose` к ней не добавить. Пишите
  `createStore(() => ({ model: createModel({ count: 0 }) }))`.
- **Селектор с новым объектом — только с `isEqual`.** `find`, `map` и `{ ... }` каждый раз дают новую
  ссылку, и без `shallowEqual` компонент перерисуется на любую правку.
- **`useSignalSnapshot(app.$)` для части данных не годится.** Снимок всей модели меняется при любой
  правке. Берите `useComputed(() => app.$.ui.theme.value)`.
- **Стор компонента — через `useStore`.** `useMemo` вправе пересоздать стор, а синхронный
  `dispose()` в очистке `useEffect` убивает его в StrictMode.
- **Map и Set меняют заменой.** `app.tags.add('x')` подписчиков не будит, потому что ссылка та же.
  Пишите `app.tags = new Set([...app.tags, 'x'])`.
- **Набор ключей группы задаёт начальное значение.** Присваивание полю, которого не было в
  `initial`, бросит ошибку. Словарь с динамическими ключами (`Record<id, T>`) держите листом:
  `Map` или объект внутри `signal`.
- **Экземпляр класса в модели теряет методы.** Модель разбирает его в группу полей, и в режиме
  разработки консоль об этом предупредит. Держите в модели данные, а экземпляры — вне её.
- **`model.list = [...]` пересоздаёт строки массива.** Сигналы строк будут новыми: подписки на
  старые строки перестанут получать изменения.

## См. также

- [Модель данных](./model.mdx) — прокси значений и сигналов, методы, сброс.
- [Сигналы, прокси и уровни](./levels.mdx) — уровни над моделью: форма, тема, язык, таблица.
- [React-хуки](../react/hooks.md) — `useComputed`, `useSignalSnapshot`, `useStore`.
- [Справочник API: model](/docs/api/model), [resource](/docs/api/resource).
