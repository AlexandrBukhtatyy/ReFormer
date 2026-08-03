# Troubleshooting / FAQ

## Component "X" not found in registry

Имя из оператора `$component(X)` (или `$dataSource(X)`) не зарегистрировано в реестре. Проверь:

- `defineRegistry` действительно содержит `reg.component('X', ...)` или `reg.dataSource('X', ...)`.
- В схеме используется оператор, а не голая строка: `component: '$component(X)'`, а не `component: 'X'`.
- `JsonFormRenderer` обёрнут в `JsonRendererProvider` с этим реестром.
- Если используются вложенные провайдеры — реестр внутреннего провайдера наследуется через `withParent`, но дубли разрешаются в пользу внешнего.

## Field renders without label/error

Не зарегистрирован контейнер с ключом `FIELD_WRAPPER`. Добавь:

```typescript
import { FIELD_WRAPPER } from '@reformer/renderer-json';
import { FormField } from '@reformer/ui-kit';

reg.component(FIELD_WRAPPER, FormField);
```

## No model signal for "..." / `model` prop is required

Два разных симптома одной причины — модель.

- `JsonFormRenderer: `model` prop is required (M1)` — не передана модель. Под M1 листья схемы биндятся к сигналам `FormModel`; передай её пропом: `<JsonFormRenderer schema={schema} model={model} />`.
- `[JsonRenderer/M1] No model signal for "path"` (warn) — путь в `$model(path)` не соответствует структуре модели. Проверь: `value: '$model(personalData.firstName)'` — поле `firstName` реально существует внутри `personalData` в `createModel(...)` initial-значениях.

## Сырой контрол UI-kit пишет в модель событие вместо значения

Контрол зарегистрирован по имени и рендерится, но в модель уезжает не то: у `Checkbox` — DOM-событие вместо `boolean`, у `Radio` — событие вместо строки. Причина: рендерер отдаёт полю value-based seam (`value` + `onChange(value)`), а сырой контрол ждёт свой диалект (`checked` + `onChange(event)` и т.п.). (У `Select` значение приходит **первым** аргументом `onChange(value, option)` и пишется верно — лишний `option` обработчик отбрасывает сам; адаптер ему нужен лишь чтобы не протёк проп `control` в DOM.) Не оборачивай каждый контрол — зарегистрируй `FieldAdapter` через `resolveFieldAdapter`, и рендерер сам переложит seam на диалект контрола:

```tsx
<JsonRendererProvider
  settings={{
    registry,
    model,
    resolveFieldAdapter: (component) => {
      if (component === Checkbox)
        return { valueProp: 'checked', fromEmit: (e) => (e as any).target.checked, toValue: (v) => v ?? false };
      if (component === Radio) return { fromEmit: (e) => (e as any).target.value };
      return undefined; // текстовые / уже value-based контролы — seam как есть
    },
  }}
>
  <JsonFormRenderer<MyForm> schema={schema} />
</JsonRendererProvider>
```

`resolveFieldAdapter` — поле `RendererSettings` (рядом с `fieldWrapper`); renderer-json наследует его без изменений кода и прокидывает через `JsonRendererProvider settings` в рендерер. Вернул `undefined` → контрол получает seam как есть (обратная совместимость, прежнее поведение). Полный контракт `FieldAdapter` (`valueProp`/`changeProp`/`fromEmit`/`toValue`/`bindBlur`/`strip`) — в cookbook `@reformer/renderer-react`.

## componentProps string passes through as plain string

Строка `'$dataSource(NAME)'` в `componentProps` ссылается на source, который не зарегистрирован — конвертер оставляет её как есть. Используй `reg.dataSource('NAME', value)` либо передавай значение литералом напрямую. Голые строки (без `$dataSource(...)`) намеренно не резолвятся — это обычные значения пропа (`label`, `placeholder`).

## useJsonRendererSettings throws outside provider

`useJsonRendererSettings` в dev-режиме бросает, если вызван вне `JsonRendererProvider` **или** если в провайдере не передан `registry`. Оберни вызывающий компонент в провайдер с реестром.

## "version" missing / invalid schema (при validate)

`validateSchema={true}` прогоняет схему через мета-схему (ajv) + обход имён операторов. Типичные ошибки: узел не подходит ни под field/array/container (нет ни `value`, ни `array`+`item`, ни `component`), голая строка вместо оператора, неизвестное `$component(...)`/`$dataSource(...)` имя. Ошибки рисуются в `SchemaErrorPanel` вместо формы. `$model(...)`-пути мета-схема не проверяет (только синтаксис) — они динамичны.

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

## console.warn: `schema.node(...)` адресует неизвестный selector

`schema.node('typo')` не нашёл узла с таким `selector` — рендерер пишет в консоль `console.warn` и перечисляет все известные селекторы схемы. Обычно это промах/опечатка в `selector` внутри `renderBehavior`: имя в `schema.node(...)` не совпадает с тем, что реально задано узлу в схеме (`selector: 'properties-array'`). Как чинить:

- Сверь строку в `schema.node('...')` с `selector` целевого узла — регистр и дефисы должны совпадать буква в букву.
- Убедись, что узлу вообще задан `selector` (без него узел не адресуется — см. «Behavior selector matches nothing»).
- Возьми правильное имя из списка известных селекторов, который печатает сам warn.

Промах не роняет форму, но behavior (`hideWhen`/`patchProps`) молча ни к чему не применяется — поэтому warn стоит воспринимать как ошибку конфигурации, а не как шум.

## dev-warn: нестабильный `renderBehavior`

Если ссылка на `renderBehavior` меняется между рендерами (новая функция на каждый рендер родителя), рендерер в dev-режиме предупреждает о нестабильном `renderBehavior`. Причина — behavior пересобирается на каждый проход и перевешивает реактивные связи впустую. Держи ссылку стабильной:

- объяви функцию `const` на уровне модуля (как в примере «Toggle-видимость секции массива» выше), если она не замыкает пропсы/стейт;
- либо оберни в `useMemo` / `useCallback` с корректными зависимостями, если behavior обязан замыкать что-то из компонента.

```tsx
// стабильно: не пересоздаётся на каждый рендер
const renderBehavior = useCallback<RenderBehaviorFn<MyForm>>(
  (schema) => {
    hideWhen(schema.node('properties-array'), () => model.signalAt('hasProperty').value !== true);
  },
  [model],
);

<JsonFormRenderer<MyForm> form={jsonForm} renderBehavior={renderBehavior} />;
```

## Битая схема при выключенном `validateSchema` → `SchemaErrorPanel`, а не белый экран

Раньше при `validateSchema={false}` (или когда валидатор отключён) ошибка в структуре схемы во время конвертации/рендера роняла поддерево — пользователь видел белый экран без диагностики. Теперь такой сбой перехватывает `SchemaErrorBoundary` и рисует `SchemaErrorPanel` с описанием проблемы — как и при `validateSchema={true}`. То есть панель ошибки схемы показывается в обоих режимах; `validateSchema={true}` лишь ловит проблему раньше и подробнее (мета-схема ajv + обход имён операторов, см. «"version" missing / invalid schema»), а выключенный флаг больше не превращает битую схему в пустую страницу.

## See also

- [01-overview.md](01-overview.md)
- [02-json-schema.md](02-json-schema.md)
- [03-registry.md](03-registry.md)
- [05-cookbook.md](05-cookbook.md)
