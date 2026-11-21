---
sidebar_position: 1
---

# React-хуки

Хуки связывают форму с компонентами React. Они живут в отдельном входе пакета
**`@reformer/core/react`**: корень `@reformer/core` от React не зависит. Хук подписывается только на
нужные [сигналы](../reference/glossary.md) и перерисовывает компонент, когда меняются они.

## Когда нужно

- Собрать форму в компоненте — `useFormBundle`.
- Нарисовать своё поле или показать часть формы по значению другого поля — `useFormControl`,
  `useFormControlValue`.
- Нарисовать строки массива — `useArrayLength`.
- Свои кнопки и индикатор шагов — `useFormFlow`.
- Показать значение модели приложения или свой `computed` — `useSignalSnapshot`, `useComputed`.
- Держать стор экрана или виджета, который живёт, пока смонтирован компонент, — `useStore`.

С `FormField` из `@reformer/ui-kit` хуки чтения обычно не нужны: он подписывается сам.

| Хук                            | Возвращает                             | Когда брать                                             |
| ------------------------------ | -------------------------------------- | ------------------------------------------------------- |
| `useFormBundle(factory)`       | сборку `createForm`, одну на компонент | собрать форму в компоненте                              |
| `useFormControl(control)`      | состояние поля или массива — объект    | нужны значение, замечания, касание, доступность         |
| `useFormControlValue(control)` | только значение — `T`                  | условный рендер, вычисления в разметке                  |
| `useArrayLength(array)`        | число строк                            | перерисовать список при добавлении и удалении строк     |
| `useFormFlow(flow)`            | снимок потока шагов                    | свои кнопки, индикатор и заголовок шагов                |
| `useIssueMessage(messages?)`   | функцию «замечание → текст»            | текст замечания в своём компоненте                      |
| `useFormValidation(options)`   | `{ submit, validate, isValidating }`   | стратегия валидации для формы без сборки                |
| `useFormBundleContext()`       | сборку из контекста или `null`         | компонент внутри `FormRenderer` или `FormBundleContext` |
| `useSignalSnapshot(signal)`    | значение одного сигнала                | сигнал модели, `computed`, `bundle.validating`          |
| `useComputed(fn, deps?, eq?)`  | результат селектора                    | часть модели приложения: строка корзины, сумма          |
| `useStore(factory)`            | стор, один на компонент                | состояние экрана: фильтры, черновик, загрузка данных    |

## Пример

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle, useFormControlValue } from '@reformer/core/react';
import { FormField } from '@reformer/ui-kit';

function CheckoutForm() {
  // Сборка создаётся один раз и снимается при размонтировании.
  const checkout = useFormBundle(() =>
    createForm<Checkout>({ initial: checkoutInitial, schema: checkoutSchema })
  );
  const { form } = checkout;
  // Перерисовка — только когда меняется флаг доставки.
  const needsDelivery = useFormControlValue(form.needsDelivery);

  return (
    <form>
      <FormField control={form.needsDelivery} />
      {needsDelivery && <FormField control={form.address} />}
    </form>
  );
}
```

Ноды полей берут из формы по имени: `form.email`, `form.address.city`, `form.items`. Поле, имя
которого совпадает с членом ноды (`value`, `issues`, `reset`), доступно через `form.$`: `form.$.value`.

## useFormBundle

`useFormBundle(() => createForm(...))` вызывает фабрику ровно один раз — при первом рендере — и
держит сборку между рендерами. Ещё он:

- включает живую проверку, если у сборки задана [стратегия](../validation/validation-strategies.md);
  на сервере (SSR) эффекты не выполняются, и проверка там не включается;
- при размонтировании снимает сборку — `bundle.dispose()`: поведение, подписки нод, живую проверку.
  Значения модели остаются.

Поэтому фабрика должна собирать **новую** форму. Сборку, которая живёт дольше компонента, создавайте
вне его и снимайте сами.

`useMemo` вместо `useFormBundle` не годится: React вправе сбросить его кэш, и форма соберётся заново
без введённых значений.

:::note StrictMode в разработке
StrictMode вызывает фабрику дважды. Второй экземпляр React отбрасывает, но его поведение успевает
запуститься. Запросы данных поэтому запускайте из поведения формы или из эффекта компонента, а не
из фабрики.
:::

## useFormControl

Состояние поля — объект. Хук запоминает, какие свойства компонент прочитал, и перерисовывает его
только при их смене. Деструктуризация — тоже чтение: в примере ниже прочитаны семь свойств, и смена
`valid` или `dirty` компонент не будит. Поэтому поле, которое не показывает `pending`, не
перерисовывается, пока сервер проверяет значение.

```tsx
import { useFormControl, useIssueMessage } from '@reformer/core/react';
import type { FormControl } from '@reformer/core';

