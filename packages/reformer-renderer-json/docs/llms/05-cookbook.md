# Cookbook

Продвинутые рецепты для `@reformer/renderer-json` (строковый операторный DSL, документ формата 2). Всё сверено с рабочим кодом: конвертер — [json-to-render-schema.ts](../../src/converter/json-to-render-schema.ts), операторы — [operators.ts](../../src/operators.ts), реестр — [component-registry.ts](../../src/registry/component-registry.ts).

## Монтаж формы из JSON { #mounting }

**Problem.** JSON-схема статична, а данные и форма — runtime. Нужно связать их без React-glue на каждой странице.

**Solution.** Документ формата 2 собирает единая сборка `createForm` из `@reformer/core`: модель — источник данных, дерево из документа строит реестр (`registry.resolveSchema`), рисует `FormRenderer` из `@reformer/renderer-react`. Документ передаётся один раз — в сборку.

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import type { JsonFormSchema } from '@reformer/renderer-json';
import rawJsonSchema from './form.schema.json'; // вариант «схема как данные»; дефолт — form.schema.ts с defineJsonSchema<T>
import { createRegistry } from './registry';

const jsonSchema = rawJsonSchema as unknown as JsonFormSchema<MyForm>; // «схема пришла строкой»
const registry = createRegistry();

export function MyFormPage() {
  // useFormBundle (ленивый useState) зовёт фабрику ровно один раз — в отличие от useMemo, кэш
  // которого React вправе сбросить, потеряв введённое.
  const bundle = useFormBundle(() =>
    createForm<MyForm>({ model: createMyModel(), schema: jsonSchema, registry, behavior: formBehavior })
  );

  // Обёртку поля (запись FIELD_WRAPPER реестра) и границу ошибок схемы сборка кладёт в бандл.
  return <FormRenderer form={bundle} />;
}
```

**Notes.**

- Документ с неизвестным `$component` бросает при сборке. Проверяй его заранее: `validateFormSchema(schema, { registry })` из `@reformer/renderer-json/validate` (тянет ajv — грузи динамически и только в dev, как эталон `complex-multy-step-form-renderer-json`), при ошибках рисуй `SchemaErrorPanel`. Ошибку рендера перехватывает `SchemaErrorBoundary` — сборка кладёт его в бандл.
- Поведение (compute/enableWhen/onChange модели **и** правила узлов hideWhen/onComponentEvent/onMount) — одно, полем `behavior`. Отдельного `renderBehavior` нет.
- Реестр уходит в сборку явно, а не через React-контекст: провайдер хоста и рендерер ремоута могут оказаться в разных бандлах. `JsonRendererProvider` для этого пути не нужен.

## Сборка формы одним проходом { #one-pass }

**Problem.** Схему легко передать дважды — в сборку формы и отдельно рендереру — и две несвязанные передачи одного артефакта разъезжаются. Плюс `useMemo` для сборки модели/формы ненадёжен: React вправе сбросить его кэш.

**Solution.** `createForm({ schema, registry, model | initial, behavior?, validation?, flow?, seed?, setup? })` — уже один проход: модель → дерево из документа → компиляция → форма → поведение. `useFormBundle(factory)` делает сборку стабильной (фабрика зовётся ровно один раз) и армирует живую проверку. Бандл целиком отдаётся `FormRenderer` пропом `form`.

```tsx
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { FormRenderer } from '@reformer/renderer-react';
import { defineJsonSchema } from '@reformer/renderer-json';
import { createRegistry } from './registry';
import { formBehavior } from './form.behavior';

interface CreditForm {
  loanType: string;
  personalData: { firstName: string };
}
const INITIAL: CreditForm = { loanType: 'consumer', personalData: { firstName: '' } };

// defineJsonSchema<T> типизирует пути $model(...): $model(personalData.firstName) — ок,
// а $model(personalData.firstNam) — ошибка компиляции (нет такого пути в CreditForm).
const schema = defineJsonSchema<CreditForm>({
  format: 2,
  root: {
    component: '$component(Box)',
    children: [
      {
        model: '$model(personalData.firstName)',
        component: '$component(Input)',
        componentProps: { label: 'Имя' },
      },
    ],
  },
});

