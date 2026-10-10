# Troubleshooting / FAQ

## Component "X" not found in registry

Имя из оператора `$component(X)` (или `$dataSource(X)`) не зарегистрировано в реестре. Проверь:

- `defineRegistry` действительно содержит `reg.component('X', ...)` или `reg.dataSource('X', ...)`.
- В схеме используется оператор, а не голая строка: `component: '$component(X)'`, а не `component: 'X'`.
- В сборку ушёл именно этот реестр: `createForm({ schema, registry })`. Если реестров несколько — `composeRegistries(base, own)`, при дублях имени выигрывает последний. На прежнем пути (`JsonFormRenderer`) реестр приходит пропом `registry`, бандлом `form` либо из `JsonRendererProvider`; при вложенных провайдерах выигрывает **внутренний**.
- Прежние имена `FormArray` / `FormArraySection` реестр понимает сам — как псевдонимы `FieldArray` / `FieldArraySection` (в dev — предупреждение `Компонент "FormArray" переименован в "FieldArray"`). Ошибка «not found» для них значит, что в реестре нет и записи под новым именем.

## Field renders without label/error

Не зарегистрирован контейнер с ключом `FIELD_WRAPPER`. Добавь:

```typescript
import { FIELD_WRAPPER } from '@reformer/renderer-json';
import { FormField } from '@reformer/ui-kit';

reg.component(FIELD_WRAPPER, FormField);
```

Сборка кладёт обёртку из реестра в бандл, `FormRenderer` берёт её оттуда (проп `settings.fieldWrapper` её перекрывает).

## No model signal / `createForm: нужна модель`

Два разных симптома одной причины — модель.

- `[@reformer/core] createForm: нужна модель — model либо initial` — сборке не передана модель. Передай `model: createMyModel()` либо `initial: { … }`.
- `[JsonRenderer/M1] No model signal for "path"` (warn) — путь в `$model(path)` не соответствует структуре модели. Проверь: `model: '$model(personalData.firstName)'` — поле `firstName` реально существует внутри `personalData` в начальных значениях модели. Внутри шаблона строки и части путь считается от строки/группы.
- `"$model(x)" is not an array of the model` / `is not a group of the model` — узел с `item` привязан не к массиву (или начальное значение массива — `null`), узел с `part` — не к объекту.

## Сырой контрол UI-kit пишет в модель событие вместо значения

Контрол зарегистрирован по имени и рендерится, но в модель уезжает не то: у `Checkbox` — DOM-событие вместо `boolean`, у `Radio` — событие вместо строки. Причина: рендерер отдаёт полю value-based seam (`value` + `onChange(value)`), а сырой контрол ждёт свой диалект (`checked` + `onChange(event)` и т.п.). (У `Select` значение приходит **первым** аргументом `onChange(value, option)` и пишется верно — лишний `option` обработчик отбрасывает сам.) Не оборачивай каждый контрол — задай `FieldAdapter` через `resolveFieldAdapter`, и рендерер сам переложит seam на диалект контрола:

```tsx
<FormRenderer
  form={bundle}
  settings={{
    resolveFieldAdapter: (component) => {
      if (component === Checkbox)
        return { valueProp: 'checked', fromEmit: (e) => (e as any).target.checked, toValue: (v) => v ?? false };
      if (component === Radio) return { fromEmit: (e) => (e as any).target.value };
      return undefined; // текстовые / уже value-based контролы — seam как есть
    },
  }}
/>
```

`resolveFieldAdapter` — поле `RendererSettings` (рядом с `fieldWrapper`). На прежнем пути его передают в `JsonRendererProvider settings` — `JsonRendererSettings` наследует его без изменений. Вернул `undefined` → статика компонента `reformerAdapter`, без неё — seam как есть. Полный контракт `FieldAdapter` (`valueProp`/`changeProp`/`fromEmit`/`toValue`/`bindBlur`/`strip`) — в cookbook `@reformer/renderer-react`.

## componentProps string passes through as plain string

Строка `'$dataSource(NAME)'` в `componentProps` ссылается на source, который не зарегистрирован — конвертер оставляет её как есть. Используй `reg.dataSource('NAME', value)` либо передавай значение литералом напрямую. Голые строки (без `$dataSource(...)`) намеренно не резолвятся — это обычные значения пропа (`label`, `placeholder`).

## The document is in the previous JSON schema format

У документа нет `format: 2` (ключи `value` / `array`, шаги в `componentProps.steps`), а собирает его `createForm`. Переведи его `migrateJsonSchema(document)` — функция чистая, документ формата 2 возвращает как есть. Обратная ошибка — `createJsonForm: документ схемы — формата 2`: документ формата 2 собирает `createForm({ model, schema, registry })`, а не `createJsonForm`.

## useJsonRendererSettings throws outside provider

Только прежний путь. `useJsonRendererSettings` в dev-режиме бросает, если вызван вне `JsonRendererProvider` **или** если в провайдере не передан `registry`. Оберни вызывающий компонент в провайдер с реестром. Сборке `createForm` провайдер не нужен — реестр уходит в неё явно.

## Invalid schema (при проверке документа)

