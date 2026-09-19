# Императивные handle полей — управление компонентом по селектору

Каждое поле ui-kit отдаёт типизированный императивный handle через `ref` (строит его обёртка
поля — см. «Своё поле с handle»). Из render-схемы он достаётся по селектору: `schema.node(sel).getRef<H>()`. Это мост «узел схемы → живой компонент»,
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
import { Input, type FieldHandle } from '@reformer/ui-kit';

const schema = createRenderSchema<MyForm>(() => ({
  component: Box,
  children: [{ value: model.$.email, component: Input, componentProps: { label: 'Email' } }],
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
{ value: model.$.email, component: Input }          // → schema.node('email')
{ value: model.$.phones[0].number, component: Input } // → schema.node('phones.0.number')

// с явным selector → адресуется им
{ selector: 'pwd', value: model.$.password, component: InputPassword } // → schema.node('pwd')
```

Благодаря `__path` путь модели — **одновременно ключ ref и адрес сигнала** (`model.signalAt(path)`),
поэтому после `validateModel` ошибки поля читаются по тому же пути — см. рецепт ниже. Для строк
`FormArray` индексы не нужно перечислять в схеме.

## Контракты handle

Все rich-handle наследуют `FieldHandle`.

| Компонент                | Handle                    | Дополнительно к baseline                                                        | Импорт                         |
| ------------------------ | ------------------------- | ------------------------------------------------------------------------------- | ------------------------------ |
| любое поле               | `FieldHandle`             | `focus` `blur` `scrollIntoView` `getElement`                                    | `@reformer/ui-kit`             |
| `InputPassword`          | `InputPasswordHandle`     | `toggleVisibility` `setVisible`                                                 | `@reformer/ui-kit`             |
| `SelectAsync`            | `SelectAsyncHandle`       | `open` `close` `clear` `reload` `loadMore`                                      | `@reformer/ui-kit`             |
| `Combobox`               | `ComboboxHandle`          | `open` `close` `clear`                                                          | `@reformer/ui-kit/combobox`    |
| `ComboboxTree`           | `ComboboxTreeHandle`      | `open` `close` `clear` `refresh`                                                | `@reformer/ui-kit/combobox`    |
| `ComboboxTreeMulti`      | `ComboboxTreeMultiHandle` | `open` `close` `clear` `refresh`                                                | `@reformer/ui-kit/combobox`    |
| `DatePicker`             | `DatePickerHandle`        | `open` `close`                                                                  | `@reformer/ui-kit/date-picker` |
| `Tree` (не поле)         | `TreeHandle`              | `expand` `collapse` `toggle` `refresh` `focusNode` `getRows` `getActionTargets` | `@reformer/ui-kit`             |

`Combobox` и `DatePicker` — heavy-компоненты, они вне главного barrel и доступны только своим subpath.

`refresh(id)` у древесных вариантов перечитывает уровень (`null` — верхний) и действует, только
пока поповер открыт: закрытый Radix содержимое размонтирует, и перечитывать нечего — следующее
открытие прочитает уровень заново.

`Tree` в таблице — исключение: это не поле формы (статики `reformerAdapter` у него нет), и в схеме он живёт
контейнерным узлом. Его handle берут обычным React-ref'ом там, где дерево отрисовано; если узел
объявлен в схеме со своим `selector`, работает и `schema.node(sel).getRef<TreeHandle>()` — тем же
способом, что у `FormWizard` и `FormArray`.

`getRef<H>()` не выводит `H` из селектора (схема не индексирована статически) — тип указывает
вызывающий, как и для `getRef<FormWizardHandle<T>>()`.

## Рецепт: focus первого невалидного поля после submit

Классика UX, реактивно невыразимая. `validateModel` роутит ошибки в ноды; нода поля
резолвится по тому же пути через `getNodeForSignal(model.signalAt(path))`, а путь —
готовый ключ ref:

```tsx
import { getNodeForSignal } from '@reformer/core';
import { validateModel } from '@reformer/core/validation';
import type { FieldHandle } from '@reformer/ui-kit';

const ORDER = ['email', 'password', 'city', 'nickname']; // порядок обхода = порядок полей

async function handleSubmit() {
  const ok = await validateModel(model, validationSchema); // ошибки уже в нодах
  if (ok) return submit();

  const firstInvalid = ORDER.find((path) => {
    const sig = model.signalAt(path); // пути статические — сигнал существует
    return sig ? (getNodeForSignal(sig)?.errors.value.length ?? 0) > 0 : false;
  });
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

Handle строит **обёртка поля** (`FormField.Control` из `@reformer/cdk`, рендерер
`@reformer/renderer-react`), а не сам контрол: она вешает ref на `component` и публикует
потребителю

- handle самого контрола, если тот его реализует (`useImperativeHandle` внутри композита);
- иначе — базовый `FieldHandle`, построенный из DOM-узла контрола (`makeElementFieldHandle`).

Поэтому своему контролу для baseline-handle делать ничего не нужно — достаточно пробросить `ref`
на DOM-элемент (`forwardRef` или React 19 ref-as-prop). Слой создания полей публикуется точкой
`@reformer/ui-kit/fields`: `defineFieldControl`, адаптеры-пресеты (`nativeInputAdapter`,
`textValueAdapter`, `checkedAdapter`, `pressedAdapter`, `valueChangeAdapter`, `multiValueAdapter`,
`sliderAdapter`, `dateAdapter`, `datePickerAdapter`), `makeElementFieldHandle` и типы
`FieldAdapter` / `FieldHandle`.

```tsx
import { defineFieldControl, type FieldHandle } from '@reformer/ui-kit/fields';

// 1) baseline — ref уходит на DOM-узел, обёртка сама соберёт FieldHandle:
export const MyInput = defineFieldControl(MyPrimitive, { adapter: myAdapter });

// 2) композит сам владеет handle (useImperativeHandle внутри) — обёртка отдаст его как есть:
export interface MySelectHandle extends FieldHandle {
  open(): void;
  close(): void;
}
export const MySelect = defineFieldControl(MySelectBase, { adapter: myAdapter });
```

`defineFieldControl` не создаёт обёртку — он вешает на компонент статику `reformerAdapter` и
возвращает тот же компонент, поэтому ref не проходит через лишний слой и не пишется дважды.

`FieldAdapter` — один тип на всех (`@reformer/core`, реэкспорт в `@reformer/ui-kit/fields` и
`@reformer/renderer-react`): статика `reformerAdapter` компонента и
`RendererSettings.resolveFieldAdapter` (для чужих компонентов без статики) описывают диалект
одинаково. Rich-handle объявляйте рядом с композитом и реэкспортируйте из barrel компонента.
