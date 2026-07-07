---
sidebar_position: 1
---

# React-хуки

ReFormer даёт три хука для чтения состояния нод в React-компонентах (React 18+). Все они построены
на `useSyncExternalStore` и обновляют компонент **точечно** — только когда меняются те сигналы, на
которые подписан хук.

| Хук                            | Что возвращает                      | Когда брать                                           |
| ------------------------------ | ----------------------------------- | ----------------------------------------------------- |
| `useFormControl(control)`      | полное состояние ноды (объект)      | нужны `value`, `errors`, `touched`, `disabled` и т.д. |
| `useFormControlValue(control)` | **только значение** (`T` напрямую)  | нужно лишь значение — условный рендер, вычисления     |
| `useArrayLength(arrayNode)`    | реактивная длина массива (`number`) | рендер динамического списка                           |

:::info Доступ к нодам — через proxy
Ноды берут из proxy формы по имени: `form.email`, `form.address.city`, `form.phones` — напрямую,
без промежуточного контейнера полей.
:::

## useFormControl

Подписка на **всё** состояние ноды. Компонент ре-рендерится только при реальном изменении данных
контрола.

```tsx
import { useFormControl } from '@reformer/core';
import type { FieldNode } from '@reformer/core';

function TextField({ control, label }: { control: FieldNode<string>; label: string }) {
  const { value, disabled, errors, shouldShowError, pending } = useFormControl(control);

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
      {shouldShowError && errors[0] && <span className="error">{errors[0].message}</span>}
      {pending && <span className="loading">Проверка…</span>}
    </div>
  );
}
```

### Состояние для `FieldNode`

| Свойство          | Тип                       | Описание                                           |
| ----------------- | ------------------------- | -------------------------------------------------- |
| `value`           | `T`                       | текущее значение                                   |
| `errors`          | `ValidationError[]`       | ошибки валидации (`[]` когда валидно)              |
| `valid`           | `boolean`                 | поле проходит валидацию                            |
| `invalid`         | `boolean`                 | есть ошибки                                        |
| `touched`         | `boolean`                 | пользователь взаимодействовал (был `blur`)         |
| `dirty`           | `boolean`                 | значение отличается от начального                  |
| `disabled`        | `boolean`                 | поле отключено                                     |
| `pending`         | `boolean`                 | идёт асинхронная валидация                         |
| `shouldShowError` | `boolean`                 | пора показать ошибку (`touched && invalid`)        |
| `componentProps`  | `Record<string, unknown>` | пропсы компонента из схемы (`label`, `options`, …) |

### Состояние для `ArrayNode`

То же самое, плюс реактивная `length`; у массива нет `shouldShowError` и `componentProps`.

| Свойство            | Тип                 | Описание                                 |
| ------------------- | ------------------- | ---------------------------------------- |
| `value`             | `T[]`               | значения всех элементов                  |
| `length`            | `number`            | количество элементов (реактивно)         |
| `errors`            | `ValidationError[]` | ошибки уровня массива                    |
| `valid` / `invalid` | `boolean`           | валиден ли массив и все элементы         |
| `touched`           | `boolean`           | было взаимодействие с любым элементом    |
| `dirty`             | `boolean`           | массив изменился относительно начального |
| `disabled`          | `boolean`           | массив отключён                          |
| `pending`           | `boolean`           | идёт асинхронная валидация               |

:::tip `componentProps` — из схемы
`label`, `placeholder`, `options` и прочие пропсы задаются в **схеме поля** и читаются из
`useFormControl(control).componentProps`, а не из JSX-пропсов. Подробнее — в разделе
[Свои компоненты полей](./custom-fields).
:::

---

## useFormControlValue

Подписка **только на значение**. Компонент не ре-рендерится при изменении `errors`, `touched`,
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
import { useFormControlValue } from '@reformer/core';
import type { FormProxy } from '@reformer/core';

