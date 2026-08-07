# Cookbook

Продвинутые рецепты для `@reformer/renderer-json` (M1, строковый операторный DSL). Всё сверено с рабочим кодом: конвертер — [json-to-render-schema.ts](../../src/converter/json-to-render-schema.ts), операторы — [operators.ts](../../src/operators.ts), реестр — [component-registry.ts](../../src/registry/component-registry.ts).

## Монтаж формы из JSON (M1) { #mounting }

**Problem.** JSON-схема статична, а данные и форма — runtime. Нужно связать их без React-glue на каждой странице.

**Solution.** Модель (`FormModel`) — источник данных, форма строится из **той же** JSON-схемы через `convertJsonToM1Tree`, а `JsonFormRenderer` получает `schema` + `model` пропами. Это низкоуровневый (ручной) путь: схема передаётся дважды — конвертеру и рендереру, а «собрать ровно один раз» держится на комментарии в прикладном коде. `JsonFormRenderer` принимает **либо** пару `schema` + `model` (как здесь), **либо** готовый бандл `form={jsonForm}` — рекомендуемый одно-проходный способ, см. [«Сборка формы одним проходом»](#one-pass).

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
    <JsonRendererProvider settings={{ registry }}>
      <JsonFormRenderer<MyForm> schema={jsonSchema} model={model} validateSchema={import.meta.env.DEV} />
    </JsonRendererProvider>
  );
}
```

**Notes.**

- `convertJsonToM1Tree` бросает при битой схеме (неизвестный `$component`) **до** рендера. Оберни в try/catch, если хочешь показать `SchemaErrorPanel` вместо краша (см. `buildModelAndForm` в эталоне).
- `validateSchema={import.meta.env.DEV}` — детекцию dev нельзя «запечь» в пакет; приложение передаёт значение из своего окружения.
- Поведение (compute/enableWhen/navigation) идёт в `createForm({ behavior })`; render-behavior (hideWhen/patchProps/onInit) — отдельным пропом `renderBehavior`.
- Ручная сборка выше — низкоуровневый путь. Рекомендуемый — собрать всё одним проходом через `createJsonForm` и отдать бандлом `form={jsonForm}`, см. [ниже](#one-pass).

## Сборка формы одним проходом { #one-pass }

**Problem.** Ручной монтаж (см. выше) передаёт схему дважды: в `convertJsonToM1Tree` (для `createForm`) и пропом `schema` в `JsonFormRenderer`. Две несвязанные передачи одного артефакта легко разъезжаются (рендереру уходит не та схема/модель), а «собрать ровно один раз» держится на комментарии. Плюс `useMemo` для сборки модели/формы ненадёжен: React вправе сбросить его кэш и пересоздать форму → потеря введённого.

**Solution.** `createJsonForm<T>({ schema, registry, initial | model, behavior? })` собирает всё за один проход и возвращает бандл `{ model, form, schema, registry }`. Хук `useJsonForm(factory)` делает сборку стабильной (ленивый `useState` — фабрика зовётся ровно один раз). Бандл целиком отдаётся рендереру пропом `form` — `schema` и `model` он берёт из него.

```tsx
import { useMemo } from 'react';
import {
  createJsonForm,
  useJsonForm,
  defineJsonSchema,
  JsonFormRenderer,
  JsonRendererProvider,
} from '@reformer/renderer-json';
import { createRegistry } from './registry';
import { formBehavior } from './behavior';

interface CreditForm {
  loanType: string;
  personalData: { firstName: string };
}
const INITIAL: CreditForm = { loanType: 'consumer', personalData: { firstName: '' } };

// defineJsonSchema<T> типизирует пути $model(...): $model(personalData.firstName) — ок,
// а $model(personalData.firstNam) — ошибка компиляции (нет такого пути в CreditForm).
// Не нужен `as unknown as JsonFormSchema`.
const schema = defineJsonSchema<CreditForm>({
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        value: '$model(personalData.firstName)',
        component: '$component(Input)',
        componentProps: { label: 'Имя' },
      },
    ],
  },
});

