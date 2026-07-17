# Миграция `@reformer/ui-kit` на shadcn/ui (v7, greenfield replace)

## Context

`@reformer/ui-kit` переводится на экосистему [shadcn/ui](https://ui.shadcn.com/): полный состав
компонентов, каталог-на-компонент с концептом «Вариантов» (функциональные пресеты под юзкейсы),
self-contained тема, и интеграция с формами ReFormer **с минимумом правок компонентов** (чистый shadcn + HOC).

Решения пользователя (согласованы):
- **v7, без обратной совместимости** — старые рукописные компоненты просто удаляются; API реструктурируется
  свободно (не сохраняем старые имена/контракт ради совместимости).
- **Все 64 компонента shadcn** (полный список ниже), включая тяжёлые recipe и AI-примитивы.
- **Pure shadcn + HOC** — примитивы чистые; form-версии через `withFormControl`.
- **Self-contained тема** — пакет поставляет `@reformer/ui-kit/styles`.
- **Каталог-на-компонент + «Варианты»** — всё лежит под `src/components/<name>/variants/{base, <variant>}/`,
  где **«Вариант» = функционально закастомизированная версия под юзкейс** (Select: `base` / `user-picker` /
  `grouped`), а НЕ стиль (размер/цвет/раскладка лейбла/подсказки/ошибки — обычные props внутри реализации).
  Композитные импортируют примитивы из каталогов-владельцев (shadcn-модель `registryDependencies`).
- **shadcn `Field` как база `FormField`** — ReFormer `FormField` перестраивается поверх shadcn `Field`
  (Label/Description/Error), сохраняя интеграцию с `@reformer/cdk` (валидация/ошибки/сигналы).
- **Массовая параллелизация суб-агентами** — интеграцию ОДНОГО компонента выполняет один суб-агент
  (полный вертикальный срез); запускаются волнами через Workflow fan-out.
- **Props-компаньон на вариант** — рядом с реализацией лежит `<cmp>-<variant>.props.ts` (JSON Schema draft-07
  + `x-doc`): единый источник для `api.controls[]` в reformer-doc и для валидации `componentProps` в
  renderer-json. Обязателен для F-компонентов и DSL-контейнеров (`Box`, `Section`, `AsyncBoundary`, `Step`);
  остальным — по потребности. **Ручной `controls[]` запрещён** (§ Props-компаньоны).

Стартовые преимущества (снижают риск): `cn()` идентичен shadcn; `Button` уже cva + `data-slot` + `asChild`;
Tailwind v4 + oklch-токены (shadcn `new-york`/`neutral`) уже есть у потребителей.

Контракт интеграции (seam): под `<FormField control={…}/>` компонент получает plain props, резолвленные
выше — `value` (raw; для checkbox/switch тоже `value`), **value-based** `onChange:(value)=>void`, `onBlur`,
`disabled`, `id`, `aria-*`, весь `componentProps` кроме `testId`. Компонент НЕ вызывает `useFormControl` и
НЕ читает контекст. Renderer-react дополнительно передаёт `control={fieldNode}` — HOC его отбрасывает.
(`packages/reformer-cdk/src/components/form-field/FormFieldControl.tsx:95-115`,
`packages/reformer-renderer-react/src/core/render-node.tsx:145-146`.)

## Полный список компонентов (64) — чтобы не упустить ни одного

Колонки: **F** = form-control (нужна field-версия/адаптер); **C** = composite (зависит от других — волна 2);
**Dep** = тяжёлая внешняя зависимость.

| # | Компонент | F | C | Dep | Заметка |
|---|---|---|---|---|---|
| 1 | Accordion | | | | Radix |
| 2 | Alert | | | | |
| 3 | Alert Dialog | | | | Radix |
| 4 | Aspect Ratio | | | | Radix |
| 5 | Attachment | | | | AI |
| 6 | Avatar | | | | Radix |
| 7 | Badge | | | | стили через cva (не «варианты») |
| 8 | Breadcrumb | | | | |
| 9 | Bubble | | | | AI |
| 10 | Button | | | | база уже shadcn-shaped (cva-стили) |
| 11 | Button Group | | | | |
| 12 | Calendar | F | | react-day-picker, date-fns | `selected`/`onSelect(Date)` |
| 13 | Card | | | | |
| 14 | Carousel | | | embla-carousel-react | |
| 15 | Chart | | | recharts | subpath-only |
| 16 | Checkbox | F | | | `checked`/`onCheckedChange` |
| 17 | Collapsible | | | | Radix (заменяет самописный) |
| 18 | Combobox | F | C | cmdk | Popover + Command |
| 19 | Command | | | cmdk | |
| 20 | Context Menu | | | | Radix |
| 21 | Data Table | | C | @tanstack/react-table | реализован обёрткой `<Table settings>` (§ Table), отдельного компонента нет |
| 22 | Date Picker | F | C | react-day-picker, date-fns | Popover + Calendar |
| 23 | Dialog | | | | Radix |
| 24 | Direction | | | | RTL provider |
| 25 | Drawer | | | vaul | |
| 26 | Dropdown Menu | | | | Radix |
| 27 | Empty | | | | |
| 28 | Field | | | | layout: label/desc/error → база `FormField`; делается в **волне 0** (инфраструктура) |
| 29 | Hover Card | | | | Radix |
| 30 | Input | F | | | native `onChange(e)` + number-буфер |
| 31 | Input Group | | | | обёртка контролов |
| 32 | Input OTP | F | | input-otp | `value`/`onChange(string)` |
| 33 | Item | | | | |
| 34 | Kbd | | | | |
| 35 | Label | | | | Radix |
| 36 | Marker | | | | AI |
| 37 | Menubar | | | | Radix |
| 38 | Message | | C | | AI |
| 39 | Message Scroller | | C | | AI |
| 40 | Native Select | F | | | native `<select>` |
| 41 | Navigation Menu | | | | Radix |
| 42 | Pagination | | | | |
| 43 | Popover | | | | Radix |
| 44 | Progress | | | | Radix |
| 45 | Radio Group | F | | | `value`/`onValueChange` |
| 46 | Resizable | | | react-resizable-panels | |
| 47 | Scroll Area | | | | Radix |
| 48 | Select | F | | | Radix + async-расширение |
| 49 | Separator | | | | Radix |
| 50 | Sheet | | | | Radix Dialog variant |
| 51 | Sidebar | | C | | Sheet+Tooltip+Button+Input+Separator+Skeleton |
| 52 | Skeleton | | | | |
| 53 | Slider | F | | | `value:number[]`/`onValueChange` |
| 54 | Sonner | | | sonner | toaster |
| 55 | Spinner | | | | |
| 56 | Switch | F | | | `checked`/`onCheckedChange` |
| 57 | Table | | C | @tanstack/react-table | data-driven обёртка `settings` + presentational части (§ Table) |
| 58 | Tabs | | | | Radix |
| 59 | Textarea | F | | | native `onChange(e)` |
| 60 | ~~Toast~~ | | | | **SKIPPED** — deprecated upstream в пользу `Sonner`; агент не создаётся (решение) |
| 61 | Toggle | F | | | `pressed`/`onPressedChange` |
| 62 | Toggle Group | F | | | `value`/`onValueChange` (string\|string[]) |
| 63 | Tooltip | | | | Radix |
| 64 | Typography | | | | utility/гайд, не field |

**Плюс ReFormer-специфичные** (нет в shadcn, сохраняются в новой структуре): `Box`, `Section`,
`AsyncBoundary`, `InputMask`, `InputPassword`, `ExampleCard`, `FormField` (→ поверх Field), `FormArraySection`,
`FormWizard*`, `ErrorState`, `LoadingState`.

## Структура каталога компонента

**«Вариант» = функциональная разновидность компонента под конкретный юзкейс** (готовый закастомизированный
компонент), а не стилевая ось. Пример Select: `base` (обычный), `user-picker` (в опциях аватар + ФИО вместо
строки), `grouped` (с группировкой). **НЕ варианты**: размер, цвета, расположение лейбла, подсказки, ошибки
валидации — это обычные props/стилизация (cva/Tailwind) внутри реализации, общие для всех вариантов.

```
src/components/<cmp>/
  variants/
    base/                         # ОБЯЗАТЕЛЕН: чистый shadcn primitive (data-slot, unified radix-ui, cn)
      <cmp>-base.tsx              #   + под-части (напр. select-item, select-trigger)
      <cmp>-base.field.tsx       #   form-версия базового варианта (только для F)
      <cmp>-base.props.ts        #   props-схема варианта (F + DSL-контейнеры) — источник controls[] и DSL-валидации
    <variant>/                    # функциональный пресет (simple/user-picker/grouped/...) — по потребности
      <cmp>-<variant>.tsx        #   закастомизированная реализация + нужные варианту компоненты
      <cmp>-<variant>.field.tsx  #   своя form-версия (варианты — разные компоненты: user-picker.field ≠ base.field)
      <cmp>-<variant>.props.ts   #   своя схема: у варианта свои props (async ≠ base)
  <cmp>.test.tsx                  # unit-тест(ы)
  <cmp>.props.test.ts             # страж: ключи схемы ⊆ props варианта (§ Props-компаньоны)
  index.ts                        # barrel: все варианты + их field + их props-схемы
```

- `base` есть у каждого компонента (это порт чистого shadcn). Функциональные варианты добавляются по мере
  надобности — на старте миграции у большинства компонентов будет только `base`.
- Эти же функциональные варианты образуют таб **Variants** в doc-config reformer-doc (§ playbook, фаза H):
  код-вариант ↔ `VariantDef`. Рецепты использования → таб **Examples**, интерактивные props → таб **API**.
- **Props-схема описывает props ВАРИАНТА**, поэтому живёт рядом с ним — как `.field.tsx`. `select/variants/base`
  (чистый shadcn) и `select/variants/async` (options/resource/clearable) имеют разные схемы: это то же правило,
  что «варианты — разные компоненты: `user-picker.field` ≠ `base.field`». Вариант, на который смотрит алиас
  `<Cmp>Field`, помечает себя `'x-registryName': '<Cmp>'` — по нему `generate-meta.mjs` собирает
  `defaultPropSchemas` для MCP (§ Props-компаньоны).
- Стилизация (размеры/цвета/состояния) живёт cva/Tailwind-классами **внутри** реализации варианта — не выносится
  в отдельные под-каталоги.
- Кросс-компонентное переиспользование = импорт из каталога-владельца (Combobox → `@/components/popover`,
  `@/components/command`). Отдельного глобального shared нет, кроме `src/lib/utils.ts` (`cn`). Общая
  инфраструктура форм — `src/fields/{with-form-control.tsx, adapters.ts}` (импортируется компонентами напрямую
  как `@/fields/...`, без отдельного `/fields` subpath) и `src/styles/theme.css`.

## HOC form-слой

`withFormControl(Primitive, adapter)` (`src/fields/with-form-control.tsx`) превращает чистый примитив в
field-компонент по контракту seam и **отбрасывает `control` + не-DOM ключи**.

```ts
interface FieldAdapter {
  valueProp: string;   // 'value' | 'checked' | 'pressed' | 'selected'
  changeProp: string;  // 'onChange' | 'onCheckedChange' | 'onValueChange' | 'onPressedChange' | 'onSelect'
  fromEmit: (arg: unknown, rest: Record<string, unknown>) => unknown;  // emit → значение поля
  toValue: (value: unknown) => unknown;                                // значение поля → valueProp (+coerce null)
  bindBlur?: (onBlur?: () => void) => Record<string, unknown>;         // напр. Select: onOpenChange(false)
  strip?: string[];
}
```

Пресеты (`src/fields/adapters.ts`): `nativeInputAdapter` (Input/Textarea/NativeSelect: `e.target.value||null`),
`checkedAdapter` (Checkbox/Switch/Toggle: `checked`/`onCheckedChange`|`pressed`/`onPressedChange`),
`valueChangeAdapter` (Select/RadioGroup/ToggleGroup/Combobox), `sliderAdapter` (`arr[0]`),
`dateAdapter` (Calendar/DatePicker: `selected`/`onSelect`). Каждый F-вариант несёт свою `.field.tsx` рядом
с реализацией (`variants/<variant>/<cmp>-<variant>.field.tsx`) — как правило однострочник:
`export const SelectBaseField = withFormControl(SelectBase, valueChangeAdapter)`.

**Соглашение имён и экспорт**: field-версия варианта — `<Cmp><Variant>Field` (`SelectBaseField`, `SelectAsyncField`,
`SelectUserPickerField`); плюс алиас `<Cmp>Field` на дефолтный для форм вариант (`SelectField → SelectAsyncField`,
`CheckboxField → CheckboxBaseField`, `InputField` — по `type`: base/number). Всё экспортируется **через barrel
компонента** `@reformer/ui-kit/<cmp>` (primitive-варианты + их field + алиас) — отдельного `/fields` subpath нет.

**Seam как общий runtime-контракт схем.** `value`/`onChange`/`onBlur`/`disabled` резолвит HOC, а не автор схемы
формы — значит в `componentProps` их не бывает. Они описаны один раз в `src/fields/seam.props.ts`
(`seamRuntimeProps`) и подмешиваются `mergeFieldPropsSchema`; вариант переопределяет только `value.type` /
`onChange.type` под свой адаптер (Select — `string | null`, Slider — `number[]`). Дублировать их в `*.props.ts`
не нужно (§ Props-компаньоны).

**Enhanced-логика ложится на концепт вариантов** (не отдельный примитив, а функциональный вариант):
- **`input/variants/number`** — вариант Input с raw-буфером (переиспользует чистый `input-number-buffer.ts`,
  дословно логику текущего `input.tsx:99-134`); его `input-number.field.tsx` владеет буфером.
- **`select/variants/async`** — вариант Select с options/resource/search/pagination/clear
  (`select-resource.ts` не трогать); `select-async.field.tsx = withFormControl(SelectAsync, valueChangeAdapter)`.

**FormField поверх Field**: `src/components/form-field/` перестраивается на визуальной базе shadcn `Field`
(Field/FieldLabel/FieldDescription/FieldError), сохраняя обёртку над `@reformer/cdk/form-field` (резолв
ошибок/ids/статусов). Детекция checkbox-раскладки (`form-field.tsx:81`) — через статический маркер
`CheckboxField.reformerLayout === 'inline-label'`, не по идентичности компонента.

## Props-компаньоны (`*.props.ts`)

### Зачем

Две дыры с одной причиной — нет машиночитаемого описания props:

1. **Дока дрейфует.** `api.controls[]` — ручная копия JSDoc. В v6 уже разошлась: у Select нет `className`,
   дефолт `placeholder` заявлен `'Выберите вариант'` против реального `'Select an option...'`; у Input не
   документированы `min`/`max`/`step`, enum `type` не содержит ни `number`, ни `date`.
2. **`componentProps` в JSON-DSL — opaque.** `form-schema.schema.json:43` → `"componentProps": {"type":"object"}`.
   Опечатка `lable` доезжает до React молча, MCP `validate_json_schema` отвечает `✅ valid`. Боевая
   `complex-multy-step-form-renderer-json/json-schema.json` прямо сейчас содержит 4 невалидных `type: "date"`
   (строки 246, 323, 1128, 1223) — v6-контракт `TextInputProps` их не заявляет, и никто этого не видит.

Встроенная в playbook, фича масштабируется бесплатно: суб-агент и так читает shadcn-исходник и пишет doc-config
— пусть пишет `.props.ts` и генерит `controls[]` из него. **Дрейф становится структурно невозможен с первого дня
v7**, а не лечится потом на 18 компонентах.

### Три факта, проверенных исполняемыми пробами (не переизобретать)

- **`if/then` по `component` в мета-схеме — тупик для валидации.** В боевой форме 144 ноды с `componentProps`,
  структурно достижимо для JSON Schema — **2** (всё лежит внутри `root.children[0].componentProps.steps[…]`, а он
  сам opaque). Прототип `allOf`+`if/then` сказал `valid` на форме с 4 ошибками. **Реальная проверка обязана быть
  рекурсивным обходом** рядом с `walkOperatorNames` — ровно по причине из шапки `validate.ts`. Прототип обхода:
  53/53 мешка, 4 настоящие ошибки. `if/then` оставляем только для IDE-подсветки через `$schema`.
- **Ajv 8.17 в strict бросает на `x-`-ключах** (`strict mode: unknown keyword: "x-doc"`), а `validate.ts:162`
  компилирует с дефолтным strict → strip обязателен. Удачно: это машинная гарантия, что валидатор DSL физически
  не видит doc-метаданные.
- **`additionalProperties: false` реалистичен**: реальная поверхность в DSL — Select 4 ключа, Input 7. Прогон по
  144 нодам: 0 ложных срабатываний.

Плюс: `as const satisfies JSONSchema7` **отвергает** `x-doc` (TS2823 — нет индексной сигнатуры), поэтому
`satisfies` целится в локальный `PropsSchema`. Оператор-строка допустима на месте любого значения
(`options: "$dataSource(LOAN_TYPES)"`) → `anyOf` навешивается автоматически, а не руками в каждой схеме.

### Три контракта в одном мешке

```
componentProps = { label, required, testId,   placeholder, options, clearable, className }
                  └─── контракт враппера ──┘  └──── контракт ВАРИАНТА примитива ─────────┘
                  вынимает CDK                 HOC прокидывает в <SelectAsync>

x-runtimeProps  = seam-контракт (общий) + несериализуемые props варианта
                  value/onChange/onBlur/disabled   resource (требует функцию load)
```

Проверено на коде: `FormFieldControl.tsx:104-115` ставит `disabled={disabled}` **после** спреда `componentProps`
→ `componentProps.disabled` **мёртв**. `required` — **жив**: `FormFieldRoot.tsx:80` → `FormFieldLabel.tsx:51`
рисует маркер «*». Это проп враппера, а не примитива.

| Что | Где | Кто пишет |
|---|---|---|
| Типы + `mergeFieldPropsSchema` | `src/fields/props-schema.ts` | Волна 0 |
| Seam-контракт (общий `x-runtimeProps`) | `src/fields/seam.props.ts` | Волна 0 |
| Контракт враппера | `src/components/form-field/form-field.props.ts` | Волна 0 — целиком, вместе с `Field`+`FormField` (`label`/`required`/`testId` + возможный `description` от `FieldDescription`) |
| Схема варианта | `src/components/<cmp>/variants/<v>/<cmp>-<v>.props.ts` | **Суб-агент** (фаза E) |
| `meta`-barrel | `src/meta.ts` ← `scripts/generate-meta.mjs` глобом | Оркестратор между волнами |
| Механизм DSL (операторы, strip, обход) | `renderer-json` | Волна 4 |
| `ApiControl[]` | `reformer-doc/…/controls-from-schema.ts` | Волна 0 (общая demo-инфраструктура) |

**Жёсткое ограничение**: `src/meta.ts` и всё, что он тянет, — **React-free**. MCP-сервер грузит их в голом Node.
`*.props.ts` не импортирует `.tsx` (типы — только в тест-файле рядом).

### `src/fields/props-schema.ts` (волна 0)

```ts
export type PropGroup = 'Control' | 'Options' | 'Textfield' | 'Behavior' | 'State';
export type PropWidget = 'boolean' | 'text' | 'number' | 'enum' | 'readonly';

/** `x-doc` — ровно то, чего нет в словаре JSON Schema. Остальное берётся из
 *  стандартных ключей: description, default, enum→options, minimum/maximum/multipleOf. */
export interface PropDoc {
  group: PropGroup;
  /** Отображаемый TS-тип: JSON Schema не выражает `string | null` и сигнатуры функций. */
  type: string;
  /** Переопределить виджет. По умолчанию выводится из `type`/`enum`. */
  kind?: PropWidget;
}

/** Проп, которого НЕ бывает в componentProps: резолвит seam (value/onChange/onBlur/disabled)
 *  либо не представим в JSON (resource.load). Держим отдельно от `properties`, чтобы схема
 *  не врала, будто его можно указать. Валидатор DSL этот блок не видит (вырезается с x-*). */
export interface RuntimePropDoc extends PropDoc {
  description: string;
  default?: string | number | boolean;
}

/** ВНИМАНИЕ: форма `Omit<…> & {…}` — не косметика. Именно интерсекция с mapped-типом
 *  пропускает `as const`-значения (readonly-кортежи в required/enum). Плоский interface
 *  на них ругается (проверено). Рефакторить — только с прогоном typecheck. */
export type PropsSchema = Omit<JSONSchema7, 'properties'|'items'|'anyOf'|'additionalProperties'> & {
  'x-doc'?: PropDoc;
  'x-runtimeProps'?: Record<string, RuntimePropDoc>;
  /** Каноническое имя в реестре renderer-json. Ставит вариант, на который смотрит алиас
   *  `<Cmp>Field`. По нему generate-meta.mjs собирает defaultPropSchemas. */
  'x-registryName'?: string;
  properties?: Record<string, PropsSchema>;
  items?: PropsSchema | PropsSchema[];
  anyOf?: PropsSchema[];
  additionalProperties?: boolean | PropsSchema;
};

/** Полная схема componentProps field-ноды: враппер + seam + вариант.
 *  Именно структурный merge properties, а НЕ `allOf: [wrapper, variant]`: в draft-07
 *  additionalProperties смотрит только на properties СВОЕЙ схемы → в allOf каждая ветка
 *  отвергла бы props соседней. Строгость решает вариант своим additionalProperties. */
export function mergeFieldPropsSchema(variantSchema: PropsSchema): PropsSchema {
  const strict = variantSchema.additionalProperties === false;
  return {
    type: 'object',
    properties: { ...fieldWrapperPropsSchema.properties, ...variantSchema.properties },
    ...(strict ? { additionalProperties: false } : {}),
    // Вариант переопределяет value/onChange под свой адаптер — его спред идёт последним.
    'x-runtimeProps': { ...seamRuntimeProps, ...variantSchema['x-runtimeProps'] },
  };
}
```

`src/fields/seam.props.ts` — `seamRuntimeProps`: `value`, `onChange`, `onBlur` (группа `Control`) и `disabled`
(`State`, `kind: 'boolean'`, `default: false`). У `disabled` в описании — что он задаётся `control.disable()`, а
не через `componentProps`, со ссылкой на `FormFieldControl.tsx:104-115`. `value.type`/`onChange.type` заданы
обобщённо; варианты переопределяют.

### Образец: `select/variants/async/select-async.props.ts`

```ts
export const selectAsyncPropsSchema = {
  type: 'object',
  additionalProperties: false,   // реальная поверхность — 4 ключа; строгость ловит `lable`
  'x-registryName': 'Select',    // алиас SelectField → SelectAsyncField
  properties: {
    className:   { type: 'string', description: '…', 'x-doc': { group: 'Control', type: 'string', kind: 'readonly' } },
    options:     { type: 'array', items: { type: 'object', required: ['value','label'], additionalProperties: false,
                     properties: { value: { type: ['string','number'] }, label: { type: 'string' }, group: { type: 'string' } } },
                   description: '…', 'x-doc': { group: 'Options', type: 'Array<{ value; label; group? }>', kind: 'readonly' } },
    placeholder: { type: 'string', default: 'Select an option...', description: '…',
                   'x-doc': { group: 'Textfield', type: 'string' } },        // kind выводится → 'text'
    clearable:   { type: 'boolean', default: false, description: '…',
                   'x-doc': { group: 'Behavior', type: 'boolean' } },
  },
  'x-runtimeProps': {
    // Только СВОЁ: seam (value/onChange/onBlur/disabled) подмешает mergeFieldPropsSchema.
    value:    { group: 'Control', type: 'string | null', description: '…' },        // override под адаптер
    onChange: { group: 'Control', type: '(value: string | null) => void', description: '…' },
    resource: { group: 'Options', type: 'ResourceConfig<unknown>',
                description: 'Асинхронный источник опций. В componentProps JSON-формы недостижим: требует функцию `load`.' },
  },
} as const satisfies PropsSchema;
```

### Страж от дрейфа (фаза E2)

Тип-левел, падает на `npm run typecheck` (не на vitest — тот транспилирует esbuild'ом без проверки типов):

```ts
type SchemaKeys = keyof typeof selectAsyncPropsSchema.properties
                | keyof (typeof selectAsyncPropsSchema)['x-runtimeProps'];

/** A: в схеме нет опечаток и удалённых props. */
export type _A_NoStrayKeys = Assert<SchemaKeys extends keyof SelectAsyncProps ? true : false>;

/** B: новый проп варианта → typecheck падает, пока его не классифицируют.
 *  Транзитные props Radix документируются намеренно НЕ здесь; список явный и ревьюится. */
export type _B_AllPropsClassified =
  Assert<Exclude<keyof SelectAsyncProps, SchemaKeys | RadixTransit | SeamKeys> extends never ? true : false>;
```

Направление B применимо, только если тип варианта **не наследует** `React.*HTMLAttributes`: у Input `keyof` даст
~300 ключей и «всё покрыто» бессмысленно — там только A, и это записать комментарием. Дистрибутивный `AnyKeyOf`
не нужен даже для union-типов: члены наследуют общую базу, поэтому `keyof` union = объединение (проверено на
v6-`InputProps`: 307 = 307). Плюс рантайм-часть: `properties` ∩ `x-runtimeProps` = ∅.

TS Compiler API (`symbols-parser.ts`, `generate-llms-txt`) переиспользовать **не стоит**: тип-левел даёт то же
бесплатно и детерминированно, без второго парсера типов.

### `renderer-json` (волна 4)

- **`form-schema.schema.json`**: `+ definitions.operatorOp` (`^\\$(model|component|dataSource|fn|locale)\\(.+\\)$`).
- **`schema/index.ts`**: `allowOperatorStrings(schema)` — рекурсивно оборачивает каждый проп в
  `anyOf: [<честный тип>, operatorOp]`, чтобы автор схемы не дублировал это руками; `stripDocExtensions(schema)` —
  вырезает `x-*` (ajv strict бросает); `toComponentPropsValidatorSchema` = композиция + `definitions.operatorOp`.
  Плюс `propSchemas?: Record<string, ComponentPropsSchema>` в `BuildFormSchemaMetaSchemaOptions` — **только новое
  необязательное поле**, `gen-form-json-schema.ts:32` работает без правок. В `if`-ветке обязателен
  `required: ['component']`, иначе нода без `component` проходит вакуумно и получает чужой `then`.
- **`validate.ts`** — основная работа. Фаза (d) `walkComponentProps` по образцу `walkOperatorNames`: рекурсивно
  находит ноды с `component`-оператором, валидирует их `componentProps`. Мягкий пропуск: нет `propSchemas` → фаза
  не запускается; компонента нет в карте → пропускается индивидуально. Плюс единый `formatAjvErrors` вместо
  инлайнового фильтра (строки 165-172): глушит `keyword === 'if'` (мета-ошибка дискриминации нод),
  `keyword === 'anyOf'` (мета-ошибка escape-hatch'а операторов) и ветку `operatorOp`; **называет виновника** для
  `additionalProperties` — иначе «must NOT have additional properties» не говорит, что опечатано, а это главная
  ценность строгих схем. Проверено на `{ lable, clearable: 'yes' }`: 7 сырых ошибок → 2 полезных. Ajv для props:
  `{ allErrors: true, allowUnionTypes: true }` (union из-за `min/max/step: ['number','string']`).
- **MCP** `validate-json-schema.ts`: `optionalDependencies: { "@reformer/ui-kit": ">=7.0.0" }` + ленивый
  `await import('@reformer/ui-kit/meta')` → `defaultPropSchemas`, с graceful-fallback — по образцу существующего
  импорта `renderer-json/validate`. Нет пакета → props не проверяем.

### `reformer-doc/src/components/demo/controls-from-schema.ts` (волна 0)

`controlsFromPropsSchema(schema, { omit? })`. Маппинг: `prop` ← ключ; `description`/`default`/`enum`→options/
`minimum`/`maximum`/`multipleOf` ← стандартные ключи; `group`/`type` ← `x-doc`; `kind` ← `x-doc.kind`, иначе
выводится (`enum`→enum, `boolean`→boolean, `number`→number, `string`→text, иначе readonly). `x-runtimeProps` идут
первыми — в них `value`/`onChange`/`onBlur` группы `Control`, а `ApiExplorer` группирует по первому появлению.
Сортировка стабильная по `GROUP_ORDER = ['Control','Options','Textfield','Behavior','State']`.

### Чего в рамках фичи ЯВНО не делаем

1. **Схемы для ~46 остальных компонентов** (Kbd, Skeleton, Separator, Badge…) — по потребности, когда попадут в
   DSL или получат нетривиальный api-таб.
2. **Общий `createUiKitRegistry()`** — вне охвата (хотя два v6-реестра уже разошлись: `RendererFormWizard` vs
   `Wizard`, `reg.dataSource` вместо `reg.fn`). Follow-up после волны 4.
3. **Перенос контракта враппера в CDK** — `form-field.props.ts` живёт в ui-kit, хотя `label`/`required` читает
   CDK. Осознанный компромисс: у CDK нет инфраструктуры схем, а под `FIELD_WRAPPER` регистрируется ui-kit'овый
   `FormField`.
4. **`resource: "$dataSource(X)"` в DSL** — `resource` в `x-runtimeProps` → строгая схема отвергнет его в JSON.
   Сейчас так никто не пишет (проверено). Разрешать — отдельным решением.
5. **Типизация `componentProps` в `renderer-json/src/types/json-schema.ts`** — остаётся `Record<string, unknown>`.
6. **Валидация props у array/container-нод** — фаза (d) обходит все ноды, но `mergeFieldPropsSchema` (враппер)
   применяется только к field-нодам; контейнерам подставляется их схема как есть.

## Компонент `Table` (data-driven обёртка)

У Table два варианта в смысле нашего концепта — `base` (presentational shadcn) и `data-grid` (data-driven
обёртка). Каталог `src/components/table/`:
- **`variants/base/`** — чистый shadcn: `TableRoot/TableHeader/TableBody/TableRow/TableHead/TableCell/TableCaption`
  для ручной вёрстки (стили размеров/полос — cva/Tailwind внутри, не отдельные варианты).
- **`variants/data-grid/`** — высокоуровневая обёртка `<Table settings={…}>` (движок `@tanstack/react-table`),
  реализующая заодно и `Data Table` из списка:

```ts
interface TableSettings<Row> {
  dataProvider: (params: {
    filters: Record<string, unknown>;
    pagination: { pageIndex: number; pageSize: number };
    sorting: { id: string; desc: boolean }[];
  }) => Promise<{ rows: Row[]; total: number }>;   // async, server-side
  columns: TableColumn<Row>[];                       // accessor, header, cell, sortable, filterable, width, align
  pageSize?: number;
  rowKey?: (r: Row) => string | number;
  selection?: 'none' | 'single' | 'multiple';       // опционально
  // ...прочие tableSettings: sticky header, empty/loading слоты
}
function Table<Row>({ settings }: { settings: TableSettings<Row> }): JSX.Element;
```

- Обёртка держит TanStack state (`manualPagination/manualSorting/manualFiltering = true`); при изменении
  filters/pagination/sorting вызывает `dataProvider`, рендерит через presentational части, показывает
  loading/error/empty (переиспользуя `AsyncBoundary`/`LoadingState`/`ErrorState`); `total` → расчёт страниц.
- `@tanstack/react-table` — optional peer, `external`, только subpath `@reformer/ui-kit/table` (вне barrel).
- Волна 2 (`data-grid` composite: зависит от `variants/base` + `AsyncBoundary`/state). Демо — таблица с
  mock-`dataProvider` (сортировка/пагинация/фильтр). `Data Table` из списка реализуется этим вариантом.

## Per-component sub-agent playbook (ЧЁТКАЯ ИНСТРУКЦИЯ)

Один суб-агент = один компонент = самодостаточный вертикальный срез. Инструкция воспроизводима (по образцу
`docs/iter-prompts/sub-agent.template.md`).

**Вход** (оркестратор передаёт): имя компонента; путь к его shadcn-исходнику (уже добавлен CLI в scratch-каталог
на unified `radix-ui`); классификация (F/C/Dep из таблицы); **обязательные варианты**, если они предписаны
(напр. input → `number`, table → `data-grid`) — остальные агент предлагает сам (фаза A7); **какой вариант
дефолтный** для алиаса `<Cmp>Field` и `x-registryName`; список каталогов-зависимостей (для C).

**Инварианты (жёсткие правила)**:
- Пишет **ТОЛЬКО** в: `src/components/<cmp>/**`; свой doc-config
  `projects/reformer-doc/src/components/demo/examples/<cmp>.tsx`; свою mdx-страницу
  `projects/reformer-doc/docs/ui-kit/<cmp>.mdx`. **Отдельная страница в react-playground НЕ создаётся** —
  витрина/документация живёт в reformer-doc через `ComponentDoc` (3 таба Variants/Examples/API).
- **НЕ трогает** общие файлы: `src/index.ts`, `src/meta.ts` (генерируется глобом), `package.json`,
  `vite.config.ts`, `components.json`, `src/fields/{adapters.ts, with-form-control.tsx, props-schema.ts,
  seam.props.ts}`, `src/styles/theme.css`; в reformer-doc —
  `src/components/demo/{ComponentDoc,types,field-demo,harness,index,VariantGallery,ApiExplorer,controls-from-schema,...}.*`,
  `sidebars.ts`, `src/theme/MDXComponents.tsx` (общая demo-инфраструктура и навигация — их задаёт
  оркестратор/Foundation).
- **НЕ трогает** чужие каталоги `src/components/<other>/**` — только читает зависимости.
- **Ручной `controls[]` в doc-config ЗАПРЕЩЁН** — только `controlsFromPropsSchema(...)` (§ Props-компаньоны).
  Verify-агент волны проверяет grep'ом `prop:\s*'` по `examples/*.tsx`.
- Именование: канонические shadcn-имена примитивов; `data-slot`, unified `radix-ui`, `cn`; стили — cva/Tailwind
  внутри реализации варианта (НЕ отдельные под-каталоги «стилевых вариантов»).
- **Дословный порт `variants/base/*`** — правки только: импорты (`@/lib/utils`, `@/components/<dep>`), `data-slot`,
  снятие `'use client'`. Никаких «улучшений» shadcn-кода: иначе ломается ручной diff против upstream (Риски №10/11).
- **`data-testid` — на Root примитива** (для Radix — на `*Primitive.Root`), НЕ на wrapper-`div` и НЕ на скрытый
  bubble-`input`: иначе strict-mode violation / «Not a checkbox or radio button» на ~31 e2e-сайте (Риск №1).
  RadioGroup дополнительно эмитит per-option `data-testid="input-<field>-<value>"` на каждом `Item`.
- Если нужен новый adapter-пресет — **не** добавляет в общий `adapters.ts`, а запрашивает у оркестратора
  (адаптеры — общий файл; централизуются, чтобы избежать конфликтов).

**Последовательность действий** (строго по фазам A→K):

**Фаза A — Приём и изучение (read-only, ничего не писать)**
- A1. Разобрать задание оркестратора: `<cmp>`, флаги F/C/Dep, обязательные варианты (если предписаны), дефолтный
  вариант, список каталогов-зависимостей, путь к shadcn-исходнику в scratch.
- A2. Прочитать shadcn-исходник `<cmp>` в scratch — выделить примитив, суб-части, Radix-импорты, `data-slot`.
- A3. Прочитать **пилотные эталоны волны 0.5** (это живой v7-образец; `.tmp/v6-archive/` — v6-структура, образец
  «как НЕ надо»): `src/components/button/**` (минимальный `base`-срез); если F — `src/components/select/**`
  (base+async, field+алиас, props+страж) и `src/fields/{with-form-control.tsx, adapters.ts}`; doc-эталон
  `reformer-doc/src/components/demo/examples/select.tsx` + `docs/ui-kit/select.mdx` + `demo/types.ts`
  (образец 3-раздельного `ComponentDocConfig`) и хелперы `demo/field-demo.tsx`, `demo/harness.ts`.
- A4. Если нужна props-схема (F или DSL-контейнер) — прочитать `src/fields/{props-schema.ts, seam.props.ts}`
  (типы + что уже покрыто seam'ом, чтобы не дублировать) и образец `select/variants/async/select-async.props.ts`.
- A5. Для C — прочитать **только `index.ts`** каталогов-зависимостей (какие имена импортировать через
  `@/components/<dep>`); не читать их внутренности.
- A6. Выбрать adapter под каждый F-вариант из `adapters.ts`. Если подходящего нет → **стоп-условие** (см. ниже).
- A7. **Определить набор вариантов** (решает агент). По умолчанию — **только `base`**. Функциональный вариант
  добавляется, только если оправдан реальным юзкейсом: он есть в shadcn-доке компонента либо воспроизводит
  функционал v6 (`.tmp/v6-archive/`). Плюс обязательные из задания. **Не плодить варианты «на будущее»** —
  каждый вариант умножает срез (реализация + field + props + страж + doc) и бьёт по объёму (Риск №12).
  Набор и обоснование — в dev-report (K1); оркестратор вправе отклонить.

**Фаза B — `base`-вариант**
- B1. Создать `variants/base/<cmp>-base.tsx`: портировать чистый shadcn — unified `radix-ui`, `data-slot`, `cn`,
  cva-стили внутри; убрать `'use client'`; импорты через `@/lib/utils` и `@/components/<dep>`.
- B2. Суб-части (`<cmp>-item.tsx`, `<cmp>-trigger.tsx` и т.п.) — в `variants/base/`, именованные экспорты (`<Cmp>Base`, части).

**Фаза C — функциональные варианты** (для каждого из списка, кроме `base`)
- C1. `variants/<variant>/<cmp>-<variant>.tsx` — надстройка над `../base` под юзкейс (user-picker: аватар+ФИО в опции; grouped: группировка).
- C2. Enhanced-варианты: `input/number` переносит `input-number-buffer.ts` **дословно** из `input.tsx:99-134`;
  `select/async` переносит `select-resource.ts` **байт-в-байт**. Логику не переписывать.

**Фаза D — field-версии** (только F, на каждый F-вариант)
- D1. `variants/<variant>/<cmp>-<variant>.field.tsx` = `withFormControl(<Cmp><Variant>, <adapter>)`; имя `<Cmp><Variant>Field`.
- D2. Для checkbox-раскладки проставить статический маркер `<...>Field.reformerLayout = 'inline-label'`.

**Фаза E — props-схема** (F-компоненты и DSL-контейнеры; остальным — по потребности; § Props-компаньоны)
- E1. На каждый вариант — `variants/<v>/<cmp>-<v>.props.ts`:
  `export const <cmp><Variant>PropsSchema = {…} as const satisfies PropsSchema` (`@/fields/props-schema`).
  - `properties` — только то, что реально пишут в `componentProps`: сериализуемо и не перекрывается seam'ом.
    `description` + `default` + `enum`/`minimum`/`maximum` — стандартными ключами JSON Schema; `group`/`type`/
    `kind` — в `x-doc`.
  - `x-runtimeProps` — **только** несериализуемые props ВАРИАНТА (напр. `resource` — требует функцию `load`) и
    переопределения `value`/`onChange` под адаптер. Seam не дублировать.
  - `additionalProperties: false` — по умолчанию (ловит `lable` вместо `label`). Открытый режим — просто не
    писать ключ; обосновать в dev-report.
  - Дефолтный для форм вариант помечает `'x-registryName': '<Cmp>'`.
- E2. `<cmp>.props.test.ts` — страж: тип-левел A (ключи схемы ⊆ props варианта) + B (все props классифицированы —
  только если тип НЕ наследует `React.*HTMLAttributes`) + рантайм (`properties` ∩ `x-runtimeProps` = ∅).
- E3. Дефолты и описания брать **из реализации варианта**, не из головы: расхождение — это и есть дрейф, ради
  устранения которого фаза существует.

**Фаза F — barrel**
- F1. `index.ts`: реэкспорт всех primitive-вариантов + суб-частей + всех field + **алиас `<Cmp>Field`** на дефолтный
  вариант + props-схемы всех вариантов.

**Фаза G — тесты**
- G1. `<cmp>.test.tsx` (vitest + testing-library): рендер `base` и каждого варианта; для field — `value`→primitive,
  emit→`onChange(value)`, `onBlur`, strip `control`/`testId`, passthrough `aria-*`.
- G2. Enhanced — перенесённые `input-number-buffer.test.ts`/`select-resource.test.ts` проходят **без изменений**.

**Фаза H — doc-config (reformer-doc: 3 раздела Variants / Examples / API)**
- H1. Создать `reformer-doc/src/components/demo/examples/<cmp>.tsx` → `export const <cmp>DocConfig: ComponentDocConfig`:
  - `variants: VariantDef[]` — **функциональные варианты компонента** (§ структура) как готовые пресеты
    (`{ id, title, description, render, code }`); для F — рендер через `makeFieldVariant`.
  - `examples: ExampleDef[]` — рецепты использования (напр. clearable, resource/`dataProvider`-стратегии, валидация).
  - `api: ApiConfig` — form-bound playground: `component` (field-версия), `initialValue`, `baseComponentProps`,
    `validators`, `valuePresets`, генератор `code`; `controls` — **только**
    `controlsFromPropsSchema(mergeFieldPropsSchema(<cmp><Variant>PropsSchema), { omit })`. `omit` обязателен для
    props, задаваемых `baseComponentProps`: иначе проп без `default` попадёт в `initialValues` как `undefined` и
    перетрёт их (`ApiExplorer.tsx:38-44`).
- H2. Переиспользовать `makeFieldVariant`/`useDemoField` из `../field-demo`/`../harness`; тексты — на русском.

**Фаза I — mdx-страница (reformer-doc)**
- I1. Создать `reformer-doc/docs/ui-kit/<cmp>.mdx` (по образцу `select.mdx`): frontmatter (`id/title/sidebar_label`),
  `import { ComponentDoc } from '@site/src/components/demo'`, `import { <cmp>DocConfig } from '...examples/<cmp>'`,
  краткое RU-описание, `<ComponentDoc config={<cmp>DocConfig} />`.

**Фаза J — self-check** (обязателен перед сдачей)
- J1. `tsc --noEmit` по своему каталогу + doc-config + mdx — чисто (здесь же падает страж фазы E, если схема
  разошлась с реализацией).
- J2. `vitest run <cmp>` — зелёный.
- J3. Локальная сборка своего entry — импорты резолвятся; reformer-doc не падает на своей mdx-странице.
- J4. Grep-самоаудит: тронуты **только** разрешённые пути (§ Инварианты); запрещённые файлы не изменены; в своём
  doc-config нет ручного `controls[]`.

**Фаза K — сдача**
- K1. dev-report: созданные файлы; **набор вариантов + обоснование каждого не-`base`** (фаза A7 — оркестратор
  ревьюит и вправе отклонить); использованные adapter'ы; props-схемы (+ обоснование, если `additionalProperties`
  открыт); новые deps (если Dep); отклонения/риски; что нужно от оркестратора (напр. регистрация в главном barrel
  и в `sidebars.ts`, новый adapter-пресет).

**Definition of Done**: `base` + все заданные варианты + их field + props-схемы (F и DSL-контейнеры) + страж
+ `index.ts` + тесты + doc-config (3 раздела, `controls[]` сгенерирован) + mdx-страница; self-check зелёный;
тронуты только разрешённые пути.

**Стоп-условия (эскалация к оркестратору, не решать самому)**: нет подходящего adapter-пресета; каталог-зависимость
отсутствует/не готов; конфликт имён экспортов; тяжёлая dep не в `external`-списке; неоднозначность набора вариантов;
seam-контракт варианта не выражается через `seamRuntimeProps` + override (экзотический адаптер); неясно, какой
вариант дефолтный для реестра (кому ставить `x-registryName`).

Для guide/recipe-компонентов файла-примитива нет: `Typography` = prose-классы + витрина (фазы A, B, F, H, I, J, K —
без C/D/E/G: нет вариантов, field, props-схемы и unit-тестов); `Data Table` покрыт вариантом `table/data-grid`
(отдельного агента нет).

**Выход**: самодостаточный срез, ноль пересечений с другими агентами.

## Волна −1: Очистка (clean slate)

Предварительный этап (оркестратор, до Foundation). Цель — снести v6-компоненты и их артефакты, чтобы
суб-агенты волн 1–3 создавали новое на чистом месте и не путались между старой и новой моделью
(плоский `ui/*.tsx` vs `variants/`, рукописные адаптеры vs HOC, v6 doc-конфиги vs 3-раздельные).

**Шаг 1 — сохранить переносимое (НЕ удалять)**
- `src/lib/utils.ts` (`cn`) — остаётся как есть.
- Логика для дословного переноса → во временный `.tmp/v6-carry/` (волна 1 кладёт в целевые каталоги):
  `src/components/ui/input-number-buffer.ts`+`.test.ts` → `components/input/variants/number/`;
  `src/components/ui/select-resource.ts`+`.test.ts` → `components/select/variants/async/`.
- Референс-снимок для агентов → `.tmp/v6-archive/` (gitignored): копия `ui-kit/src/components/**` (эталон
  value-based адаптеров: `input.tsx:105-123`, `checkbox.tsx:83-101`), `reformer-doc/src/components/demo/examples/**`
  и `reformer-doc/docs/ui-kit/*.mdx`. Нужен для фазы A7 (какой функционал был в v6) — но это **v6-структура,
  образец «как НЕ надо»**; живой v7-эталон даёт пилот (§ Волна 0.5). Дублирующий источник — git history.

**Шаг 2 — удалить в `@reformer/ui-kit`**
- `src/components/ui/**` — все v6-примитивы и их тесты (кроме перенесённого в шаге 1).
- `src/components/{form-array,form-wizard,state}/**` — пере-создаются в волне 3.
- `src/index.ts` (старый barrel) и `src/package-exports.test.ts` — перегенерируются/переписываются в волне 0.
- В `vite.config.ts` — рукописная карта `lib.entry` (17 записей) и `external` со старыми radix.
- В `package.json` — рукописная карта `exports` (17 subpath) + deps `@radix-ui/react-select`, `@radix-ui/react-slot`
  (в волне 0 заменяются unified `radix-ui`).

**Шаг 3 — удалить в `reformer-doc`**
- `src/components/demo/examples/*.tsx` — v6 doc-конфиги (button, checkbox, input, input-mask, input-password,
  radio-group, select, textarea → волна 1; `cdk-form-*` → волна 3).
- `docs/ui-kit/<cmp>.mdx` — v6-страницы этих компонентов.
- Записи ui-kit-компонентов в `sidebars.ts` (перегенерируются между волнами).

**Шаг 4 — НЕ трогать** (переписывается позже, нужны как эталон)
- Общая demo-инфраструктура reformer-doc: `ComponentDoc.tsx`, `types.ts`, `field-demo.tsx`, `harness.ts`,
  `VariantGallery/ApiExplorer/ApiPreview/PropsTable/Playground/Demo`, `index.ts`, `styles.module.css`
  (в волне 0 дополняется `controls-from-schema.ts`).
- Обзорные доки: `docs/ui-kit/{overview.md, form-array.md, form-navigation.md}`, `docs/packages/ui-kit.md`,
  `i18n/ru/**/ui-kit/*` — переписываются в волне 4.
- playground `pages/examples/**`, `src/index.css` и e2e — консумеры, переписываются в волне 4.

**Ожидаемое состояние**: `@reformer/ui-kit` пуст (кроме `lib/utils.ts`); пакет, playground, doc и e2e **не
собираются** — это норма greenfield-миграции до волны 4. Работать в отдельной ветке (напр.
`feat/ui-kit-shadcn-v7`); CI на ней красный до финала (Риск №7).

## Волна 0.5: Пилот (эталон до fan-out)

Волна −1 сносит все v6-компоненты, а playbook волны 1 требует равняться на живой образец — без пилота
~57 агентов стартуют вслепую и тиражируют одну ошибку 57 раз. Поэтому **оркестратор сам** (не fan-out) делает
два полных среза строго по playbook (фазы A→K):

- **`button`** — простой не-F: `variants/base` + barrel + тест + doc-config (3 таба) + mdx. Эталон минимального среза.
- **`select`** — тяжёлый F: `variants/{base, async}` + field'ы + алиас `SelectField` → `SelectAsyncField` +
  `select-async.props.ts` + страж (E2) + перенос `select-resource.ts` байт-в-байт + doc-config с
  `controlsFromPropsSchema(mergeFieldPropsSchema(...))` + mdx. Эталон всего сложного разом.

Зачем именно так:
1. **Живой эталон v7** — на него ссылаются фазы A3/A4 playbook (в архиве `.tmp/v6-archive/` лежит v6-структура,
   т.е. образец «как НЕ надо»).
2. **Проверка исполнимости playbook** — если какая-то фаза не выполняется/противоречива, правим инструкцию
   **до**, а не после 57 агентов.
3. **Калибровка объёма** (Риск №12) — замер токенов/времени на простой и на сложный срез → экстраполяция на
   волну 1 и решение, резать ли хвост.

**Гейт**: пилот принят (self-check зелёный, playbook не потребовал правок) → только тогда fan-out волны 1.

## Оркестрация: волны + Workflow fan-out

Реализация — серией Workflow-запусков (ultracode fan-out), барьер между волнами. Общие артефакты
генерирует оркестратор (не суб-агенты).

- **Волна −1 — Очистка** (оркестратор): снос v6-компонентов и артефактов, сохранение переносимой логики и
  референс-снимка (§ Волна −1). Гейт для всего остального.

- **Волна 0 — Foundation** (оркестратор, без параллелизма; после Волны −1): `components.json`; `withFormControl` +
  `adapters.ts`; `styles/theme.css`; glob-build (`vite.config.ts`) + `scripts/generate-*.mjs`; sub-agent template;
  написать заново `package-exports.test.ts`; unified `radix-ui` вместо снятых `@radix-ui/react-*`. Скелет
  `src/components/`, `src/fields/`. В reformer-doc — раздел `ui-kit` в `sidebars.ts` (пустой, наполняется между
  волнами).
  Плюс инфраструктура props-схем (§ Props-компаньоны): `src/fields/{props-schema.ts, seam.props.ts}`;
  `src/components/form-field/form-field.props.ts`; `scripts/generate-meta.mjs` + `meta`-entry в glob-build и
  `generate-exports.mjs`; в reformer-doc — `demo/controls-from-schema.ts`.
  **Плюс `Field` (shadcn) + `FormField` (ReFormer поверх него) — это инфраструктура, а не «прочий компонент»**:
  `reformer-doc/src/components/demo/field-demo.tsx:2` импортирует `FormField` из `@reformer/ui-kit`, и
  `makeFieldVariant` рендерит `<FormField control={…}/>` — значит **любой F-doc-config (фаза H) уже в пилоте и
  волне 1 не соберётся без него**, как и `reformer-doc` build между волнами. Здесь же `form-field.props.ts`
  доводится до итогового контракта враппера (`label`/`required`/`testId` + возможный `description` от
  `FieldDescription`) — отдельного «уточнения» позже не требуется.
- **Волна 0.5 — Пилот** (оркестратор): эталонные срезы `button` + `select` по playbook (§ Волна 0.5). Гейт для fan-out.
- **Волна 1 — Базовые примитивы** (fan-out ~55 суб-агентов параллельно; 64 − Toast(skipped) − 6 composite −
  `button`/`select` из пилота): все компоненты **без единого composite-варианта**. Один агент = один компонент =
  все его варианты (`base` + функц., напр. input/`number`) — полный срез (§ playbook). Сюда же **базовые утилиты**
  `AsyncBoundary` + `state` (`ErrorState`/`LoadingState`) — их использует composite-Table из волны 2.
- **Волна 2 — Компоненты с composite-вариантом** (`C`, целиком): Combobox, Date Picker, Table (base+data-grid),
  Sidebar, AI Message/Message Scroller — зависят от каталогов волны 1.
- **Волна 3 — прочие ReFormer-специфичные**: Box, Section, InputMask/InputPassword (на новом `Input`),
  ExampleCard, FormArraySection, FormWizard*. (`Field`/`FormField` здесь **нет** — они в волне 0 как
  инфраструктура doc-config'ов.)
- **Между волнами (оркестратор)**: сгенерировать глобом `src/index.ts` (главный barrel — лёгкие примитивы + их
  field, без тяжёлых), `package.json#exports`, vite-entries, `src/meta.ts` (`generate-meta.mjs`); зарегистрировать
  mdx-страницы компонентов в reformer-doc `sidebars.ts` (раздел ui-kit); прогнать `vite build` +
  `package-exports.test.ts` + size-limit + `reformer-doc` build.
- **Волна 4 — Кросс-cutting консумеры**: переписать формы-примеры (`registration-form`, `complex-multy-step-form/**`,
  `validation`, `behaviors`, MCP-примеры), renderer-json реестры + renderer-react схемы на новые `*Field`;
  переключить consumer CSS на `@import '@reformer/ui-kit/styles'` (голый импорт; снять свои `@custom-variant dark`;
  `@source` оставить); README (корень + пакета) + `llms.txt`. Плюс e2e-хвост: **ре-бейзлайн ~160 визуальных
  снапшотов** одним шагом (UI устоялся) и фикс латентной `accessibility.spec.ts:226-237` (roving tabindex Radix
  даёт `button[role=radio][tabindex="-1"]`).
  Плюс включение props-валидации (§ Props-компаньоны → renderer-json): `operatorOp` + `allowOperatorStrings` /
  `stripDocExtensions` / `propSchemas` в `schema/index.ts`; `walkComponentProps` + `formatAjvErrors` в
  `validate.ts`; `propSchemas` в реестрах примеров и в `gen-form-json-schema.ts`; MCP-tool.
- **Каждая волна**: verify-агенты адверсариально проверяют срезы (структура, seam-контракт, отсутствие правок
  общих файлов, typecheck/test), наличие `.props.ts` у F/DSL-компонентов и отсутствие ручного `controls[]`.

## Build, зависимости, тема

- **Build (glob)**: `vite.config.ts` вычисляет `lib.entry` глобом `src/components/*/index.ts` + `src/index.ts`
  + `src/meta.ts` (subpath на компонент = его barrel c primitive+field); `rollupOptions.external` = функция (react*, все `@reformer/*`, `radix-ui`, `lucide-react`, все
  тяжёлые recipe-deps). `scripts/generate-exports.mjs` пишет `package.json#exports` глобом. `package-exports.test.ts`
  переписать под глоб (dir↔export в обе стороны) — проверить, что он видит и `meta`.
- **`meta`-entry**: `src/meta.ts` генерируется `scripts/generate-meta.mjs` глобом `src/components/*/variants/*/*.props.ts`
  (реэкспорт схем + карта `defaultPropSchemas` по `x-registryName`). Держится **вне** `src/index.ts`: это чистые
  данные для Node-процессов (MCP, gen-скрипты), их незачем тащить в React-бандл — и 15 kB кап `dist/index.js` не
  задет. Экспорт `"./meta"`.
- **Зависимости**: unified `radix-ui` (убрать `@radix-ui/react-select`/`-slot`). Deps (лёгкие): `radix-ui`,
  `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tslib`, `tw-animate-css`. Новая devDep
  `@types/json-schema@^7.0.15` (для `PropsSchema`; сейчас в корне транзитивно от ajv — на hoisting не полагаться).
  `resolveJsonModule` **не нужен** — в этом плюс формата `.props.ts` против `.json`. Тяжёлые
  (`recharts`, `@tanstack/react-table`, `embla-carousel-react`, `react-day-picker`, `date-fns`, `cmdk`, `vaul`,
  `sonner`, `input-otp`, `react-resizable-panels`) → **optional peerDependencies** + `external` + **только свой
  subpath** (не в barrel `src/index.ts`).
- **Контроль бандла** (Риск №6 — сегодня его фактически нет):
  - `external` — **предикат/паттерны, не перечисление**. Текущий список точный (`@radix-ui/react-select`, `-slot`),
    поэтому любой новый `@radix-ui/react-*` **молча забандлится**. Заменить на: `/^@radix-ui\//`, `radix-ui`,
    `/^@reformer\//`, `react`/`react-dom`/`react/jsx-runtime`, `lucide-react` + все heavy-deps.
  - **Капы на то, что реально растёт**: `.size-limit.json` дополнить записями на тяжёлые subpath'ы
    (`dist/chart.js`, `dist/table.js`, `dist/calendar.js`, …) и на общий `utils`-чанк (сегодня **74 kB raw /
    12.8 kB gzip** — бандлятся clsx + tailwind-merge; капа нет). Кап `dist/index.js` (15 kB) оставить, понимая,
    что он меряет лишь re-export shim (сейчас 1.59 kB) и растёт на ~23 B brotli на компонент.
  - **size-limit шагом в CI** (`.github/workflows/test.yml`) — сейчас не запускается нигде. Учесть: `@size-limit/file`
    меряет **brotli** и **не обходит импорты**; `@reformer/core` уже на 97.8% своего лимита — краснота там ожидаема,
    поднимать осознанно.
- **Тема** (Риск №2 — решён одним файлом на обоих потребителей): `src/styles/theme.css` = токены из
  `projects/react-playground/src/index.css:8-113` (shadcn neutral/new-york oklch + chart + sidebar, radius 0.625rem)
  + `@import 'tw-animate-css'` + **комбинированные** `@custom-variant dark (&:is(.dark *, [data-theme='dark'] *))`
  и блок `.dark, [data-theme='dark'] { … }` (строго **после** `:root` — специфичность равная, решает порядок).
  Экспорт `"./styles"`, добавить CSS в `files` (сегодня публикуется только `dist`). Жёсткие ограничения:
  - импортировать **только голым** `@import '@reformer/ui-kit/styles';` — `layer(…)` роняет `@custom-variant`/`@source`
    («cannot be nested»); в `reformer-demo.css` это ломает текущий layered-идиом;
  - внутри **нет** `@import 'tailwindcss'` (Preflight убьёт Infima в doc) — Tailwind-вход остаётся у consumer'а;
  - у consumer'ов **удалить свои** `@custom-variant dark` — последний объявленный молча побеждает;
  - **`@source` остаётся у потребителя** (монорепо → на `src`, чтобы HMR видел несобранные изменения классов;
    внешние npm-потребители → на `dist`, т.к. `src` не публикуется). В `theme.css` его не класть.
  - Факт: playground dark **не активируется** (нет toggle/provider) — `.dark` там мёртвый код; живой dark у doc.

## Верификация

- **Typecheck**: `tsc --noEmit` в пакете и всех затронутых консумерах.
- **Build/exports**: `vite build` → по файлу на глоб-entry; переписанный `package-exports.test.ts` (dir↔export);
  spot-check `import '@reformer/ui-kit/chart'`, `@reformer/ui-kit/select` (primitive + field + алиас), `/styles` из `dist`.
- **Vitest**: per-component тесты (включая перезаписанные checkbox/radio под Radix DOM; `input-number-buffer.test.ts`
  и `select-resource.test.ts` должны пройти без изменений — доказывают сохранность логики); HOC-тесты (strip
  `control`/`testId`, маппинг по адаптеру, passthrough `aria-*`).
- **Props-схемы** (§ Props-компаньоны): страж **кусается** — временно переименовать проп в схеме, `typecheck`
  обязан упасть TS2344 (проверить хотя бы на одном срезе, иначе страж может молча ничего не проверять). Verify-агент:
  grep `prop:\s*'` по `reformer-doc/…/examples/*.tsx` пуст. Повторный `generate-meta.mjs` → пустой `git diff`.
- **DSL-валидация** (волна 4): **регресс совместимости** — `npm run gen:form-schema -w react-playground` без
  `propSchemas` даёт `git diff --exit-code` пуст. Юниты `validate.ts` (фикстуры прямо в тесте, **без импорта
  ui-kit**): ① нода в `componentProps.steps[…]` с опечаткой ловится — регресс на достижимость, самое важное;
  ② `options: "$dataSource(X)"` валиден; ③ компонент вне карты пропускается; ④ без `propSchemas` поведение не
  меняется; ⑤ шейпер называет опечатанный проп, шум `operatorOp`/`anyOf` не течёт. MCP: схема с
  `componentProps: { "lable": "T" }` → `must NOT have additional properties ("lable")`; боевая
  `json-schema.json` → valid.
  **Позитивный контроль, что проверка живая**: новый `Input` обязан заявить `type: 'date'` — боевая форма
  использует его ×4. Не заявит → `gen:form-schema` упадёт ровно на этих 4 полях. Это ожидаемое срабатывание, а
  не регрессия.
- **Bundle**: `size-limit` (brotli) — `dist/index.js` ≤ 15 kB (shim, пройдёт заведомо) + **новые капы**: тяжёлые
  subpath'ы и `utils`-чанк. Проверять в конце волны 2 и держать шагом в CI. Отдельно проверить, что `external`-предикат
  сработал: в `dist/**` нет инлайна `@radix-ui/*` / heavy-deps (grep по бандлам).
- **reformer-doc**: `npm run build -w reformer-doc` проходит; каждая `docs/ui-kit/<cmp>.mdx` рендерит `ComponentDoc`
  с 3 табами (Variants/Examples/API). Ручной прогон в dev: number-input (`1.`/`-`), async Select
  (поиск/пагинация/clear), checkbox, radio, Table (сортировка/пагинация/фильтр через `dataProvider`). В табе API
  панель контролов собрана из props-схемы: дефолты совпадают с реализацией, `disabled` переключает поле
  (`control.disable()`), `baseComponentProps` не перетёрты `undefined`-ами (проверка `omit`).
- **Playground**: `npm run dev -w react-playground` — все формы-примеры (не витрина компонентов) рендерятся; build проходит.
- **e2e** (`projects/react-playground-e2e`): полный прогон. **Тест-код меняться не должен** (Playwright работает
  с `role=checkbox`). Диагностика: `.check()` падает «Not a checkbox or radio button» → testid уехал на wrapper;
  strict-mode «resolved to 2 elements» → testid попал и на Root, и на bubble-input (Риск №1). Визуальные
  снапшоты — **ре-бейзлайн одним шагом в волне 4** (~160 PNG, `maxDiffPixelRatio: 0.01`, слака нет).

## Риски

Проверено фактами (playwright-core 1.57, исходники Tailwind v4, `@size-limit/file`, локальный build) — часть
исходных формулировок оказалась ложной; ниже — уточнённые риски и принятые решения.

1. **Checkbox/RadioGroup native → Radix** (средний; был «главный churn»). Playwright `.check()`/`.uncheck()`/
   `.isChecked()`/`toBeChecked()` **работают** с `button[role=checkbox][aria-checked]` (роль входит в
   `kAriaCheckedRoles`; `retarget` сохраняет её). Ни один тест не селектит `input[type=checkbox]` — всё через
   `data-testid`. **Тест-код не меняется.** Реальные под-риски:
   - `data-testid` обязан лечь на **Radix Root**. Naive `{...props}` попадёт и на Root, и на скрытый bubble-`input`
     (Radix рендерит его внутри `<form>`) → 2 узла → **strict-mode violation на ~31 сайте**; на wrapper-`div` →
     `getChecked` вернёт `"error"` → «Not a checkbox or radio button». → **инвариант playbook** (фазы B/D).
   - RadioGroup обязан сохранить per-option `data-testid="input-<field>-<value>"` на каждом `Item` — на точную
     строку завязаны `selectGender`/`selectEmploymentStatus`/`selectMaritalStatus` (`credit-form-page.pom.ts:313,432,495`).
   - Латентная ловушка `accessibility.spec.ts:226-237` («каждый `button:visible` имеет `tabindex != -1`»): Radix
     RadioGroup использует roving tabindex → `button[role=radio][tabindex="-1"]`. Сейчас зелено (на step 1 нет
     RadioGroup) — упадёт, если RadioGroup появится на step 1 или тест расширят. → фикс в волне 4.
2. **Тема: dark-селекторы** (решён). Tailwind v4 компилирует `@custom-variant dark (&:is(.dark *, [data-theme='dark'] *))`
   и блок `.dark, [data-theme='dark'] { … }` — **один `theme.css` обслуживает обоих**. Остаточные гочи (§ Тема):
   импорт только голый (`layer(…)` ломает `@custom-variant`/`@source`), последний `@custom-variant dark` молча
   побеждает, внутри нет `@import 'tailwindcss'`. Факт: playground dark-режим **не активируется вообще** (мёртвый
   код) — живой dark только в reformer-doc.
3. **Number-буфер / async Select** — держать `input-number-buffer.ts`/`select-resource.ts` **байт-в-байт**
   (частичные `1.`/`-`, debounce, пагинация, clear→`null`); их тесты — guard, переносятся первыми (волна −1 → 1).
4. **Параллельные конфликты** — verify-агент **механически** сверяет `git diff --name-only` с whitelist путей
   агента (не «на глаз»); общие файлы генерирует оркестратор.
5. **Композитные зависимости** — волна 2 строго после генерации barrel'ов волны 1; typecheck между волнами ловит
   битые импорты.
6. **Контроль бандла отсутствует** (переформулирован; был «15 kB кап упадёт»). Факты: `@size-limit/file` меряет
   **только сам файл** (в **brotli**, не gzip) и не обходит импорты; `dist/index.js` — re-export shim, **1 590 B
   из 15 kB**; при glob-entry на компонент 45 штук дадут ≈ 2.6 kB (17%) — кап пройдёт, **но не защищает ничего**.
   Настоящие дыры: `external` — **точный список**, поэтому `@radix-ui/react-*` / `radix-ui` / heavy-deps
   **забандлятся** в чанки; чанк `utils` (74 kB raw — clsx + tailwind-merge) и per-component чанки — **без капов**;
   `size-limit` **не запускается в CI** (поэтому `@reformer/core` незамеченно живёт в 461 B от своего лимита).
   → Решение: external-**паттерны**, капы на тяжёлые subpath'ы и `utils`, size-limit шагом в CI (§ Build).
7. **Длительное «красное» состояние после Волны −1** — пакет и консумеры не собираются до волны 4. Митигация:
   ветка `feat/ui-kit-shadcn-v7`, CI-красный там ожидаем; порядок «сохранить → удалить» в Волне −1 не менять.
8. **Схема врёт про вариант** — рукописный `.props.ts` расходится с реализацией. Страж (фаза E2) на `typecheck`;
   для типов от `React.*HTMLAttributes` (Input) возможно только направление A — осознанное ограничение.
9. **Seam ↔ adapter разъезжаются** — `seamRuntimeProps` описывает контракт, реализуемый `withFormControl` +
   адаптером; тип-левел связи нет. Seam-контракт один на всех, ревьюится вместе с `adapters.ts`; экзотический
   адаптер — стоп-условие playbook.
10. **Отрыв от upstream shadcn** (новый, стратегический). Реструктуризация в `variants/base/` ломает
    `npx shadcn add` / `shadcn diff` — будущие обновления upstream придётся мержить вручную. Митигация:
    `variants/base/` — **дословный порт** (правки только импорты/`data-slot`); зафиксировать версию/коммит registry
    в `components.json`; обновление = ручной diff против свежего scratch-снимка.
11. **Отсебятина в порте** (новый). При 64 агентах «улучшения» shadcn-кода становятся системными и ломают риск №10.
    Митигация: инвариант «дословный порт, без улучшений»; verify-агент диффает `variants/base/*` против
    scratch-исходника (допустимы только импорты/`data-slot`/cn).
12. **Объём** (новый). 64 компонента × полный срез (варианты + field + `.props.ts` + тест + doc-config + mdx) —
    риск застрять в «красном» (Риск №7). Митигация: измерить факт по первым ~10 агентам волны 1 и экстраполировать;
    приоритет — F-контролы и ходовые презентационные; хвост (AI-примитивы, нишевые) режется без ущерба для форм.

## Критические файлы

- `packages/reformer-ui-kit/vite.config.ts`, `scripts/generate-exports.mjs` (NEW), `scripts/generate-meta.mjs` (NEW), `package.json`, `components.json` (NEW) — build/exports/deps.
- `packages/reformer-ui-kit/src/fields/with-form-control.tsx`, `src/fields/adapters.ts`, `src/fields/props-schema.ts` (NEW), `src/fields/seam.props.ts` (NEW), `src/styles/theme.css` (NEW) — общая инфраструктура.
- `packages/reformer-cdk/src/components/form-field/{FormFieldControl.tsx, FormFieldRoot.tsx, FormFieldLabel.tsx}`, `packages/reformer-renderer-react/src/core/render-node.tsx` — контракт seam (HOC чинит и strip'ает) и контракт враппера (`label`/`required` из `componentProps`; `disabled` перетирается).
- `packages/reformer-ui-kit/src/components/{select,form-field}/**` — самые сложные порты (async Select, FormField-поверх-Field).
- `packages/reformer-renderer-json/src/validate.ts`, `src/schema/index.ts`, `src/schema/form-schema.schema.json` — props-валидация DSL (волна 4).
- `docs/iter-prompts/sub-agent.template.md` — образец для per-component playbook.
- `projects/reformer-doc/src/components/demo/{ComponentDoc.tsx, types.ts, field-demo.tsx, harness.ts, ApiExplorer.tsx, controls-from-schema.ts (NEW), examples/select.tsx}`,
  `projects/reformer-doc/docs/ui-kit/select.mdx` — система документации (3 таба) и эталон doc-config/mdx.
- `projects/react-playground/src/pages/examples/**/registry.ts`, `projects/react-playground/scripts/gen-form-json-schema.ts`, `projects/react-playground/src/index.css` — репрезентативные консумеры + CI-гейт схемы + миграция темы.
