# Композиция форм как словарь схемы (Угол 2: первоклассные узлы)

> Расширение контракта `docs/plans/stateful-sleeping-volcano.md` на две недостающие оси
> (динамический выбор, асинхронная загрузка) с исправлением инварианта №1 и предпосылки про селекторы.
> Статус: дизайн. Ничего не реализовано.

## 0. Одной фразой

Композиция становится частью **словаря схемы**: три новых узла (`fragment`, `variant`) и один
новый оператор (`$param`) плюс **фаза резолва документа** для асинхронности. Всё разворачивается
на этапе build, до `createForm`. Асинхронность — свойство ДОКУМЕНТА, а не узла, потому что
`convertNodeM1` синхронен не случайно, а по необходимости (см. §1).

---

## 1. Исправление инварианта №1 (обязательно прочесть до дизайна)

Оригинальная формулировка (`stateful-sleeping-volcano.md`, инвариант 1): «реализация "фрагмент =
компонент, рендерящий поддерево" запрещена — она теряет валидаторы, `harvestFieldConfig` не
заглядывает в React-компоненты».

**Обоснование ложное.** `harvestFieldConfig` (`packages/reformer/src/form/create-form.ts:94-101`)
переносит ровно пять ключей — `component`, `componentProps`, `updateOn`, `disabled`, `debounce`.
`validators` среди них нет и быть не может: schema-валидация живёт вне layout-дерева
(`validateModel` из `@reformer/core/validation`), что сам код и декларирует на `create-form.ts:149-151`.
Валидаторы теряются не у фрагмента-компонента, а у любого листа M1 — это открытый баг ReFormer-ixr.

**Запрет надо сохранить, но по трём другим причинам.** Поддерево, появившееся ПОСЛЕ `createForm`:

| что ломается | где | чинится постфактум? |
|---|---|---|
| `ModelArrayNode` не материализуется → строки массива рендерятся пустыми, `applyEach` бросает | `create-form.ts:222-234` (`if (!itemFn) continue`), `behaviors.ts:404-419` | **нет.** `GroupNode._fields` заполняется в конструкторе; единственная внешняя запись — `create-form.ts:233`, до `getProxy()` |
| `FieldNode.component` не установлен → ui-kit `FormField` теряет inline-label-детект, cdk `FormFieldControl` не может авторендерить контрол | `field-node.ts:109,123` (`public readonly`), `ui-kit/.../form-field.tsx:109`, `cdk/.../FormFieldControl.tsx:95` | **нет** (readonly, нет `setComponent`) |
| `componentProps` не собран → под `settings={{ fieldWrapper: FormField }}` поля рендерятся без label/required/description | `render-node.tsx:244`, `cdk/useFormField.ts:141,155,191` | частично: `FieldNode.updateComponentProps` (`field-node.ts:551`), но `description` peek'ается один раз (`form-field.tsx:114`) |
| `disabled` не применён | `field-node.ts:139` | да: `disable()`/`enable()` (`form-node.ts:365,376`) |
| `updateOn`/`debounce` | — | в M1 **инертны** (гейтятся собственными валидаторами ноды, которых в M1 нет: `field-node.ts:174,190,315,480`). Если ReFormer-ixr починят — перестанут быть инертны, и цена вырастет |

Плюс: `registerSignalNode` — **модульно-глобальный** `WeakMap` без владельца
(`signal-node-registry.ts:18,42`, last-write-wins). Вторая форма над теми же сигналами молча
перепривязывает листья родителя, а `GroupNode` продолжает агрегировать valid по осиротевшим нодам
(`group-node.ts:202-213`) — рассинхрон без единого warning.

### Инвариант №1 (новая редакция)

> Переиспользуемый блок обязан разворачиваться в **тот же объект `FormSchemaNode`**, который передан
> в `createForm({ model, schema })`. Именно этот вызов (а) материализует model-массивы в
> `ModelArrayNode`, (б) наполняет глобальный реестр сигнал→нода, от которого зависят рендер строк,
> роутинг ошибок `validateModel` и `enableWhen`, (в) устанавливает `readonly component` на листовых
> нодах. Реализации «фрагмент = React-компонент, рендерящий поддерево» и «фрагмент = `React.lazy` +
> `Suspense`» запрещены. Про валидаторы — вычеркнуть.

Практическое следствие, которое разблокирует оси 2 и 3: запрет **не** запрещает менять layout в
рантайме — он запрещает менять его **после** `createForm`. Значит выбор варианта делается либо
внутри builder'а схемы (ось 2, §3), либо пересборкой формы над той же моделью (ось 3, §4).

### Исправление предпосылки про селекторы

`createRenderSchema` (`render-schema-proxy.ts:167-245`) **не обходит дерево**: карты пустые до первого
`.node(selector)`, резолв — на каждой ноде в момент рендера по строке (`render-node.tsx:653-671`).
Коллизия двух инстансов фрагмента реальна, но её механизм — общий строковый namespace, а не
однократно собранный индекс. Отсюда два практических вывода, которых в плане нет:

- фоллбэк `refRegistry` на `__path` работает **только** когда у листа НЕТ `selector`
  (`render-node.tsx:701`: `selector ?? __path`) — префикс нужен листьям с селекторами тоже;
- `propsOverride` вычисляется для всех узлов (`render-node.tsx:656`), но применяется **только**
  в контейнерной ветке (`:737`). `schema.node('<лист>').patchProps({...})` — тихий no-op.
  Фрагменты сделают этот баг заметнее; фикс — 3 строки в `ModelFieldRenderer`, идёт компаньоном.

---

## 2. Ось 1 — переиспользование: узел `fragment` + оператор `$param`

### Типы

