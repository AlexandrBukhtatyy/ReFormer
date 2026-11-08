---
title: 'Поля: обёртка и адаптеры'
sidebar_label: 'Поля и обёртки'
---

# Поля: обёртка и адаптеры

Узел поля связывает компонент с нодой поля: `{ model: model.$.email, component: Input }`. Рендерер
сам передаёт компоненту значение и обработчики. Эта страница — о том, что именно получает
компонент, чем его обернуть и как подключить компонент сторонней библиотеки.

## Когда это нужно

- Поля рисуются без подписи и текста замечаний — не задана обёртка поля.
- Нужна своя обёртка: другая раскладка, подсказка, аналитика.
- Компонент из чужого кита пишет в модель событие вместо значения.

## Что получает компонент поля

| Проп              | Откуда                                                   |
| ----------------- | -------------------------------------------------------- |
| `value`           | текущее значение ноды                                    |
| `onChange(value)` | записывает значение в ноду                               |
| `onBlur`          | отмечает [касание](/docs/reference/glossary) поля        |
| `disabled`        | доступность ноды                                         |
| `data-testid`     | `input-<testId>`, если в пропсах его нет                 |
| остальное         | `componentProps` узла: `label`, `placeholder`, `options` |

Саму ноду (`control`) компонент не получает: подпись, замечания и касание обслуживает обёртка поля.
Компонентам `@reformer/ui-kit` этого достаточно — кладите их в `component` как есть.

`testId` берётся из `componentProps.testId`, а без него — из пути поля: `personalData.lastName` даёт
`personalData-lastName`.

## Обёртка поля

Обёртка рисует подпись, контрол и текст замечания. Обычно это `FormField` из `@reformer/ui-kit`:

```tsx
<FormRenderer form={profile} settings={{ fieldWrapper: FormField }} />
```

Варианты:

- **Одно поле с другой обёрткой** — `componentProps.fieldWrapper` у узла перекрывает общую.
- **Без обёртки** — компонент кладётся в `div`. Тег меняет `componentProps.wrapper`.
- **`componentProps.className` поля** достаётся обёртке (или `div` без неё), а не компоненту.

### Своя обёртка

Обёртка получает `FieldWrapperProps`: ноду `control`, уже отрисованный контрол `children`,
`className` и `testId`. Удобнее всего собрать её из частей `FormField` пакета `@reformer/cdk`: они
сами читают подпись, замечания и доступность из ноды.

```tsx
import { FormField } from '@reformer/cdk/form-field';
import type { FieldWrapperProps } from '@reformer/renderer-react';

export function CompactFieldWrapper({ control, className, children, testId }: FieldWrapperProps) {
  return (
    <FormField.Root control={control}>
      <div className={className} data-testid={`field-${testId ?? 'unknown'}`}>
        <FormField.Label className="text-xs uppercase text-slate-500" />
        {/* Контрол уже отрисован рендерером — подключаем его как есть. */}
        <FormField.Control asChild>{children}</FormField.Control>
        {/* Текст первого замечания — по коду, из словаря формы или локали. */}
        <FormField.Error className="text-sm text-red-600" />
      </div>
    </FormField.Root>
  );
}
```

Если контрол рисует подпись сам (чекбокс с текстом рядом), своей обёртке нужно это учесть — иначе
подпись задвоится. `FormField` из `@reformer/ui-kit` это делает.

## Компоненты сторонних библиотек

Рендерер отдаёт полю пару `value` + `onChange(value)`. Компоненты `@reformer/ui-kit` объявляют, как
перевести её в свои пропсы, статикой `reformerAdapter`. У чужого контрола такой статики нет. Если он
читает значение не из `value` или передаёт в `onChange` событие, в модель попадёт не то.

| Контрол                            | Что пойдёт в модель без адаптера           |
| ---------------------------------- | ------------------------------------------ |
| чекбокс: `checked` + `onChange(e)` | DOM-событие вместо `true`/`false`          |
| радио: `value` + `onChange(e)`     | DOM-событие вместо строки                  |
| выбор: `onChange(value, option)`   | значение — верно, лишний `option` отброшен |

Перевод описывает [адаптер поля](/docs/reference/glossary) — `FieldAdapter`. Для чужих компонентов
его возвращает `settings.resolveFieldAdapter`:

