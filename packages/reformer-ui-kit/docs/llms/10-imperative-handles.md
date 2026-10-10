# Императивные handle полей — управление компонентом по селектору

Каждое поле ui-kit отдаёт типизированный императивный handle через `ref` (строит его обёртка
поля — см. «Своё поле с handle»). Из схемы формы он достаётся по селектору:
`schema.node(sel).getRef<H>()` в поведении формы (`defineFormBehavior`) либо
`bundle.render.node(sel).getRef<H>()` снаружи — это одна и та же корневая область схемы. Это мост
«узел схемы → живой компонент» для листовых полей и для контейнеров, которые принимают `ref`.

## Когда императив, а когда реактив

Handle покрывает ТОЛЬКО то, что не выражается реактивно. Всё остальное остаётся в behaviors —
дублировать его через handle нельзя, иначе появятся два способа делать одно и то же.

| Действие                                   | Слой            | API                                              |
| ------------------------------------------ | --------------- | ------------------------------------------------ |
| value / compute / copy / sync              | реактивный      | `computeFrom` / `copyFrom` / `field.setValue`     |
| enable / disable                           | реактивный      | `enableWhen` / `disableWhen`                      |
| видимость                                  | реактивный      | `hideWhen` / `setHidden`                          |
| options / props                            | реактивный      | `updateComponentProps` (поле) / `patchProps` (контейнер) |
| валидация                                  | реактивный      | `validate` / `revalidateWhen`                     |
| навигация по шагам визарда                 | реактивный      | `flow.goTo(id)` / `flow.next()` (поток сборки)    |
| **focus / blur / scrollIntoView**          | **императивный** | `getRef<FieldHandle>().current?.focus()`          |
| **открыть/закрыть дропдаун, поповер**      | **императивный** | `getRef<SelectAsyncHandle>().current?.open()`     |
| **reload / loadMore async-источника**      | **императивный** | `…current?.reload()`                              |
| **переключить видимость пароля**           | **императивный** | `getRef<InputPasswordHandle>().current?.setVisible(true)` |

## Базовое использование

```tsx
import { createForm } from '@reformer/core';
import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';
import { Box, Button, Input, type FieldHandle } from '@reformer/ui-kit';

const signInBehavior = defineFormBehavior<SignIn>(({ schema }) => {
  // ref запрашивается ЗДЕСЬ — поведение исполняется при сборке, до первого рендера (см. ниже).
  const emailRef = schema.node('email').getRef<FieldHandle>();

  // Позже, из обработчика/эффекта:
  onComponentEvent(schema.node('focus-email'), 'onClick', () => {
    emailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    emailRef.current?.focus();
  });
});

const signIn = createForm<SignIn>({
  initial: { email: '' },
  schema: (model) => ({
    component: Box,
    children: [
      { model: model.$.email, component: Input, componentProps: { label: 'Email' } },
      { selector: 'focus-email', component: Button, children: ['К email'] },
    ],
  }),
  behavior: signInBehavior,
});
```

## ⚠️ `getRef()` вызывать ДО первого рендера

`getRef()` намеренно **не** бампает version-сигнал ноды (иначе каждый вызов вызывал бы ре-рендер).
Нода читает реестр рефов в момент рендера — поэтому ref, запрошенный впервые уже после монтирования,
**никогда не прикрепится и останется `null`**.

```tsx
// ✅ правильно — в поведении формы: оно исполняется при сборке, до рендера
defineFormBehavior<MyForm>(({ schema }) => {
  const emailRef = schema.node('email').getRef<FieldHandle>();
  onComponentEvent(schema.node('submit'), 'onClick', () => emailRef.current?.focus());
});

// ❌ неправильно — первый getRef внутри обработчика клика: ref останется null
<button onClick={() => bundle.render.node('email').getRef<FieldHandle>().current?.focus()} />;
```

Повторные `getRef()` для того же селектора идемпотентны и возвращают тот же `RefObject` — поэтому
достаточно один раз «прогреть» все нужные селекторы в поведении, а дальше звать `getRef()` где угодно
(в том числе через `bundle.render.node(sel)` — это та же корневая область).

## Адресация: `selector` или путь модели

Ключ ref листа — `selector` узла, иначе путь ручки модели (`__path`, явный селектор в приоритете):

```tsx
// без selector → адресуется путём модели
{ model: model.$.email, component: Input }            // → schema.node('email')
{ model: row.$.number, component: Input }             // строка phones[0] → schema.node('phones.0.number')

// с явным selector → адресуется им
{ selector: 'pwd', model: model.$.password, component: InputPassword } // → schema.node('pwd')
```