```ts
// packages/reformer-renderer-react/src/core/fragment.ts   (новый файл)
export interface FragmentContext<S = unknown, P = Record<string, unknown>> {
  /** Под-модель, к которой привязаны листья фрагмента. Всегда FormModel (группа), не лист. */
  scope: FormModel<S>;
  /** Литеральные параметры точки подстановки. */
  params: P;
  /** Применённый префикс селекторов (только для чтения; применяется автоматически в at()). */
  selectorPrefix?: string;
}

export interface Fragment<S = unknown, P = Record<string, unknown>> {
  readonly name: string;
  readonly __isReformerFragment: true;
  /** @internal — сырой билдер; вызывается конвертером JSON. */
  build(ctx: FragmentContext<S, P>): RenderNode<unknown>;
  at(scope: FormModel<S>, params?: P, opts?: { selectorPrefix?: string }): RenderNode<unknown>;
}

export function defineFragment<S, P = Record<string, unknown>>(
  name: string,
  build: (ctx: FragmentContext<S, P>) => RenderNode<unknown>,
): Fragment<S, P>;

/**
 * Рекурсивно префиксует `selector` (контейнеры, листья, массивы) и оборачивает `item`-фабрики.
 * При пустом/undefined префиксе возвращает ТУ ЖЕ ссылку (инвариант стабильности, §6).
 */
export function prefixSelectors<T>(node: RenderNode<T>, prefix: string | undefined): RenderNode<T>;
```

```ts
// packages/reformer-renderer-json/src/types/json-schema.ts   (дополнение)
export interface JsonFragmentNode {
  selector?: string;
  /** Реестровый TS-фрагмент либо локальный definitions-блок. */
  fragment: FragmentOp | DefOp;
  /** Scope модели. Обязан резолвиться в ГРУППУ. По умолчанию — текущий scope. */
  scope?: ModelOp;
  /** Префикс селекторов внутри инстанса. По умолчанию — `selector`, если задан. */
  selectorPrefix?: string;
  /** Литералы, доступные внутри тела через `$param(name)`; значения проходят transformPropValue. */
  params?: Record<string, unknown>;
}
```

### Операторы — единственная точка расширения

```ts
// packages/reformer-renderer-json/src/operators.ts
const OPERATOR_RE = /^\$(model|component|html|dataSource|fn|locale|fragment|def|param)\((.+)\)$/;

export type FragmentOp = `$fragment(${string})`;
export type DefOp      = `$def(${string})`;
export type ParamOp    = `$param(${string})`;
export interface ParsedOperator {
  op: 'model'|'component'|'html'|'dataSource'|'fn'|'locale'|'fragment'|'def'|'param';
  arg: string;
}
export const isFragmentOp = (v: unknown): v is FragmentOp => parseOperator(v)?.op === 'fragment';
export const isDefOp      = (v: unknown): v is DefOp      => parseOperator(v)?.op === 'def';
export const isParamOp    = (v: unknown): v is ParamOp    => parseOperator(v)?.op === 'param';
```

**Важное решение по `definitions.operatorOp` в мета-схеме** (`form-schema.schema.json:44-48`).
`operatorOp` — escape-hatch: `allowOperatorStrings` оборачивает КАЖДЫЙ проп `componentProps`
в `anyOf:[честный тип, operatorOp]` (`schema/index.ts:135-159`). Туда добавляется **только `param`**:

```json
"operatorOp": { "pattern": "^\\$(model|component|html|dataSource|fn|locale|param)\\(.+\\)$" }
```

`$fragment`/`$def` — дискриминаторы УЗЛА, а не значения пропа; голая строка `"$fragment(X)"`
в позиции пропа не несёт ни scope, ни params и должна оставаться невалидной. Фрагмент внутри
`componentProps` подставляется объектом-узлом (см. §6, `looksLikeNode`).

⚠️ Регулярка живёт в двух местах — `operators.ts:86` и `form-schema.schema.json` (строкой).
Нужен тест-сторож: `expect(metaSchema.definitions.operatorOp.pattern).toBe(<строка из operators.ts>)`.

### Кейс: два адреса (complex-multy-step-form-renderer-json)

Сегодня в `projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.json`
блок адреса скопирован дословно дважды: строки 455-527 (`registrationAddress.*`) и 530-604
(`residenceAddress.*`) — ~140 строк JSON, различающихся только префиксом пути и заголовком секции.

Становится:

```json
{
  "version": "2.0",
  "definitions": {
    "AddressBlock": {
      "component": "$component(Section)",
      "componentProps": { "title": "$param(title)", "titleClassName": "text-lg font-semibold", "className": "space-y-4" },
      "children": [
        { "component": "$component(Box)", "componentProps": { "className": "grid grid-cols-2 gap-4" },
          "children": [
            { "value": "$model(region)", "component": "$component(Input)", "componentProps": { "label": "Регион" } },
            { "value": "$model(city)",   "component": "$component(Input)", "componentProps": { "label": "Город"  } }
          ]},
        { "value": "$model(street)", "component": "$component(Input)", "componentProps": { "label": "Улица" } },
        { "component": "$component(Box)", "componentProps": { "className": "grid grid-cols-3 gap-4" },
          "children": [
            { "value": "$model(house)",      "component": "$component(Input)",     "componentProps": { "label": "Дом" } },
            { "value": "$model(apartment)",  "component": "$component(Input)",     "componentProps": { "label": "Квартира" } },
            { "value": "$model(postalCode)", "component": "$component(InputMask)", "componentProps": { "label": "Индекс", "mask": "999999" } }
          ]}
      ]
    }
  },
  "root": { "…": "…",
    "children": [
      { "fragment": "$def(AddressBlock)", "scope": "$model(registrationAddress)",
        "selectorPrefix": "reg", "params": { "title": "Адрес регистрации" } },
      { "fragment": "$def(AddressBlock)", "scope": "$model(residenceAddress)",
        "selectorPrefix": "res", "params": { "title": "Адрес проживания" } }
    ]}
}
```

`data-testid` **не** требует параметра: рендерер выводит его из `__path` сигнала
(`render-node.tsx:179-185`), а пути инстансов различны (`registrationAddress.city` vs
`residenceAddress.city`). Конвенция iter-промтов (`componentProps.testId = fieldName`) в теле
фрагмента неприменима — там testId обязан оставаться пустым, иначе оба инстанса дадут один
`data-testid`. Это отдельная строка в документации фрагментов.

Модельный и валидационный слои переиспользуются УЖЕ сегодня и не меняются:
`apply([model.$.registrationAddress, model.$.residenceAddress], addressBehavior)`
(`complex-multy-step-form/schemas/behavior.ts:137`) и `addressSchema({ model: model.registrationAddress })`
(`.../schemas/validation.ts:444,448`). Фрагмент закрывает третий, единственный незакрытый слой — layout.

