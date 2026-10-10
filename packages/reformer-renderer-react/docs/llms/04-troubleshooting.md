# Troubleshooting / FAQ

## Field renders without label/error

Не передан `fieldWrapper` в `settings`. Добавь:

```tsx
import { FormField } from '@reformer/ui-kit';

<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />;
```

Для конкретного поля можно перекрыть глобальный wrapper через `componentProps.fieldWrapper`. В JSON-варианте обёртку кладёт в бандл реестр (запись `FIELD_WRAPPER`), и `settings.fieldWrapper` её перекрывает.

## Field renders as null (console warning `[RenderSchema] No form node for signal ...`)

Нода поля находится по ручке модели через реестр `getNodeForSignal`, а реестр заполняет сборка. Если поле рисуется как `null` и в консоли `[RenderSchema] No form node for signal "<path>" — render value-leaf after createForm`:

- Форма не собрана из этой же схемы. Канон — `createForm({ model | initial, schema })` (в React — внутри `useFormBundle`) и `<FormRenderer form={bundle} />`; низкоуровневый путь — `createFormFromModel({ model, schema })` до рендера `createRenderSchema`.
- Лист привязан к ручке другой модели (не той, что передана в сборку). Убедись, что `model: model.$.<field>` берётся из того же `model`, который получил билдер схемы.
- Узел не стал полем: ключ `value:` вместо `model:` либо `model: model.<path>` (value-фасад) вместо `model: model.$.<path>`. Компилятор схемы пишет об этом предупреждение в dev.

## Container children не рендерятся

`children` контейнера — это TOP-LEVEL свойство узла, а не часть `componentProps`. Если положить их в `componentProps.children`, поддерево не отрисуется.

```typescript
// CORRECT
{ component: Section, componentProps: { title: 'X' }, children: [ /* nodes */ ] }
// WRONG
{ component: Section, componentProps: { title: 'X', children: [ /* nodes */ ] } }
```

## FormRenderer: render или form — что передавать

Источников схемы два:

- `<FormRenderer form={bundle} settings={…} />` — бандл сборки `createForm`: рендерер берёт готовую скомпилированную схему из `bundle.render`, ставит контекст сборки (его читает визард) и исполняет правила узлов из поведения формы. Это основной путь. Прежний бандл `createReactForm` принимается тем же пропом;
- `<FormRenderer render={schema} settings={…} />` — низкоуровневый путь: `schema` — функция-схема либо результат `createRenderSchema`.

При одновременной передаче побеждает явный `render`, а бандл игнорируется целиком — вместе с правилами узлов и контекстом сборки. Не передавай оба пропа.

Чего делать нельзя: подставлять в `form` не бандл, а `FormGroup` (`bundle.form`) — проп ожидает `{ render }`, и компилятор это ловит (TS2322).

## `FormRenderer: в бандле нет дерева`

У сборки `createForm` не задана `schema`. Без схемы рисовать нечего — поля рисуют сами: `<FormField control={bundle.form.email} />`.

## Unknown component in schema

В `component` листа должен лежать React-компонент (`Input`, `SelectAsync`, ...); у контейнера — компонент либо HTML-тег строкой (`'div'`, `'h3'`). Лист поля дополнительно требует `model: model.$.<field>`. Если хочешь адресовать компоненты по строковым именам — переходи на `@reformer/renderer-json` (реестр + `$component(Name)`).

## Правило узла ничего не делает

`hideWhen`/`patchProps`/`onComponentEvent` работают только при адресации узла через `schema.node(selector)`. Убедись, что:

- У узла есть `selector` (top-level свойство узла). Без него `schema.node('x')` вернёт контроллер с пустыми переопределениями — без ошибок, но и без эффекта. В dev сборка предупреждает: «поведение обращается к узлам схемы, которых нет в корневом дереве».
- Узел лежит в той же области, что и поведение. Узлы строки массива и подформы адресуются из их поведения — `applyEach(model.$.items, rowBehavior)` / `apply(model.$.group, groupBehavior)`, а не из корневого.
- Поведение подключено к сборке полем `behavior`. На низкоуровневом пути функция-схема обёрнута `createRenderSchema`, и в `<FormRenderer render={…} />` передан именно прокси.

## `[@reformer/core] compileSchema: в области «#» селектор «…» повторяется`

