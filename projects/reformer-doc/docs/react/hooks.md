---
sidebar_position: 1
---

# React-хуки

React-часть ядра живёт в отдельном входе **`@reformer/core/react`** (React 18+). Корень
`@reformer/core` от React свободен и хуков не экспортирует. Хуки чтения построены на
`useSyncExternalStore` и обновляют компонент **точечно** — только когда меняются сигналы, на которые
подписан хук.

| Хук                            | Что возвращает                     | Когда брать                                           |
| ------------------------------ | ---------------------------------- | ----------------------------------------------------- |
| `useFormBundle(factory)`       | стабильную сборку `createForm`     | собрать форму в компоненте один раз                   |
| `useFormControl(control)`      | полное состояние ноды (объект)     | нужны `value`, `issues`, `touched`, `disabled` и т.д. |
| `useFormControlValue(control)` | **только значение** (`T` напрямую) | нужно лишь значение — условный рендер, вычисления     |
| `useArrayLength(array)`        | длину массива (`number`)           | перерисовать список на добавление и удаление строк    |
| `useFormFlow(flow)`            | снимок потока шагов                | свой индикатор, кнопки или заголовок визарда          |
| `useIssueMessage(messages?)`   | функцию «замечание → текст»        | показать текст замечания своим компонентом            |
| `useFormBundleContext()`       | сборку из контекста или `null`     | компонент внутри `FormRenderer` / `FormBundleContext` |

```tsx
import {
  useFormBundle,
  useFormControl,
  useFormControlValue,
  useArrayLength,
  useFormFlow,
} from '@reformer/core/react';
```

:::info Доступ к нодам — по имени поля
Ноды берут из формы по имени: `form.email`, `form.address.city`, `form.phones` — напрямую, без
промежуточного контейнера полей. Поле, имя которого совпадает с членом ноды (`value`, `issues`,
`reset`, …), доступно через `form.$`: `form.$.value`.
:::

## useFormBundle

Собирает форму **один раз** за время жизни компонента: фабрика вызывается ленивым инициализатором
`useState`. Заодно армирует живую проверку, если у сборки задана стратегия
(`validation: { strategy: 'blur' }`), и снимает её при размонтировании.

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';

function ContactPage() {
  const bundle = useFormBundle(() =>
    createForm<ContactForm>({ initial: { name: '', email: '' }, schema: contactSchema })
  );
  const { form, model } = bundle;
  // …
}
```

`useMemo` для этого не годится: React вправе сбросить его кэш и пересобрать форму, потеряв
введённое. Передавайте именно фабрику, а не готовую сборку.

## useFormControl

Подписка на **всё** состояние ноды. Компонент перерисовывается только при реальном изменении данных
контрола.

```tsx
import { useFormControl, useIssueMessage } from '@reformer/core/react';
import type { FormControl } from '@reformer/core';