---

## 3. Ось 2 — динамический выбор: узел `variant` + `when` на `RenderNode`

### Почему не `hideWhen`

`hideWhen` пишет в `conditionRegistry` по строке-селектору (`render-behavior.ts:67-69`), а конвертер
до proxy не дотягивается (`createRenderSchema(fn)` оборачивает уже готовую фабрику,
`json-form-renderer.tsx:228-229`). Плюс селектор — общий namespace: два инстанса фрагмента
с одинаковым внутренним селектором получат одно условие. Значит условие должно жить **в узле**.

### Минимальное расширение рендерера (renderer-react)

```ts
// packages/reformer-renderer-react/src/core/types.ts — на все три вида узла
/**
 * Условие ПОКАЗА, встроенное в узел (в отличие от hideWhen, адресующего по selector).
 * Реактивно. Приоритет: setHidden(override) > hideWhen(selector) > when(node).
 */
when?: () => boolean;
```

```tsx
// packages/reformer-renderer-react/src/core/render-node.tsx:664-666 — было
const conditionFn = selector ? overrideMaps?.conditionRegistry.get(selector) : undefined;
const isHiddenByBehavior = useCondition(conditionFn);
// стало (число хуков не меняется)
const selectorCondition = selector ? overrideMaps?.conditionRegistry.get(selector) : undefined;
const nodeWhen = (node as { when?: () => boolean }).when;
const effectiveCondition = selectorCondition ?? (nodeWhen ? () => !nodeWhen() : undefined);
const isHiddenByBehavior = useCondition(effectiveCondition);
```

Плюс маленький пробрасывающий компонент (обёртка `variant` по умолчанию; `React.Fragment`
не годится — `isContainerRenderNode` (`utils.ts:73-84`) не пропускает symbol):

```tsx
// packages/reformer-renderer-react/src/core/passthrough.tsx  (новый)
export function SchemaPassthrough({ children }: { children?: ReactNode }): ReactNode {
  return <>{children}</>;
}
```

### JSON-узел

```ts
export interface JsonVariantCase {
  /** Литералы дискриминатора либо `$fn(name)`-предикат `(value, model) => boolean`. */
  when?: unknown[] | FnOp;
  /** Селектор контейнера ветки (после префиксования) — точка для hideWhen/patchProps извне. */
  selector?: string;
  node: JsonNode;
}
export interface JsonVariantNode {
  selector?: string;
  /** Дискриминатор. Обязан резолвиться — иначе ошибка конвертации (не warn). */
  variant: ModelOp;
  cases: JsonVariantCase[];
  /** Что показать, когда ни одна ветка не подошла. */
  fallback?: JsonNode;
  /** Обёртка (анимация переключения и т.п.). По умолчанию SchemaPassthrough. */
  component?: ComponentOp | HtmlOp;
  componentProps?: Record<string, unknown>;
}
```

### Разворот (build-time, ВСЕ ветки)

```
{ variant, cases, fallback }
  ↓ convertNodeM1
{ selector, component: SchemaPassthrough | resolved, componentProps,
  children: [
    { ...convert(case[0].node), when: () => matches(sig.value, case[0]) },
    ...
    { ...convert(fallback),     when: () => !cases.some(matches) },
  ] }
```

Ветка копируется поверхностно (`{ ...caseNode, when }`) — `children`/`item` остаются теми же
ссылками, кэш поддеревьев массива (`render-node.tsx:331-339`, ключ — identity `node.item`) не рвётся.
Если у ветки уже есть свой `when` (вложенный variant) — условия композируются `&&`.

Все ветки присутствуют в дереве на момент `createForm` ⇒ массивы веток материализуются,
реестр сигнал→нода полон, `component` у листьев установлен. Неактивные ветки просто не монтируются
(`isHidden → return null`, `render-node.tsx:682`).

### ⚠️ Layout-only `variant` — ловушка. Обязательный компаньон: гейты модели

Скрытая ветка **остаётся в payload и в валидации**:

- `GroupNode.getValue()` (`group-node.ts:239-246`) не смотрит `disabled`; `FormSubmitter`
  зовёт `form.getValue()` (`form-submitter.ts:137`). Opt-out'а нет
  (`getRawValue`/`includeDisabled`/`skipDisabled` по `packages/` — 0 совпадений).
  Сам код это признаёт: `behaviors-node.ts:32-34` («мусор утечёт в payload»),
  а `form-node.ts:363` утверждает обратное — JSDoc ядра противоречат друг другу.
- `validateModel` слова `disabled` не знает (0 совпадений в `validation-schema.ts`).
  Скрытая, но не обёрнутая в `validateWhen` ветка **завалит submit**.

Поэтому узел `variant` обязан экспортировать свою дискриминацию в модельный и валидационный слои:

```ts
// packages/reformer-renderer-json/src/variants.ts  → subpath "@reformer/renderer-json/variants"
export interface VariantBranchGate {
  /** Абсолютный путь группы-ветки в модели ('vehicle'), либо null — у ветки нет своей группы. */
  scopePath: string | null;
  /** Литералы активности; либо имя $fn-предиката. */
  caseValues?: unknown[];
  predicateFn?: string;
  /** Итоговый (префиксованный) селектор контейнера ветки. */
  selector?: string;
}
export interface VariantGate {
  /** Абсолютный путь дискриминатора ('insuranceType'). */
  on: string;
  selector?: string;
  branches: VariantBranchGate[];
}

/** Статический разбор схемы (после resolveSchemaDefinitions). Не требует модели. */
export function collectVariantGates(schema: JsonFormSchema): VariantGate[];

/** Реактивные предикаты активности: scopePath → () => boolean. Для validateWhen. */
export function variantPredicates<T>(
  model: FormModel<T>, gates: VariantGate[], registry?: ComponentRegistry,
): Record<string, () => boolean>;

/**
 * Вызывается ВНУТРИ defineFormBehavior (использует ambient-scope, как enableWhen).
 * Отдельным FormBehavior сделать нельзя: createForm принимает один behavior, а
 * behaviors.apply() на корне не работает — `if (!path) continue` (behaviors.ts:598) отсекает
 * корневой путь ''.
 */
export function gateVariants<T>(
  model: FormModel<T>, gates: VariantGate[],
  opts?: { resetOnDisable?: boolean; registry?: ComponentRegistry },
): void;
```

