# Императивные handle полей — управление компонентом по селектору

Каждое поле ui-kit экспонирует типизированный императивный handle через `ref`. Из render-схемы он
достаётся по селектору: `schema.node(sel).getRef<H>()`. Это мост «узел схемы → живой компонент»,
тот же, что уже использовался для `FormWizard`/`FormArray`, но теперь работает и для листовых полей.

## Когда императив, а когда реактив

Handle покрывает ТОЛЬКО то, что не выражается реактивно. Всё остальное остаётся в behaviors —
дублировать его через handle нельзя, иначе появятся два способа делать одно и то же.

| Действие                                   | Слой            | API                                              |
| ------------------------------------------ | --------------- | ------------------------------------------------ |
| value / compute / copy / sync              | реактивный      | `computeFrom` / `copyFrom` / `field.setValue`     |
| enable / disable                           | реактивный      | `enableWhen` / `disableWhen`                      |
| видимость                                  | реактивный      | `hideWhen` / `setHidden`                          |
| options / props                            | реактивный      | `updateComponentProps` / `patchProps`             |
| валидация                                  | реактивный      | `validate` / `revalidateWhen`                     |
| **focus / blur / scrollIntoView**          | **императивный** | `getRef<FieldHandle>().current?.focus()`          |
| **открыть/закрыть дропдаун, поповер**      | **императивный** | `getRef<SelectAsyncHandle>().current?.open()`     |
| **reload / loadMore async-источника**      | **императивный** | `…current?.reload()`                              |
| **переключить видимость пароля**           | **императивный** | `getRef<InputPasswordHandle>().current?.setVisible(true)` |

## Базовое использование

```tsx
import { createRenderSchema, renderEffect } from '@reformer/renderer-react';
import { InputField, type FieldHandle } from '@reformer/ui-kit';

const schema = createRenderSchema<MyForm>(() => ({
  component: Box,
  children: [{ value: model.$.email, component: InputField, componentProps: { label: 'Email' } }],
}));

// Поведение схемы: ref запрашивается ЗДЕСЬ (до первого рендера — см. ниже).
const emailRef = schema.node('email').getRef<FieldHandle>();

// Позже, из обработчика/эффекта:
emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
emailRef.current?.focus();
```

## ⚠️ `getRef()` вызывать ДО первого рендера

`getRef()` намеренно **не** бампает version-сигнал ноды (иначе каждый вызов вызывал бы ре-рендер и
менял семантику wizard-а). Нода читает реестр рефов в момент рендера — поэтому ref, запрошенный
впервые уже после монтирования, **никогда не прикрепится и останется `null`**.

```tsx
// ✅ правильно — на этапе применения поведения, до рендера
const behavior: RenderBehaviorFn<MyForm> = (schema) => {
  const emailRef = schema.node('email').getRef<FieldHandle>();
  onComponentEvent(schema.node('submit'), 'onClick', () => emailRef.current?.focus());
};

// ❌ неправильно — первый getRef внутри обработчика клика: ref останется null
<button onClick={() => schema.node('email').getRef<FieldHandle>().current?.focus()} />;
```

Повторные `getRef()` для того же селектора идемпотентны и возвращают тот же `RefObject` — поэтому
достаточно один раз «прогреть» все нужные селекторы в поведении, а дальше звать `getRef()` где угодно.

## Адресация: `selector` или `__path`

Ключ ref листа — `node.selector ?? __path` сигнала модели (явный селектор в приоритете):

```tsx
// без selector → адресуется индексным путём модели
{ value: model.$.email, component: InputField }          // → schema.node('email')
{ value: model.$.phones[0].number, component: InputField } // → schema.node('phones.0.number')

// с явным selector → адресуется им
{ selector: 'pwd', value: model.$.password, component: InputPasswordField } // → schema.node('pwd')
```

Благодаря `__path` пути из `validateFormModel(model, schema).errors` **напрямую годятся как ключ ref**
— см. рецепт ниже. Для строк `FormArray` индексы не нужно перечислять в схеме.

## Контракты handle

Все rich-handle наследуют `FieldHandle`.

| Компонент             | Handle                | Дополнительно к baseline                     | Импорт                          |
| --------------------- | --------------------- | -------------------------------------------- | ------------------------------- |
| любое поле            | `FieldHandle`         | `focus` `blur` `scrollIntoView` `getElement` | `@reformer/ui-kit`              |
| `InputPasswordField`  | `InputPasswordHandle` | `toggleVisibility` `setVisible`               | `@reformer/ui-kit`              |
| `SelectField`         | `SelectAsyncHandle`   | `open` `close` `clear` `reload` `loadMore`    | `@reformer/ui-kit`              |
| `ComboboxField`       | `ComboboxHandle`      | `open` `close` `clear`                        | `@reformer/ui-kit/combobox`     |
| `DatePickerField`     | `DatePickerHandle`    | `open` `close`                                | `@reformer/ui-kit/date-picker`  |

