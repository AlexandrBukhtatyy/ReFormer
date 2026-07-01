# Cookbook

Продвинутые рецепты для `@reformer/renderer-json` (M1, строковый операторный DSL). Всё сверено с рабочим кодом: конвертер — [json-to-render-schema.ts](../../src/converter/json-to-render-schema.ts), операторы — [operators.ts](../../src/operators.ts), реестр — [component-registry.ts](../../src/registry/component-registry.ts), эталонная форма — `CreditApplicationFormRendererJson` (monorepo example).

## Монтаж формы из JSON (M1) { #mounting }

**Problem.** JSON-схема статична, а данные и форма — runtime. Нужно связать их без React-glue на каждой странице.

**Solution.** Модель (`FormModel`) — источник данных, форма строится из **той же** JSON-схемы через `convertJsonToM1Tree`, а `JsonFormRenderer` получает модель через `JsonRendererProvider` settings. `JsonFormRenderer` не имеет `form`-пропа (by-design).

```tsx
import { useMemo } from 'react';
import { createForm, createModel } from '@reformer/core';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  convertJsonToM1Tree,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import rawJsonSchema from './json-schema.json';
import { createRegistry } from './registry';

const jsonSchema = rawJsonSchema as unknown as JsonFormSchema; // «схема пришла строкой»

export function MyFormPage() {
  const registry = useMemo(() => createRegistry(), []);
  const { model } = useMemo(() => {
    const model = createModel<MyForm>(initialValues);
    // Форма строится из JSON: конвертер биндит листья к сигналам модели.
    createForm<MyForm>({ model, schema: convertJsonToM1Tree(jsonSchema, registry, model) });
    return { model };
  }, [registry]);

  return (
    <JsonRendererProvider settings={{ registry, model }}>
      <JsonFormRenderer<MyForm> schema={jsonSchema} validate={import.meta.env.DEV} />
    </JsonRendererProvider>
  );
}
```

**Notes.**

- `convertJsonToM1Tree` бросает при битой схеме (неизвестный `$component`) **до** рендера. Оберни в try/catch, если хочешь показать `SchemaErrorPanel` вместо краша (см. `buildModelAndForm` в эталоне).
- `validate={import.meta.env.DEV}` — детекцию dev нельзя «запечь» в пакет; приложение передаёт значение из своего окружения.
- Поведение (compute/enableWhen/navigation) идёт в `createForm({ behavior })`; render-behavior (hideWhen/patchProps/onInit) — отдельным пропом `renderBehavior`.

## $template для массивов { #template-arrays }

**Problem.** В JSON нельзя выразить функцию `(itemPath) => RenderNode` для item-шаблона. Массив должен остаться декларативным.

**Solution.** Array-node несёт `array: '$model(path)'` + `item: { $template: <JsonNode> }` + `initialValue`. Внутри `$template` пути `$model(...)` резолвятся **относительно элемента** массива. Массивы под M1 рендерятся native-веткой конвертера (`{ array, item }`) — отдельный контейнер-компонент не нужен.

```typescript
{
  selector: 'properties-array',
  array: '$model(properties)',
  initialValue: { type: 'apartment', description: '', estimatedValue: 0, hasEncumbrance: false },
  componentProps: {
    title: 'Имущество',
    addButtonLabel: '+ Добавить имущество',
    itemLabel: '$dataSource(PROPERTY_ITEM_LABEL_SOURCE_FN)',
    emptyMessage: 'Нажмите "Добавить имущество"',
  },
  item: {
    $template: {
      component: '$component(Box)',
      componentProps: { className: 'space-y-3' },
      children: [
        { value: '$model(type)', component: '$component(Select)',
          componentProps: { label: 'Тип', options: '$dataSource(PROPERTY_TYPES)' } },
        { value: '$model(estimatedValue)', component: '$component(Input)',
          componentProps: { label: 'Стоимость', type: 'number' } },
        { value: '$model(description)', component: '$component(Textarea)',
          componentProps: { label: 'Описание', rows: 2 } },
      ],
    },
  },
}
```

**Notes.**