function TextField({ control, label }: { control: FormControl<string>; label: string }) {
  const { value, disabled, issues, shouldShowError, shouldShowIssues, pending } =
    useFormControl(control);
  const message = useIssueMessage(); // код замечания → текст из словаря локали

  return (
    <div className="field">
      <label>{label}</label>
      <input
        value={value ?? ''}
        disabled={disabled}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        aria-invalid={shouldShowError}
      />
      {shouldShowIssues && issues[0] && <span className="error">{message(issues[0])}</span>}
      {pending && <span className="loading">Проверка…</span>}
    </div>
  );
}
```

### Состояние для `FormControl`

| Свойство           | Тип                       | Описание                                                                                    |
| ------------------ | ------------------------- | ------------------------------------------------------------------------------------------- |
| `value`            | `T`                       | текущее значение                                                                            |
| `issues`           | `ValidationIssue[]`       | замечания валидации (`[]`, когда их нет)                                                    |
| `valid`            | `boolean`                 | блокирующих замечаний нет                                                                   |
| `invalid`          | `boolean`                 | есть блокирующие замечания                                                                  |
| `touched`          | `boolean`                 | пользователь взаимодействовал (был `blur`)                                                  |
| `dirty`            | `boolean`                 | значение меняли                                                                             |
| `disabled`         | `boolean`                 | поле отключено                                                                              |
| `pending`          | `boolean`                 | идёт асинхронная проверка                                                                   |
| `shouldShowError`  | `boolean`                 | состояние ошибки (`aria-invalid`): поле невалидно, его трогали или меняли                   |
| `shouldShowIssues` | `boolean`                 | пора показать тексты замечаний — ошибок и предупреждений: они есть, поле трогали или меняли |
| `componentProps`   | `Record<string, unknown>` | пропсы компонента из схемы (`label`, `options`, …)                                          |

Замечание — `{ code, params?, severity? }`: текста в нём нет. Текст по коду даёт словарь
(`defineIssueMessages`) — через `useIssueMessage(messages)` или провайдер
`ValidationMessagesProvider messages` из `@reformer/cdk`, который читают `FormField` и
`useIssueMessageResolver()`.

### Состояние для `FormArray`

То же самое, плюс `length`; у массива нет `shouldShowError`, `shouldShowIssues` и `componentProps`.

| Свойство            | Тип                 | Описание                            |
| ------------------- | ------------------- | ----------------------------------- |
| `value`             | `T[]`               | значения всех элементов             |
| `length`            | `number`            | количество элементов                |
| `issues`            | `ValidationIssue[]` | замечания массива и его строк       |
| `valid` / `invalid` | `boolean`           | валиден ли массив и все строки      |
| `touched`           | `boolean`           | было взаимодействие с любой строкой |
| `dirty`             | `boolean`           | массив изменился                    |
| `disabled`          | `boolean`           | массив отключён                     |
| `pending`           | `boolean`           | идёт асинхронная проверка           |

:::tip `componentProps` — из схемы
`label`, `placeholder`, `options` и прочие пропсы задаются в **узле схемы** и читаются из
`useFormControl(control).componentProps`, а не из JSX-пропсов. Подробнее — в разделе
[Свои компоненты полей](./custom-fields).
:::

---

## useFormControlValue

Подписка **только на значение**. Компонент не перерисовывается при изменении `issues`, `touched`,
`valid` и других свойств — это дешевле, чем `useFormControl`, когда нужно лишь значение.

:::warning Не деструктурируйте результат
`useFormControlValue` возвращает значение `T` **напрямую**, а не объект. Присваивайте его
переменной целиком.

```tsx
const email = useFormControlValue(form.email); // ✅ верно
const { value } = useFormControlValue(form.email); // ❌ значение — не объект
```

:::

Типичный сценарий — условный рендер по значению другого поля:

```tsx
import type { FormGroup } from '@reformer/core';

function ShippingSection({ form }: { form: FormGroup<CheckoutForm> }) {
  // Перерисовка только когда меняется hasShipping
  const hasShipping = useFormControlValue(form.hasShipping);

  if (!hasShipping) {
    return null;
  }

  return (
    <div className="shipping">
      <FormField control={form.city} />
      <FormField control={form.street} />
    </div>
  );
}
```

### Когда использовать

- условный рендер секции по значению флага/селекта;
- вычисляемое отображение (счётчик символов, превью, «итого по строке»);
- показ значения только для чтения.

Если компоненту нужны `issues`, `disabled` или другие свойства — берите `useFormControl`: одна
подписка эффективнее, чем несколько разных хуков на один контрол.

---

## useArrayLength

Длина массива строк. `useArrayLength` подписывается только на длину и не перерисовывает компонент
при изменении полей внутри строк. Строки рисуют через ноду массива (`form.phones.map`), ключ строки —
`form.phones.keyAt(index)`: он держится за элемент и не меняется при перестановке.

```tsx
import { FormField } from '@reformer/ui-kit';
import type { FormArray } from '@reformer/core';

