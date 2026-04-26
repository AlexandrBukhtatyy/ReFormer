# Cookbook

Продвинутые рецепты для `@reformer/renderer-json`. Каждый рецепт описан на актуальном API: source-резолв и `$template` реализованы в [json-to-render-schema.ts](../../src/converter/json-to-render-schema.ts), реестр — в [component-registry.ts](../../src/registry/component-registry.ts).

## $template для массивов { #template-arrays }

**Problem.** В JSON нельзя выразить функцию `(itemPath) => RenderNode`, которая нужна для item-шаблона `RendererFormArraySection`/любого FormArray-контейнера. JSON остаётся декларативным, шаблон — декларативным.

**Solution.** Любой проп со значением `{ $template: <JsonNode> }` конвертер оборачивает в функцию `(itemPath, ...) => RenderNode`. Внутри шаблона `selector` (или `model`) указывает путь **относительно `itemPath`**, переданного контейнером — типичный кейс для `Property`, `ExistingLoan`, `CoBorrower`.

```typescript
{
  selector: 'properties-array',
  component: 'RendererFormArraySection',
  componentProps: {
    title: 'Имущество',
    control: 'properties',                // string → FieldPathNode (см. рецепт ниже)
    itemLabel: 'PROPERTY_ITEM_LABEL_SOURCE_FN',
    addButtonLabel: '+ Добавить имущество',
    itemComponent: {
      $template: {
        component: 'Box',
        componentProps: { className: 'space-y-3' },
        children: [
          { selector: 'type', component: 'Select',
            componentProps: { label: 'Тип', options: 'PROPERTY_TYPES' } },
          { selector: 'description', component: 'Textarea',
            componentProps: { label: 'Описание', rows: 2 } },
          { selector: 'estimatedValue', component: 'Input',
            componentProps: { label: 'Стоимость', type: 'number' } },
        ],
      },
    },
  },
}
```

**Notes.**
- Резолв пути работает так: `transformPropValue` встречает `{ $template }` и возвращает `(...args) => convertNode(template, args[0], registry)`. `args[0]` — `FieldPath<Item>`, который контейнер обязан передать первым аргументом (это контракт `RendererFormArraySection`).
- Внутри template путь к полю задаётся через `selector` без префикса parent-пути (`'type'`, не `'properties[0].type'`). Конвертер достаёт `itemPath.type` из переданного `args[0]`.
- В template можно вкладывать любые контейнеры (`Box`, `Section`, под-таблицы), но не другой `$template`-уровень того же массива — для вложенного массива нужен новый `RendererFormArraySection` с своим `$template`.
- Если сам контейнер не получает `itemPath` первым аргументом (нестандартный компонент) — `$template` всё равно сработает, но `selector` внутри будет резолвиться от корня формы; обычно это не то, что нужно.
- Эталон: блок `properties-array` в [json-schema.ts](../../../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.ts).

## Source-функции

**Problem.** Нужно передать в проп функцию (например `itemLabel: (form, index) => string`) или React-компонент (`LoadingComponent: LoadingState`) — а JSON хранит только примитивы и объекты.

**Solution.** Регистрируешь значение через `reg.source('NAME', value)`, в JSON-схеме ссылаешься строкой. Конвертер при обходе `componentProps` подставит зарегистрированное значение. Если source — функция, то она оборачивается так: возвращаемый ею `JsonNode` автоматически конвертируется в `RenderNode` (то же, что делает `$template`).

