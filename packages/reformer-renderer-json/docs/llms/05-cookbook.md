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
- Эталон: блок `properties-array` в `json-schema.ts` (monorepo example).

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
  reg.source('PROPERTY_ITEM_LABEL_SOURCE_FN', (_, index: number) => `Имущество #${index + 1}`);

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
- Эталон: реестр `registry.ts` (monorepo example).

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

| TS RenderSchema (`@reformer/renderer-react`)                                                                                            | JSON-схема (`@reformer/renderer-json`)                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `{ component: path.email }`                                                                                                             | `{ model: 'email' }` или `{ selector: 'email', component: 'Input' }`                                                                   |
| `{ component: path.personalData.firstName }`                                                                                            | `{ model: 'personalData.firstName', component: 'Input' }`                                                                              |
| `{ component: path.addresses[0].city }`                                                                                                 | `{ model: 'addresses[0].city', component: 'Input' }`                                                                                   |
| `{ component: Box, componentProps: { className: 'grid', children: [...] } }` _(старый стиль)_ или `{ component: Box, children: [...] }` | `{ component: 'Box', componentProps: { className: 'grid' }, children: [...] }`                                                         |
| `{ component: Section, componentProps: { title: 'X' }, children: [...] }`                                                               | `{ component: 'Section', componentProps: { title: 'X' }, children: [...] }`                                                            |
| `{ selector: 'mortgage-section', component: Section, ... }`                                                                             | то же — `selector` сохраняется                                                                                                         |
| `componentProps: { options: LOAN_TYPES }` (импорт константы)                                                                            | `componentProps: { options: 'LOAN_TYPES' }` + `reg.source('LOAN_TYPES', LOAN_TYPES)`                                                   |
| `componentProps: { LoadingComponent: LoadingState }`                                                                                    | `componentProps: { LoadingComponent: 'LoadingState' }` + `reg.source('LoadingState', LoadingState)`                                    |
| `componentProps: { control: path.properties, itemLabel: (_, i) => '#' + i, itemComponent: (itemPath) => ({ ... }) }`                    | `componentProps: { control: 'properties', itemLabel: 'NAME_FN', itemComponent: { $template: { ... } } }` + `reg.source('NAME_FN', fn)` |
| `createCreditApplicationRenderBehavior(form)(schema)` (поведение в TS)                                                                  | то же поведение — переиспользуется как есть, через `JsonFormSchema → createRenderSchemaFromJson → behavior(schema)`                    |

```typescript
// До: TS RenderSchema
const schema: RenderSchemaFn<MyForm> = (path) => ({
  component: Box,
  componentProps: {
    className: 'space-y-4',
    children: [
      { component: path.email, componentProps: { label: 'Email' } },
      {
        component: Section,
        componentProps: { title: 'Адрес', children: [{ component: path.address.city }] },
      },
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
- Поведение (`hideWhen`, `onComponentEvent`, lifecycle) **не** переезжает в JSON — оно остаётся TS-функцией `RenderBehaviorFn<T>` и применяется к финальной `RenderSchemaProxy` после `createRenderSchemaFromJson`. Полный пример организации — `CreditApplicationFormRendererJson` (monorepo example).
- `createRenderSchema` оборачивает результат `createRenderSchemaFromJson` в Proxy — без этого `proxy.node(selector)` и behavior-helpers работать не будут.

## Динамические массивы — `RendererFormArraySection`

> **Это правильный путь для всех array-секций в renderer-json.** НЕ пиши per-page custom block components с `CreditFormProvider` — это нарушает обещание «форма полностью описана в JSON».

`RendererFormArraySection` — это **app-level компонент**, собранный из примитивов библиотеки (`FormArray.Root + List + AddButton`, `RenderNodeComponent`, `useFormControl`). Его нет в `@reformer/renderer-react` намеренно: класть готовую UI-сборку с зашитыми классами и текстами в SDK значило бы навязать её всем потребителям. Реализация ~150 строк, копируется в проект целиком и адаптируется под ui-kit / тестовые конвенции / стили.

Шаблон реализации (адаптируй под себя): см. ниже секцию **«Реализация компонента»**.

### Регистрация (один раз на проект)

```tsx
// registry.tsx
import { defineRegistry, FIELD_WRAPPER } from '@reformer/renderer-json';
import {
  Input,
  InputMask,
  Select,
  Textarea,
  Checkbox,
  RadioGroup,
  Button,
  FormField,
  Box,
  Section,
} from '@reformer/ui-kit';
// Локальный app-level компонент (НЕ из @reformer/renderer-react!)
import { RendererFormArraySection } from '@/components/RendererFormArraySection';

// Plain-leaf factories для AddButton initialValue (НЕ FieldConfig!)
const propertyTemplate = () => ({
  type: 'apartment',
  description: '',
  estimatedValue: 0,
  hasEncumbrance: false,
});
const existingLoanTemplate = () => ({
  bank: '',
  type: '',
  amount: 0,
  remainingAmount: 0,
  monthlyPayment: 0,
  maturityDate: '',
});
const coBorrowerTemplate = () => ({
  personalData: {
    lastName: '',
    firstName: '',
    middleName: '',
    birthDate: '',
    gender: 'male',
    birthPlace: '',
  },
  phone: '',
  email: '',
  relationship: '',
  monthlyIncome: 0,
});