function ShippingSection({ form }: { form: FormProxy<CheckoutForm> }) {
  // Ре-рендер только когда меняется hasShipping
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
- read-only показ значения без интерактивности.

Если компоненту нужны `errors`, `disabled` или другие свойства — берите `useFormControl`: одна
подписка эффективнее, чем несколько разных хуков на один контрол.

---

## useArrayLength

Реактивная длина массива. Значения массива принадлежат [модели](../core-concepts/model), поэтому
мутации выполняются на модели (`model.phones.push` / `removeAt`), а рендер — через ноду формы
(`form.phones.map`). `useArrayLength` подписывается только на `length` и не ре-рендерится при
изменении полей внутри элементов.

```tsx
import { useArrayLength } from '@reformer/core';
import { FormField } from '@reformer/ui-kit';
import type { FormModel, FormProxy } from '@reformer/core';

function PhoneList({ form, model }: { form: FormProxy<OrderForm>; model: FormModel<OrderForm> }) {
  const length = useArrayLength(form.phones);

  return (
    <div>
      {form.phones.map((phone, index) => (
        <div key={index} className="row">
          <FormField control={phone.type} />
          <FormField control={phone.number} />
          <button type="button" onClick={() => model.phones.removeAt(index)}>
            Удалить
          </button>
        </div>
      ))}

      {length === 0 && <p>Телефонов пока нет</p>}

      <button type="button" onClick={() => model.phones.push({ type: 'mobile', number: '' })}>
        Добавить телефон
      </button>
    </div>
  );
}
```

:::info push принимает плоские значения
`model.phones.push({ type, number })` — это **значения** элемента, а не узел схемы
(`{ value, component }`). Компонент и его пропсы берутся из фабрики элемента в схеме.
:::

---

## Отправка формы

Сабмит в M1 — это три шага, без опоры на агрегированные флаги формы:

1. `form.touchAll()` — пометить все поля тронутыми, чтобы показались ошибки.
2. `validateFormModel(model, schema)` — headless-валидация данных модели против схемы; ошибки
   роутятся в ноды для отображения.
3. `model.get()` — снимок всех значений для отправки.

```tsx
import { useMemo } from 'react';
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { required, email } from '@reformer/core/validators';
import { FormField, Input, Button } from '@reformer/ui-kit';

type ContactForm = { name: string; email: string };

export function ContactFormView() {
  const { form, model, schema } = useMemo(() => {
    const model = createModel<ContactForm>({ name: '', email: '' });
    const schema = {
      name: {
        value: model.$.name,
        component: Input,
        componentProps: { label: 'Имя' },
        validators: [required()],
      },
      email: {
        value: model.$.email,
        component: Input,
        componentProps: { label: 'Email', type: 'email' },
        validators: [required(), email()],
      },
    };
    const form = createForm<ContactForm>({ model, schema });
    return { form, model, schema };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.touchAll();

    const { valid } = await validateFormModel(model, schema);
    if (valid) {
      console.log('Отправка:', model.get());
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FormField control={form.name} />
      <FormField control={form.email} />
      <Button type="submit">Отправить</Button>
    </form>
  );
}
```

:::warning Источник сабмита — валидация модели, не флаги формы
Валидность для отправки определяет результат `validateFormModel(model, schema)`, а данные —
`model.get()`. Не полагайтесь на агрегированные флаги формы как на источник сабмита — используйте
headless-валидацию модели.
:::

---

## Производительность

Все три хука используют `useSyncExternalStore` и подписываются точечно, поэтому родительский
компонент не перерисовывается при изменении отдельных полей.

```tsx
function Form() {
  // Этот компонент не ре-рендерится при изменении полей —
  // перерисовывается только тот, кто подписан на конкретную ноду.
  return (
    <form>
      <FormField control={form.name} /> {/* ре-рендер только при смене name */}
      <FormField control={form.email} /> {/* ре-рендер только при смене email */}
    </form>
  );
}
```

## Дальше

- [Свои компоненты полей](./custom-fields) — как построить поле на `useFormControl`.
- [Ноды и proxy](../core-concepts/nodes) — что форма строит поверх модели.
- [Модель данных](../core-concepts/model) — массивы модели и `model.get()`.
- [Примеры](https://stackblitz.com/~/github.com/AlexandrBukhtatyy/ReFormer/tree/main/projects/react-playground) — живая песочница.