const registry = createRegistry();

export function CreditFormPage() {
  const bundle = useFormBundle(() =>
    createForm<CreditForm>({ schema, registry, initial: INITIAL, behavior: formBehavior })
  );
  return <FormRenderer form={bundle} />;
}
```

**Notes.**

- Модель задаётся **либо** `initial` (создаётся внутри через `createModel`), **либо** готовой `model` (приоритетнее `initial`). Ни того, ни другого — `createForm` бросает.
- `useFormBundle(factory)` — стабильная сборка через ленивый `useState`; `factory` вызывается ровно один раз.
- `defineJsonSchema<T>` в `form.schema.ts` — канон схемы для renderer-json: identity-хелпер сужает пути `$model(...)` до `Path<T>`. Схему-строку-с-сервера (тип формы неизвестен) типизируй `JsonFormSchema` без параметра (`raw as unknown as JsonFormSchema<T>`). Пути внутри шаблона строки и именованной части относительны строке/группе и НЕ типизируются.
- **Прежний формат** (документ без `format: 2`) собирает `createJsonForm` + `useJsonForm` и рисует `JsonFormRenderer form={jsonForm}` внутри `JsonRendererProvider`; его типы — `JsonFormSchemaV1`, `defineJsonSchemaV1`. Документ формата 2 `createJsonForm` отвергает. Перевод — `migrateJsonSchema` (см. [10-format-2.md](10-format-2.md)).

## Шаблон строки массива { #template-arrays }

**Problem.** В JSON нельзя выразить функцию `(row) => узел` для шаблона строки. Массив должен остаться декларативным.

**Solution.** Узел массива несёт `model: '$model(path)'` + `item` — вписанный шаблон `{ $template: <JsonNode> }` либо именованную часть `'$part(name)'`. Внутри шаблона пути `$model(...)` резолвятся **относительно строки**. Шаблон новой строки для кнопки «Добавить» — в модели: `arrayOf(blank)`.

```json
{
  "selector": "properties-array",
  "model": "$model(properties)",
  "component": "$component(FieldArray)",
  "componentProps": {
    "title": "Имущество",
    "addButtonLabel": "+ Добавить имущество",
    "itemLabel": "$fn(propertyItemLabel)",
    "emptyMessage": "Нажмите \"Добавить имущество\""
  },
  "item": {
    "$template": {
      "component": "$component(Box)",
      "componentProps": { "className": "space-y-3" },
      "children": [
        { "model": "$model(type)", "component": "$component(Select)",
          "componentProps": { "label": "Тип", "options": "$dataSource(PROPERTY_TYPES)" } },
        { "model": "$model(estimatedValue)", "component": "$component(InputNumber)",
          "componentProps": { "label": "Стоимость" } },
        { "model": "$model(description)", "component": "$component(Textarea)",
          "componentProps": { "label": "Описание", "rows": 2 } }
      ]
    }
  }
}
```

```typescript
// model.ts — шаблон строки рядом с остальными начальными значениями
createModel<CreditForm>({ /* … */ properties: arrayOf(blankProperty) });
```

**Notes.**

- `model` **и** `item` обязательны оба — иначе узел не считается массивом под-форм (`isArrayNode`); массив без `item` — значение одного поля (мультивыбор, теги).
- Начальное значение массива в модели обязано быть массивом, а не `null`: иначе сборка бросает `"$model(x)" is not an array of the model`.
- `initialValue` узла — запасной шаблон для формы, чья модель создаётся из данных без кода; шаблон модели главнее. Если задан — plain-объект со **всеми** ключами строки (это проверяет `validateFormSchema`), клонируется через `JSON.parse(JSON.stringify(...))`.
- Внутри шаблона пути относительны строке (`'$model(type)'`, а не `'$model(properties.0.type)'`).
- Вложенный массив в массиве — новый узел массива внутри шаблона со своим `model`/`item`. Повторяющийся шаблон выносится в `parts` и подключается `"item": "$part(property)"`.
- В JSON-документе прежнего формата компонент секции мог называться `$component(FormArray)` — реестр понимает это имя как псевдоним `FieldArray` (в dev — предупреждение), см. [03-registry.md](03-registry.md).

## Display-список из массива модели { #display-list }

**Problem.** В модели — массив объектов (алерты, бейджи, строки-статусы). Нужно отрендерить компонент на каждый элемент и реактивно показывать/скрывать элементы — но БЕЗ редактор-хрома (add/remove/карточки), который даёт `FieldArray`.

**Solution.** Тот же узел массива, но `component: '$component(List)'` вместо `'$component(FieldArray)'`. `List` (`@reformer/ui-kit`) — chrome-less обёртка; шаблон новой строки не нужен (добавлять нечего). Показ/скрытие — мутация массива в `defineFormBehavior`. `$model(...)` в `componentProps` элемента доходит до компонента значением (рендерер разворачивает сигнал).

```typescript
// schema
{
  selector: 'alerts-list',
  model: '$model(alerts)',
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

- Дисплей vs редактирование = выбор компонента, а не тип узла. Без `component` тот же узел рендерится безхромным fallback'ом (только строки, в консоли предупреждение).
- Компонент-рендерер массива получает готовые элементы пропом `items` (`{ key, index, model, children }`) и колбэки `onAdd`/`onRemove`/`onMove` — итерацию делает рендерер.
- Для React/TS (вне JSON) есть headless-примитив `List` из `@reformer/cdk/list` (брат `FieldArray` без мутаций) и `useList`.

## dataSource-значения и функции { #datasource }

**Problem.** Нужно передать в проп массив options, функцию (`itemLabel: (row, index) => string`) или React-компонент — а JSON хранит только примитивы и объекты.

**Solution.** Регистрируешь значение через `reg.dataSource('NAME', value)` (функцию — через `reg.fn('name', fn)`), в JSON-схеме ссылаешься оператором `'$dataSource(NAME)'` / `'$fn(name)'`. Конвертер при обходе `componentProps` подставит зарегистрированное значение.

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

  // 3. Функция: itemLabel для секции массива (`$fn(propertyItemLabel)` в схеме).
  reg.fn('propertyItemLabel', (_row: unknown, index: number) => `Имущество #${index + 1}`);

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
    // не нужно; статус и текст ошибки подставляет поведение через patchProps.
    status: 'loading',
  },
  children: [
    { model: '$model(loanType)', component: '$component(Select)',
      componentProps: { options: '$dataSource(LOAN_TYPES)' } },   // → массив
    { model: '$model(carYear)', component: '$component(InputNumber)',
      componentProps: { max: '$dataSource(CURRENT_YEAR_PLUS_ONE)' } }, // → число
  ],
}
```

**Notes.**

- Резолв происходит только для строк-операторов (`'$dataSource(NAME)'`, `'$fn(name)'`). Голые строки (`label`, `placeholder`) и инлайн-массивы options идут как есть.
- Если имя не зарегистрировано: без проверки документа строка `'$dataSource(NAME)'` останется строкой (молчаливый баг); `validateFormSchema` даст ошибку `unknown dataSource "NAME"`.
- dataSource нельзя использовать как имя `component` (`component: '$component(EMPTY_PLACEHOLDER)'`, где `EMPTY_PLACEHOLDER` — dataSource, бросит `Entry "..." is a 'dataSource' and cannot be used as $component(...)`). dataSource — только для значений в `componentProps`.

## Сырые контролы UI-kit без обёрток (FieldAdapter) { #field-adapter }

**Problem.** JSON-реестр удобно наполнять готовыми контролами чужого UI-kit (antd/MUI) прямо по имени: `reg.component('Checkbox', Checkbox)`. Компоненты `@reformer/ui-kit` объявляют свой диалект статикой `reformerAdapter`, и рендерер применяет её сам, — а у чужих контролов статики нет, и они получают seam **как есть**: `value` + `onChange(value)`. Сырой antd `Checkbox` держит значение в `checked` и эмитит DOM-событие (`onChange(e)`), `Radio` — тоже событие: без перевода в модель попадёт `event`, а не значение. `Select` эмитит `(value, option)` — значение приходит **первым** и пишется в модель верно (лишний `option` отбрасывается сам) — ему адаптер не нужен.

**Solution.** `resolveFieldAdapter(component) => FieldAdapter | undefined` в настройках рендерера (он приоритетнее статики `reformerAdapter`). Если компонент можно подготовить в своём коде, альтернатива без настроек — статика: `defineFieldControl(Checkbox, { adapter })` из `@reformer/ui-kit/fields`. Адаптер резолвится по **резолвнутому** `node.component` (тому, что реестр вернул на `$component(Checkbox)`), поэтому ключуй по ссылке на компонент, а не по имени.

```tsx
import { Checkbox, Select, Radio } from 'antd';
import { FormRenderer, type FieldAdapter } from '@reformer/renderer-react';

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
  // значение приходит в событии.
  [Radio, { fromEmit: (e) => (e as any).target.value }],
]);