function TextField({ control }: { control: FormControl<string> }) {
  const { value, disabled, issues, shouldShowError, shouldShowIssues, pending, componentProps } =
    useFormControl(control);
  const message = useIssueMessage(); // код замечания → текст по локали

  return (
    <label>
      {componentProps.label as string}
      <input
        value={value}
        disabled={disabled}
        aria-invalid={shouldShowError}
        onChange={(event) => control.setValue(event.target.value)}
        onBlur={() => control.markAsTouched()}
      />
      {shouldShowIssues && issues[0] && <span>{message(issues[0])}</span>}
      {pending && <span>Проверка…</span>}
    </label>
  );
}
```

Состояние поля:

| Свойство           | Тип                       | Что значит                                                          |
| ------------------ | ------------------------- | ------------------------------------------------------------------- |
| `value`            | `T`                       | значение                                                            |
| `issues`           | `ValidationIssue[]`       | замечания; `[]`, когда их нет                                       |
| `valid`, `invalid` | `boolean`                 | нет / есть блокирующие замечания                                    |
| `touched`          | `boolean`                 | поле трогали: был уход из поля                                      |
| `dirty`            | `boolean`                 | значение меняли                                                     |
| `disabled`         | `boolean`                 | поле выключено                                                      |
| `pending`          | `boolean`                 | идёт асинхронная проверка                                           |
| `shouldShowError`  | `boolean`                 | поле невалидно, его трогали или меняли — для `aria-invalid` и рамки |
| `shouldShowIssues` | `boolean`                 | есть замечания (ошибки или предупреждения), поле трогали или меняли |
| `componentProps`   | `Record<string, unknown>` | пропсы компонента из узла схемы: `label`, `options`, …              |
| `path`             | `string`                  | путь поля в модели (`items.0.name`); у строки массива — с индексом  |

Путь поля строки массива меняется вместе с индексом строки, когда строки переставляют или удаляют.
Из него выводят `id`, `name` и `data-testid`.

Для массива `useFormControl(form.items)` возвращает `value`, `length`, `issues` (свои и строк),
`ownIssues` (только правила на самом массиве), `valid`, `invalid`, `touched`, `dirty`, `disabled`,
`pending`, `path`. Массив перерисовывает компонент на смену любого из них.

Текста в замечании нет — только код и параметры. Текст даёт `useIssueMessage(messages)`, а внутри
`ValidationMessagesProvider` из `@reformer/cdk` — `useIssueMessageResolver()`. Подробнее — в
[Обработке ошибок](../validation/error-handling.md).

## useFormControlValue

Только значение поля. Компонент не перерисовывается, когда меняются замечания, касание и прочее.

:::warning Не деструктурируйте результат
`useFormControlValue` возвращает само значение, а не объект:

```tsx
const email = useFormControlValue(form.email); // ✅
const { value } = useFormControlValue(form.email); // ❌ value будет undefined
```

:::

Типичный случай — показать часть формы по значению поля, как в примере выше. Если компоненту нужны
и замечания, и доступность — берите один `useFormControl`, а не несколько хуков.

## useArrayLength

Число строк массива. Хук подписан только на длину: правки внутри строк компонент не перерисовывают.
Строки рисуют через ноду массива, ключ строки — `keyAt(index)`:

```tsx
import type { FormArray } from '@reformer/core';
import { useArrayLength } from '@reformer/core/react';
import { FormField } from '@reformer/ui-kit';

function PhoneList({ phones }: { phones: FormArray<Phone> }) {
  const count = useArrayLength(phones);

  return (
    <>
      {phones.map((phone, index) => (
        <div key={phones.keyAt(index)}>
          <FormField control={phone.number} />
          <button type="button" onClick={() => phones.removeAt(index)}>
            Удалить
          </button>
        </div>
      ))}
      {count === 0 && <p>Телефонов пока нет</p>}
      <button type="button" onClick={() => phones.push()}>
        Добавить телефон
      </button>
    </>
  );
}
```

- `push()` без аргумента добавляет строку по шаблону модели; `push({ number: '' })` — со своими
  значениями. Это значения строки, а не узел схемы.
- Если строки переставляют (`move`, `swap`), длина не меняется. Подпишитесь на массив целиком —
  `useFormControl(phones)`.

Живой пример — в [Массивах и динамических формах](../patterns/arrays.mdx).

## useFormFlow

Снимок потока шагов `bundle.flow` для отрисовки: `{ current, index, completed, isFirst, isLast,
validating }`. Переходы — методами самого потока.

```tsx
import { useFormFlow } from '@reformer/core/react';
import type { FormFlow } from '@reformer/core';

