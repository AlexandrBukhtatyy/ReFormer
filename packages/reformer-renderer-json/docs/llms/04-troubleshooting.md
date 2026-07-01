# Troubleshooting / FAQ

## Component "X" not found in registry

Имя из оператора `$component(X)` (или `$dataSource(X)`) не зарегистрировано в реестре. Проверь:

- `defineRegistry` действительно содержит `reg.field('X', ...)`, `reg.container('X', ...)` или `reg.dataSource('X', ...)`.
- В схеме используется оператор, а не голая строка: `component: '$component(X)'`, а не `component: 'X'`.
- `JsonFormRenderer` обёрнут в `JsonRendererProvider` с этим реестром.
- Если используются вложенные провайдеры — реестр внутреннего провайдера наследуется через `withParent`, но дубли разрешаются в пользу внешнего.

## Field renders without label/error

Не зарегистрирован контейнер с ключом `FIELD_WRAPPER`. Добавь:

```typescript
import { FIELD_WRAPPER } from '@reformer/renderer-json';
import { FormField } from '@reformer/ui-kit';

reg.container(FIELD_WRAPPER, FormField);
```

## No model signal for "..." / settings.model is required

Два разных симптома одной причины — модель.

- `JsonFormRenderer: settings.model is required (M1)` — не передана модель. Под M1 листья схемы биндятся к сигналам `FormModel`; передай её в `JsonRendererProvider settings={{ registry, model }}`.
- `[JsonRenderer/M1] No model signal for "path"` (warn) — путь в `$model(path)` не соответствует структуре модели. Проверь: `value: '$model(personalData.firstName)'` — поле `firstName` реально существует внутри `personalData` в `createModel(...)` initial-значениях.

## componentProps string passes through as plain string

Строка `'$dataSource(NAME)'` в `componentProps` ссылается на source, который не зарегистрирован — конвертер оставляет её как есть. Используй `reg.dataSource('NAME', value)` либо передавай значение литералом напрямую. Голые строки (без `$dataSource(...)`) намеренно не резолвятся — это обычные значения пропа (`label`, `placeholder`).

## useJsonRendererSettings throws outside provider

`useJsonRendererSettings` в dev-режиме бросает, если вызван вне `JsonRendererProvider` **или** если в провайдере не передан `registry`. Оберни вызывающий компонент в провайдер с реестром.

## "version" missing / invalid schema (при validate)

`validate={true}` прогоняет схему через мета-схему (ajv) + обход имён операторов. Типичные ошибки: узел не подходит ни под field/array/container (нет ни `value`, ни `array`+`item`, ни `component`), голая строка вместо оператора, неизвестное `$component(...)`/`$dataSource(...)` имя. Ошибки рисуются в `SchemaErrorPanel` вместо формы. `$model(...)`-пути мета-схема не проверяет (только синтаксис) — они динамичны.

## Behavior selector matches nothing

`hideWhen`/`patchProps` ищут узел по `selector`. Убедись, что у узла он явно задан (`selector: 'mortgage-section'`), и что значение совпадает с тем, на которое смотрит behavior. `selector` — plain-строка, НЕ оператор.

## $template inside array doesn't render rows

Массив — это array-node, а не container с `itemComponent`. Проверь:

- Узел использует `array: '$model(path)'` **и** `item: { $template: <JsonNode> }` (оба обязательны — иначе `isArrayNode` вернёт false).
- Внутри `$template` пути `$model(...)` заданы **относительно элемента** (`value: '$model(type)'`, а не `'$model(properties[0].type)'`).
- Есть `initialValue` (plain-литерал по форме элемента) — иначе кнопка «Добавить» создаст пустой элемент без сигналов для полей шаблона.

## Массив рендерится без строк / пустой при добавлении

`initialValue` должен быть **полным** plain-объектом по форме элемента (все поля, что есть в `$template`). Если передать частичный объект (`{ type: 'apartment' }` без `estimatedValue`/`description`), под-модель нового элемента не получит сигналов для недостающих полей и они не отрендерятся. `initialValue` клонируется через `JSON.parse(JSON.stringify(...))` — только сериализуемые значения, никакого FieldConfig.

## Toggle-видимость секции массива

Условный показ секции (напр. массив `properties` виден только когда `hasProperty === true`) делается **не** кастомным блоком, а через `renderBehavior`:

```typescript
import { hideWhen } from '@reformer/renderer-react';

const renderBehavior: RenderBehaviorFn<MyForm> = (schema) => {
  hideWhen(schema.node('properties-array'), () => model.signalAt('hasProperty').value !== true);
};
```

`renderBehavior` передаётся пропом в `JsonFormRenderer`; узел адресуется по своему `selector`.

## See also

- [01-overview.md](01-overview.md)
- [02-json-schema.md](02-json-schema.md)
- [03-registry.md](03-registry.md)
- [05-cookbook.md](05-cookbook.md)