<FormRenderer form={bundle} settings={{ resolveFieldAdapter: (c) => adapters.get(c) }} />;
```

В самой JSON-схеме ничего особого — лист ссылается на зарегистрированное имя:

```json
{ "model": "$model(agree)", "component": "$component(Checkbox)", "componentProps": { "label": "Согласен" } }
```

**Notes.**

- `resolveFieldAdapter` получает **резолвнутый** `node.component` (React-компонент), а не строку `$component(...)`. Ключуй `Map` по той же ссылке, что отдал в `reg.component`.
- На прежнем пути (`JsonFormRenderer`) тот же резолв передаётся в `JsonRendererProvider settings` — `JsonRendererSettings` наследует его от `RendererSettings`.
- `control` (нода формы) в контрол по умолчанию **не** пробрасывается — ни с адаптером, ни без (opt-in: `reformerNeedsControl` / `passControl`, см. [03-registry.md](03-registry.md)); `disabled` пробрасывается всегда.
- Компонентам `@reformer/ui-kit` (`Input`, `Textarea`, `CheckboxWithLabel`, …) и контролам с уже value-based контрактом адаптер не нужен — верни для них `undefined`: у первых диалект объявлен статикой.
- Полный справочник полей `FieldAdapter` (`valueProp`/`changeProp`/`fromEmit`/`toValue`/`bindBlur`/`strip`) — в JSDoc типа `FieldAdapter` и кукбуке `@reformer/renderer-react`.

## Рантайм-сущности и пропсы узла (form, поток, статус) { #inject-runtime }

**Problem.** Компоненту нужно то, что нельзя выразить в статичном JSON: форма, поток шагов, обработчик, статус загрузки.

**Solution.** Форму, поток шагов и отправку компонент внутри сборки берёт из контекста — `useFormBundleContext()` из `@reformer/core/react` (его ставит `FormRenderer`). Так работает `FormWizard`: в узел визарда ничего инъектировать не нужно. Остальные рантайм-значения подставляет поведение формы — `patchProps` и `onComponentEvent` по `selector`:

```typescript
import { defineFormBehavior, onComponentEvent, onMount } from '@reformer/core/behaviors';