`gateVariants` разворачивается в `disableWhen(model.$.<scopePath>, () => !active, { resetOnDisable: true })`
(`behaviors.ts:341` → `enableGroup:349-366` → `nodeByPath`). Это даёт: `form.valid` игнорирует
выключенную ветку (`aggregate-signals.ts:88-91` — `child.disabled.value || child.valid.value`),
значения ветки обнуляются в МОДЕЛИ (`FieldNode.reset` пишет в `_value`, который и есть сигнал
модели, `field-node.ts:130,222`). Что НЕ решается: **ключи остаются** — payload будет
`{ vehicle:{vin:'',…}, property:{…}, health:{…}, travel:{…} }`. Омиссии в ядре нет; это отдельная
задача (`GroupNode.getValue({ skipDisabled })` или submit-transform) и она вне этого дизайна.

### Кейс: шаг 3 страховой формы (4 взаимоисключающих варианта)

Спека `docs/specs/insurance-application-form.md` (read-only) даёт четыре секции шага 3 с
непересекающимися префиксами полей: `vehicle.*` (L394), `property.*` + `property.address.*` (L575),
`health.*` + `lifeCoverageOptions.*` (L800), `travel.*` + `travelCoverageOptions.*` (L1014).
Массивов внутри шага 3 нет (проверено: `health.chronicDiseases`/`health.surgeries` — Textarea) —
значит жёсткая зона инварианта №1 здесь не задета вовсе. Массивы (`drivers`, `beneficiaries`,
`claims`) живут на шагах 4-5 и все top-level, то есть материализуются штатно.

```json
{
  "component": "$component(Step)",
  "componentProps": { "title": "Объект страхования" },
  "children": [{
    "variant": "$model(insuranceType)",
    "selector": "step3.object",
    "cases": [
      { "when": ["casco", "osago"], "selector": "vehicle",
        "node": { "fragment": "$def(VehicleObject)",  "scope": "$model(vehicle)",  "selectorPrefix": "obj.vehicle" } },
      { "when": ["property"], "selector": "property",
        "node": { "fragment": "$def(PropertyObject)", "scope": "$model(property)", "selectorPrefix": "obj.property" } },
      { "when": ["life"], "selector": "health",
        "node": { "fragment": "$def(HealthObject)",   "scope": "$model(health)",   "selectorPrefix": "obj.health" } },
      { "when": ["travel"], "selector": "travel",
        "node": { "fragment": "$def(TravelObject)",   "scope": "$model(travel)",   "selectorPrefix": "obj.travel" } }
    ],
    "fallback": { "component": "$html(p)", "children": ["Выберите тип страхования на шаге 1"] }
  }]
}
```

`PropertyObject` переиспользует `AddressBlock` — **относительный scope композируется**:

```json
"PropertyObject": {
  "component": "$component(Section)",
  "children": [
    { "value": "$model(type)",        "component": "$component(Select)", "componentProps": { "options": "$dataSource(PROPERTY_TYPES)" } },
    { "value": "$model(area)",        "component": "$component(Input)",  "componentProps": { "label": "Площадь, м²", "type": "number" } },
    { "value": "$model(floor)",       "component": "$component(Input)",  "componentProps": { "label": "Этаж" }, "selector": "floor" },
    { "fragment": "$def(AddressBlock)", "scope": "$model(address)", "selectorPrefix": "addr",
      "params": { "title": "Адрес объекта" } }
  ]
}
```

`$model(address)` внутри `PropertyObject` резолвится от `property` → `property.address`;
селекторы складываются в `obj.property.addr.<sel>`. «Условия внутри условий» из спеки
(`property.floor` только для квартир) — вложенный `variant` либо `hideWhen` по
`schema.node('obj.property.floor')`.

Полная обвязка на стороне приложения:

```ts
const gates = collectVariantGates(resolvedSchema);

const behavior = defineFormBehavior<Insurance>(({ model }) => {
  /* …существующее… */
  gateVariants(model, gates, { resetOnDisable: true, registry });
});

const p = variantPredicates(model, gates, registry);   // { vehicle, property, health, travel }
const validation = defineValidationSchema<Insurance>(({ model }) => {
  validateWhen(p.vehicle,  () => { validate(model.$.vehicle.vin, [required(), exactLength(17)]); /*…*/ });
  validateWhen(p.property, () => { addressSchema({ model: model.property.address }); /*…*/ });
  validateWhen(p.health,   () => { /*…*/ });
  validateWhen(p.travel,   () => { /*…*/ });
});
```

Один предикат — три слоя (layout через `when` узла, модель через `gateVariants`, валидация через
`validateWhen`), выведенные из ОДНОГО объявления в схеме. Это ровно та дедупликация девяти
бизнес-предикатов, которую измеряет `docs/plans/2-resilient-wigderson.md` (28 повторов).

---

## 4. Ось 3 — асинхронность: фаза документа, а не узел

### Почему не «асинхронный узел»

`convertNodeM1` синхронен, и это не техдолг: его результат обязан целиком существовать до
`createForm` (§1). Три отвергнутых варианта:

- **`React.lazy`/`Suspense` внутри фрагмента.** Поддерево невидимо для `harvestFieldConfig` ⇒
  массивы не материализуются, `component` листьев не установлен. Плюс во всём
  `renderer-react`/`renderer-json`/`form-registry` нет ни одного `React.lazy`/`Suspense`
  (в cdk `AsyncBoundary` стоит явный дисклеймер «это НЕ Suspense-boundary»).
- **Плейсхолдер-узел, патчащийся по приезде.** Постфактум API есть только для `componentProps`
  и `disabled`; `component` — readonly, массивов — нет вовсе. Тихая порча.