`validateFormSchema(schema, { registry })` из `@reformer/renderer-json/validate` прогоняет документ через мета-схему (ajv) + обход имён операторов. Типичные ошибки: узел не подходит ни под поле/массив/подформу/контейнер, голая строка вместо оператора, неизвестное `$component(...)`/`$dataSource(...)` имя, необъявленная часть `$part(...)`, неполный `initialValue`, несобранная ссылка на шаг. Ошибки рисует `SchemaErrorPanel`. `$model(...)`-пути мета-схема не проверяет (только синтаксис) — они динамичны. На прежнем пути то же делает проп `validateSchema` у `JsonFormRenderer`.

## Behavior selector matches nothing

`hideWhen`/`patchProps` ищут узел по `selector`. Убедись, что у узла он явно задан (`selector: 'mortgage-section'`), и что значение совпадает с тем, на которое смотрит поведение. `selector` — plain-строка, НЕ оператор. Узлы внутри шаблона строки и именованной части лежат в своих областях: их адресует поведение строки (`applyEach(model.$.items, rowBehavior)`) или подформы (`apply(model.$.group, groupBehavior)`), а не корневое.

## Шаблон строки массива не рендерит строки

Проверь:

- Узел несёт `model: '$model(path)'` **и** `item` (`{ $template: <JsonNode> }` либо `'$part(name)'`) — иначе `isArrayNode` вернёт false, и узел станет полем.
- Внутри шаблона пути `$model(...)` заданы **относительно строки** (`model: '$model(type)'`, а не `'$model(properties.0.type)'`).
- Шаблон новой строки объявлен в модели — `arrayOf(blank)` — либо узел несёт `initialValue`. Без обоих «Добавить» бросает ошибку про шаблон.

## Массив рендерится без полей / пустой при добавлении

`initialValue` должен быть **полным** plain-объектом по форме элемента (все поля, что есть в шаблоне) — это проверяет `validateFormSchema`. Если передать частичный объект (`{ type: 'apartment' }` без `estimatedValue`/`description`), под-модель нового элемента не получит сигналов для недостающих полей и они не отрендерятся. Надёжнее шаблон в модели — `arrayOf(blankProperty)`.

## Toggle-видимость секции массива

Условный показ секции (напр. массив `properties` виден только когда `hasProperty === true`) делается **не** кастомным блоком, а правилом узла в поведении формы:

```typescript
import { defineFormBehavior, hideWhen } from '@reformer/core/behaviors';

export const formBehavior = defineFormBehavior<MyForm>(({ model, schema }) => {
  hideWhen(schema.node('properties-array'), () => model.hasProperty !== true);
});
```

Поведение уходит в сборку полем `behavior`; узел адресуется по своему `selector`.

## console.warn: поведение обращается к узлам, которых нет в дереве

`createForm` в dev сверяет адресованные через `schema.node(...)` селекторы с деревом и пишет «поведение обращается к узлам схемы, которых нет в корневом дереве: "…"». Обычно это опечатка в `selector` внутри поведения либо узел строки/части, адресованный из корневого поведения. Как чинить:

- Сверь строку в `schema.node('...')` с `selector` целевого узла — регистр и дефисы должны совпадать буква в букву.
- Убедись, что узлу вообще задан `selector` (без него узел не адресуется — см. «Behavior selector matches nothing»).
- Узел строки или подформы адресуй из их поведения (`applyEach` / `apply`).

Промах не роняет форму, но правило молча ни к чему не применяется — поэтому warn стоит воспринимать как ошибку конфигурации, а не как шум. На прежнем пути `JsonFormRenderer` пишет похожее: «`schema.node(...)` адресует неизвестный selector» с перечнем известных селекторов.

## dev-warn: нестабильный `renderBehavior`

Только прежний путь (`JsonFormRenderer`). Если ссылка на `renderBehavior` меняется между рендерами (новая функция на каждый рендер родителя), рендерер в dev-режиме предупреждает: дерево пересобирается на каждый проход. Держи ссылку стабильной — задавай фабрику полем `renderBehavior` конфига `createJsonForm` (бандл собран один раз, ссылка стабильна по построению) либо объявляй функцию `const` на уровне модуля. В сборке `createForm` отдельного `renderBehavior` нет — правила узлов в поведении формы.

## Битая схема → `SchemaErrorPanel`, а не белый экран

Ошибку рендера дерева из документа перехватывает `SchemaErrorBoundary` и рисует `SchemaErrorPanel` с описанием проблемы. В сборке `createForm` граница приходит в бандле от реестра (`bundle.render.errorBoundary`), и `FormRenderer` оборачивает ею дерево. Ошибку **сборки** (неизвестный `$component` бросает конвертер при `createForm`) граница рендера не ловит — проверяй документ до сборки `validateFormSchema` (см. «Invalid schema») и показывай `SchemaErrorPanel` вместо формы, как эталон `complex-multy-step-form-renderer-json`.

## See also

- [01-overview.md](01-overview.md)
- [02-json-schema.md](02-json-schema.md)
- [03-registry.md](03-registry.md)
- [05-cookbook.md](05-cookbook.md)
- [10-format-2.md](10-format-2.md)