export function CreditFormPage() {
  const registry = useMemo(() => createRegistry(), []);
  // factory зовётся один раз — model/form переживают ре-рендеры (в отличие от useMemo).
  const jsonForm = useJsonForm(() =>
    createJsonForm<CreditForm>({ schema, registry, initial: INITIAL, behavior: formBehavior })
  );

  return (
    <JsonRendererProvider settings={{ registry }}>
      {/* Проп form поставляет и schema, и model — передавать их отдельно не нужно. */}
      <JsonFormRenderer form={jsonForm} validateSchema={import.meta.env.DEV} />
    </JsonRendererProvider>
  );
}
```

Тот же результат ручной сборкой (схема передаётся дважды, `useMemo` вместо `useJsonForm`) — для сравнения:

```tsx
// Было (ручная сборка): createModel + createForm + convertJsonToM1Tree.
const model = createModel<CreditForm>(INITIAL);
const form = createForm<CreditForm>({
  model,
  schema: convertJsonToM1Tree(schema, registry, model),
  behavior: formBehavior,
});
// ...
<JsonFormRenderer<CreditForm> schema={schema} model={model} />;

// Стало (одним проходом): бандл { model, form, schema, registry } → проп form.
const jsonForm = useJsonForm(() =>
  createJsonForm<CreditForm>({ schema, registry, initial: INITIAL, behavior: formBehavior })
);
// ...
<JsonFormRenderer form={jsonForm} />;
```

**Notes.**

- Модель задаётся **либо** `initial` (создаётся внутри через `createModel`), **либо** готовой `model` (приоритетнее `initial`). Ни того, ни другого — `createJsonForm` бросает.
- `behavior` (compute/copyFrom/enableWhen/onChange модели) уходит в `createForm({ behavior })` внутри — не путать с `renderBehavior` (hideWhen/patchProps/onInit), который по-прежнему отдельный проп `JsonFormRenderer`.
- `JsonFormRenderer` принимает **либо** `form={jsonForm}`, **либо** пару `schema` + `model`. С бандлом отдельные `schema`/`model` не нужны; не задать ни `form`, ни `schema`+`model` — рендерер бросит.
- `useJsonForm(factory)` — стабильная сборка через ленивый `useState`; `factory` вызывается ровно один раз. `useMemo` для сборки формы не годится (React вправе сбросить кэш → потеря введённого).
- `defineJsonSchema<T>` — identity-хелпер: сужает пути `$model(...)` до `Path<T>` (опечатка — ошибка компиляции). Схему-строку-с-сервера (тип формы неизвестен) типизируй `JsonFormSchema` без параметра (`raw as unknown as JsonFormSchema<T>`). Пути внутри `item.$template` относительны элементу и НЕ типизируются.

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

## Display-список из массива модели { #display-list }

**Problem.** В модели — массив объектов (алерты, бейджи, строки-статусы). Нужно отрендерить компонент на каждый элемент и реактивно показывать/скрывать элементы — но БЕЗ редактор-хрома (add/remove/карточки), который тащит обычный array-node.

**Solution.** Тот же array-node + опциональный `component: '$component(List)'`. `List` (`@reformer/ui-kit`) — chrome-less обёртка; `initialValue` не нужен (добавлять нечего). Показ/скрытие — мутация массива в `defineFormBehavior`. `$model(...)` в `componentProps` элемента доходит до компонента значением (рендерер разворачивает сигнал).

```typescript
// schema
{
  selector: 'alerts-list',
  array: '$model(alerts)',
  component: '$component(List)',
  componentProps: { className: 'space-y-2' },
  item: {
    $template: {
      component: '$component(Alert)',
      componentProps: { type: '$model(type)', message: '$model(message)' },
    },
  },
}

// registry
reg.component('List', List);   // @reformer/ui-kit
reg.component('Alert', Alert); // ваш display-компонент { type, message }