`Combobox` и `DatePicker` — heavy-компоненты, они вне главного barrel и доступны только своим subpath.

`getRef<H>()` не выводит `H` из селектора (схема не индексирована статически) — тип указывает
вызывающий, как и для `getRef<FormWizardHandle<T>>()`.

## Рецепт: focus первого невалидного поля после submit

Классика UX, реактивно невыразимая. `validateFormModel` возвращает `errors`, ключованные путём
модели, а путь — готовый ключ ref:

```tsx
import { validateFormModel } from '@reformer/core';
import type { FieldHandle } from '@reformer/ui-kit';

const ORDER = ['email', 'password', 'city', 'nickname']; // порядок обхода = порядок полей

async function handleSubmit() {
  const res = await validateFormModel(model, schema);
  if (res.valid) return submit();

  const firstInvalid = ORDER.find((path) => (res.errors[path]?.length ?? 0) > 0);
  if (!firstInvalid) return;

  const ref = schema.node(firstInvalid).getRef<FieldHandle>();
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  ref.current?.focus();
}
```

## Рецепт: зависимый async-Select

Реактивная часть (параметры источника) — через `patchProps`; императивная (сброс, перезагрузка,
открытие) — через handle:

```tsx
import { renderEffect } from '@reformer/renderer-react';
import type { SelectAsyncHandle } from '@reformer/ui-kit';

renderEffect(schema, () => {
  const country = form.address.country.value.value; // зависимость-сигнал
  const city = schema.node('city');

  city.patchProps({ dataSourceParams: { country } }); // реактивно

  const ref = city.getRef<SelectAsyncHandle>(); // императивно
  ref.current?.clear();
  ref.current?.reload();
});
```

## Рецепт: фокус в поле только что добавленной строки FormArray

```tsx
import type { FormArrayHandle } from '@reformer/cdk';
import type { FieldHandle } from '@reformer/ui-kit';

const phones = schema.node('phones').getRef<FormArrayHandle<Phone>>();
phones.current?.add({ number: '' });

// строка ещё не смонтирована — ждём коммита React
queueMicrotask(() => {
  const idx = (phones.current?.length ?? 1) - 1;
  schema.node(`phones.${idx}.number`).getRef<FieldHandle>().current?.focus();
});
```

## null-safety и жизненный цикл

`ref.current` равен `null`, пока поле не смонтировано — и остаётся `null` у скрытых/условных полей,
которые не рендерятся вовсе. Все вызовы обязаны идти через `?.`.

- `renderEffect` работает на Preact-effect, а не на React-commit: сразу после структурного изменения
  `.current` может быть ещё `null`. Для «сфокусировать после появления» используйте `onMount` ноды
  или `queueMicrotask`.
- Сам baseline-handle тоже null-safe: `focus()/blur()/scrollIntoView()` на несмонтированном поле —
  no-op без исключения.

## Своё поле с handle

Слой создания полей публикуется точкой `@reformer/ui-kit/fields` — оттуда доступны
`withFormControl`, все адаптеры-пресеты (`nativeInputAdapter`, `checkedAdapter`, `pressedAdapter`,
`valueChangeAdapter`, `sliderAdapter`, `dateAdapter`), `makeElementFieldHandle` и типы
`FieldAdapter` / `WithFormControlOptions` / `FieldHandle`.

`withFormControl` принимает третий аргумент:

```tsx
import { withFormControl, type FieldHandle } from '@reformer/ui-kit/fields';

// 1) baseline по умолчанию — handle синтезируется из DOM-узла примитива, ничего делать не нужно:
export const MyField = withFormControl(MyPrimitive, myAdapter);

// 2) композит сам владеет handle (useImperativeHandle внутри) — passthrough:
export const MySelectField = withFormControl(MySelect, myAdapter, { exposesHandle: true });
```

При `exposesHandle: true` HOC форвардит ref потребителя прямо в примитив и **не** вешает свой
`useImperativeHandle` — иначе один ref писался бы дважды. Rich-handle объявляйте рядом с композитом
(`export interface MySelectHandle extends FieldHandle { … }`) и реэкспортируйте из barrel компонента.
