# Troubleshooting / FAQ

## Field renders without label/error

Не передан `fieldWrapper` в `settings`. Добавь:

```tsx
import { FormField } from '@reformer/ui-kit';

<FormRenderer render={schema} form={form} settings={{ fieldWrapper: FormField }} />;
```

## "RenderSchemaFn must return a RenderNode"

Функция вернула `null`/`undefined` или React-element. Корневой узел обязан быть `{ component, componentProps }`. Если контейнер пустой — верни узел с пустым `children: []`.

## Unknown component in renderSchema

В `component` положили строку, а нужен либо React-компонент, либо `path.<field>`. Если используешь имена-строки — переходи на `@reformer/renderer-json`.

## RenderSchemaProxy nodes don't react to behavior

`hideWhen`/`patchProps` работают только при адресации узла через `proxy.node(selector)`. Убедись, что:

- У узла есть `selector` (или используется внешний адрес-провайдер).
- `RenderSchemaFn` обёрнута через `createRenderSchema`, а не передана в `<FormRenderer>` напрямую.

## Hidden node still mounts

`hideWhen` контролирует только видимость (display), узел всё равно монтируется. Если нужно полностью убрать — оборачивай родителя в условный рендер на уровне `RenderSchemaFn`.

## Form changes don't trigger re-render

Скорее всего обращение к значению идёт без `.value` или подписка не доходит до React. Проверь, что внутри компонента используется `useFormControl`/`useSignal`.

## See also

- [01-overview.md](01-overview.md)
- [02-render-schema.md](02-render-schema.md)
- [03-render-behavior.md](03-render-behavior.md)