// behavior — показ/скрытие = пересборка массива
defineFormBehavior<FormShape>(({ model }) => {
  onChange(model.$.amount, () => {
    model.alerts.clear();
    if (Number(model.amount) > 1_000_000)
      model.alerts.push({ type: 'error', message: 'Превышен лимит' });
  });
});
```

**Notes.**

- Дисплей vs редактирование = выбор компонента, а не тип узла. Без `component` тот же узел рендерится встроенной редактируемой секцией (и требует `initialValue`).
- Компонент-обёртка получает готовые элементы `children` (+ `array`/`item`/`fieldWrapper` — если хочет сам итерировать/добавлять хром).
- Для React/TS (вне JSON) есть headless-примитив `List` из `@reformer/cdk/list` (брат `FormArray` без мутаций) и `useList`.

## dataSource-значения и функции { #datasource }

**Problem.** Нужно передать в проп массив options, функцию (`itemLabel: (form, index) => string`) или React-компонент — а JSON хранит только примитивы и объекты.

**Solution.** Регистрируешь значение через `reg.dataSource('NAME', value)`, в JSON-схеме ссылаешься оператором `'$dataSource(NAME)'`. Конвертер при обходе `componentProps` подставит зарегистрированное значение.

```typescript
import { defineRegistry } from '@reformer/renderer-json';
import { EmptyPlaceholder } from './components/EmptyPlaceholder';