```typescript
import { defineRegistry } from '@reformer/renderer-json';
import { LoadingState } from './LoadingState';

const registry = defineRegistry((reg) => {
  // 1. Константа: массив options.
  reg.source('LOAN_TYPES', [
    { value: 'consumer', label: 'Потребительский' },
    { value: 'mortgage', label: 'Ипотека' },
  ]);

  // 2. React-компонент как source (для AsyncBoundary.LoadingComponent).
  reg.source('LoadingState', LoadingState);

  // 3. Функция: itemLabel для FormArraySection.
  reg.source(
    'PROPERTY_ITEM_LABEL_SOURCE_FN',
    (_, index: number) => `Имущество #${index + 1}`,
  );

  // 4. Computed-константа.
  reg.source('CURRENT_YEAR_PLUS_ONE', new Date().getFullYear() + 1);
});
```

```typescript
// В JSON-схеме:
{
  selector: 'data-boundary',
  component: 'AsyncBoundary',
  componentProps: {
    status: 'loading',
    LoadingComponent: 'LoadingState',                    // → React-компонент
  },
  children: [
    { selector: 'loanType', component: 'Select',
      componentProps: { options: 'LOAN_TYPES' } },        // → массив
    { selector: 'carYear', component: 'Input',
      componentProps: { type: 'number', max: 'CURRENT_YEAR_PLUS_ONE' } }, // → число
  ],
}
```

**Notes.**
- Резолв строки в source происходит только если строка зарегистрирована. Если имени в реестре нет — строка останется строкой (никакой ошибки), что часто становится молчаливым багом. Перепроверь имя при «приходит литерал вместо значения».
- Source-функция, возвращающая объект, **не** конвертируется автоматически — только если результат «выглядит как `JsonNode`» (есть `model: string` или `component: string`). Для функций-итем-лейблов (возвращают строку) — никаких сюрпризов.
- Source нельзя использовать как имя `component` в самом узле (`{ component: 'LoadingState' }` вне source-проп будет ошибкой `Entry "..." is a 'source' and cannot be used as component`). Source — только для значений в `componentProps`.
- Эталон: реестр [registry.ts](../../../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/registry.ts).

## Control-пропсы

**Problem.** Нужно передать в компонент ссылку на FieldPath (например, `RendererFormArraySection` принимает `control={form.properties}`, FormWizard — `control={form}` для какого-то поля). Из JSON это нельзя сделать напрямую, потому что `FieldPathNode` строится на старте `RenderSchemaFn`.

**Solution.** Конвертер по специальному правилу резолвит **строку** в `componentProps` к `FieldPathNode`, если ключ называется `control` или оканчивается на `Control` (`amountControl`, `dateRangeControl`).

```typescript
{
  selector: 'properties-array',
  component: 'RendererFormArraySection',
  componentProps: {
    title: 'Имущество',
    control: 'properties',                       // → path.properties (FieldPathNode)
    itemLabel: 'PROPERTY_ITEM_LABEL_SOURCE_FN',
    itemComponent: { $template: { /* ... */ } },
  },
}
```

Для составных путей и индексов используется тот же синтаксис, что у `model`:

```typescript
{
  component: 'CityHint',
  componentProps: {
    cityControl: 'registrationAddress.city',         // вложенное поле
    primaryAddressControl: 'addresses[0]',           // элемент массива
  },
}
```

**Notes.**
- Правило срабатывает только когда (а) ключ — `control` или `*Control` и (б) значение — строка. Для других ключей строка пойдёт через source-резолв, и если имя в реестре есть — подставится source-значение.
- Если путь не существует в форме (`'addresses[0].city'` при пустом массиве) — `getFieldPathNode` бросит `Invalid field path: "..." - segment "..." not found` уже на этапе конверсии. Это значит: `control` на динамические индексы не работает, для item-полей пользуйся `$template`.
- Параметр прокидывается как `FieldPathNode<unknown, unknown, unknown>` — компонент должен сам кастить к нужному типу или принимать `FieldPathNode<unknown>`.

## Migration from TS RenderSchema

**Problem.** Есть готовая `RenderSchemaFn<T>` (TS-вариант с `path.email`, React-компонентами по ссылке) — нужно перенести её в JSON-схему. Ниже — точное соответствие конструкций.

**Solution.** Покомпонентная карта замен.

| TS RenderSchema (`@reformer/renderer-react`) | JSON-схема (`@reformer/renderer-json`) |
|---|---|
| `{ component: path.email }` | `{ model: 'email' }` или `{ selector: 'email', component: 'Input' }` |
| `{ component: path.personalData.firstName }` | `{ model: 'personalData.firstName', component: 'Input' }` |
| `{ component: path.addresses[0].city }` | `{ model: 'addresses[0].city', component: 'Input' }` |
| `{ component: Box, componentProps: { className: 'grid', children: [...] } }` *(старый стиль)* или `{ component: Box, children: [...] }` | `{ component: 'Box', componentProps: { className: 'grid' }, children: [...] }` |
| `{ component: Section, componentProps: { title: 'X' }, children: [...] }` | `{ component: 'Section', componentProps: { title: 'X' }, children: [...] }` |
| `{ selector: 'mortgage-section', component: Section, ... }` | то же — `selector` сохраняется |
| `componentProps: { options: LOAN_TYPES }` (импорт константы) | `componentProps: { options: 'LOAN_TYPES' }` + `reg.source('LOAN_TYPES', LOAN_TYPES)` |
| `componentProps: { LoadingComponent: LoadingState }` | `componentProps: { LoadingComponent: 'LoadingState' }` + `reg.source('LoadingState', LoadingState)` |
| `componentProps: { control: path.properties, itemLabel: (_, i) => '#' + i, itemComponent: (itemPath) => ({ ... }) }` | `componentProps: { control: 'properties', itemLabel: 'NAME_FN', itemComponent: { $template: { ... } } }` + `reg.source('NAME_FN', fn)` |
| `createCreditApplicationRenderBehavior(form)(schema)` (поведение в TS) | то же поведение — переиспользуется как есть, через `JsonFormSchema → createRenderSchemaFromJson → behavior(schema)` |

```typescript
// До: TS RenderSchema
const schema: RenderSchemaFn<MyForm> = (path) => ({
  component: Box,
  componentProps: {
    className: 'space-y-4',
    children: [
      { component: path.email, componentProps: { label: 'Email' } },
      { component: Section, componentProps: { title: 'Адрес', children: [
        { component: path.address.city },
      ] } },
    ],
  },
});