export const formBehavior = defineFormBehavior<MyForm>(({ schema }) => {
  const boundary = schema.node('data-boundary');
  onMount(boundary, () => {
    void load()
      .then(() => boundary.patchProps({ status: 'ready' }))
      .catch((error: Error) => boundary.patchProps({ status: 'error', error: error.message }));
  });
  onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: MyForm) => api.send(values));
});
```

**Notes.**

- `onInit(node, fn)` — build-time hook, вызывается один раз до первого рендера узла; `patchProps` в нём попадает в первый рендер.
- `patchProps` мержит переданные пропы в `componentProps` узла.
- Прежний приём — `onInit(schema.node('wizard'), () => schema.node('wizard').patchProps({ form, validateStep, validateAll }))` — больше не нужен: `validateStep`/`validateAll`-конфига у визарда нет, правила шагов — поток сборки (см. [07-form-wizard.md](07-form-wizard.md)).

## Вся форма read-only / view-mode { #readonly }

**Problem.** Нужно показать заполненную форму «только для просмотра» — все поля недоступны для ввода. Тянет искать флаг `settings.readonly` / `settings.mode`.

**Solution.** Такого флага **нет**. Настройки рендерера (`RendererSettings`) — это `fieldWrapper` **и** `resolveFieldAdapter`; флага `readonly`/`mode` среди них нет. Read-only задаётся **на уровне нод**: `form.disable()` каскадит `disabled` по всему поддереву, а рендерер пробрасывает `disabled` ноды в компонент. Один вызов на корне → вся форма read-only.

```typescript
// Вариант A — сразу после сборки (поле setup конфига):
const bundle = useFormBundle(() =>
  createForm<MyForm>({ model, schema, registry, setup: (built) => built.form.disable() })
);
```

```typescript
// Вариант B — из поведения формы (например, включить view-mode по условию/после загрузки данных):
export const readonlyBehavior = defineFormBehavior<MyForm>(({ form }) => {
  form.disable();
});
```

**Notes.**

- `disable()` / `enable()` — методы ноды (`FormNode`): у группы каскад рекурсивный, дизейбл секции задизейблит только её поля.
- **`componentProps.disabled` в JSON не работает — и это by design.** Рендерер листа ставит `disabled` из состояния ноды ПОСЛЕ пропсов схемы, поэтому значение из схемы затирается. Props-схемы field-компонентов его и не объявляют: `disabled` описан как seam-проп в [seam.props.ts](../../../reformer-ui-kit/src/fields/seam.props.ts), а `validateFormSchema` вернёт `has unknown property "disabled"`. Единственный рабочий рычаг — состояние ноды: `control.disable()` / `control.enable()`.
- **Одно поле, а не вся форма.** Тот же `disable()` вызывается точечно из поведения — так делаются readonly-поля для вычисляемых значений:

  ```typescript
  defineFormBehavior<CreditForm>(({ form }) => {
    // Вычисляемые поля правит только поведение, руками их менять нельзя.
    form.interestRate.disable();
    form.monthlyPayment.disable();
  });
  ```

  На снимок `model.get()` это НЕ влияет, поэтому вычисленные значения всё равно уезжают в обработчик отправки.
- `readOnly` в DSL тоже нет: ни одна props-схема его не объявляет, и `additionalProperties: false` его отклонит.
- Отключённые ноды не валидируются — для чистого view-mode это обычно желаемо.

## Migration from TS schema { #migration }

**Problem.** Есть готовая TS-схема `@reformer/renderer-react` (`(model) => RenderNode<T>` с React-компонентами по ссылке) — нужно перенести её в JSON-документ.

**Solution.** Покомпонентная карта замен. Ключевое: TS-ссылки (`model.$.email`, `Box`, `LOAN_TYPES`) → строки-операторы.

| TS-схема (`@reformer/renderer-react`)                                                     | JSON-документ (`@reformer/renderer-json`, формат 2)                                                        |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `{ model: model.$.email, component: Input }`                                             | `{ model: '$model(email)', component: '$component(Input)' }`                                               |
| `{ model: model.$.personalData.firstName, component: Input }`                            | `{ model: '$model(personalData.firstName)', component: '$component(Input)' }`                              |
| `{ component: Box, componentProps: { className: 'grid' }, children: [...] }`             | `{ component: '$component(Box)', componentProps: { className: 'grid' }, children: [...] }`                 |
| `{ component: 'div', children: ['Итого'] }`                                              | `{ component: '$html(div)', children: ['Итого'] }`                                                        |
| `{ selector: 'mortgage-section', component: Section, ... }`                              | то же — `selector` сохраняется (plain-строка)                                                             |
| `componentProps: { options: LOAN_TYPES }` (импорт константы)                            | `componentProps: { options: '$dataSource(LOAN_TYPES)' }` + `reg.dataSource('LOAN_TYPES', LOAN_TYPES)`      |
| `componentProps: { placeholderComponent: EmptyPlaceholder }`                             | `componentProps: { placeholderComponent: '$dataSource(EMPTY_PLACEHOLDER)' }` + `reg.dataSource('EMPTY_PLACEHOLDER', ...)` |
| `{ model: model.$.properties, component: FieldArray, item: (row) => ({...}) }`           | `{ model: '$model(properties)', component: '$component(FieldArray)', item: { $template: {...} } }`          |
| `{ model: model.$.address, part: address }`                                              | `{ model: '$model(address)', part: '$part(address)' }` + `parts: { address: {...} }`                       |

```typescript
// После: JSON
const schema = defineJsonSchema<MyForm>({
  format: 2,
  root: {
    component: '$component(Box)',
    componentProps: { className: 'space-y-4' },
    children: [
      { model: '$model(email)', component: '$component(Input)', componentProps: { label: 'Email' } },
      {
        component: '$component(Section)',
        componentProps: { title: 'Адрес' },
        children: [{ model: '$model(address.city)', component: '$component(Input)' }],
      },
    ],
  },
});