```tsx
import { FormRenderer, type FieldAdapter } from '@reformer/renderer-react';
import { FormField } from '@reformer/ui-kit';
import { Checkbox, Radio } from 'some-ui-kit';

// Ключ — сам компонент: рендерер ищет адаптер по ссылке из node.component.
const adapters = new Map<unknown, FieldAdapter>([
  [
    Checkbox,
    {
      valueProp: 'checked',
      fromEmit: (e) => (e as { target: { checked: boolean } }).target.checked,
      toValue: (v) => v ?? false,
    },
  ],
  [Radio, { fromEmit: (e) => (e as { target: { value: string } }).target.value }],
]);

<FormRenderer
  form={profile}
  settings={{ fieldWrapper: FormField, resolveFieldAdapter: (c) => adapters.get(c) }}
/>;
```

Порядок поиска: `resolveFieldAdapter` → статика `reformerAdapter` компонента → значение как есть.
Вернули `undefined` — рендерер идёт дальше по цепочке.

| Поле адаптера | Что задаёт                                                      | По умолчанию |
| ------------- | --------------------------------------------------------------- | ------------ |
| `valueProp`   | из какого пропа контрол читает значение                         | `'value'`    |
| `changeProp`  | каким колбэком сообщает об изменении                            | `'onChange'` |
| `fromEmit`    | как достать значение из того, что пришло в колбэк               | как есть     |
| `toValue`     | как привести значение поля к пропу (`null` → `false`)           | как есть     |
| `bindBlur`    | как подключить уход фокуса, если не через `onBlur`              | `onBlur`     |
| `strip`       | какие ключи убрать из `componentProps`, чтобы не ушли в контрол | —            |
| `passControl` | передавать ли контролу ноду пропом `control`                    | `false`      |

Свой компонент можно подготовить один раз, без настроек рендерера: статикой через
`defineFieldControl(Control, { adapter })` из `@reformer/ui-kit/fields`. Готовые пресеты
(`checkedAdapter`, `nativeInputAdapter` и другие) лежат там же. Подробно — на странице
[Свои компоненты полей](/docs/react/custom-fields).

### Контролу нужна сама нода

Если контрол читает ноду напрямую — например, вызывает `useFormControl(control)` ради её
сигналов, — включите передачу явно: статикой `Control.reformerNeedsControl = true` или
`passControl: true` в адаптере. Без этого `control` будет `undefined`.

## Доступность поля

`disabled` компонент получает из состояния ноды. Рендерер ставит его после `componentProps`, поэтому
`componentProps.disabled` не действует. Рычаги:

- `disabled: true` в узле поля — постоянная блокировка (так помечают вычисляемые поля): `enable()`
  формы или группы её не снимает, только `enable()` самого поля или `enableWhen`;
- `form.<поле>.disable()` / `enable()` — из кода или поведения формы;
- `disable()` на группе блокирует все её поля. Вся форма только для чтения — один вызов при сборке:

```tsx
const order = useFormBundle(() =>
  createForm<Order>({
    initial,
    schema: orderSchema,
    // Режим просмотра: блокировка каскадом проходит по всем полям.
    setup: (built) => built.form.disable(),
  })
);
```

Отключённые поля не проверяются правилами. Отдельного флага `readonly` у рендерера нет.

## Подводные камни

- **Поля без подписи и ошибок** — не задана обёртка: `settings.fieldWrapper`.
- **В модель уходит событие** — у чужого контрола нет адаптера. Задайте `resolveFieldAdapter`.
- **`control` пришёл `undefined`** — контрол читает ноду, а передача не включена:
  `reformerNeedsControl` или `passControl`.
- **Не оборачивайте обёртку в `React.memo`** без сравнения по `control` и `children` — DOM
  застрянет на старом контроле.

## См. также

- [@reformer/renderer-react](../renderer-react.md) — обзор пакета.
- [Свои компоненты полей](/docs/react/custom-fields) — `defineFieldControl` и пресеты адаптеров.
- [FormField (UI Kit)](/docs/ui-kit/form-field) — готовая обёртка поля.
- [Реестр renderer-json](../renderer-json/registry.md) — те же адаптеры в форме из JSON.