function PhoneList({ phones }: { phones: FormArray<Phone> }) {
  const length = useArrayLength(phones);

  return (
    <div>
      {phones.map((phone, index) => (
        <div key={phones.keyAt(index)} className="row">
          <FormField control={phone.type} />
          <FormField control={phone.number} />
          <button type="button" onClick={() => phones.removeAt(index)}>
            Удалить
          </button>
        </div>
      ))}

      {length === 0 && <p>Телефонов пока нет</p>}

      <button type="button" onClick={() => phones.push({ type: 'mobile', number: '' })}>
        Добавить телефон
      </button>
    </div>
  );
}
```

:::info push принимает плоские значения
`phones.push({ type, number })` — это **значения** элемента, а не узел схемы (`{ model, component }`).
Компонент и его пропсы берутся из `item` узла массива в схеме. Без аргумента `push()` добавляет
строку по шаблону модели (`arrayOf(blank)`).
:::

Если строки переставляются (`move` / `swap`), подписывайтесь на массив целиком —
`useFormControl(phones)`: длина при перестановке не меняется. Готовые компоненты массива —
`FieldArraySection` из `@reformer/ui-kit` и headless `FieldArray` из `@reformer/cdk` — делают это сами.

---

## useFormFlow

Снимок потока шагов (`bundle.flow`) для рендера: `{ current, index, completed, isFirst, isLast,
validating }`. Переходы — методами самого потока.

```tsx
import { useFormFlow } from '@reformer/core/react';
import type { FormFlow } from '@reformer/core';

function StepFooter({ flow }: { flow: FormFlow }) {
  const { current, isFirst, isLast, validating } = useFormFlow(flow);
  return (
    <div>
      <button disabled={isFirst} onClick={() => flow.previous()}>
        Назад
      </button>
      <button disabled={isLast || validating} onClick={() => void flow.next()}>
        Далее ({current})
      </button>
    </div>
  );
}
```

Подробнее о потоке — в [FormWizard](../cdk/form-wizard).

---

## Отправка формы

Правила валидации — **отдельный слой** от разметки: `defineValidation(({ model }) => …)` из
`@reformer/core/validation`, переданная в сборку полем `validation` (у визарда — ещё и правила шагов
`flow`). Отправка — `bundle.submit(handler)`: один прогон всех правил; при замечаниях обработчик не
вызывается, а поля помечаются тронутыми, при успехе — `handler(model.get())`.

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { FormField, Input, Button } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string };

// Правила: отдельный слой, стабильная ссылка уровня модуля.
const contactRules = defineValidation<ContactForm>(({ model }) => {
  validate(model.$.name, [required()]);
  validate(model.$.email, [required(), email()]);
});

export function ContactFormView() {
  const bundle = useFormBundle(() =>
    createForm<ContactForm>({
      initial: { name: '', email: '' },
      // Разметка: привязка полей + компоненты. Валидаторов здесь НЕТ.
      schema: (model) => ({
        children: [
          { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
          {
            model: model.$.email,
            component: Input,
            componentProps: { label: 'Email', type: 'email' },
          },
        ],
      }),
      validation: contactRules,
    })
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const outcome = await bundle.submit((values) => api.send(values));
    if (outcome.status === 'invalid') console.log('Проверьте форму');
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField control={bundle.form.name} />
      <FormField control={bundle.form.email} />
      <Button type="submit">Отправить</Button>
    </form>
  );
}
```

:::info Источник вердикта — уровень формы
Вердикт на отправку даёт `bundle.submit` (или `bundle.validate()` — проверка без отправки), данные —
значения модели. Методов `form.submit()` / `form.validate()` у нод нет. Правила с
`severity: 'warning'` отправку не блокируют. Подробнее — [Отправка и сброс](../patterns/submit-and-reset).
:::

---

## Производительность

Хуки чтения используют `useSyncExternalStore` и подписываются точечно, поэтому родительский компонент
не перерисовывается при изменении отдельных полей.

```tsx
function Form({ form }: { form: FormGroup<ContactForm> }) {
  // Этот компонент не перерисовывается при изменении полей —
  // перерисовывается только тот, кто подписан на конкретную ноду.
  return (
    <form>
      <FormField control={form.name} /> {/* перерисовка только при смене name */}
      <FormField control={form.email} /> {/* перерисовка только при смене email */}
    </form>
  );
}
```

## Дальше

- [Свои компоненты полей](./custom-fields) — как построить поле на `useFormControl`.
- [Схема валидации](../core-concepts/schemas/validation-schema) — отдельный слой правил.
- [Ноды формы](../core-concepts/nodes) — что форма строит поверх модели.
- [Модель данных](../core-concepts/model) — массивы модели и `model.get()`.
- [Примеры](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground) — живая песочница.
