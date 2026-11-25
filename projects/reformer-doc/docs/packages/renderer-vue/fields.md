---
title: 'Поля: обёртка и адаптеры'
sidebar_label: 'Поля и обёртки'
---

# Поля: обёртка и адаптеры

Узел поля связывает компонент с нодой поля: `{ model: model.$.email, component: TextInput }`.
Рендерер сам передаёт компоненту значение и слушает его события. Эта страница — о том, что именно
получает контрол, чем его обернуть, как контролу нарисовать поле целиком и как подключить
компонент другой библиотеки.

## Когда это нужно

- Поля рисуются без подписи и текста замечаний — нет обёртки поля.
- Нужна своя обёртка: другая раскладка, подсказка, роли для тестов.
- Контрол сам рисует подпись и ошибку, как поля Vuetify.
- Компонент из чужой библиотеки читает значение не из `modelValue` или сообщает о вводе другим
  событием.

## Что получает компонент поля

По умолчанию контрол связан по `v-model`: значение приходит пропом `modelValue`, ввод — событием
`update:modelValue`.

| Проп или событие            | Откуда                                                                           |
| --------------------------- | -------------------------------------------------------------------------------- |
| `modelValue`                | текущее значение ноды                                                            |
| событие `update:modelValue` | записывает значение в ноду                                                       |
| событие `blur`              | отмечает [касание](/docs/reference/glossary) поля                                |
| `disabled`                  | доступность ноды                                                                 |
| `data-testid`               | `input-<testId>`, если в пропсах его нет                                         |
| `control`                   | нода поля — только по запросу: `reformerNeedsControl` или `passControl` адаптера |
| `label`, `required`         | только контролу с `reformerLayout = 'inline-label'`                              |
| остальное                   | `componentProps` узла: `placeholder`, `options`, `type`                          |

`label`, `description`, `required` и `labelTooltip` адресованы обёртке поля и обычному контролу не
уходят. Служебные ключи `className`, `wrapper`, `fieldWrapper` и `testId` забирает рендерер.

`testId` берётся из `componentProps.testId`, а без него — из пути поля: `personalData.lastName` даёт
`personalData-lastName`. У поля строки массива путь живой: после удаления соседней строки
`data-testid` меняется вместе с индексом.