export const registry = defineRegistry((reg) => {
  // UI fields
  reg.field('Input', Input);
  reg.field('InputMask', InputMask);
  reg.field('Select', Select);
  reg.field('Textarea', Textarea);
  reg.field('Checkbox', Checkbox);
  reg.field('RadioGroup', RadioGroup);
  // Containers
  reg.container('Section', Section);
  reg.container('Box', Box);
  // The ONE generic array section
  reg.container('FormArraySection', RendererFormArraySection);
  // Field wrapper (label + error + pending)
  reg.container(FIELD_WRAPPER, FormField);
  // Sources for option lists + initial-value templates
  reg.source('PROPERTY_TYPES', [
    /* ... */
  ]);
  reg.source('PROPERTY_TEMPLATE', propertyTemplate);
  reg.source('EXISTING_LOAN_TEMPLATE', existingLoanTemplate);
  reg.source('CO_BORROWER_TEMPLATE', coBorrowerTemplate);
});
```

### Использование из JSON-схемы

```jsonc
{
  "selector": "step5.properties-section",
  "component": "FormArraySection",
  "componentProps": {
    "control": "step5.properties",
    "title": "Имущество",
    "titleAs": "h3",
    "addButtonLabel": "+ Добавить имущество",
    "removeButtonLabel": "Удалить",
    "initialValue": "PROPERTY_TEMPLATE",
    "itemComponent": {
      "$template": {
        "component": "Box",
        "componentProps": { "className": "space-y-3" },
        "children": [
          {
            "model": "type",
            "component": "Select",
            "componentProps": { "label": "Тип имущества", "options": "PROPERTY_TYPES" },
          },
          {
            "model": "estimatedValue",
            "component": "Input",
            "componentProps": { "label": "Оценочная стоимость (₽)", "type": "number" },
          },
          {
            "model": "description",
            "component": "Textarea",
            "componentProps": {
              "label": "Описание",
              "rows": 2,
              "placeholder": "Опишите имущество",
            },
          },
          {
            "model": "hasEncumbrance",
            "component": "Checkbox",
            "componentProps": { "label": "Имеется обременение (залог)" },
          },
        ],
      },
    },
  },
}
```

### Toggle-видимость массива (`hasProperty` checkbox)

Условный показ всей секции **не** делается через custom blocks. Используй один из:

1. **JSON-уровень `hideWhen`** через top-level `RenderBehaviorFn` (применяется после `createRenderSchemaFromJson`):

   ```typescript
   import { hideWhen } from '@reformer/renderer-react';

   // index.tsx
   const schema = useMemo(() => {
     const proxy = createRenderSchemaFromJson<CreditApplicationForm>(jsonSchema, registry);
     hideWhen(
       proxy.node('step5.properties-section'),
       () => form.step5.hasProperty.value.value !== true
     );
     return proxy;
   }, [form]);
   ```

2. **`useEffect setHidden`** в page-level `index.tsx` (если нужна реактивность через React state):
   ```typescript
   const hasProperty = useFormControlValue(form.step5.hasProperty);
   useEffect(() => {
     schema.node('step5.properties-section').setHidden(!hasProperty);
   }, [schema, hasProperty]);
   ```

Оба варианта работают для **любой** array-секции, не нарушают JSON-as-single-source, не требуют per-page React glue.

### Что не делать

- ❌ **Не пиши `array-blocks.tsx`** с собственным `CreditFormProvider` + `useCreditForm()` — это легаси-pattern, который дробит форму на JSON + TS.
- ❌ **Не клади toggle и его array в разные шаги** — `RendererFormArraySection` работает с любым расположением, но для maintainability держи их рядом по спеке.
- ❌ **Не передавай FieldConfig в `initialValue`** — это plain leaf values для нового item. FieldConfig (`{ value, component }`) живёт ТОЛЬКО в schema literal `createForm({...})`.
- ❌ **Не импортируй `RendererFormArraySection` из `@reformer/renderer-react`** — его там нет. Это app-level компонент, который ты копируешь в свой проект (напр. `src/components/RendererFormArraySection.tsx`).

### Реализация компонента (app-level, ~150 строк)

Скопируй этот шаблон в `<your-app>/src/components/RendererFormArraySection.tsx` и адаптируй под свой UI-кит. Ключевые точки контракта:

1. **`__selfManagedChildren = true` marker** — чтобы `RenderNodeComponent` пробрасывал в компонент prop `form` (а не рекурсивно рендерил его «детей» из node.children). Это единственный примитив из библиотеки, на который компонент опирается, не считая остальных импортов.
2. **`resolveArrayNode(control, form)`** — `control` приходит либо как уже-резолвленный `ArrayNode<T>` (TS RenderSchema), либо как `FieldPathNode` (JSON converter после `control: "step5.properties"`). Нужно поддержать оба варианта через `FieldPathNavigator + extractPath`.
3. **`itemComponent(itemPath)`** — рендер-проп, возвращающий `RenderNode<T>`. Для каждого item внутри `<FormArray.List>` создаём свежий `createFieldPath<T>()` и вызываем колбэк, потом отдаём результат в `<RenderNodeComponent node={...} form={itemForm} />`.
4. **`initialValue`** — должно быть **plain leaf values** (`string`/`number`/`boolean`/вложенные объекты тех же типов), НЕ FieldConfig. В JSON ссылается на `source`-запись в registry (см. правила `add-form-array`).

```tsx
/* eslint-disable @typescript-eslint/no-explicit-any */
import { type ReactNode } from 'react';
import {
  FieldPathNavigator,
  createFieldPath,
  extractPath,
  useFormControl,
  type FieldPath,
  type FieldPathNode,
  type FormFields,
  type FormProxy,
  type ArrayNode,
} from '@reformer/core';
import { FormArray } from '@reformer/cdk/form-array';
import {
  RenderNodeComponent,
  type RenderNode,
  type FieldWrapperProps,
} from '@reformer/renderer-react';