const registry = defineRegistry((reg) => {
  reg.component('Input', Input);
  reg.component('Box', Box);
  reg.component('Section', Section);
  reg.component(FIELD_WRAPPER, FormField);
});
```

**Notes.**

- В JSON `children` всегда отдельное поле узла (не `componentProps.children`).
- Вид узла решают соседние ключи: `model` + `item` → массив, `model` + `part` → подформа, `model` → поле, `component` + `children` → контейнер. Порядок распознавания: массив → подформа → поле → контейнер.
- Поведение (`hideWhen`, `onComponentEvent`, lifecycle) **не** переезжает в JSON — остаётся TS-функцией `defineFormBehavior` и подключается полем `behavior` сборки. TS- и JSON-варианты одной формы переиспользуют одно поведение, одни правила и один поток шагов.

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
      "model": "$model(amount)",
      "component": "$component(InputNumber)",
      "componentProps": { "label": "Сумма (₽)" }
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
  reg.component('InputNumber', InputNumber);
  reg.component(FIELD_WRAPPER, FormField);
  reg.locale(createLocaleResolver({ 'installment.title': 'Рассрочка' }));
});
```

**Notes.**

- `'$model(...)'` текстовым ребёнком реактивен: рендерер подписывается на сигнал и перерисовывает только текст.
- Вычисляемых выражений в JSON нет — «платёж = сумма / срок» считается `compute`-поведением над моделью, а текст показывает уже готовое поле (`"$model(monthlyPayment)"`).
- Текст, живущий не в модели, а в UI-состоянии (статус отправки), кладётся сигналом в реестр и подставляется как `"$dataSource(SUBMIT_STATUS)"`.
- Whitelist тегов и чистка `componentProps` (обработчики, `javascript:`-URL) описаны в [02-json-schema.md](02-json-schema.md#html-узлы-html-и-текст).
- Живой пример (JSON рядом с типизованной схемой) — `projects/react-playground/src/pages/demo/html-nodes/`.

## See also

- [01-overview.md](01-overview.md) — сборка `createForm` из документа и реестра.
- [02-json-schema.md](02-json-schema.md) — справочник по узлам `JsonNode` и операторам.
- [03-registry.md](03-registry.md) — все методы `defineRegistry`.
- [04-troubleshooting.md](04-troubleshooting.md) — типичные ошибки.
- [10-format-2.md](10-format-2.md) — документ формата 2 и перевод прежнего.