// После: JSON
const schema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: 'Box',
    componentProps: { className: 'space-y-4' },
    children: [
      { model: 'email', component: 'Input', componentProps: { label: 'Email' } },
      {
        component: 'Section',
        componentProps: { title: 'Адрес' },
        children: [{ model: 'address.city', component: 'Input' }],
      },
    ],
  },
};

const registry = defineRegistry((reg) => {
  reg.field('Input', Input);
  reg.container('Box', Box);
  reg.container('Section', Section);
  reg.container(FIELD_WRAPPER, FormField);
});
```

**Notes.**
- В TS-варианте часто `children` лежат в `componentProps.children` исторически — это работает, но в JSON `children` всегда вне `componentProps` (отдельное поле `JsonNode.children`).
- `field`-узлы и `container`-узлы взаимоисключающи: либо `model`, либо `children` — нельзя одновременно. Если ошибочно поставить и `model`, и `children`, конвертер развернёт `model` (поле), а `children` молча проигнорирует.
- Поведение (`hideWhen`, `onComponentEvent`, lifecycle) **не** переезжает в JSON — оно остаётся TS-функцией `RenderBehaviorFn<T>` и применяется к финальной `RenderSchemaProxy` после `createRenderSchemaFromJson`. Полный пример организации — [CreditApplicationFormRendererJson](../../../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/).
- `createRenderSchema` оборачивает результат `createRenderSchemaFromJson` в Proxy — без этого `proxy.node(selector)` и behavior-helpers работать не будут.

## See also

- [02-json-schema.md](02-json-schema.md) — справочник по полям `JsonNode`.
- [03-registry.md](03-registry.md) — все методы `defineRegistry`.
- [04-troubleshooting.md](04-troubleshooting.md) — типичные ошибки.