- `array` **и** `item.$template` обязательны оба — иначе узел не считается array-node (`isArrayNode`).
- `initialValue` — полный plain-объект по форме элемента (все поля из `$template`). Клонируется через `JSON.parse(JSON.stringify(...))`; не FieldConfig. Частичный `initialValue` → у нового элемента нет сигналов для недостающих полей.
- Внутри `$template` пути относительны элементу (`'$model(type)'`, а не `'$model(properties[0].type)'`).
- Вложенный массив в массиве — новый array-node внутри `$template` со своим `array`/`item`.
- Эталон: блоки `properties`/`existingLoans`/`coBorrowers` в `json-schema.json` (monorepo example).

## dataSource-значения и функции { #datasource }

**Problem.** Нужно передать в проп массив options, функцию (`itemLabel: (form, index) => string`) или React-компонент (`LoadingComponent`) — а JSON хранит только примитивы и объекты.

**Solution.** Регистрируешь значение через `reg.dataSource('NAME', value)`, в JSON-схеме ссылаешься оператором `'$dataSource(NAME)'`. Конвертер при обходе `componentProps` подставит зарегистрированное значение.

```typescript
import { createElement } from 'react';
import { defineRegistry } from '@reformer/renderer-json';
import { LoadingState, ErrorState } from '@reformer/ui-kit';

const registry = defineRegistry((reg) => {
  // 1. Константа: массив options.
  reg.dataSource('LOAN_TYPES', [
    { value: 'consumer', label: 'Потребительский' },
    { value: 'mortgage', label: 'Ипотека' },
  ]);

  // 2. React-компонент как dataSource (для AsyncBoundary.LoadingComponent).
  reg.dataSource('LoadingState', LoadingState);
  reg.dataSource('ErrorStateDefault', () => createElement(ErrorState, { error: 'Ошибка' }));

  // 3. Функция: itemLabel для array-секции.
  reg.dataSource('PROPERTY_ITEM_LABEL_SOURCE_FN', (_form, index: number) => `Имущество #${index + 1}`);

  // 4. Computed-константа.
  reg.dataSource('CURRENT_YEAR_PLUS_ONE', new Date().getFullYear() + 1);
});
```

```typescript
// В JSON-схеме — ссылки операторами:
{
  selector: 'data-boundary',
  component: '$component(AsyncBoundary)',
  componentProps: {
    status: 'loading',
    LoadingComponent: '$dataSource(LoadingState)',       // → React-компонент
    ErrorComponent: '$dataSource(ErrorStateDefault)',
  },
  children: [
    { value: '$model(loanType)', component: '$component(Select)',
      componentProps: { options: '$dataSource(LOAN_TYPES)' } },   // → массив
    { value: '$model(carYear)', component: '$component(Input)',
      componentProps: { type: 'number', max: '$dataSource(CURRENT_YEAR_PLUS_ONE)' } }, // → число
  ],
}
```

**Notes.**

- Резолв происходит только для строк `'$dataSource(NAME)'`. Голые строки (`label`, `placeholder`) и инлайн-массивы options идут как есть.
- Если имя не зарегистрировано: без `validate` строка `'$dataSource(NAME)'` останется строкой (молчаливый баг); с `validate` — ошибка `unknown dataSource "NAME"`.
- dataSource нельзя использовать как имя `component` (`component: '$component(LoadingState)'`, где `LoadingState` — dataSource, бросит `Entry "..." is a 'dataSource' and cannot be used as $component(...)`). dataSource — только для значений в `componentProps`.
- Эталон: `registry.ts` (monorepo example).

## Инъекция runtime-сущностей в компонент (form, validation) { #inject-runtime }

**Problem.** Компоненту (напр. wizard) нужен `FormProxy` или validation-конфиг — рантайм-сущности, которые нельзя выразить в статичном JSON.

**Solution.** Инжектируй их через `renderBehavior` + `onInit`/`patchProps` до первого рендера. Узел адресуется по `selector`.

```typescript
import { onInit, type RenderBehaviorFn } from '@reformer/renderer-react';