Путь абсолютный и ищется от корня сборки — поэтому поле строки `FieldArray` адресуется из
корневого поведения (`phones.0.number`) без перечисления индексов в схеме. Селектор же живёт в
своей области: селекторы узлов строки массива и подформы адресуются из их поведения
(`applyEach` / `apply`), а не из корня. Путь модели — **одновременно ключ ref и адрес ручки**
(`model.signalAt(path)`), поэтому замечания поля читаются по тому же пути — см. рецепт ниже.

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

`Tree` в таблице — исключение: это не поле формы (статики `reformerAdapter` у него нет), и в схеме он
живёт контейнерным узлом. Его handle берут обычным React-ref'ом там, где дерево отрисовано; если
узел объявлен в схеме со своим `selector`, работает и `schema.node(sel).getRef<TreeHandle>()` —
рендерер вешает ref на компонент контейнерного узла.

У `FormWizard` и узла-массива `FieldArray` handle нет: визардом управляет поток шагов сборки
(`bundle.flow.goTo(id)`, `flow` в поведении), массивом — модель и нода формы
(`model.phones.push()`, `form.phones.removeAt(i)`).

`getRef<H>()` не выводит `H` из селектора (схема не индексирована статически) — тип указывает
вызывающий.

## Рецепт: focus первого невалидного поля после submit

Классика UX, реактивно невыразимая. `bundle.submit` разносит замечания по нодам; нода поля
находится по тому же пути через `getNodeForSignal(model.signalAt(path))`, а путь — готовый ключ ref:

```tsx
import { getNodeForSignal } from '@reformer/core';
import type { FieldHandle } from '@reformer/ui-kit';

const ORDER = ['email', 'password', 'city', 'nickname']; // порядок обхода = порядок полей

// В поведении формы — прогреть ref'ы до первого рендера:
//   defineFormBehavior(({ schema }) => { for (const path of ORDER) schema.node(path).getRef(); });

async function handleSubmit() {
  const outcome = await bundle.submit(sendForm); // при замечаниях обработчик не вызывается
  if (outcome.status !== 'invalid') return;

  const firstInvalid = ORDER.find((path) => {
    const handle = bundle.model.signalAt(path); // пути статические — ручка существует
    return handle ? getNodeForSignal(handle)?.invalid.value === true : false;
  });
  if (!firstInvalid) return;

  const ref = bundle.render.node(firstInvalid).getRef<FieldHandle>();
  ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  ref.current?.focus();
}
```

## Рецепт: зависимый async-Select

Реактивная часть (источник опций) — через `updateComponentProps` ноды поля; императивная (сброс,
перезагрузка, открытие) — через handle:

```tsx
import { defineFormBehavior, onChange } from '@reformer/core/behaviors';
import type { SelectAsyncHandle } from '@reformer/ui-kit';

// узел: { selector: 'city', model: model.$.address.city, component: SelectAsync }
const addressBehavior = defineFormBehavior<MyForm>(({ model, form, schema }) => {
  const cityRef = schema.node('city').getRef<SelectAsyncHandle>(); // до первого рендера

  // onChange срабатывает на смену значения (не на старте) и вне effect-контекста.
  onChange(model.$.address.country, (country) => {
    form.address.city.updateComponentProps({ resource: citiesResource(country) }); // реактивно
    cityRef.current?.clear(); // императивно
    cityRef.current?.reload();
  });
});
```

`patchProps` из `schema.node(sel)` действует на контейнерные узлы; пропсы поля меняет
`updateComponentProps` его ноды.

## Рецепт: фокус в поле только что добавленной строки FieldArray

```tsx
import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';
import type { FieldHandle } from '@reformer/ui-kit';

defineFormBehavior<MyForm>(({ form, schema }) => {
  onComponentEvent(schema.node('add-phone'), 'onClick', () => {
    const index = form.phones.length; // индекс будущей строки (length — число)
    // ref поля новой строки — до её первого рендера, иначе он не прикрепится
    const numberRef = schema.node(`phones.${index}.number`).getRef<FieldHandle>();
    form.phones.push({ number: '' });
    // строка ещё не смонтирована — ждём коммита React
    queueMicrotask(() => numberRef.current?.focus());
  });
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

`FieldAdapter` — один тип на всех (`@reformer/core/react`, реэкспорт в `@reformer/ui-kit/fields` и
`@reformer/renderer-react`): статика `reformerAdapter` компонента и
`RendererSettings.resolveFieldAdapter` (для чужих компонентов без статики) описывают диалект
одинаково. Rich-handle объявляйте рядом с композитом и реэкспортируйте из barrel компонента.