- **`$component(FormOutlet)` из `@reformer/form-registry`.** Проп `model` там уже есть
  (`mounted-form.tsx:29,49-59`, покрыт тестом `react-layer.test.tsx:139-161`), и он честно
  закрывает ось 3 — но ценой ВТОРОЙ формы над сигналами родителя, а `signal-node-registry`
  глобален и владельца не знает. Годится для «под-форма = самостоятельная единица поставки
  из чужого бандла», не годится для «шаг одной формы».

### Контракт

Отложенный definitions-блок — это `{ $src }`; узел-точка подстановки не меняется вовсе.

```ts
// packages/reformer-renderer-json/src/types/json-schema.ts
export type JsonSchemaSource =
  | { kind: 'inline'; value: JsonNode }
  | { kind: 'module'; name: string }               // резолвится хостом (import map микрофронта)
  | { kind: 'http';   url: string; init?: RequestInit };

export interface JsonDeferredDefinition { $src: JsonSchemaSource }
export type JsonDefinition = JsonNode | JsonDeferredDefinition;

export interface JsonFormSchema<T = unknown> {
  /* … */
  definitions?: Record<string, JsonDefinition>;
}
```

```ts
// packages/reformer-renderer-json/src/resolve-definitions.ts   (новый)
export interface ResolveDefinitionsOptions {
  load: (src: JsonSchemaSource, name: string) => Promise<JsonNode>;
  /** Какие имена нужны сейчас. По умолчанию — ВСЕ отложенные (eager). */
  need?: (name: string) => boolean;
  /** Предел транзитивного резолва ($src → $def → $src). По умолчанию 8. */
  maxDepth?: number;
  signal?: AbortSignal;
}
export interface ResolvedJsonFormSchema<T = unknown> extends JsonFormSchema<T> {
  /** Ключ пересборки: меняется, когда множество разрешённых definitions расширилось. */
  readonly __resolvedRevision: string;
}
export async function resolveSchemaDefinitions<T>(
  schema: JsonFormSchema<T>, opts: ResolveDefinitionsOptions,
): Promise<ResolvedJsonFormSchema<T>>;
```

```ts
// packages/reformer-renderer-json/src/use-resolved-schema.ts   (новый)
export type SchemaResource<T> =
  | { status: 'pending'; schema?: ResolvedJsonFormSchema<T> }
  | { status: 'ready';   schema:  ResolvedJsonFormSchema<T> }
  | { status: 'error';   error: unknown; retry: () => void; schema?: ResolvedJsonFormSchema<T> };

export function useResolvedSchema<T>(
  schema: JsonFormSchema<T>,
  opts: ResolveDefinitionsOptions & { deps?: readonly unknown[] },
): SchemaResource<T>;
```

Форма ресурса намеренно повторяет `FormResource` из
`packages/reformer-form-registry/src/react/use-form-resource.ts:41-47` — без Suspense, как везде.

`convertNodeM1`, встретив неразрешённый `{ $src }`, **бросает**:
`Definition "PropertyObject" is deferred ($src) — call resolveSchemaDefinitions() before building the form.`
Это громкий контракт, а не мягкая деградация: тихий пропуск дал бы форму без половины полей.

### Две стратегии и честная цена

**Eager (рекомендация по умолчанию).** `need` не задан → грузим все четыре варианта разом, до
`createJsonForm`. Пересборки формы не бывает никогда, весь §3 работает как описано. Цена —
4 JSON-блоба вместо 1. Для шага 3 страховой формы это верный выбор: это разметка, а не код.

**Lazy (escape hatch).** Грузим только активную ветку; при смене типа страхования резолвится
новая и **форма пересобирается над той же моделью**:

```tsx
const model = useMemo(() => createInsuranceModel(), []);            // создаётся один раз
const active = useSignalValue(model.$.insuranceType);
const need = useCallback((n: string) => n === 'AddressBlock' || n === DEF_BY_TYPE[active], [active]);
const res = useResolvedSchema(schema, { load, need, deps: [active] });

const jsonForm = useMemo(
  () => (res.status === 'ready'
    ? createJsonForm<Insurance>({ schema: res.schema, registry, model, behavior })
    : null),
  [res.status === 'ready' ? res.schema.__resolvedRevision : null, model],
);

if (!jsonForm) return <Skeleton />;
return <JsonFormRenderer key={res.schema.__resolvedRevision} form={jsonForm} renderBehavior={rb} />;
```

Что переживает пересборку: **все значения** (модель одна и создаётся вне). Что теряется:
`touched`, разложенные ошибки, состояние нод; `behavior.__run` перезапускается. `registerSignalNode`
при этом самолечится (`create-form.ts:245` перерегистрирует листья) — но старая форма нигде не
диспозится: `.dispose()` не вызывается ни разу во всём `renderer-json`/`renderer-react`/
`form-registry`/`cdk`. Значит lazy-режим **требует** предварительной задачи «дисциплина dispose»,
иначе каждое переключение варианта копит осиротевшие effect'ы (и `enableGroup` их и так течёт —
`behaviors.ts:349-366` не оборачивает `effect` в `onDispose`, в отличие от скалярной ветки на `:333`).

### Прямая оценка оси 3

Это **слабая ось для данного угла**. Первоклассный узел даёт композицию словаря, но асинхронность
он не делает первоклассной — он её ЛЕГАЛИЗУЕТ в отдельной фазе. Честная формулировка результата:
«асинхронно грузится ДОКУМЕНТ схемы (или его части), а форма всегда собирается из полного
синхронного документа». Кто хочет по-настоящему асинхронную под-форму без пересборки — идёт
в `@reformer/form-registry` `FormOutlet model={…}` и платит второй формой и четырьмя правками
пакета (владелец в signal-node-registry, dispose, preflight против хостовой модели, агрегация
валидности). Внутри этого дизайна такой путь сознательно не выбран.

---

## 5. Порядок дискриминации узлов

Рантайм (`convertNodeM1`) и мета-схема (`definitions.node`) обязаны совпадать посимвольно:

| # | guard | ключ-дискриминатор |
|---|---|---|
| 1 | `isFragmentNode` | `fragment` (`isFragmentOp \|\| isDefOp`) |
| 2 | `isVariantNode`  | `variant` (`isModelOp`) + `Array.isArray(cases)` |
| 3 | `isArrayNode`    | `array` (`isModelOp`) + `item.$template` |
| 4 | `isFieldNode`    | `value` (`isModelOp`) |
| 5 | `isContainerNode`| `component` (`isComponentOp \|\| isHtmlOp`) |
| 6 | — | `throw new Error('Invalid JSON node (M1): …')` |