function createMyRenderBehavior(
  form: FormProxy<MyForm>,
  model: FormModel<MyForm>
): RenderBehaviorFn<MyForm> {
  return (schema) => {
    // JSON-схема не знает про FormProxy/валидацию — инъектим их в wizard до первого рендера.
    onInit(schema.node('wizard'), () => {
      schema.node('wizard').patchProps({ form, ...makeValidationConfig(model) });
    });
    // Остальное поведение (visibility/navigation) — из shared render-behavior.
    createSharedRenderBehavior(form)(schema);
  };
}

// <JsonFormRenderer schema={jsonSchema} renderBehavior={createMyRenderBehavior(form, model)} />
```

**Notes.**

- `onInit(node, fn)` — build-time hook, вызывается один раз до первого рендера ноды.
- `patchProps` мержит переданные пропы в `componentProps` ноды.
- Эталон: [render-behavior.ts](../../../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/render-behavior.ts) (monorepo example).

## Migration from TS RenderSchema { #migration }

**Problem.** Есть готовая `RenderSchemaFn<T>` (TS-вариант с `path.email`, React-компонентами по ссылке) — нужно перенести её в JSON-схему.

**Solution.** Покомпонентная карта замен. Ключевое: TS-ссылки (`path.email`, `Box`, `LOAN_TYPES`) → строки-операторы.

| TS RenderSchema (`@reformer/renderer-react`)                                             | JSON-схема (`@reformer/renderer-json`, M1)                                                                 |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `{ value: path.email, component: Input }`                                                | `{ value: '$model(email)', component: '$component(Input)' }`                                               |
| `{ value: path.personalData.firstName, component: Input }`                               | `{ value: '$model(personalData.firstName)', component: '$component(Input)' }`                              |
| `{ component: Box, componentProps: { className: 'grid' }, children: [...] }`             | `{ component: '$component(Box)', componentProps: { className: 'grid' }, children: [...] }`                 |
| `{ component: Section, componentProps: { title: 'X' }, children: [...] }`                | `{ component: '$component(Section)', componentProps: { title: 'X' }, children: [...] }`                    |
| `{ selector: 'mortgage-section', component: Section, ... }`                              | то же — `selector` сохраняется (plain-строка)                                                             |
| `componentProps: { options: LOAN_TYPES }` (импорт константы)                            | `componentProps: { options: '$dataSource(LOAN_TYPES)' }` + `reg.dataSource('LOAN_TYPES', LOAN_TYPES)`      |
| `componentProps: { LoadingComponent: LoadingState }`                                     | `componentProps: { LoadingComponent: '$dataSource(LoadingState)' }` + `reg.dataSource('LoadingState', ...)` |
| `{ array: path.properties, item: (ip) => ({...}), initialValue: () => ({...}) }`         | `{ array: '$model(properties)', item: { $template: {...} }, initialValue: {...} }`                          |

```typescript
// После: JSON
const schema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [
      { value: '$model(email)', component: '$component(Input)', componentProps: { label: 'Email' } },
      {
        component: '$component(Section)',
        componentProps: { title: 'Адрес' },
        children: [{ value: '$model(address.city)', component: '$component(Input)' }],
      },
    ],
  },
};

const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Box', Box);
  reg.component('Section', Section);
  reg.component(FIELD_WRAPPER, FormField);
});
```

**Notes.**

- В JSON `children` всегда отдельное поле узла (не `componentProps.children`).
- field/array/container взаимоисключающи: `value` → лист, `array`+`item` → массив, `component`+`children` → контейнер. Дискриминация в конвертере: array → field → container.
- Поведение (`hideWhen`, `onInit`, lifecycle) **не** переезжает в JSON — остаётся TS-функцией `RenderBehaviorFn<T>` и передаётся пропом `renderBehavior`. В эталоне TS- и JSON-варианты переиспользуют один shared behavior.

## See also

- [01-overview.md](01-overview.md) — монтаж через `model` + `JsonRendererProvider`.
- [02-json-schema.md](02-json-schema.md) — справочник по узлам `JsonNode` и операторам.
- [03-registry.md](03-registry.md) — все методы `defineRegistry`.
- [04-troubleshooting.md](04-troubleshooting.md) — типичные ошибки.