const registry = defineRegistry((reg) => {
  // 1. Константа: массив options.
  reg.dataSource('LOAN_TYPES', [
    { value: 'consumer', label: 'Потребительский' },
    { value: 'mortgage', label: 'Ипотека' },
  ]);

  // 2. React-компонент как значение пропа (не как `component` узла!).
  reg.dataSource('EMPTY_PLACEHOLDER', EmptyPlaceholder);

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
    // AsyncBoundary рисует блоки загрузки и ошибки сам — слот-компоненты регистрировать
    // не нужно; статус и текст ошибки подставляет behavior через patchProps.
    status: 'loading',
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
- Если имя не зарегистрировано: без `validateSchema` строка `'$dataSource(NAME)'` останется строкой (молчаливый баг); с `validateSchema` — ошибка `unknown dataSource "NAME"`.
- dataSource нельзя использовать как имя `component` (`component: '$component(EMPTY_PLACEHOLDER)'`, где `EMPTY_PLACEHOLDER` — dataSource, бросит `Entry "..." is a 'dataSource' and cannot be used as $component(...)`). dataSource — только для значений в `componentProps`.

## Сырые контролы UI-kit без обёрток (FieldAdapter) { #field-adapter }

**Problem.** JSON-реестр удобно наполнять готовыми контролами UI-kit (antd/MUI) прямо по имени: `reg.component('Checkbox', Checkbox)`. Но seam рендерера **value-based** — он читает `value` и зовёт `onChange(value)`. Сырой antd `Checkbox` держит значение в `checked` и эмитит DOM-событие (`onChange(e)`), `Radio` — тоже событие: без перевода в модель попадёт `event`, а не значение. `Select` эмитит `(value, option)` — значение приходит **первым** и пишется в модель верно (лишний `option` отбрасывается сам), но по умолчанию рендерер пробрасывает в контрол `control={fieldNode}`, и сырой antd-контрол разольёт неизвестный проп в DOM с React-warning.

**Solution.** `resolveFieldAdapter(component) => FieldAdapter | undefined` в настройках рендерера. `JsonRendererSettings` наследует его от `RendererSettings`, поэтому адаптер передаётся тем же `JsonRendererProvider settings` и доходит до листового рендерера **без единой строки** в renderer-json (`JsonFormRenderer` спредит `...rendererSettings` в `FormRenderer`). Адаптер резолвится по **резолвнутому** `node.component` (тому, что реестр вернул на `$component(Checkbox)`), поэтому ключуй по ссылке на компонент, а не по имени.

```tsx
import { Checkbox, Select, Radio } from 'antd';
import type { FieldAdapter } from '@reformer/renderer-react';

// Сырые контролы регистрируем по имени — как обычные компоненты.
const registry = defineRegistry((reg) => {
  reg.component('Checkbox', Checkbox);
  reg.component('Select', Select);
  reg.component('Radio', Radio);
  reg.component(FIELD_WRAPPER, FormField);
});

// Перевод value-based seam → диалект контрола держим отдельно
// (данные приложения; ядро остаётся UI-агностичным).
const adapters = new Map<unknown, FieldAdapter>([
  // checked + onChange(event) → e.target.checked; null/undefined → false.
  [Checkbox, { valueProp: 'checked', fromEmit: (e) => (e as any).target.checked, toValue: (v) => v ?? false }],
  // value/onChange уже как надо; пустой адаптер нужен лишь чтобы НЕ прокинуть `control`
  // (второй аргумент onChange(value, option) отбрасывается сам — колбэк берёт только первый).
  [Select, {}],
  // значение приходит в событии.
  [Radio, { fromEmit: (e) => (e as any).target.value }],
]);

<JsonRendererProvider settings={{ registry, resolveFieldAdapter: (c) => adapters.get(c) }}>
  <JsonFormRenderer<MyForm> schema={jsonSchema} model={model} />
</JsonRendererProvider>;
```

В самой JSON-схеме ничего особого — лист ссылается на зарегистрированное имя:

```json
{ "value": "$model(agree)", "component": "$component(Checkbox)", "componentProps": { "label": "Согласен" } }
```

**Notes.**

- `resolveFieldAdapter` получает **резолвнутый** `node.component` (React-компонент), а не строку `$component(...)`. Ключуй `Map` по той же ссылке, что отдал в `reg.component`.
- С адаптером `control` в контрол **не** пробрасывается (сырой antd-контрол его не потребляет); `disabled` пробрасывается всегда. Без адаптера — прежний seam (`control` + `value` + `onChange(value)`), полная обратная совместимость.
- Контролам с уже value-based контрактом (`Input`, `Textarea`, собственные поля `@reformer/ui-kit`) адаптер не нужен — верни для них `undefined`.
- Полный справочник полей `FieldAdapter` (`valueProp`/`changeProp`/`fromEmit`/`toValue`/`bindBlur`/`strip`) — в JSDoc типа `FieldAdapter` и кукбуке `@reformer/renderer-react`; здесь важно лишь, что `JsonRendererSettings` наследует `resolveFieldAdapter` без изменений в renderer-json.

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

## Вся форма read-only / view-mode { #readonly }

**Problem.** Нужно показать заполненную форму «только для просмотра» — все поля недоступны для ввода. Тянет искать флаг `settings.readonly` / `settings.mode`.

**Solution.** Такого флага **нет**. Настройки рендерера (`JsonRendererSettings`) — это `registry` + `model` поверх `RendererSettings`, а `RendererSettings` несёт `fieldWrapper` **и** `resolveFieldAdapter` (см. [json-renderer-context.tsx](../../src/context/json-renderer-context.tsx), renderer-react `RendererSettings`) — флага `readonly`/`mode` среди них нет. Read-only задаётся **на уровне модели**: `form.disable()` каскадит `disabled` по всему поддереву — `GroupNode.onDisable()` рекурсивно зовёт `field.disable()` на всех детях, а рендерер пробрасывает per-field `disabled: state.disabled` в компонент. Один вызов на корне → вся форма read-only.

```typescript
// Вариант A — сразу после сборки формы (самый прямой):
const model = createModel<MyForm>(initialValues);
const form = createForm<MyForm>({ model, schema: convertJsonToM1Tree(jsonSchema, registry, model) });
form.disable(); // каскад disabled по всему дереву → вся форма read-only
```

```typescript
// Вариант B — из render-behavior (например, включить view-mode по условию/после загрузки данных):
import { onInit, type RenderBehaviorFn } from '@reformer/renderer-react';

function createReadonlyBehavior(form: FormProxy<MyForm>): RenderBehaviorFn<MyForm> {
  return (schema) => {
    onInit(schema.node('wizard'), () => {
      form.disable(); // корневой FormProxy отдаёт disable() (делегирует в GroupNode)
    });
  };
}
```

**Notes.**

- `form.disable()` — публичный метод узла (`FormNode.disable()`): ставит статус `disabled` и вызывает hook `onDisable`, который у группы каскадит на всех детей рекурсивно. Обратно — `form.enable()`.
- **Caveat:** поле с явным `componentProps.disabled` **перебивает** каскад. Рендерер собирает пропы как `{ value, disabled: state.disabled, ...componentProps }` — спред `componentProps` идёт ПОСЛЕ `disabled`, поэтому `componentProps.disabled: false` вернёт полю доступность даже при `form.disable()`. Не задавай `disabled` в JSON, если хочешь глобальный каскад.
- Отключённые узлы не валидируются и не попадают в `getValue()` — для чистого view-mode это обычно желаемо; если нужен submit disabled-значений, снимай `disable()` перед сбором.
- `settings.readonly` / `settings.mode` не существует — model-level каскад (`form.disable()`) это канонический механизм view-mode.

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
| `componentProps: { placeholderComponent: EmptyPlaceholder }`                             | `componentProps: { placeholderComponent: '$dataSource(EMPTY_PLACEHOLDER)' }` + `reg.dataSource('EMPTY_PLACEHOLDER', ...)` |
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

## Презентационные блоки без регистрации компонентов { #html-nodes }

**Problem.** Заголовки, инфо-плашки, разделители, блок «Итого» с живыми значениями. Через `$component(...)` под каждый такой блок нужен React-компонент и строка в реестре — реестр разрастается кодом, который ничего не делает, кроме вёрстки.

**Solution.** Оператор `$html(tag)` + текст прямо в `children`. В реестре остаются только настоящие компоненты (поля, обёртка поля).

```json
{
  "component": "$html(div)",
  "componentProps": { "className": "space-y-6" },
  "children": [
    {
      "component": "$html(h2)",
      "componentProps": { "className": "text-xl font-bold" },
      "children": ["$locale(installment.title)"]
    },
    {
      "component": "$html(div)",
      "componentProps": { "className": "p-4 bg-blue-50 border border-blue-200 rounded-md" },
      "children": [
        {
          "component": "$html(p)",
          "componentProps": { "className": "text-sm text-blue-800" },
          "children": [
            "Проценты не начисляются. ",
            { "component": "$html(b)", "children": ["Досрочное погашение бесплатно."] }
          ]
        }
      ]
    },
    {
      "value": "$model(amount)",
      "component": "$component(Input)",
      "componentProps": { "label": "Сумма (₽)", "type": "number" }
    },
    { "component": "$html(hr)" },
    {
      "component": "$html(dl)",
      "componentProps": { "className": "grid grid-cols-2 gap-2 text-sm" },
      "children": [
        { "component": "$html(dt)", "children": ["Запрошенная сумма"] },
        {
          "component": "$html(dd)",
          "componentProps": { "className": "font-medium" },
          "children": ["$model(amount)", " ₽ на ", "$model(months)", " мес."]
        }
      ]
    }
  ]
}
```

Реестр при этом сводится к:

```typescript
defineRegistry((reg) => {
  reg.component('Input', InputField);
  reg.component(FIELD_WRAPPER, FormField);
  reg.locale(createLocaleResolver({ 'installment.title': 'Рассрочка' }));
});
```

**Notes.**

- `'$model(...)'` текстовым ребёнком реактивен: рендерер подписывается на сигнал и перерисовывает только текст.
- Вычисляемых выражений в JSON нет — «платёж = сумма / срок» считается `compute`-поведением над моделью, а текст показывает уже готовое поле (`"$model(monthlyPayment)"`).
- Текст, живущий не в модели, а в UI-состоянии (статус отправки), кладётся сигналом в реестр и подставляется как `"$dataSource(SUBMIT_STATUS)"`.
- Whitelist тегов и чистка `componentProps` (обработчики, `javascript:`-URL) описаны в [02-json-schema.md](02-json-schema.md#html-узлы-html-и-текст).
- Живой пример (JSON рядом с типизованной схемой) — `projects/react-playground/src/pages/examples/html-nodes/`.

## See also

- [01-overview.md](01-overview.md) — монтаж через `model` + `JsonRendererProvider`.
- [02-json-schema.md](02-json-schema.md) — справочник по узлам `JsonNode` и операторам.
- [03-registry.md](03-registry.md) — все методы `defineRegistry`.
- [04-troubleshooting.md](04-troubleshooting.md) — типичные ошибки.