`fragment` первым — узел может нести `selector`/`params` и не должен спутаться ни с чем.
`variant` до `array` — оба несут `$model(...)`, но в разных ключах; `additionalProperties:false`
на обоих узлах делает их взаимоисключающими структурно.

Мета-схема (`form-schema.schema.json`) — цепочка `if/then/else` (не `oneOf`: с `allErrors`
ajv похоронил бы настоящую причину, см. `$comment` на `:50`):

```json
"node": {
  "if":   { "type": "object", "required": ["fragment"] },
  "then": { "$ref": "#/definitions/fragmentNode" },
  "else": {
    "if":   { "type": "object", "required": ["variant"] },
    "then": { "$ref": "#/definitions/variantNode" },
    "else": {
      "if":   { "type": "object", "required": ["array"] },
      "then": { "$ref": "#/definitions/arrayNode" },
      "else": {
        "if":   { "type": "object", "required": ["value"] },
        "then": { "$ref": "#/definitions/fieldNode" },
        "else": { "$ref": "#/definitions/containerNode" }
      }}}},

"fragmentNode": {
  "type": "object", "required": ["fragment"], "additionalProperties": false,
  "properties": {
    "selector": { "type": "string" },
    "fragment": { "anyOf": [{ "$ref": "#/definitions/fragmentOp" }, { "$ref": "#/definitions/defOp" }] },
    "scope": { "$ref": "#/definitions/modelOp" },
    "selectorPrefix": { "type": "string" },
    "params": { "type": "object" }
  }
},
"variantNode": {
  "type": "object", "required": ["variant", "cases"], "additionalProperties": false,
  "properties": {
    "selector": { "type": "string" },
    "variant": { "$ref": "#/definitions/modelOp" },
    "cases": { "type": "array", "minItems": 1, "items": {
      "type": "object", "required": ["node"], "additionalProperties": false,
      "properties": {
        "when": { "anyOf": [{ "type": "array" }, { "$ref": "#/definitions/fnOp" }] },
        "selector": { "type": "string" },
        "node": { "$ref": "#/definitions/node" }
      }}},
    "fallback": { "$ref": "#/definitions/node" },
    "component": { "anyOf": [{ "$ref": "#/definitions/componentOp" }, { "$ref": "#/definitions/htmlOp" }] },
    "componentProps": { "type": "object" }
  }
},
"fragmentOp": { "type": "string", "pattern": "^\\$fragment\\(.+\\)$" },
"defOp":      { "type": "string", "pattern": "^\\$def\\(.+\\)$" },
"fnOp":       { "type": "string", "pattern": "^\\$fn\\(.+\\)$" },
"definitionEntry": {
  "anyOf": [
    { "$ref": "#/definitions/node" },
    { "type": "object", "required": ["$src"], "additionalProperties": false,
      "properties": { "$src": { "type": "object", "required": ["kind"] } } }
  ]
}
```

Корень: `"definitions": { "type": "object", "additionalProperties": { "$ref": "#/definitions/definitionEntry" } }`
(корневой `additionalProperties:false` требует явного объявления, `form-schema.schema.json:8`).

⚠️ Коллизия имён: наш корневой ключ `definitions` совпадает с ключевым словом JSON Schema.
Технически конфликта нет (наш — под `properties`), но редактировать мета-схему станет заметно
неприятнее. Альтернатива — назвать наш ключ `fragments`. Вынесено в открытые вопросы.

`buildFormSchemaMetaSchema` (`schema/index.ts:214`) дополнительно сужает `fragmentOp` до enum имён
реестра и `defOp` — до ключей `schema.definitions`, ровно как уже делается для `componentOp`/`htmlOp`.

---

## 6. Механика конвертера

```ts
// packages/reformer-renderer-json/src/converter/json-to-render-schema.ts
interface ConvertCtx {
  registry: ComponentRegistry;
  /** Только уже разрешённые (inline) блоки. Отложенные отсеяны resolveSchemaDefinitions. */
  definitions: Record<string, JsonNode>;
  /** Стек имён для детекта циклов $def. */
  stack: readonly string[];
  /** Накопленный префикс селекторов ('obj.property.addr'). */
  prefix?: string;
  /** params ближайшей охватывающей подстановки — источник для $param(name). */
  params?: Record<string, unknown>;
  depth: number;      // предел 64, защита от рекурсии TS-фрагментов
}
function convertNodeM1<T>(node: JsonNode, scope: unknown, ctx: ConvertCtx): RenderNode<T>;
```

Ветка фрагмента:

1. `parseOperator(node.fragment)` → `{ op: 'fragment'|'def', arg: name }`.
2. `scope` → `resolveModelPath(scope, path)`; **runtime-guard**:
   `typeof resolved?.signalAt === 'function'`, иначе `throw`
   («scope "x.y" резолвится в лист/массив, а не в группу модели»).
   `resolveModelPath` на группе возвращает стабильный кэшированный фасад
   (`form-model.ts:246` → `makeFormModel`, `facadeCache` на `:364`), значит идентичность scope
   между конвертациями сохраняется.
3. `params` → `transformProps(node.params, scope, ctx)` — операторы в параметрах резолвятся
   в СИСТЕМЕ КООРДИНАТ ТОЧКИ ПОДСТАНОВКИ (родительский scope), а не тела фрагмента.
4. `prefix' = join(ctx.prefix, node.selectorPrefix ?? node.selector)`.
5. `op === 'def'`: если `stack.includes(name)` → `throw` с цепочкой `A → B → A`;
   рекурсивный `convertNodeM1(definitions[name], resolvedScope, { ...ctx, stack: [...stack, name], prefix: prefix', params, depth: depth+1 })`.
   `op === 'fragment'`: `registry.get(name)` с проверкой роли `'fragment'` (симметрично
   `resolveComponent`/`resolveDataSource`/`resolveFn`, `json-to-render-schema.ts:69,85,100`),
   затем `prefixSelectors(frag.build({ scope, params, selectorPrefix: prefix' }), prefix')`.