export interface RendererFormArraySectionProps<T extends FormFields> {
  control: ArrayNode<T> | FieldPathNode<unknown, unknown>;
  itemComponent: (itemPath: FieldPath<T>) => RenderNode<T>;
  title?: string;
  titleAs?: 'h2' | 'h3' | 'h4';
  titleClassName?: string;
  className?: string;
  cardClassName?: string;
  addButtonLabel?: string;
  removeButtonLabel?: string;
  initialValue?: Partial<FormFields>;
  showRemoveOnSingle?: boolean;
  emptyLabel?: string;
  maxItems?: number;
  form?: FormProxy<unknown>;
  fieldWrapper?: React.ComponentType<FieldWrapperProps>;
}

const navigator = new FieldPathNavigator();

function resolveArrayNode<T extends FormFields>(
  control: RendererFormArraySectionProps<T>['control'],
  form: FormProxy<unknown> | undefined
): ArrayNode<T> | null {
  if (
    control &&
    typeof control === 'object' &&
    typeof (control as ArrayNode<T>).push === 'function' &&
    typeof (control as ArrayNode<T>).removeAt === 'function'
  ) {
    return control as ArrayNode<T>;
  }
  if (!form) return null;
  try {
    const pathStr = extractPath(control as FieldPathNode<unknown, unknown>);
    const node = navigator.getNodeByPath(form, pathStr);
    return (node as unknown as ArrayNode<T>) ?? null;
  } catch {
    return null;
  }
}

export function RendererFormArraySection<T extends FormFields>({
  control,
  itemComponent,
  title,
  titleAs: TitleTag = 'h3',
  titleClassName = 'text-base font-semibold mb-2',
  className = 'space-y-3 mt-2',
  cardClassName = 'rounded-md border p-4 space-y-3',
  addButtonLabel = '+ Добавить',
  removeButtonLabel = 'Удалить',
  initialValue,
  showRemoveOnSingle = false,
  emptyLabel,
  maxItems,
  form,
  fieldWrapper,
}: RendererFormArraySectionProps<T>): ReactNode {
  const arrayNode = resolveArrayNode<T>(control, form);
  if (!arrayNode) return null;
  const lengthCtrl = useFormControl(arrayNode as unknown as Parameters<typeof useFormControl>[0]);
  const length = (lengthCtrl as unknown as { length?: number } | undefined)?.length ?? 0;
  const atMaxItems = maxItems != null && length >= maxItems;
  return (
    <section className={className}>
      {title ? <TitleTag className={titleClassName}>{title}</TitleTag> : null}
      {length === 0 && emptyLabel ? <p className="text-sm italic">{emptyLabel}</p> : null}
      <FormArray.Root control={arrayNode}>
        <FormArray.List className="space-y-3">
          {({ control: itemForm, index, remove }) => {
            const renderNode = itemComponent(createFieldPath<T>());
            const showRemove = showRemoveOnSingle || length > 1;
            return (
              <div className={cardClassName} data-testid={`array-item-${index}`}>
                <RenderNodeComponent
                  node={renderNode}
                  form={itemForm as unknown as FormProxy<T>}
                  fieldWrapper={fieldWrapper}
                />
                {showRemove ? (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={remove}
                      data-testid={`array-item-${index}-remove`}
                    >
                      {removeButtonLabel}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          }}
        </FormArray.List>
        {atMaxItems ? null : (
          <div>
            <FormArray.AddButton initialValue={initialValue} data-testid="array-add">
              {addButtonLabel}
            </FormArray.AddButton>
          </div>
        )}
      </FormArray.Root>
    </section>
  );
}

(RendererFormArraySection as any).__selfManagedChildren = true;
```

## See also

- [02-json-schema.md](02-json-schema.md) — справочник по полям `JsonNode`.
- [03-registry.md](03-registry.md) — все методы `defineRegistry`.
- [04-troubleshooting.md](04-troubleshooting.md) — типичные ошибки.
