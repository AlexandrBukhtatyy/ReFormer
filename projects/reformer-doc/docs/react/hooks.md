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

Полное состояние поля — объект. Компонент перерисовывается, когда меняется любое из его свойств.

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

Для массива `useFormControl(form.items)` возвращает `value`, `length`, `issues` (свои и строк),
`ownIssues` (только правила на самом массиве), `valid`, `invalid`, `touched`, `dirty`, `disabled`,
`pending`.

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

## Подводные камни

- **Не создавайте сборку в теле компонента.** `const form = createForm(...)` без `useFormBundle`
  собирает форму на каждый рендер и теряет введённое.
- **Сборку, созданную снаружи, не отдавайте в `useFormBundle`.** Хук снимет её при размонтировании.
- **Пропсы поля — в схеме.** `label`, `options` и прочее приходят из `componentProps`, а не из JSX.
- **Отправка — у сборки.** `bundle.submission.submit(handler)`; методов `submit` и `validate` у
  нод нет. См. [Отправку и сброс](../patterns/submit-and-reset.mdx).

## См. также

- [Свои компоненты полей](./custom-fields.md) — поле на `useFormControl`.
- [Ноды формы](../core-concepts/nodes) — что форма строит поверх модели.
- [Стратегии валидации](../validation/validation-strategies.md) — `useFormValidation` для формы без
  сборки.
- [Многошаговые формы](/docs/guides/multi-step-forms) — `useFormFlow` и машина шагов.