Контрол объявляет `modelValue` пропом, а `update:modelValue` и `blur` — в `emits`. `data-testid`
приходит атрибутом: с `inheritAttrs: false` его переносят на нативный элемент сами, как `TextInput`
из [минимального примера](../renderer-vue.md#минимальный-пример).

## Обёртка поля

Обёртка рисует подпись, контрол и текст замечания. Откуда она берётся, по старшинству:

1. `componentProps.fieldWrapper` узла — обёртка одного поля;
2. `settings.fieldWrapper` у `FormRenderer`;
3. запись `FIELD_WRAPPER` реестра — для формы из JSON-документа.

```ts
h(FormRenderer, { form: profile, settings: { fieldWrapper: FieldWrapper } });
```

Без обёртки контрол кладётся в `div`. Тег или компонент вместо него задаёт `componentProps.wrapper`:
`{ wrapper: 'label' }`. `componentProps.className` поля достаётся обёртке (или `div` без неё), а не
контролу.

### Своя обёртка

Обёртка — компонент Vue. Она получает пропсы `control` (нода поля) и `testId`, атрибут `class` из
`className` узла и уже отрисованный контрол — слотом `default`. Тип пропсов — `FieldWrapperProps`.

```ts
import { defineComponent, h, type PropType } from 'vue';
import type { FormControl } from '@reformer/core';
import { useFieldError, useFormControl } from '@reformer/renderer-vue';

export const FieldWrapper = defineComponent({
  name: 'FieldWrapper',
  // Оба пропа объявлены: необъявленные Vue отдал бы атрибутами корню.
  props: {
    control: { type: Object as PropType<FormControl<unknown>>, required: true },
    testId: { type: String, default: undefined },
  },
  setup(props, { slots }) {
    const field = useFormControl(props.control);
    // Текст замечания, которое поле показывает сейчас, — из словаря формы или локали.
    const error = useFieldError(props.control);
    return () => {
      const { label } = field.componentProps.value;
      return h('div', { 'data-testid': `field-${props.testId}` }, [
        label ? h('label', String(label)) : null,
        slots.default?.(),
        // Пока ошибки нет, элемента ошибки в разметке нет.
        error.value ? h('p', { 'data-testid': `error-${props.testId}` }, error.value) : null,
      ]);
    };
  },
});
```

- Подпись лежит в пропсах ноды: `componentProps` узла поля попадают в ноду при сборке.
- `class` Vue кладёт на корневой элемент обёртки сам.

## Контрол рисует поле сам

Компонент, который рисует подпись и ошибку сам, обходится без обёртки. Он объявляет две статики:

- `reformerNeedsControl = true` — получать ноду поля пропом `control`;
- `reformerLayout = 'inline-label'` — получать `label` и `required` вместо обёртки.

```ts
import { defineComponent, h, type PropType } from 'vue';
import type { FormControl } from '@reformer/core';
import { useFieldError } from '@reformer/renderer-vue';

export const TextField = Object.assign(
  defineComponent({
    name: 'TextField',
    inheritAttrs: false,
    props: {
      modelValue: { type: String, default: '' },
      control: { type: Object as PropType<FormControl<unknown>>, required: true },
      label: { type: String, default: undefined },
      required: { type: Boolean, default: false },
      disabled: { type: Boolean, default: false },
    },
    emits: ['update:modelValue', 'blur'],
    setup(props, { attrs, emit }) {
      const error = useFieldError(props.control);
      return () =>
        h('label', [
          props.label && props.required ? `${props.label} *` : props.label,
          h('input', {
            ...attrs,
            value: props.modelValue,
            disabled: props.disabled,
            onInput: (event: Event) =>
              emit('update:modelValue', (event.target as HTMLInputElement).value),
            onBlur: () => emit('blur'),
          }),
          error.value ? h('span', { role: 'alert' }, error.value) : null,
        ]);
    },
  }),
  { reformerNeedsControl: true, reformerLayout: 'inline-label' }
);
```

Так устроены все контролы `@reformer/kit-vuetify`: поэтому у кита нет обёртки поля. Обёртка,
которая сама рисует подпись из ноды, рядом с таким контролом подпись задвоит.

## Текст замечания

`useFieldError(control)` отдаёт текст главного замечания тронутого поля либо `undefined`. Текст
ищется по цепочке: словарь формы → словарь локали по коду → встроенный английский → сам код.

- **Словарь формы** — проп `messages` у `FormRenderer` или `provideIssueMessages(messages)` в
  `setup` предка. Вложенный словарь накладывается поверх родительского.
- **Локаль** — `provideI18n(i18n)` в `setup` предка. Она же переводит описатели `msg()` в пропсах
  узлов. Без неё — английский.
- **Свой резолвер** — `useIssueMessage()` в `setup`: функция `(issue) => string` по той же цепочке.

```ts
import { createI18n, defineIssueMessages } from '@reformer/core/i18n';
import { ru } from '@reformer/core/locale/ru';
import { FormRenderer, provideI18n } from '@reformer/renderer-vue';

// В `setup` компонента, который рисует форму:
provideI18n(createI18n(ru));
return () =>
  h(FormRenderer, {
    form: bundle,
    messages: defineIssueMessages({ 'name.taken': 'Имя занято' }),
  });
```

Локаль и словарь читаются при создании компонента: смены языка на лету в этой версии нет.

## Компоненты сторонних библиотек

Рендерер отдаёт полю пару «значение + колбэк» в диалекте контрола. Диалект описывает
[адаптер поля](/docs/reference/glossary) — `FieldAdapter` из `@reformer/core/render`. Порядок
поиска:

1. `settings.resolveFieldAdapter(component)` — для чужих компонентов без статики;
2. статика `reformerAdapter` компонента;
3. `MODEL_VALUE_ADAPTER` — `v-model` по умолчанию.

Вернули `undefined` — рендерер идёт дальше по цепочке.

```ts
import type { FieldAdapter } from '@reformer/core/render';
import { FormRenderer } from '@reformer/renderer-vue';
import { Toggle } from 'some-vue-kit';

// Ключ — сам компонент: рендерер ищет адаптер по ссылке из node.component.
const adapters = new Map<unknown, FieldAdapter>([
  // Значение — проп `checked`, ввод — событие `toggle`.
  [Toggle, { valueProp: 'checked', changeProp: 'onToggle' }],
]);

h(FormRenderer, {
  form: profile,
  settings: { fieldWrapper: FieldWrapper, resolveFieldAdapter: (c) => adapters.get(c) },
});
```

`changeProp` — имя пропа-слушателя Vue: событие `toggle` слушается как `'onToggle'`, событие
`update:modelValue` — как `'onUpdate:modelValue'`.

| Поле адаптера | Что задаёт                                                      | По умолчанию |
| ------------- | --------------------------------------------------------------- | ------------ |
| `valueProp`   | из какого пропа контрол читает значение                         | `'value'`    |
| `changeProp`  | каким пропом-слушателем сообщает об изменении                   | `'onChange'` |
| `fromEmit`    | как достать значение из того, что пришло в событие              | как есть     |
| `toValue`     | как привести значение поля к пропу (`null` → `false`)           | как есть     |
| `bindBlur`    | как подключить уход фокуса, если не через `onBlur`              | `onBlur`     |
| `strip`       | какие ключи убрать из `componentProps`, чтобы не ушли в контрол | —            |
| `passControl` | передавать ли контролу ноду пропом `control`                    | `false`      |

Ключ `uncontrolled` во Vue не действует: значение всегда приходит пропом.

Адаптер заменяет диалект целиком. Умолчания в таблице — умолчания адаптера, а не `v-model`: статика
`reformerAdapter = { passControl: true }` переводит контрол на `value` + `onChange`. Чтобы получить
ноду и остаться на `v-model`, хватит статики `reformerNeedsControl = true` — или разверните
`{ ...MODEL_VALUE_ADAPTER, passControl: true }`.

## Доступность поля

`disabled` контрол получает из состояния ноды. Рендерер ставит его после `componentProps`, поэтому
`componentProps.disabled` не действует. Рычаги те же, что в React: `disabled: true` в узле поля,
`form.<поле>.disable()` / `enable()`, `disable()` на группе. Подробно — в разделе
[Доступность поля](../renderer-react/fields.md#доступность-поля) страницы React.

## Подводные камни

- **Поля без подписи и ошибок** — нет обёртки поля, а контрол не рисует поле сам.
- **В модель уходит событие или ничего** — у чужого контрола другой диалект. Задайте
  `resolveFieldAdapter` или статику `reformerAdapter`.
- **`control` пришёл `undefined`** — передача не включена: `reformerNeedsControl` или `passControl`.
- **После `reformerAdapter = { passControl: true }` поле перестало получать значение** — адаптер
  перевёл контрол с `modelValue` на `value` + `onChange`.
- **`data-testid` не на `<input>`, а на корне компонента** — атрибут не перенесён на нативный
  элемент. Поставьте `inheritAttrs: false` и разверните `attrs` на нужный элемент.
- **Подпись задвоилась** — обёртка рисует подпись рядом с контролом, который рисует её сам
  (`reformerLayout = 'inline-label'`).

## См. также

- [@reformer/renderer-vue](../renderer-vue.md) — обзор пакета.
- [Поля в React](../renderer-react/fields.md) — то же для `@reformer/renderer-react`.
- [Реестр renderer-json](../renderer-json/registry.md) — компоненты и `FIELD_WRAPPER` формы из
  JSON.
- [Обзор валидации](/docs/validation/overview) — правила и замечания поля.
