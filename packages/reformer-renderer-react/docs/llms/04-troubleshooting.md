# Troubleshooting / FAQ

## Field renders without label/error

Не передан `fieldWrapper` в `settings`. Добавь:

```tsx
import { FormField } from '@reformer/ui-kit';

<FormRenderer render={schema} settings={{ fieldWrapper: FormField }} />;
```

Для конкретного поля можно перекрыть глобальный wrapper через `componentProps.fieldWrapper`.

## Field renders as null (console warning `[RenderSchema] No form node for signal ...`)

State-нода поля резолвится по сигналу через реестр `getNodeForSignal`, а реестр заполняет `createForm`. Если поле рисуется как `null` и в консоли `[RenderSchema] No form node for signal "<path>" — render value-leaf after createForm`:

- Форма не построена из этой же схемы. Вызови `createForm({ model, schema })` до рендера — реестр `сигнал→нода` заполняется именно там.
- Лист привязан к сигналу другой модели (не той, что передана в `createForm`). Убедись, что `value: model.$.<field>` берётся из того же `model`.
- Внутри массива — под-модель элемента (`im.$.<field>`) должна проходить через `createForm`/`ModelArrayNode` (материализуется автоматически при обработке `ArrayRenderNode`).

## Container children не рендерятся

`children` контейнера — это TOP-LEVEL свойство узла, а не часть `componentProps`. Рендерер деструктурирует `const { children } = node`. Если положить их в `componentProps.children`, `node.children` будет undefined и поддерево не отрисуется.

```typescript
// CORRECT
{ component: Section, componentProps: { title: 'X' }, children: [ /* nodes */ ] }
// WRONG
{ component: Section, componentProps: { title: 'X', children: [ /* nodes */ ] } }
```

## FormRenderer не принимает form

`FormRenderer` принимает только `render` и `settings`. Формы через проп нет — она передаётся wizard/root-узлу через `componentProps.form` в самой схеме (см. [01-overview.md](01-overview.md)). Не пиши `<FormRenderer render={schema} form={form} />`.

## Unknown component in renderSchema

В `component` листа/контейнера должен лежать React-компонент (`Input`, `Section`, ...), а не строка. Лист поля дополнительно требует `value: model.$.<field>` (сигнал). Если хочешь адресовать компоненты по строковым именам — переходи на `@reformer/renderer-json`.

## RenderSchemaProxy nodes don't react to behavior

`hideWhen`/`patchProps` работают только при адресации узла через `schema.node(selector)`. Убедись, что:

- У узла есть `selector` (top-level свойство узла). Без него `schema.node('x')` вернёт контроллер с пустыми переопределениями — без ошибок, но и без эффекта.
- `RenderSchemaFn` обёрнута через `createRenderSchema`, а результат передан в `<FormRenderer>`. Если передать «сырую» `RenderSchemaFn`, override-карты/behavior не подключатся.

## Hidden node still mounts

`hideWhen` / `setHidden` возвращают `null` для узла (узел не рендерится, пока условие истинно). Скрытие реактивное: приоритет `setHidden` (программный override) > `hideWhen` (декларативное условие) > видимо. Чтобы вернуть автоматику после `setHidden(true)` — `resetHidden()`.

## Form changes don't trigger re-render

Скорее всего чтение значения идёт без `.value`, или подписка не доходит до React. Проверь:

- Внутри `hideWhen`/`renderEffect` сигнал читается целиком: `form.x.value.value` (первый `.value` — доступ к сигналу поля, второй — к его значению).
- В пользовательском компоненте используется `useFormControl` (он подписывается на state-ноду).

## See also

- [01-overview.md](01-overview.md)
- [02-render-schema.md](02-render-schema.md)
- [03-render-behavior.md](03-render-behavior.md)
- [05-cookbook.md](05-cookbook.md)