Ветка `$param` в `transformPropValue` и в `resolveTextChild`:
`if (isParamOp(value)) { const k = parseOperator(value)!.arg; if (!(k in (ctx.params ?? {}))) throw …; return ctx.params[k]; }`.
Вне тела definitions/фрагмента (`ctx.params === undefined`) — `throw` с подсказкой.

**`looksLikeNode` расширяется** (`json-to-render-schema.ts:181-187`) — иначе фрагмент/variant,
положенный в `componentProps` (шаги визарда: `componentProps.steps[]`, см.
`complex-multy-step-form-renderer-json/json-schema.json:16`), не будет распознан:

```ts
return isModelOp(n.value) || isModelOp(n.array) || isComponentOp(n.component) || isHtmlOp(n.component)
    || isFragmentOp(n.fragment) || isDefOp(n.fragment)
    || (isModelOp(n.variant) && Array.isArray(n.cases));
```

Тот же список — в `collect-schema-selectors.ts:19-21` (`looksLikeNode`) и `walkNode` (`:23-37`),
иначе §8-диагностика `JsonFormRenderer` будет ругаться «неизвестный selector» на каждый
`schema.node('reg.address')`. `collectSchemaSelectors` обязан РАЗВОРАЧИВАТЬ definitions
с префиксом каждой точки подстановки — только так множество известных селекторов совпадёт
с реальным деревом.

### Идентичность ссылок (инвариант 4 плана — уточнение)

Кэш поддеревьев массива ключуется идентичностью `node.item` (`render-node.tsx:331-339`),
а `FormRenderer` вызывает `render()` на КАЖДЫЙ рендер (`form-renderer.tsx:53`) — то есть
JSON-путь уже сегодня пересобирает дерево целиком и сбрасывает кэш на каждый ре-рендер
`JsonFormRenderer`. Фрагменты этого не ухудшают, но и не должны ухудшать:

- `prefixSelectors(node, undefined)` возвращает **ту же ссылку** (без клона);
- обёртка `item`-фабрики создаётся один раз на конвертацию, не на элемент;
- ветка `variant` копируется **поверхностно** (`{ ...caseNode, when }`), `children`/`item` — те же ссылки;
- `Fragment` — модульная константа (`defineFragment` вне рендера).

---

## 7. Валидация схемы (`validate.ts`) — новые проверки

К существующим (a)-(d) добавляются:

| код | проверка | почему тихо ломается сегодня |
|---|---|---|
| (e) | неизвестное имя `$fragment(...)` (против реестра) / `$def(...)` (против ключей `schema.definitions`) | `walkOperatorNames` их не знает — ветки в `validate.ts:76-90` |
| (f) | цикл `$def(A) → $def(B) → $def(A)` — статически по графу definitions, с цепочкой в тексте | переполнение стека в рантайме |
| (g) | достижимый из `root` `{ $src }`, не разрешённый | конвертер бросит, но поздно и без указания места |
| (h) | два инстанса одного `$def`/`$fragment` с одинаковым эффективным `selectorPrefix`, если тело несёт `selector` | коллизия `hiddenOverrides`/`propsOverrides`/`conditionRegistry` — оба узла управляются одной записью |
| (i) | array-узел внутри блока, подставленного с НЕ-корневым `scope` | **самое опасное.** `create-form.ts:222-234` материализует только top-level ключи snapshot'а, а `buildModelConfig` массивы `continue`-ит (`:136-141`) ⇒ массив глубже одного уровня не материализуется НИКОГДА: строки рендерятся пустыми, `applyEach` бросает |
| (j) | `$param(x)` вне тела definitions; `$param(x)`, отсутствующий в `params` хотя бы одной точки подстановки | молча `undefined` в пропе |
| (k) | `variant.cases[].when` не массив и не `$fn` | structural, ajv |
| (l) | путь дискриминатора `variant` совпадает с `scope` одной из веток | самореференция → мигание |

Плюс правка существующей (c): `collectTemplateModelKeys` (`validate.ts:234-253`) обязана
разворачивать `$def` внутри `item.$template`, иначе проверка полноты `initialValue` даст
ложноотрицательный результат на массиве, чей шаблон — фрагмент.

---

## 8. Файлы

**`packages/reformer-renderer-react/src/`**
- `core/fragment.ts` — новый: `FragmentContext`, `Fragment`, `defineFragment`, `prefixSelectors`.
- `core/passthrough.tsx` — новый: `SchemaPassthrough`.
- `core/types.ts` — `when?: () => boolean` на `ModelFieldRenderNode`/`ArrayRenderNode`/`ContainerRenderNode`.
- `core/render-node.tsx` — `effectiveCondition` (~4 строки, §3); компаньоном — `propsOverride` в `ModelFieldRenderer`.
- `index.ts` — экспорты.

**`packages/reformer-renderer-json/src/`**
- `operators.ts` — `OPERATOR_RE` + `FragmentOp`/`DefOp`/`ParamOp` + guards + `ParsedOperator['op']`.
- `types/json-schema.ts` — `JsonFragmentNode`, `JsonVariantNode`, `JsonVariantCase`, `JsonSchemaSource`,
  `JsonDeferredDefinition`, `JsonDefinition`, `JsonFormSchema.definitions`, guards, union.
- `converter/json-to-render-schema.ts` — `ConvertCtx`, ветки fragment/variant/`$param`, `looksLikeNode`.
- `registry/types.ts`, `registry/component-registry.ts` — роль `'fragment'`, `RegistryBuilder.fragment(frag)`.
- `schema/form-schema.schema.json` — `fragmentNode`, `variantNode`, `fragmentOp`, `defOp`, `fnOp`,
  `definitionEntry`, корневой `definitions`, цепочка дискриминации, `param` в `operatorOp.pattern`.
- `schema/index.ts` — `getFragmentNames`, enum-сужение `fragmentOp`/`defOp`.
- `validate.ts` — проверки (e)-(l) + правка `collectTemplateModelKeys`.
- `collect-schema-selectors.ts` — разворот definitions с префиксами.
- `variants.ts` — новый (subpath `@reformer/renderer-json/variants`): `collectVariantGates`,
  `variantPredicates`, `gateVariants`.
