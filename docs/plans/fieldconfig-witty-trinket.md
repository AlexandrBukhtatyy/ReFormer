# Концепт: FormModel + единая Schema (слияние FormSchema и RenderSchema)

> Статус: **проработка концепции**, не финальный план реализации. Архитектурные решения
> зафиксированы; миграция и детали рантайма — открыты. Реализация — отдельным планом.

## Оглавление
1. [Контекст](#контекст)
2. [Как устроено сейчас (before)](#как-устроено-сейчас-before)
3. [Целевая декомпозиция: 3 слоя](#целевая-декомпозиция-3-слоя)
4. [Статус решений](#статус-решений)
5. [Слой данных: FormModel (M1)](#слой-данных-formmodel-m1)
6. [Единая Schema (FormSchema ⊕ RenderSchema)](#единая-schema-formschema--renderschema)
7. [Валидация и behavior под M1](#валидация-и-behavior-под-m1)
8. [Открытые вопросы и следующие шаги](#открытые-вопросы-и-следующие-шаги)

---

## Контекст

Старт: интерфейс `FieldConfig` обязательно знает о `component` (React) — нельзя использовать
core-часть без ссылки на компонент. В ходе обсуждения задача расширилась до пересмотра модели схем.

Сегодня в ReFormer **две параллельные схемы**, и поле объявляется в обеих → дублирование и
размазанные ответственности. Решение:
1. **`FormModel`** — proxy над обычным JS-объектом, держит **только значения** (как сигналы).
2. **Единая `Schema`** — слияние сегодняшних `FormSchema` (конфиг поля) и `RenderSchema` (layout)
   в одну схему; значение приходит из модели через `value` (сигнал).

Исходная задача («`component` опционален в core») **поглощается**: `component` живёт только в Schema,
а Model/core про него не знают.

Релевантные файлы:
[deep-schema.ts](../../packages/reformer/src/core/types/deep-schema.ts) ·
[node-factory.ts](../../packages/reformer/src/core/factories/node-factory.ts) ·
[field-node.ts](../../packages/reformer/src/core/nodes/field-node.ts) ·
[field-path.ts](../../packages/reformer/src/core/types/field-path.ts) ·
[renderer-react/core/types.ts](../../packages/reformer-renderer-react/src/core/types.ts) ·
[render-node.tsx](../../packages/reformer-renderer-react/src/core/render-node.tsx) ·
[render-schema.ts (credit)](../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts) ·
[create-form.ts](../../packages/reformer/src/core/utils/create-form.ts).

---

## Как устроено сейчас (before)

```
   ОБЪЯВЛЕНИЕ ПОЛЯ #1                         ОБЪЯВЛЕНИЕ ПОЛЯ #2
┌──────────────────────────┐          ┌─────────────────────────────────┐
│ FormSchema (объект)      │          │ RenderSchema = (path) => дерево  │
│ loanType: {              │          │ Section({title}, [               │
│   value: 'consumer',  ◄──┼─ value   │   { component: path.loanType }◄──┼─ ТОЛЬКО ссылка
│   component: Select,  ◄──┼─ UI      │   { component: path.loanAmount } │   на поле + layout
│   componentProps:{...} } │          │ ])                               │
└───────────┬──────────────┘          └────────────────┬────────────────┘
            │ createForm({form,...})                    │ <FormRenderer render={schema}/>
            ▼                                           │
┌──────────────────────────┐                           │
│ FieldNode:               │ ◄─────────────────────────┘
│  value(signal)+component │   path.loanType → "loanType" → getNodeByPath → FieldNode
└──────────────────────────┘   → рендерим fieldNode.component (Select) + value/handlers
```

Болевые точки:
- `loanType` объявлен и в `FormSchema` (с компонентом и значением), и в `RenderSchema` (по пути) — **дублирование**.
- `value` и UI-`component` смешаны в одной схеме; layout — в другой. **Размазанные ответственности.**
- Имя `component` перегружено: в field-узле render-схемы это путь, в container-узле — React-компонент.

Значение сегодня принадлежит **ноде**: `FieldNode._value = signal(config.value)`. Дискриминатор
field/group в `NodeFactory.isFieldConfig` использует наличие `value` И `component`.

---

## Целевая декомпозиция: 3 слоя

```
┌──────────────────────┐     ┌──────────────────────────────────────────┐
│ FormModel (ДАННЫЕ)   │     │ Schema (КОНФИГ + LAYOUT, одна схема)       │
│ proxy над JS-объектом │     │ дерево узлов; field-узел: value(сигнал) +  │
│ { loanType:'consumer',│     │ component + componentProps + validators    │
│   coBorrowers: [] }   │     │  = FormSchema ⊕ RenderSchema               │
└──────────┬───────────┘     └───────────────────┬──────────────────────┘
           │      createForm({ model, schema })   │
           └──────────────────┬───────────────────┘
                              ▼
                ┌──────────────────────────────┐
                │ Form (FormProxy + ноды)      │  value → сигнал FormModel (через value узла);
                │                               │  errors/touched/disabled/validators/component → нода
                └──────────────┬───────────────┘
                               │ <FormRenderer form={form} />
                               ▼  отрисовка
```

Данные (`FormModel`) отделены от декларации UI+валидации (`Schema`); связывает их **сигнал модели**,
переданный в `value` узла-поля.

---

## Статус решений

| Тема | Статус |
|---|---|
| Источник истины значения | ✅ **M1** (Model владеет, нода — контроллер) |
| Доступ к модели | ✅ **value + escape-hatch** (`model.field` / `model.$.field`) |
| Привязка контрола к данным | ✅ **сигнал модели в `value` узла** (`value: model.$.field`) |
| Слияние FormSchema + RenderSchema | ✅ **одна схема = дерево узлов (как RenderSchema) + конфиг поля в field-узле** |
| Форма авторинга схемы | ✅ **текущие объект-узлы** (`{ component, componentProps, children }`), без нового DSL |
| Валидация | ✅ **слой данных**: `(value, model)`, headless-capable |
| Behavior | ✅ **фасад ноды**: computeFrom/copyFrom/enableWhen без изменений |
| Headless-валидация без UI | ✅ нужна сразу → `validate(model, schema)` заложить в дизайн |
| `component` опционален в core | ✅ поглощено: `component` живёт только в Schema |
| Обратная совместимость | ❌ **не требуется** (у библиотеки нет потребителей) → чистая breaking-миграция |

---

## Слой данных: FormModel (M1)

**M1 — Model единственный источник истины, нода — тонкий контроллер.** `createModel(initial)`
строит реактивное дерево сигналов по форме данных. `FieldNode` НЕ владеет значением — value узла-поля
схемы это и есть сигнал модели; нода владеет только UI/валидационным состоянием (errors, touched,
dirty, disabled, status), компонентом и валидаторами.

```
model.email (signal) ──┬─► (value узла) ─► FieldNode.value ─► useFormControl ─► <Input value/>
       ▲               │                                          │
       └─── setValue ──┘◄──────────────── onChange ───────────────┘
       ├─► behavior computeFrom/copyFrom : читает/пишет model.*
       └─► validators                    : читают model.*, пишут node.errors
```

Почему M1: только он делает данные **самостоятельным слоем** — `createModel(initial)` можно
читать/писать/валидировать без UI; load `model.set(dto)`, submit `model.get()`, шеринг, тривиальная
сериализация. Это закрывает исходную мотивацию (использовать core/данные без компонентов).

### Эскиз API (M1 + value-доступ)
```typescript
type FormModel<T> = ModelProxy<T> & {
  $: DeepSignals<T>;             // escape-hatch: model.$.loanType → Signal<LoanType>
  get(): T;                      // снимок (submit)
  set(value: T): void;           // массовая замена (load)
  patch(partial: DeepPartial<T>): void;
  isDirty(): boolean;            // current ≠ initial snapshot (снимок хранит модель)
};
declare function createModel<T>(initial: T): FormModel<T>;

// value-доступ — «как обычный объект»; $.x — сигнал
const model = createModel<CreditApplicationForm>({ loanType: 'consumer', coBorrowers: [] });
model.loanType = 'mortgage';
model.personalData.lastName = 'Иванов';
model.coBorrowers.push({ /* … */ });
model.get(); model.set(serverDto);
model.$.loanType;   // Signal<LoanType> — кладётся в value узла схемы
```

**Изменения `FieldNode` под M1** (самая рискованная часть рефактора): убрать владение `_value`;
value берётся из сигнала, переданного в узел; `setValue → signal.value = x (+dirty)`.
`initialValue`-снимок и `dirty` считает модель. errors/touched/disabled/status/component/validators
остаются в ноде. Массивы: `model.coBorrowers.push()` мутирует модель, `ArrayNode` подписан на длину
и строит/удаляет item-поддеревья.

---

## Единая Schema (FormSchema ⊕ RenderSchema)

**Решение:** одна схема = **дерево узлов в том же виде, что сегодняшняя `RenderSchema`** (объект-узлы
`{ component, componentProps, children }`), но field-узел **вбирает конфиг поля** из бывшей
`FormSchema` (component/componentProps/validators), а значение приходит из модели через `value`.
Никакого нового builder-DSL — формы узлов те же, что сейчас.

> Ранее рассматривались варианты В1 (builder-функции) и В2 (fields-map + layout) — оба отклонены
> в пользу сохранения текущих объект-узлов render-дерева.

### Контракт узла
```typescript
// Лист (поле) = field-узел render-схемы + конфиг из FormSchema; value = сигнал модели
interface FieldNode<T> {
  value: Signal<T>;                 // ← сигнал модели (заменяет literal во FormSchema И path.X в render)
  component: ComponentType<any>;    // ← UI-компонент (был во FormSchema): Select/Input/…
  componentProps?: Record<string, unknown>;
  validators?: Validator<T>[];
  selector?: string; className?: string; testId?: string;   // testId явный (из пути больше не вывести)
}
// Контейнер = ровно как сейчас в RenderSchema
interface ContainerNode {
  component: ComponentType<any>;    // Section/Box/Wizard/Step/RendererFormWizard/RendererFormArraySection…
  componentProps?: Record<string, unknown>;
  children?: Node[];
  selector?: string;
}
type Node = FieldNode<any> | ContainerNode;
// дискриминатор: есть value → поле; есть children → контейнер (перекликается с isFieldConfig по value)
```

### Было (две схемы) → стало (одна)
```typescript
// БЫЛО — FormSchema:     loanType: { value: 'consumer', component: Select, componentProps: { label, options } }
// БЫЛО — RenderSchema:   { selector: 'loanType', component: path.loanType }

// СТАЛО — один узел объединяет оба, value = сигнал модели:
{ selector: 'loanType', value: model.$.loanType, component: Select, componentProps: { label, options } }
```

### Кредитная многошаговая форма как одна схема (срез, реальные формы узлов)
```typescript
const model = createModel<CreditApplicationForm>({
  loanType: 'consumer', loanAmount: 0, loanPurpose: '', propertyValue: 0, initialPayment: 0,
  personalData: { lastName: '', firstName: '', gender: 'male', /* … */ },
  hasCoBorrower: false, coBorrowers: [], totalIncome: 0, /* … */
} as CreditApplicationForm);

const schema = createSchema(/* model в замыкании */ () => ({
  selector: 'wizard', component: RendererFormWizard,
  componentProps: { steps: [

    // Шаг 1 — контейнеры как сейчас; поля объединены (value=сигнал + component + props)
    { component: Step, componentProps: { title: 'Кредит', icon: '💰' }, children: [
      { component: Section, componentProps: { title: 'Основная информация', className: 'space-y-6' }, children: [
        { selector: 'loanType',   value: model.$.loanType,   component: Select,   componentProps: { label: 'Тип кредита', options: LOAN_TYPES } },
        { selector: 'loanAmount', value: model.$.loanAmount, component: Input,    componentProps: { label: 'Сумма', type: 'number' },
          validators: [(v) => v < 50000 ? err('Минимум 50 000') : null] },
        {                          value: model.$.loanPurpose,component: Textarea, componentProps: { label: 'Цель', rows: 4 } },
      ]},
      // условная секция — selector + внешний hideWhen (как сейчас), не инлайн
      { selector: 'mortgage-section', component: Section, componentProps: { title: 'Недвижимость' }, children: [
        { value: model.$.propertyValue,  component: Input, componentProps: { label: 'Стоимость', type: 'number' } },
        { value: model.$.initialPayment, component: Input, componentProps: { label: 'Первый взнос', type: 'number' } },
      ]},
    ]},

    // Шаг 2 — вложенная форма: просто model.$.personalData.lastName
    { component: Step, componentProps: { title: 'Личные данные', icon: '👤' }, children: [
      { component: Section, componentProps: { title: 'ФИО', className: 'grid grid-cols-2 gap-4' }, children: [
        { value: model.$.personalData.lastName, component: Input,      componentProps: { label: 'Фамилия' }, testId: 'personalData-lastName' },
        { value: model.$.personalData.gender,   component: RadioGroup, componentProps: { label: 'Пол', options: GENDERS } },
      ]},
    ]},

    // Шаг 5 — массив: RendererFormArraySection как сейчас, control = model.coBorrowers, item — модель элемента
    { component: Step, componentProps: { title: 'Дополнительно', icon: '📋' }, children: [
      { value: model.$.hasCoBorrower, component: Checkbox, componentProps: { label: 'Есть созаёмщик' } },
      { selector: 'co-borrowers-array', component: RendererFormArraySection, componentProps: {
        title: 'Созаёмщики', addButtonLabel: '+ Добавить', control: model.coBorrowers,
        itemComponent: (item /* FormModel<CoBorrower> */) => ({
          component: Box, componentProps: { className: 'space-y-3' }, children: [
            { value: item.$.personalData.lastName, component: Input, componentProps: { label: 'Фамилия' } },
            { value: item.$.relationship,          component: Input, componentProps: { label: 'Кем приходится' } },
            { value: item.$.monthlyIncome,         component: Input, componentProps: { label: 'Доход', type: 'number' },
              validators: [(v, m) => v > m.totalIncome ? err('Доход выше общего') : null] },
          ],
        }),
      }},
    ]},

  ]},
}));

// условные секции / динамика — как сейчас, по selector
const renderBehavior = () => hideWhen(schema.node('mortgage-section'), () => model.loanType !== 'mortgage');

const form = createForm({ model, schema });
<FormRenderer form={form} />;
```

### Что изменилось против сегодняшнего кода
- **Одна схема вместо двух**: контейнеры (`Step`/`Section`/`Box`/`RendererFormWizard`/`RendererFormArraySection`)
  — ровно как в текущей `render-schema.ts`; поля больше не дублируются во `FormSchema` — их
  `component`/`componentProps`/`validators` **сложены в тот же узел**.
- Привязка к данным: `component: path.loanType` → `value: model.$.loanType` (сигнал). `FieldPath` для
  value больше не нужен; `path`-параметр функции схемы уходит.
- Массивы (`RendererFormArraySection`: `control`, `itemComponent`) и условные секции (`selector` +
  `hideWhen`) — **в той же форме, что сейчас**, только данные берут из сигналов модели.
- Дискриминатор узла: есть `value` → поле; есть `children` → контейнер.

---

## Валидация и behavior под M1

### Как сейчас (факты)
- **behavior** ([compute-from.ts](../../packages/reformer/src/core/behavior/behaviors/compute-from.ts),
  [enable-when.ts](../../packages/reformer/src/core/behavior/behaviors/enable-when.ts)):
  handler `(form: GroupNode, ctx, withDebounce)` резолвит ноды, ставит `effect(() => { node.value.value; … })`
  и пишет через `targetNode.setValue()/enable()/disable()/reset()`. `condition`/`computeFn` получают
  плоские значения (`form.getValue()`).
- **validation** ([validation-applicator.ts](../../packages/reformer/src/core/validation/validation-applicator.ts)):
  валидаторы `(value, controlProxy, rootProxy)`; cross-field — чтение соседей через `root`; запись — `control.setErrors()`.

### Решение: расщепить по природе механизма
Требование «валидировать голую модель без UI» несовместимо с фасадом ноды для **валидации**. Поэтому:

- **Валидация → слой данных.** Валидатор `(value, model)` — чистая функция данных. Один и тот же
  работает headless (`validate(model, schema) → { path: errors }`) и в форме (ошибки → `node.setErrors`).
  Встроенные (`required`/`email`/`min`/`pattern`) используют только `value` → совместимы; меняются лишь
  cross-field: `root.x.value.value` → `model.x`.
- **Behavior → фасад ноды.** computeFrom/copyFrom/enableWhen смешивают value-ops (→ model, прозрачно,
  т.к. `node.value` теперь читает сигнал модели) и state-ops (enable/disable/reset/errors — runtime).
  Behavior драйвит UI, headless ему не нужен → **оставляем нетронутым**.

Принцип: **валидация = чистая функция ДАННЫХ** (слой модели, headless); **behavior = оркестрация
состояния ФОРМЫ** (слой ноды/runtime).

```
validate(model, schema):  model(data) → движок зовёт (value, model) → { 'monthlyPayment':[err], … }
   headless ── тот же движок ── в форме → ошибки → node.setErrors()
```
```typescript
// БЫЛО: root — proxy НОДЫ                          // СТАЛО: root — МОДЕЛЬ (данные)
(value, control, root) =>                           (value, model) =>
  root.monthlyIncome.value.value > 0 && …             model.monthlyIncome > 0 && …
```

Ограничение: валидаторы, которым реально нужно node-состояние (touched/status), остаются in-form
only. Стыковка с M1: `enableWhen(resetOnDisable)` → `node.reset()` сбрасывает ЗНАЧЕНИЕ к initial-снимку
(в модели); computeFrom пишет ЗНАЧЕНИЕ в модель; `disabled` — состояние ноды.

---

## Рендерер: разворот сигнала (`value: Signal<T>` → `value` + `onChange`)

Главное: благодаря M1 сигнал разворачивается **на границе ноды**, а существующие UI-kit контролы
(Input/Select/…) **не меняются** — они по-прежнему получают плоский `value: T` + `onChange: (v)=>void`.

### Поток данных
```
schema node.value: Signal<T>  (= model.$.x)
        │  createForm: new FieldNode({ valueSignal: node.value, component, props, validators })
        ▼
FieldNode.value (ReadonlySignal) ── useFormControl ── state.value (T) ─► <Input value={state.value} />
        ▲                                                                        │
        └─ setValue(v): valueSignal.value = v  ◄──────── onChange(v) ────────────┘
                         (пишет model.$.x + validate по updateOn)
```
Поскольку `FieldNode.value` ≡ сигнал модели, внешнее изменение `model.x = …` тоже реактивно доезжает
до контрола — единый источник истины.

### Сборка ноды (привязка к сигналу узла)
```typescript
// M1: нода НЕ владеет значением — value берётся из сигнала, переданного в узле схемы
class FieldNode<T> {
  constructor(cfg: { valueSignal: Signal<T>; component; componentProps?; validators?; updateOn? }) {
    this.valueSignal = cfg.valueSignal;          // ← сигнал модели из node.value
    this.component = cfg.component;               // …
  }
  get value(): ReadonlySignal<T> { return this.valueSignal; }     // читать = читать сигнал модели
  setValue(v: T) { this.valueSignal.value = v; this._dirty.value = true; this.maybeValidate(); }
}
```

### FieldRenderer — почти без изменений
```typescript
const FieldRenderer = memo(function FieldRenderer({ fieldNode, testId, className, wrapper: Wrapper='div', fieldWrapper: FieldWrapper }) {
  const state = useFormControl(fieldNode);          // state.value = fieldNode.value.value (читает сигнал модели)
  const Component = fieldNode.component;
  const inputProps = { value: state.value, disabled: state.disabled, ...state.componentProps };
  if (testId && inputProps['data-testid'] === undefined) inputProps['data-testid'] = `input-${testId}`;
  const handlers = {
    onChange: (v: unknown) => fieldNode.setValue(v),  // пишет сигнал модели (+ validate по updateOn)
    onBlur:   () => fieldNode.markAsTouched(),
  };
  const input = <Component control={fieldNode} {...inputProps} {...handlers} />;   // ← UI-kit контрол НЕ меняется
  return FieldWrapper ? <FieldWrapper control={fieldNode} className={className} testId={testId}>{input}</FieldWrapper>
                      : <Wrapper className={className}>{input}</Wrapper>;
});
```
Отличие от сегодняшнего кода — минимальное: `value`-сигнал приходит из узла схемы (а не из
`FieldConfig.value`-литерала) и инъектируется в ноду. Сам разворот (`state.value` / `onChange→setValue`)
и контракт контролов (`value`+`onChange`) **остаются как есть**.

### Опционально: рендер без ноды (signal-aware, lightweight)
Если для какого-то узла нода не нужна (нет валидаторов/disabled), рендерер может развернуть сигнал
напрямую — контрол всё равно не меняется:
```typescript
function FieldRendererDirect({ node }: { node: FieldNode_schema<unknown> }) {
  useSignals();                                      // подписка (preact/signals-react) или useSyncExternalStore
  const Component = node.component;
  return <Component value={node.value.value} onChange={(v) => { node.value.value = v; }} {...node.componentProps} />;
}
```
Но errors/disabled/touched/валидация живут в ноде → для «полноценных» полей оставляем путь через ноду.

---

## createForm и рантайм-связывание

Под M1 роли распределяются так:
- **Модель** — структура данных + значения (вложенность, массивы, сигналы). Структурный источник истины.
- **Schema** — layout (дерево) + конфиг поля (component/componentProps/validators), привязка к данным через `value`-сигнал.
- **Form (ноды)** — состояние UI/валидации (errors/touched/disabled/status) + агрегаты; значения делегированы модели.

### Что делает `createForm({ model, schema })`
```
1. Обходит дерево SCHEMA один раз:
   • field-узел (есть value) → создать FieldNode(state), привязать к node.value (сигнал модели),
                                применить node.validators в движок валидации;
   • container-узел (есть children) → рекурсия по детям (для layout нода не нужна);
   • array-узел (RendererFormArraySection) → настроить синхронизацию с model-массивом (ниже).
2. Структуру групп/массивов берёт из МОДЕЛИ (model — структурный источник истины);
   per-field конфиг сопоставляет по идентичности сигнала (node.value === model.$.path).
3. Агрегаты (form.valid/dirty/errors) — над набором FieldNode (как сейчас).
4. Возвращает FormProxy (императивный доступ) + schema используется рендерером для layout.
```
Поля, что есть в модели, но не в схеме → существуют как данные без UI/валидаторов (ок). Поля в схеме,
но не в модели → ошибка (сигнал обязан прийти из модели).

> Структуру можно было бы выводить и из схемы (по путям сигналов), но брать её из модели чище:
> модель и так знает вложенность/массивы. Group/Array-ноды остаются лёгкими координаторами состояния,
> зеркалящими модель; значения делегированы её сигналам (см. [Слой данных: FormModel (M1)](#слой-данных-formmodel-m1)).

### Привязка FieldNode ↔ сигнал (recap)
`new FieldNode({ valueSignal: node.value, component, componentProps, validators, updateOn })`;
`fieldNode.value` ≡ сигнал модели; `setValue(v) → signal.value = v (+dirty +validate)`.
Подробности разворота в контроле — [Рендерер: разворот сигнала](#рендерер-разворот-сигнала-value-signalt--value--onchange).

### Синхронизация массива (RendererFormArraySection + `model.coBorrowers`)
Узел массива сохраняет текущую форму, но `control` = реактивный массив модели, `itemComponent` отдаёт
поддерево, где поля привязаны к сигналам **под-модели элемента**:
```typescript
{ selector: 'co-borrowers-array', component: RendererFormArraySection, componentProps: {
  control: model.coBorrowers,                         // ← реактивный массив модели (length + под-модели)
  itemComponent: (item /* FormModel<CoBorrower> */) => ({
    component: Box, children: [
      { value: item.$.relationship, component: Input },
      { value: item.$.monthlyIncome, component: Input },
    ],
  }),
}}
```
```
model.coBorrowers (length signal + per-item sub-models)
        │
   ┌────┴───────────────────────── рендер ──────────────────────────┐
   │ RendererFormArraySection подписан на length;                    │
   │ для i: item = model.coBorrowers[i] (FormModel<CoBorrower>)       │
   │        itemComponent(item) → поддерево с value: item.$.*         │
   └────┬───────────────────────── состояние ───────────────────────┘
        │ ArrayNode(state) подписан на length:
        │   push  → создать FieldNode'ы для полей нового item (bind к item.$.*)
        │   remove→ dispose FieldNode'ы удалённого item
```
Поток add/remove:
```
"+ Добавить"  → model.coBorrowers.push(blank)   → length++  → (рендер: новое поддерево) + (state: новые FieldNode)
removeAt(i)   → model.coBorrowers.removeAt(i)    → length--  → (рендер: убрать поддерево) + (state: dispose FieldNode)
```
Идентичность элемента — по сигналам под-модели; per-item состояние (errors/touched) живёт ровно пока
элемент в массиве. Внешняя форма `RendererFormArraySection` (`control`/`itemComponent`/`addButtonLabel`)
— **как сейчас**; меняется лишь то, что `control` теперь массив модели, а item — под-модель.

---

## Судьба FieldPath

Сегодня `FieldPath` ([field-path.ts](../../packages/reformer/src/core/types/field-path.ts)) несёт
несколько ролей. Под сигнальной привязкой они расходятся:

| Роль `FieldPath` сегодня | Под сигналами |
|---|---|
| Привязка value в RenderSchema (`component: path.x`) | заменена `value: model.$.x` |
| Идентификация поля для validators (`validate(path.x, fn)`) | inline `validators` на узле → не нужен; либо ссылка `model.$.x` |
| Источники/цели behavior (`computeFrom([path.a], path.t)`) | сигналы `model.$.a`/`model.$.t`; value-цель пишется в сигнал, state-цель (enable/disable) — через реестр сигнал→нода |
| testId из пути (`path → '-'`) | из `signal.__path`, если сигналы модели **path-aware** → auto-testId сохраняется |
| error-routing по пути | inline-валидатор → прямо в свою ноду; иначе по сигналу→ноде |
| `getFieldByPath` / `FieldPathNavigator` | заменён реестром **сигнал → FieldNode** (строит `createForm`) |
| `selector` (`createRenderSchema().node(sel).setHidden`) | это **не** FieldPath — отдельный механизм, **остаётся** |

### Решение-направление
**`FieldPath` как отдельный typed-proxy + navigator — ретируется.** «Понятие пути» сохраняется,
но переносится на **сигналы модели**:
- `model.$` отдаёт **path-aware сигналы**: каждый знает свой `__path` (как `FieldPathNode.__path` сейчас).
  Один и тот же `model.$.x` — это и привязка value, и идентичность поля, и источник пути для testId/devtools.
- `createForm` держит реестр **сигнал → FieldNode** (заменяет навигацию по строковому пути) — для
  behavior-операций над состоянием (`enable/disable/reset`) и для роутинга ошибок отдельной валидации.
- `selector` и динамическое управление (`schema.node(sel)`) — независимы от FieldPath, без изменений.

Итог: «ручка поля» одна — **сигнал модели** (`model.$.x`), который заодно несёт путь. `FieldPath`
(типовой proxy + `getFieldByPath`/navigator) больше не нужен; его обязанности уходят на
path-aware сигналы + реестр сигнал→нода. Отдельные `ValidationSchemaFn`/`BehaviorSchemaFn` (если
останутся) ссылаются на поля как `model.$.x` вместо `path.x` (переписывание — вопрос миграции).

> Уточнение к разделу про рендерер: testId не обязан быть явным — при path-aware сигналах
> `testId ?? pathOf(node.value).replace(/\./g,'-')` сохраняет нынешнее авто-поведение.

---

## Headless-валидация: `validate(model, schema)`

Валидация — чистая функция данных, поэтому работает без нод/UI: движок обходит **field-узлы схемы**,
читает значение из сигнала модели и прогоняет валидаторы `(value, model, root)`.

### API
```typescript
interface ValidationResult {
  valid: boolean;
  errors: Record<string, ValidationError[]>;     // ключ — путь поля ('coBorrowers.0.relationship')
}
declare function validate<T>(model: FormModel<T>, schema: Schema<T>): Promise<ValidationResult>;   // sync+async
declare function validateSync<T>(model: FormModel<T>, schema: Schema<T>): ValidationResult;          // только sync

// Валидатор (слой данных): value — значение поля; model — ближайший scope (под-модель item'а или root); root — корень
type Validator<TValue, TScope, TRoot> = (value: TValue, model: TScope, root: TRoot)
  => ValidationError | null | Promise<ValidationError | null>;
```

### Обход (тот же движок headless и в форме)
```
walk(node, scopeModel, pathPrefix):
  field-узел (есть value+validators):
     value = node.value.peek()                 // снимок сигнала модели, без подписки
     path  = pathPrefix + node.value.__path     // path-aware сигнал
     for v in node.validators:
        err = await v(value, scopeModel, rootModel); if err → errors[path].push(err)
  container-узел: recurse(children)
  array-узел (RendererFormArraySection):
     for i in 0..scopeModel[arrayKey].length-1:
        item = scopeModel[arrayKey][i]          // под-модель элемента
        walk(node.itemComponent(item), scopeModel=item, pathPrefix=`${arrayKey}.${i}.`)
result.valid = Object.values(errors).every(e => e.length === 0)
```

- **Async**: `validate` возвращает Promise (покрывает серверные проверки); `validateSync` гоняет только
  sync-валидаторы (для мгновенной проверки).
- **Один движок**: in-form тот же обход, но ошибки роутятся в `node.setErrors` (через реестр сигнал→нода),
  а триггерится реактивно (`setValue` по `updateOn`). Headless — ошибки возвращаются картой.

### Условная валидация
Условие — **в самом валидаторе**, читает данные: `(v, m) => m.loanType === 'mortgage' ? requiredMsg(v) : null`.
Отдельный `applyWhen` становится сахаром (движок может пропустить блок, если `condition(model)` ложно).

> ⚠️ Важная консистентность: `hideWhen`/`selector` — **рендер-сокрытие (UI)** и **не** влияет на headless-валидацию.
> «Не валидировать скрытое поле» выражается **в данных** — условием в валидаторе (`m.loanType === …`),
> а не фактом, что секция спрятана. In-form `disabled`-поля пропускаются как сейчас (по состоянию ноды).

### Валидаторы: inline vs отдельная функция
- **inline** в узле (`field … validators: [...]`) — со-локализация, прямой роутинг ошибок в свою ноду.
- **отдельная** `ValidationSchemaFn` поверх модели — ссылки на поля `model.$.x` вместо `path.x`; ошибки
  роутятся по сигналу→ноде. Обе формы — один контракт `(value, model, root)` и один движок.

---

## FieldNode под M1: что переезжает, что остаётся

Сегодня [`FieldNode`](../../packages/reformer/src/core/nodes/field-node.ts) владеет значением
(`_value = signal(config.value)`, `initialValue`, `getValue/setValue/reset`). Под M1 значение и его
initial-снимок переезжают в модель; нода держит только UI/валидационное состояние.

| Сущность | Сегодня | Под M1 |
|---|---|---|
| `value` сигнал | `_value` в ноде | **в модели**; нода держит ссылку `valueSignal = node.value` |
| `initialValue` снимок | в ноде | **в модели** (снимок при `createModel`) |
| `getValue()` | `_value.peek()` | `valueSignal.peek()` (= данные модели) |
| `setValue(v)` | `_value.value=v` +dirty+validate | `valueSignal.value=v` +dirty+validate |
| `errors`/`setErrors` | нода | **нода** (UI/валидация) |
| `touched`/`markAsTouched` | нода | **нода** |
| `dirty` | нода (edit-tracking) | **нода** (см. ниже) |
| `status/valid/invalid/pending/disabled` (statusMachine) | нода | **нода** |
| `enable/disable` | нода | **нода** |
| `component`/`componentProps`/`updateComponentProps` | нода | **нода** (из схемы) |
| `validators`/`updateOn`/`validate()` | нода | **нода** |

### dirty — две разные семантики, не путать
- **edit-tracking** (текущая): `dirty=true` при первом `setValue`, сбрасывается `reset()`. Это
  **состояние взаимодействия** → остаётся в **ноде**, поведение без изменений.
- **value-diff** (новое, опционально): `current !== initial` — это **свойство данных** → даёт модель
  (`model.isDirty()` / `model.isDirty(path)`), сравнивая с initial-снимком. Полезно для «изменились ли
  данные против загруженных с сервера». Это отдельная сущность, не заменяет node-dirty.

### reset — расщепляется на два слоя
`node.reset(value?)` сегодня: значение→initial, clear errors/touched/dirty, status=valid. Под M1:
```
node.reset(value?):
  valueSignal.value = value ?? model.initialOf(node.path)   // ← ЗНАЧЕНИЕ из initial-снимка модели
  clear errors; touched=false; dirty=false; status=valid    // ← UI-состояние ноды
form.reset():
  model.set(initialSnapshot)                                 // все значения → initial (массивы: длина+элементы)
  forEach node: clear UI-состояние                           // ноды чистят своё
```

### setValue / getValue — делегирование + нюанс emitEvent
`setValue(v, { emitEvent:false })` (используется `computeFrom`, чтобы не зациклить валидацию) — пишет
сигнал модели, но пропускает **свой** `node.validate()`. При этом другие `effect`/`computeFrom`,
подписанные на этот сигнал модели, реагируют как и раньше (это корректный каскад вычислений).
`GroupNode.getValue()` → `model.get()` для своего под-пути (агрегация делегируется модели).

### Риски и краевые случаи
- **Шеринг модели двумя формами**: значение общее (один сигнал), но `errors/touched/disabled` у каждой
  ноды независимы — это фича (общие данные, независимый UI), но нужно явно зафиксировать.
- **Reset массивов**: `model.set(initial)` восстанавливает длину/элементы → `ArrayNode` пересобирает
  item-ноды (тот же механизм, что push/remove по `length`).
- **Cycle prevention**: `runOutsideEffect`/`peek` в behavior сохраняются — запись сигналов модели
  внутри `effect` требует тех же защит (behavior не меняется, пишет через ноду → сигнал).
- **disabled vs данные**: disable не трогает значение модели (кроме `resetOnDisable` → reset значения).
- **initial-снимок**: модель хранит его отдельно от текущих значений (для reset и value-diff dirty);
  `model.set(dto)` (load с сервера) может опционально обновлять и initial-снимок (новая «точка отсчёта»).

---

## План реализации (чистая breaking-миграция, без обратной совместимости)

Потребителей у библиотеки нет → старый API/адаптеры/мосты для legacy **не нужны**. Старые контракты
(`FormSchema`-литерал-value, отдельная `RenderSchema`, `FieldPath`/navigator, `createForm(schema)`)
**удаляются**; примеры переписываются на новый API напрямую.

### Фазы (порядок по зависимостям, safe → risky)

**Ф1. FormModel** (новое, изолированно) — `createModel<T>(initial)`: path-aware сигналы, value-доступ +
`$`, `get/set/patch/isDirty`, вложенность, реактивные массивы (`push/removeAt/length`), `signalAt(path)`.
Файлы: новый `packages/reformer/src/core/model/*`, экспорт в `src/index.ts`. + unit-тесты.

**Ф2. Единая Schema (типы + контракт узла)** — переписать
[deep-schema.ts](../../packages/reformer/src/core/types/deep-schema.ts): `FieldNode`/`ContainerNode`
(дискриминатор `value`/`children`), `FieldConfig.value: Signal<T>`, `component` опционален. Удалить
старый `FormSchema`-маппинг с литералом value.

**Ф3. Рантайм: FieldNode + createForm** (рискованно) — [field-node.ts](../../packages/reformer/src/core/nodes/field-node.ts):
value/initial/reset → модель, нода держит errors/touched/dirty/status/validators (см.
[FieldNode под M1](#fieldnode-под-m1-что-переезжает-что-остаётся)); [group-node.ts](../../packages/reformer/src/core/nodes/group-node.ts)/[array-node.ts](../../packages/reformer/src/core/nodes/array-node.ts)
— координаторы состояния, структура из модели; [create-form.ts](../../packages/reformer/src/core/utils/create-form.ts)
→ `createForm({ model, schema })`; реестр **сигнал→FieldNode**. Обновить
[node-factory.ts](../../packages/reformer/src/core/factories/node-factory.ts) (дискриминатор по `value`).
+ портировать node-тесты.

**Ф4. Валидация** — контракт `(value, model, root)`; движок `validate(model, schema)` (sync + async,
`{ path: errors }`); in-form роутинг через реестр сигнал→нода; переписать встроенные валидаторы
([validators/*](../../packages/reformer/src/core/validation/validators/) — большинство использует только `value`).
+ тесты headless и in-form.

**Ф5. Behavior** — `computeFrom/copyFrom/enableWhen/watchField` принимают сигналы модели; state-операции
(enable/disable/reset) через реестр сигнал→нода (см. [Валидация и behavior под M1](#валидация-и-behavior-под-m1)).
Файлы: [behavior/behaviors/*](../../packages/reformer/src/core/behavior/behaviors/). + тесты.

**Ф6. Рендерер** — [render-node.tsx](../../packages/reformer-renderer-react/src/core/render-node.tsx)/[types.ts](../../packages/reformer-renderer-react/src/core/types.ts):
единая schema-дерево (field-узел: `value`-сигнал + component; container; array через массив модели),
`FieldRenderer` разворачивает сигнал (см. [Рендерер](#рендерер-разворот-сигнала-value-signalt--value--onchange)),
убрать path-навигацию; `RendererFormArraySection` (`control: model.array`, `itemComponent: (item)=>…`);
`createRenderSchema().node(selector)`/`hideWhen` сохраняются. CDK
[FormFieldControl.tsx](../../packages/reformer-cdk/src/components/form-field/FormFieldControl.tsx) — guard на `component`.

**Ф7. Удалить legacy** — `FieldPath`/[field-path.ts](../../packages/reformer/src/core/types/field-path.ts) +
navigator (если не нужны), старые типы/экспорты; почистить `src/index.ts`.

**Ф8. Переписать примеры** — `projects/react-playground/src/pages/examples/**` на новый API: модель +
единая schema. Флагман — кредитный wizard ([schemas](../../projects/react-playground/src/pages/examples/complex-multy-step-form/schemas/) +
[render-schema.ts](../../projects/react-playground/src/pages/examples/complex-multy-step-form-renderer/render-schema.ts) → одна merged-schema),
плюс registration-form и пр.

**Ф9. Зелёные тесты** — unit (`packages/**`) + e2e (`projects/react-playground-e2e`, существующие POM/specs кредитной формы).

### Верификация
- Сборка/типы каждого пакета (`reformer`, `-renderer-react`, `-cdk`, `-ui-kit`) и playground.
- Unit: `createModel` (вложенность/массивы/`signalAt`/`isDirty`), FieldNode (dirty/reset/validate),
  `validate(model, schema)` headless + in-form, behavior (computeFrom/copyFrom/enableWhen на сигналах).
- e2e: кредитный wizard (существующие специи POM) — функционально без регрессий.
- Smoke в playground: ввод/валидация/массивы/условные секции/сабмит (`model.get()`).

### Риски
- **Ф3** — главный риск: сохранить семантику `dirty`(edit-tracking)/`reset`/триггеров `updateOn`; тесты — сеть безопасности.
- Реактивные массивы модели ↔ синхронизация item-нод (push/remove/reset длины).
- `behavior` cycle-prevention (`runOutsideEffect`/`peek`) при записи сигналов модели в `effect`.
- Объём Ф8 (перепись ~50 форм) — механический, но большой; кредитный wizard, вероятно, частично вручную.

### Стартовый шаг
**Ф1 (FormModel)** — изолирован, ни от чего не зависит, даёт фундамент и тестируется отдельно.

---

## Прогресс реализации (live)

Стратегия исполнения — **аддитивно** (новый путь рядом со старым; удаление legacy = Ф7), чтобы
сборка/тесты оставались зелёными по ходу.

- ✅ **Ф1 FormModel** — `core/model/{types,form-model,index}.ts`; `createModel` (value-доступ, `$`-сигналы
  path-aware, вложенность, реактивные массивы, get/set/patch/isDirty/reset/captureInitial/signalAt).
  Тесты: `tests/core/model/form-model.test.ts` (18).
- ✅ **Ф2 типы** — `FieldConfig`: `valueSignal?` (сигнал модели) + `component?` опционален
  (исходная задача закрыта). `NodeFactory.isFieldConfig` распознаёт поле по `valueSignal`.
- ✅ **Ф3 FieldNode-инъекция** — `_value = config.valueSignal ?? signal(config.value)`; значение может
  принадлежать модели. Тесты: `field-node-model-binding.test.ts` (8).
- ✅ **Ф3 createForm({model,schema})** — `core/utils/create-form.ts`: harvest конфига из схемы по
  идентичности сигнала (устойчив к вложенности), сборка дерева из структуры модели (объекты+поля).
  Тесты: `create-form-from-model.test.ts` (6).
- ✅ **Ф3 массивы (model-owned)** — массив принадлежит модели; форма элемента строится per-item
  рекурсивно `createForm({ model: model.arr.at(i), schema: itemComponent(item) })`. Родитель массив
  не материализует → **отдельный ArrayNode-дубликат не нужен**. Тесты: `create-form-arrays.test.ts` (5).

- ✅ **Ф4 движок валидации** — `core/model/validate-model.ts`: `validateModel`/`validateModelSync`
  (headless, `(value, model, root)`, вложенность + массивы, sync/async, условие, путь с индексом) +
  `validateFormModel` (in-form роутинг ошибок в ноды через реестр сигнал→нода). Тесты: `validate-model.test.ts` (7),
  `in-form-state.test.ts` (часть).
- ✅ **Ф5 behavior** — `core/model/behaviors.ts`: value-операции `computeFrom`/`copyFrom`/`watchField`
  (model-level, синхронная запись с peek-guard) + state-операции `enableWhen`/`disableWhen`
  (через реестр сигнал→нода `core/utils/signal-node-registry.ts`, заполняется `createForm`; запись
  состояния через `runOutsideEffect`) + `transformValue`/`resetWhen`/`syncFields`/`revalidateWhen`
  (transformValue с guard от self-write цикла). Тесты: `behaviors.test.ts` (13), `in-form-state.test.ts` (4).

- ✅ **Ф6 рендерер (единая схема)** — `packages/reformer-renderer-react/src/core/render-model.tsx`:
  `RenderModelNode` (field-узел: разворот сигнала через ноду из реестра, `value`+`onChange`, UI-kit
  контролы не меняются; container: рекурсия) + `RenderModelArray` (массив модели: реактивная длина,
  per-item поддерево, add/remove). Guard на опциональный `component` добавлен и в legacy `FieldRenderer`.
  Тесты (SSR `renderToStaticMarkup`, без jsdom): `render-model.test.tsx` (4). `tsc` пакета — 0 ошибок.
- ✅ **Ф6-хвост: per-item state в массивах** — `RenderModelArray`/`ArrayItem` строит per-item форму
  один раз (`createForm` регистрирует сигналы→ноды), элементы массива получают валидацию/состояние.
  Стабильная идентичность элемента — кэш фасадов под-модели по `GroupNode` (`form-model.ts`) +
  стабильный React-key. Проверено в `render-model.test.tsx` (per-item ноды существуют).
  Остаётся (часть Ф6): интеграция с `selector`/`hideWhen`/`createRenderSchema`-оверрайдами (под Ф8).
- ✅ **ModelArrayNode (материализация массивов в createForm)** — `core/nodes/model-array-node.ts`:
  узел массива, делегирующий данные массиву модели (`model.<path>`); per-item GroupNode-формы
  (на сигналах под-моделей) синхронизированы с длиной; контракт ArrayNode (value/length/valid/errors/
  at/map/push/removeAt/insert/clear) для `FormArraySection`/`useFormControl`. `createForm({model,schema})`
  материализует top-level массивы из узла `{ array: model.<path>, item }` → `form.<array>` работает.
  Тесты: `model-array-node.test.ts` (7) + интеграционный в `create-form-arrays.test.ts`. **Разблокирует флагман.**

- ✅ **Ф8 пилот: `registration-form`** — мигрирован на новый API:
  `createModel(initial)` + единая schema (component/componentProps/**validators `(value, model)`**) +
  `createForm({ model, schema })` + `validateFormModel(model, schema)` на submit (sync+async, cross-field
  passwordsMatch, captcha, terms). Рендер — **через существующий `<FormField control={form.x}/>`** без
  изменений (нода привязана к сигналу модели). Верификация: `tsc -p tsconfig.app.json` всего playground —
  **0 ошибок** (мигрированный пример + все legacy-примеры компилируются вместе).
  **Браузер-прогон (playwright) ✅**: dev playground + MSW — форма рендерится; ввод обновляет модель
  (панель «Состояние формы» = `model.get()`); submit пустой формы → корректные ошибки на всех полях
  (sync+required); валидный username → ошибка очищается после async-проверки доступности (MSW).
  Скриншот: `projects/react-playground-e2e/screenshots/m1-migration/registration-validation.png`.
- ✅ **Ф8: ещё 2 примера** (браузер-проверены):
  - `validation-examples` — 12 встроенных валидаторов через `validateFormModel`.
  - `behaviors-examples` — все 9 behaviors на сигналах (computeFrom/enableWhen/disableWhen/copyFrom/
    watchField/transformValue/resetWhen/syncFields/revalidateWhen); проверено live: computeFrom (итого),
    enableWhen (city), transformValue (uppercase), syncFields, disableWhen.
  Скриншоты: `screenshots/m1-migration/{validation,behaviors}-examples.png`.
  - Коренная правка для когерентности: `createForm` **не кладёт `validators` в FieldNode** (контракт
    `(value, model)` исполняет движок `validateModel`/`validateFormModel` по схеме, а не `node.validate(value)`).

**Итого новых тестов: зелёные; регрессий 0; `tsc` добавил 0 ошибок** (5 ошибок core — пред-существующие,
из коммита `1f6e8df`; renderer-react — 0; playground app — 0).

### Находка: пред-существующий красный прогон ядра
На `develop` **≈103 теста уже падали ДО миграции** (`tests/core/validation/**` + integration, 21 файл):
устаревший вызов валидаторов `required(path.x)` после `1f6e8df` (новый API — `validate(path, required())`).
Из них **17 (ArrayNode 14 + form-isolation 3) починены** конверсией на новый API (нужны были как чистая
база под массивы). Остальные ~86 — в слое валидации, который переписывается в Ф4 (контракт `(value, model)`),
поэтому их конверсия под текущий промежуточный API была бы выброшена; чинятся в рамках Ф4/Ф8.
⚠️ Эти падения **маскируются** обёрткой `scripts/run-vitest.mjs` (при зависании vitest не печатает итог
и по буферу выдаёт ложное «passes») — `npm test` сейчас вводит в заблуждение.

### Остаётся
Ф6-остаток (интеграция selector/hideWhen/`createRenderSchema`-оверрайдов — под Ф8) ·
Ф7 (удалить legacy: FieldPath/navigator, старые схемы/createForm) ·
Ф8 (переписать ~50 примеров на новый API) ·
Ф9 (зелёные тесты, включая чинку/перепись ~86 валидационных под контракт `(value, model)`).