function StepButtons({ flow }: { flow: FormFlow }) {
  const { isFirst, isLast, validating } = useFormFlow(flow);
  return (
    <div>
      <button type="button" disabled={isFirst} onClick={() => flow.previous()}>
        Назад
      </button>
      <button type="button" disabled={isLast || validating} onClick={() => void flow.next()}>
        Далее
      </button>
    </div>
  );
}
```

Подробнее о потоке — в [FormWizard](/docs/cdk/form-wizard).

## useSignalSnapshot

Значение одного сигнала: поля модели, группы модели, `computed` или сигнала сборки. Компонент
перерисовывается, когда меняется этот сигнал.

```tsx
import type { FormBundle } from '@reformer/core';
import { computed } from '@reformer/core/signals';
import { useSignalSnapshot } from '@reformer/core/react';

// app — модель приложения (createModel), как на странице «Модель как стор приложения».
const headerTitle = computed(() => `${app.user.name} · ${app.cart.items.length}`);

function Header() {
  return <h1>{useSignalSnapshot(headerTitle)}</h1>;
}

function SubmitButton({ bundle }: { bundle: FormBundle<Profile> }) {
  const submitting = useSignalSnapshot(bundle.submission.submitting);
  return <button disabled={submitting}>Сохранить</button>;
}
```

Сигнал группы (`app.$.user`) отдаёт новый снимок на правку любого её поля. Если компоненту нужна
часть группы, берите `useComputed`.

## useComputed

Селектор над моделями и сигналами: `useComputed(fn, deps?, isEqual?)`. Функция читает что угодно, а
компонент перерисовывается, только когда меняется её результат.

```tsx
import { shallowEqual } from '@reformer/core/model';
import { useComputed } from '@reformer/core/react';

function CartLine({ id }: { id: string }) {
  // Перерисовка — когда меняется эта строка, а не вся корзина.
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
```

- **`deps`** — значения из пропсов и состояния, которые читает функция. При их смене селектор
  пересобирается, как у `useMemo`.
- **`isEqual`** нужен, когда селектор каждый раз собирает новый объект или массив (`find`, `map`,
  `{ ... }`). Без него новая ссылка будит компонент на любую правку. `shallowEqual` из
  `@reformer/core/model` сравнивает по первому уровню.

## useStore

Стор, которым владеет компонент: `useStore(() => createStore(...))`. Фабрика вызывается один раз,
стор снимается после размонтирования. Повторный монтаж в StrictMode и Fast Refresh стор не убивает.

```tsx
import { createModel, createStore } from '@reformer/core/model';
import { useComputed, useStore } from '@reformer/core/react';

const createFilters = () =>
  createStore(() => ({ model: createModel({ query: '', onlyActive: false }) }));

function Filters() {
  const filters = useStore(createFilters);
  const query = useComputed(() => filters.model.$.query.value, [filters]);
  return <input value={query} onChange={(e) => (filters.model.query = e.target.value)} />;
}
```

Стор приложения, который живёт всё время работы, создают в модуле, а не в хуке. Что такое стор и что
он снимает — в [Модели как сторе приложения](../core-concepts/app-store.md).

## Подводные камни

- **Не раскрывайте состояние поля целиком.** `{ ...state }` и `<Input {...state} />` читают все
  свойства, и компонент снова перерисовывается на любое изменение. Берите только нужные свойства.
- **Не создавайте сборку в теле компонента.** `const form = createForm(...)` без `useFormBundle`
  собирает форму на каждый рендер и теряет введённое.
- **Сборку, созданную снаружи, не отдавайте в `useFormBundle`.** Хук снимет её при размонтировании.
- **Пропсы поля — в схеме.** `label`, `options` и прочее приходят из `componentProps`, а не из JSX.
- **Отправка — у сборки.** `bundle.submission.submit(handler)`; методов `submit` и `validate` у
  нод нет. См. [Отправку и сброс](../patterns/submit-and-reset.mdx).

## См. также

- [Свои компоненты полей](./custom-fields.md) — поле на `useFormControl`.
- [Модель как стор приложения](../core-concepts/app-store.md) — `useComputed`, `useStore` и стор.
- [Ноды формы](../core-concepts/nodes) — что форма строит поверх модели.
- [Стратегии валидации](../validation/validation-strategies.md) — `useFormValidation` для формы без
  сборки.
- [Многошаговые формы](/docs/guides/multi-step-forms) — `useFormFlow` и машина шагов.