- `resolve-definitions.ts` — новый: `resolveSchemaDefinitions`.
- `use-resolved-schema.ts` — новый: `useResolvedSchema`, `SchemaResource`.
- `fragment-from-json.ts` — новый: `fragmentFromJson` (замыкание круга TS ↔ JSON).
- `index.ts` — экспорты.

**Ядро (`packages/reformer/`) не трогается вовсе** — это главное преимущество угла.
Обязательный предварительный фикс (не часть дизайна, но блокирует lazy-режим):
`behaviors.ts:349-366` `enableGroup` не оборачивает `effect` в `onDispose` — подписка переживает
`form.dispose()`, а именно `enableWhen`-на-группе и есть механизм гашения неактивной ветки.

**Примеры**
- `projects/react-playground/src/pages/examples/complex-multy-step-form-renderer-json/json-schema.json`
  — два адреса через `$def(AddressBlock)` (минус ~140 строк).
- новый `projects/react-playground/src/pages/examples/insurance-application-renderer-json/`
  — шаг 3 через `variant` + 4 `$def`.

---

## 9. Ломающие изменения и semver

Публичная поверхность только **расширяется**; ломающих изменений нет.

- `@reformer/renderer-react` — **minor**. `when?` — необязательное поле интерфейса; новые экспорты.
  Единственный поведенческий сдвиг: узел с `when` теперь может скрыться сам. Существующие схемы
  `when` не несут ⇒ поведение не меняется.
- `@reformer/renderer-json` — **minor**. `JsonNode` расширяется двумя членами union; сужающие
  guard'ы существующих узлов не меняются. Мета-схема добавляет ветки — ранее валидные схемы
  остаются валидными. `ParsedOperator['op']` расширяется — это **потенциально ломающее для
  внешнего кода**, который делает исчерпывающий `switch` по `op` с `never`-проверкой (в репозитории
  таких нет). `operatorOp.pattern` расширяется на `param` — только разрешает больше.
- `@reformer/core` — **не меняется**.
- Новые проверки `validateFormSchema` ((h),(i),(j)) могут **отклонить ранее проходившие схемы**.
  Формально это ужесточение контракта; практически (i) ловит уже сломанные формы. Выкатывать
  как `warn` в первом minor, поднять до `error` в следующем.

---

## 10. Риски

1. **Порядок дискриминации живёт в трёх местах** — рантайм-guard'ы, `definitions.node` мета-схемы,
   `looksLikeNode` (в двух файлах). Рассинхрон даёт узел, который валиден по мета-схеме, но падает
   в конвертере. Митигация: один общий тест-набор фикстур, прогоняемый и через `validateFormSchema`,
   и через `convertNodeM1`.
2. **`OPERATOR_RE` продублирована строкой в `form-schema.schema.json`** (`operatorOp.pattern`).
   Митигация: тест-сторож на равенство.
3. **`variant` без гейтов модели — footgun.** Форма выглядит правильно, но не сабмитится
   (невидимая ветка валится в `validateModel`) или сабмитит мусор. Митигация: `collectVariantGates`
   возвращает непустой список ⇒ dev-warn из `JsonFormRenderer`, если `gateVariants` не был вызван
   (проверяется по факту `disabled` на группах веток).
4. **Ключи неактивных веток остаются в payload.** `resetOnDisable` чистит значения, не ключи.
   Требует либо серверного контракта, терпящего пустые ветки, либо отдельной задачи
   «`getValue({ skipDisabled })`».
5. **Lazy-режим оси 3 течёт**, пока нет дисциплины `dispose` (0 вызовов `.dispose()` во всех
   рендерерах и реестре) и пока `enableGroup` не оборачивает `effect` в `onDispose`.
6. **`gateVariants` резолвит ноду один раз** (`nodeByPath` до `effect`, `behaviors.ts:350`):
   если группа-ветка не материализована (опечатка в пути) — вечный молчаливый no-op.
   Митигация: `gateVariants` сам проверяет `model.$.<scopePath>?.__path` и бросает.
7. **Селекторы фрагментов + `patchProps` на листе** — тихий no-op (`render-node.tsx:737`).
   Пока компаньонный фикс не приземлится, документировать: селекторы в теле фрагмента ставить
   только на контейнеры.
8. **`$param` — седьмой оператор.** Каждый новый оператор увеличивает поверхность DSL и стоимость
   MCP-генерации. Альтернатива (передавать всё через `$locale`) хуже: параметр не всегда строка.

---

## 11. Открытые вопросы

1. `definitions` или `fragments` как имя корневого ключа? Первое согласуется с
   `stateful-sleeping-volcano.md` и JSON Schema-привычкой, второе не коллидирует с ключевым
   словом внутри самой мета-схемы.
2. Должен ли `variant` уметь `когда ветка выбрана — сбросить соседей` декларативно (флаг
   `exclusive: true` на узле), или это исключительно дело `gateVariants`? Дублирование
   предиката в двух местах — ровно то, против чего написан `2-resilient-wigderson.md`.
3. Нужен ли `$fragment` вообще, если `$def` + `resolveSchemaDefinitions` покрывают JSON-путь?
   TS-фрагменты дают `item`-фабрики и обработчики, но платят непроверяемостью мета-схемой
   (инвариант 8 плана). Возможно, стоит начать только с `$def` и добавить `$fragment` по спросу.
4. `when` на узле vs. расширение `conditionRegistry` ключом-инстансом. Первое проще и не трогает
   селекторы; второе позволило бы `schema.node(...)` перекрывать условие ветки точечно
   (сейчас `hideWhen` по селектору просто выигрывает целиком).
5. Кто владеет `load` для `{ kind: 'module' }` — приложение или `@reformer/form-registry`?
   У реестра уже есть `DataSource`/`CodeSource` с ровно такой семантикой (`types.ts:29-43`);
   возможно, `resolveSchemaDefinitions` должен принимать `DataSource` напрямую, а не свой тип.
6. Порог, после которого eager-загрузка вариантов перестаёт быть верным дефолтом (сколько
   килобайт JSON на ветку?). Без замеров на страховой форме это гадание.
