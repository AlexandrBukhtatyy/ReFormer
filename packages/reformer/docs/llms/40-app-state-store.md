# Модель как стор приложения — createModel, createStore, useComputed

## Purpose

Модель (`createModel`) — дерево сигналов, которое читается и пишется как обычный объект. Она не
привязана к форме: в ней держат и состояние приложения — пользователя, корзину, настройки
интерфейса, вкладки. Форма потом собирается над частью этой модели (`createForm({ model: app.user })`),
и данные не копируются туда и обратно.

- **Модель** — значения и сигналы полей (`model.$.<поле>`). Тип — `Model<T>` (то же, что
  `FormModel<T>`).
- **Производные значения** — `computed` из `@reformer/core/signals`.
- **Реакции** — операторы модели (`watchField`, `computeFrom`, `copyFrom`, …) и `scope.effect`.
  Их снимает область: `createScope()` или `createStore(setup)`.
- **React** — `useComputed(селектор, deps?, isEqual?)` перерисовывает компонент только при смене
  результата; `useStore(фабрика)` держит стор компонента и снимает его при размонтировании.

Всё это — `@reformer/core/model`, `@reformer/core/signals` и `@reformer/core/react`. Отдельного
пакета нет.

## API

| Символ                                 | Вход                     | Назначение                                                        |
| -------------------------------------- | ------------------------ | ----------------------------------------------------------------- |
| `createModel(initial)`                 | `@reformer/core/model`   | модель: `model.x` — значение, `model.$.x` — сигнал                |
| `Model<T>`                             | `@reformer/core/model`   | тип модели; синоним `FormModel<T>`                                |
| `createStore(setup)`                   | `@reformer/core/model`   | стор: API из `setup` + `dispose()`, снимающий всё созданное в нём |
| `createScope()`                        | `@reformer/core/model`   | область жизни: `run(fn)`, `add(cleanup)`, `effect(fn)`, `dispose` |
| `onScopeDispose(cleanup)`              | `@reformer/core/model`   | очистка в текущей области (таймер, подписка на внешний источник)  |
| `getCurrentScope()`                    | `@reformer/core/model`   | текущая область или `undefined`                                   |
| `shallowEqual(a, b)`                   | `@reformer/core/model`   | равенство для селекторов, собирающих новый объект или массив      |
| `computed`, `signal`, `effect`         | `@reformer/core/signals` | рантайм сигналов — единственная копия на приложение               |
| `useComputed(fn, deps?, isEqual?)`     | `@reformer/core/react`   | селектор над моделями и сигналами для компонента                  |
| `useStore(factory)`                    | `@reformer/core/react`   | стор, которым владеет компонент; переживает StrictMode            |
| `useSignalSnapshot(signal)`            | `@reformer/core/react`   | значение одного сигнала или `computed`                            |

Что захватывает область: операторы модели и `scope.effect`, созданные синхронно внутри
`scope.run(...)` или `setup` у `createStore`. Не захватывает: созданное в колбэке эффекта, после
`await`, а также поведение формы, собранной внутри стора, — его снимает сама форма.

Map, Set, RegExp, типизированные массивы — листья модели: значение хранится целиком,
`isDirty`/`reset` сравнивают Map и Set по содержимому. Меняйте их заменой
(`model.tags = new Set([...model.tags, 'x'])`), а не правкой на месте — правка на месте не
уведомляет подписчиков.

## Examples

### Модель приложения и селектор в компоненте

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
  // Перерисовка — только когда меняется ЭТА строка, а не вся корзина.
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

### Стор с реакциями и снятием

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

### Стор компонента

```tsx
import { createModel, createStore } from '@reformer/core/model';
import { useComputed, useStore } from '@reformer/core/react';

const createFilters = () =>
  createStore(() => {
    const model = createModel({ query: '', onlyActive: false });
    return { model };
  });

function Filters() {
  const filters = useStore(createFilters); // один стор на компонент, снимается при размонтировании
  const query = useComputed(() => filters.model.$.query.value, [filters]);
  return <input value={query} onChange={(e) => (filters.model.query = e.target.value)} />;
}
```

### Стор на запрос при SSR

Стор уровня модуля на сервере общий для всех запросов. На сервере создавайте стор на запрос и
передавайте его обычным React-контекстом.

```tsx
import { createContext, useContext, useState, type ReactNode } from 'react';

const CartContext = createContext<ReturnType<typeof createCartStore> | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart] = useState(createCartStore); // один стор на дерево (= на запрос при SSR)
  return <CartContext.Provider value={cart}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error('useCart: нет CartProvider выше по дереву');
  return cart;
}
```

### Форма над частью модели приложения

```typescript
import { createForm } from '@reformer/core';

// Ввод в поля формы сразу виден всем, кто читает app.user.
const profile = createForm<App['user']>({ model: app.user });

await profile.submission.submit(async (values) => {
  await saveUser(values);
});
```

## Anti-patterns

### `useSignalSnapshot(model.$)` для части данных

```tsx
// ❌ Снимок всей модели пересобирается при любой правке — компонент перерисовывается на всё
const theme = useSignalSnapshot(app.$).ui.theme;

// ✅ Подписка только на нужное
const theme = useComputed(() => app.$.ui.theme.value);
```

### Селектор с новым объектом без `isEqual`

```tsx
// ❌ find/map/{...} каждый раз дают новую ссылку — перерисовка на любую правку корзины
const line = useComputed(() => app.$.cart.items.value.find((i) => i.id === id), [id]);

// ✅ Равный результат — прежняя ссылка
const line = useComputed(() => app.$.cart.items.value.find((i) => i.id === id), [id], shallowEqual);
```

### Модель как результат `setup`

```typescript
// ❌ TypeError: модель не принимает новых полей, `dispose` к ней не добавить
const store = createStore(() => createModel({ count: 0 }));

// ✅ setup возвращает API стора
const store = createStore(() => ({ model: createModel({ count: 0 }) }));
```

### Правка Map или Set на месте

```typescript
// ❌ Ссылка та же — подписчики не узнают об изменении
app.tree.expanded.add('node-1');

// ✅ Новая коллекция
app.tree.expanded = new Set([...app.tree.expanded, 'node-1']);
```

### Стор компонента через `useMemo` или `useState` + `useEffect`-очистку

```tsx
// ❌ useMemo может пересоздать стор; синхронный dispose в очистке убивает стор в StrictMode
const store = useMemo(createFilters, []);
useEffect(() => () => store.dispose(), [store]);

// ✅ useStore: один стор, снятие после настоящего размонтирования
const store = useStore(createFilters);
```

### Экземпляр класса в модели

Модель разбирает объект с прототипом класса в группу полей — методы теряются (в разработке
выводится предупреждение). Храните в модели данные (plain-объекты), а экземпляры — вне модели.

## Ограничения текущей версии

- Набор ключей группы задаёт начальное значение: присваивание полю, которого не было в `initial`,
  бросает ошибку. Словари с динамическими ключами (`Record<id, T>`) держите листом
  (`Map` или объект внутри `signal`).
- `model.list = [...]` пересоздаёт строки массива: сигналы строк новые.
- `deferredWritesSettled()` ждёт отложенных записей всех моделей приложения, а не одной: счётчик
  общий на рантайм.

## See also

- `19-reading-values.md` — чтение значений модели и сигналов.
- `20-compute-vs-watch.md` — `computeFrom`/`watchField` против DSL поведения формы.
- `28-submit-and-reset.md` — отправка и сброс формы над моделью.
- `39-overview.md` — карта входов пакета.