Два узла одной области несут один `selector`. По `selector` узел адресуют поведение и шаги потока, поэтому в области он уникален. Дай узлам разные селекторы; в строках массива и подформах селекторы живут в своих областях и с корнем не пересекаются.

## Hidden node still mounts

`hideWhen` / `setHidden` возвращают `null` для узла (узел не рендерится, пока условие истинно). Скрытие реактивное: приоритет `setHidden` (программный override) > `hideWhen` (декларативное условие) > видимо. Чтобы вернуть автоматику после `setHidden(true)` — `resetHidden()`.

## `TS2353: 'validators' does not exist in type 'RenderNode<T>'`

Валидаторы вписаны прямо в лист схемы (`{ model: model.$.x, component: Input, validators: [...] }`). У узла нет поля `validators` — дерево несёт только layout. Правила валидации значений живут в **отдельной схеме над моделью** (`defineValidation<T>(({ model }) => { validate(model.$.path, [...]) })` из `@reformer/core/validation`) и уходят в сборку полями `validation` и `flow.steps[].rules`. Полный поток — [06-validation.md](06-validation.md).

## Визард: «шаги схемы и шаги потока расходятся»

`FormWizard` связывает узел шага с шагом потока по `selector`: `id` шага в `createForm({ flow: { steps: [{ id }] } })` обязан совпадать с `selector` узла шага. Предупреждение перечисляет шаги потока без узла и узлы без шага потока. То же расхождение сборка ловит в dev: «в `flow.steps` есть шаги, для которых в дереве схемы нет узла с таким `selector`». См. [07-form-wizard.md](07-form-wizard.md).

## Form changes don't trigger re-render

Скорее всего чтение значения идёт вне реактивного контекста или подписка не доходит до React. Проверь:

- Внутри `hideWhen`/`renderEffect` значение читается в самом колбэке: `model.x` (или сигнал ноды `form.x.value.value`), а не из переменной, захваченной заранее.
- В пользовательском компоненте используется `useFormControl` из `@reformer/core/react` (он подписывается на ноду).

## Сырой контрол пишет в модель событие или течёт пропом `control` (Checkbox/Select/Radio)

Дефолтный seam рендерера — value-based: контрол получает `value` и `onChange(value)`, а нода пишет в модель то, что пришло **первым** аргументом. У сырых контролов чужого UI-kit два симптома. (1) **Не то значение** — если `onChange` эмитит СОБЫТИЕ (Checkbox — `onChange(e)`, antd Radio.Group — `onChange(e)`), в `setValue` уйдёт DOM-`event`, а не `checked`/`value`. (2) **Проп `control` течёт в DOM** — только если контрол его запросил (`reformerNeedsControl` / `passControl`); по умолчанию `control` в контрол не передаётся. `Select` с `onChange(value, option)` адаптера не требует: значение приходит первым и пишется в модель **верно** (лишний `option` обработчик отбрасывает сам).

Не оборачивай контрол ради этого — задай ему `FieldAdapter`: статикой на компоненте (`defineFieldControl(Checkbox, { adapter })` из `@reformer/ui-kit/fields`) или, если компонент чужой и трогать его нельзя, через `settings.resolveFieldAdapter` (приоритетнее статики). Рендерер сам переложит seam на диалект контрола (`valueProp`/`changeProp`/`fromEmit`/`toValue`).

```tsx
<FormRenderer
  form={bundle}
  settings={{
    fieldWrapper: FormField,
    resolveFieldAdapter: (component) =>
      component === Checkbox
        ? { valueProp: 'checked', fromEmit: (e) => (e as any).target.checked, toValue: (v) => v ?? false }
        : undefined,
  }}
/>;
```

Компонентам `@reformer/ui-kit` адаптер в настройках не нужен — диалект объявлен их статикой `reformerAdapter`. Уже value-based контролам — тоже: `resolveFieldAdapter` возвращает `undefined`, статики нет — и seam применяется как есть. Рецепты по контролам — [05-cookbook.md](05-cookbook.md).

## See also

- [01-overview.md](01-overview.md)
- [02-render-schema.md](02-render-schema.md)
- [03-render-behavior.md](03-render-behavior.md)
- [05-cookbook.md](05-cookbook.md)
- [06-validation.md](06-validation.md)
- [07-form-wizard.md](07-form-wizard.md)
