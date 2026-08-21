# Динамические ветки формы: разбор core / renderer-react / renderer-json и четыре варианта

## Context

Задача: часть формы или целый шаг появляется в зависимости от выбранного значения, при этом **модель
должна актуализироваться** — у ветки появляются свои поля, свои правила и своё место в payload.

Разбор трёх пакетов показал, что вся сложность сводится к одной асимметрии в ядре. Дальше — сама
асимметрия, карта возможностей и четыре варианта решения по возрастанию цены.

---

## Что показал анализ

### Одна строка, объясняющая всё

Модель — дерево из трёх видов узлов ([form-model.ts](../../packages/reformer/src/state/form-model.ts)).
Состав группы и состав массива хранятся **по-разному**:

```ts
class GroupNode {
  readonly children = new Map<string, ModelNode>();          // ← обычный Map
  constructor(initial: Record<string, unknown>, public path: string) {
    for (const key of Object.keys(initial)) {
      this.children.set(key, buildNode(initial[key], joinPath(path, key)));
    }
  }
  read(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, node] of this.children) out[key] = node.read();   // ← сигнал не читается
    return out;
  }
}

class ArrayNode {
  readonly items: Signal<ModelNode[]>;                        // ← СИГНАЛ
  read(): unknown[] {
    return this.items.value.map((node) => node.read());       // ← состав становится зависимостью
  }
}
```

Агрегат узла — `computed(() => node.read())` (`containerSignal`). Отсюда:

- добавили элемент в массив → `items.value` изменился → `computed` инвалидирован → перестроилось всё,
  что от него зависит;
- добавили ключ в `children` → **ни один сигнал не изменился** → `computed` продолжает отдавать
  старое значение до случайной правки любого другого поля.

**Массивы динамичны, группы — нет. Это единственная причина, по которой модель считается статичной.**

### То же самое повторено на стороне формы

| | состав | реактивен |
| --- | --- | --- |
| `GroupNode._fields` ([group-node.ts:87](../../packages/reformer/src/form/nodes/group-node.ts#L87)) | `new Map()` | нет |
| `ModelArrayNode.itemNodes` ([model-array-node.ts](../../packages/reformer/src/form/nodes/model-array-node.ts)) | `Signal<FormProxy[]>` | да |

При этом сам механизм агрегатов **уже готов к динамике** — он принимает функцию, а не снимок:

```ts
// group-node.ts:202 — thunk есть, но читает нереактивный Map
const aggregateSignals = createAggregateSignals({
  getChildren: () => Array.from(this._fields.values()),
});

// model-array-node.ts:152 — тот же thunk, но читает сигнал
const agg = createAggregateSignals({
  getChildren: () => this.itemNodes.value as unknown as FormNode<unknown>[],
});
```

Ровно поэтому `valid`/`dirty`/`errors` у массива пересчитываются при добавлении строки, а у группы бы
не пересчитались.

### `ModelArrayNode` — готовый образец «динамического поддерева»

Это единственное место в системе, где форма растёт в рантайме, и сделано оно правильно:

```ts
this.disposeSync = effect(() => {
  const len = control.length;                  // подписка на состав модели
  for (let i = 0; i < len; i++) {
    const itemModel = control.at(i);
    let node = this.cache.get(itemModel);
    if (!node) { node = buildItem(itemModel); this.cache.set(itemModel, node); }  // построить
    next.push(node);
  }
  this.itemNodes.value = next;
  stale.forEach((n) => this.disposeItemNode(n));  // детерминированный teardown выпавших
});
```

`buildItem` инжектится из [create-form.ts:244](../../packages/reformer/src/form/create-form.ts#L244) и
это **полноценный рекурсивный `createFormFromModel`** — включая заполнение реестра `signal → node` для
новых листьев. Кэш по идентичности фасада под-модели даёт бесплатный reorder.

Любой вариант «динамической ветки» — это повторение этого паттерна для другого вида узла.

### Что доступно снаружи

`createFormFromModel`, `registerSignalNode`, `getNodeForSignal` — **публичные экспорты**
([form/index.ts](../../packages/reformer/src/form/index.ts)). То есть построить форму над под-моделью
и связать её сигналы можно из приложения, не трогая ядро.

### Ограничения рендереров

- **Структурных мутаций схемы нет.** У `RenderNodeControl` ровно `setHidden / resetHidden /
  patchProps / resetProps / getRef`. Ни вставки узла, ни подмены компонента.
- **`convertNodeM1` синхронный.** Асинхронность возможна только как фаза **документа**: сначала
  собрали полную схему, потом строим дерево.
- **Лист рендерится через реестр сигналов**
  ([render-node.tsx:688](../../packages/reformer-renderer-react/src/core/render-node.tsx#L688)):

  ```ts
  const fieldNode = getNodeForSignal(node.value) as FieldNode<unknown> | undefined;
  // нет ноды → console.warn('No form node for signal …') + return null
  ```

  **Важное следствие:** состояние (`touched`, ошибки, `disabled`) живёт на `FormNode`, а не на узле
  рендера. Значит пересборка **render**-дерева его не теряет — теряет только пересборка **формы**.
- **`patchProps` работает только на контейнерах.** На листе и на узле-массиве это тихий no-op: карта
  переопределений читается лишь в контейнерной ветке. Зато на контейнере через неё можно заменить
  поддерево, приехавшее в `componentProps` (так устроены шаги визарда — `steps` лежат в пропсах, а
  компонент помечен `__selfManagedChildren`).
- **Массив — единственный источник новых узлов рендера**, и он ленив по элементам:
  `item: (im) => convertNodeM1(template, im, registry)`.

### Карта: что можно и чего нельзя сегодня

| Хочу | Сегодня |
| --- | --- |
| Добавить элемент массива → выросли модель, форма, разметка, валидация | **Да**, полностью |
| Добавить поле/группу в модель | **Нет**: `children` не сигнал, `set`-трап на неизвестный ключ отдаёт `false`, `patch` молча теряет ключ |
| Скрыть/показать готовую ветку | **Да**: `hideWhen` → настоящий unmount |
| Заменить поддерево схемы в рантайме | **Нет** прямого API; косвенно — `patchProps` на self-managed контейнере либо новая идентичность `schema` |
| Загрузить фрагмент схемы по сети | **Нет**: минимальная единица — вся `FormEntry` |
| Загрузить код ветки чанком | **Да**: `CodeSource kind: 'module'` + `hideWhen` (скрытый узел не монтируется → `import()` не выполняется) |

---

## Вариант 1. Ветка как массив 0..1

**Правок в пакетах: нет.**

Ветка объявляется массивом, который держит ноль или один элемент. Массивы — единственная структура,
растущая в рантайме, поэтому выбор варианта буквально создаёт поля в модели.

### Листинг

```ts
// model.ts
export interface MortgageBranch {
  propertyValue: number | null;
  initialPayment: number | null;
}

export interface CreditForm {
  loanType: 'consumer' | 'mortgage' | 'car';
  /** Ветка 0..1. Массив, а не объект: только у массива состав реактивен. */
  mortgage: MortgageBranch[];
}

const BLANK_MORTGAGE: MortgageBranch = { propertyValue: null, initialPayment: null };

export const INITIAL: CreditForm = { loanType: 'consumer', mortgage: [] };
export const createCreditModel = () => createModel<CreditForm>({ ...INITIAL });
```

```ts
// form.behavior.ts — состав модели следует за выбором
export const creditBehavior = defineFormBehavior<CreditForm>(({ model }) => {
  onChange(model.$.loanType, () => {
    const needed = model.loanType === 'mortgage';
    const present = model.mortgage.length > 0;
    if (needed && !present) model.mortgage.push({ ...BLANK_MORTGAGE });
    // clear() выбрасывает поддерево целиком: значения ветки не уедут в submit.
    if (!needed && present) model.mortgage.clear();
  });
});
```

```ts
// validation.ts — правила появляются и исчезают вместе с элементом
export const creditValidation = defineValidationSchema<CreditForm>(({ model }) => {
  validate(model.$.loanType, [required()]);
  each(model.mortgage, (row) => {
    validate(row.$.propertyValue, [required(), min(1_000_000)]);
    validate(row.$.initialPayment, [required()]);
  });
});
```

```tsx
// registry.tsx — компонент ветки: рисует единственный элемент без хрома массива
import type { ArrayComponentProps } from '@reformer/renderer-react';

/** Ветка 0..1: `items` придут пустыми либо одним элементом. `onAdd/onRemove` не нужны — составом правит behavior. */
export const Branch: FC<ArrayComponentProps> = ({ items }) => (
  <>
    {items.map((slot) => (
      <Fragment key={slot.key}>{slot.children}</Fragment>
    ))}
  </>
);

reg.component('Branch', Branch);
```

```json
{
  "selector": "mortgage-branch",
  "array": "$model(mortgage)",
  "component": "$component(Branch)",
  "item": {
    "$template": {
      "component": "$component(Section)",
      "componentProps": { "title": "Залог" },
      "children": [
        { "value": "$model(propertyValue)", "component": "$component(InputNumber)" },
        { "value": "$model(initialPayment)", "component": "$component(InputNumber)" }
      ]
    }
  }
}
```

### Как это работает

`model.mortgage.push(...)` → `ArrayNode.push` вызывает `buildNode(value, path)` и кладёт **новый
массив** в `items.value`. Дальше по цепочке:

1. `containerSignal` инвалидируется (состав прочитан как сигнал) — `model.get()` уже содержит ветку;
2. `effect` внутри `ModelArrayNode` видит изменившийся `control.length` и зовёт `buildItem(itemModel)`
   → `createFormFromModel` строит форму элемента и **регистрирует `signal → node`** для его листьев;
3. агрегаты (`valid`, `dirty`, `errors`) пересчитываются, потому что `getChildren` читает
   `itemNodes.value`;
4. рендерер через `useModelArrayRevision` перерисовывает узел, а `item(itemModel)` лениво
   конвертирует шаблон под новую под-модель — появляются узлы разметки;
5. `each(model.mortgage, …)` на следующем прогоне видит `length === 1` и валидирует ветку. При
   `clear()` правила исчезают, а ошибки гасятся диффом `state.fields`.

**Что получаете:** настоящую актуализацию модели, корректную агрегацию валидности, детерминированный
teardown при снятии ветки (`disposeItemNode` гасит подписки), нулевой риск — путь полностью
поддержан и покрыт тестами ядра.

**Чем платите:** формой данных. В модели и в payload ветка выглядит как `mortgage: [{…}]`, обращение —
`model.mortgage[0].propertyValue`. Это семантическая неправда («массив из одного»), и при сериализации
её приходится разворачивать руками. Плюс шаблон элемента не может зависеть от значения — вариантов
веток несколько только через несколько массивов.

---

## Вариант 2. Ветка — отдельная под-форма из реестра, слияние на submit

**Правок в пакетах: нет. Даёт ленивый чанк кода.**

Ветка становится самостоятельной `FormEntry` со своей моделью. Родитель монтирует её вложенным
`FormOutlet` под `hideWhen`, а на submit сводит данные.

### Листинг

```ts
// branches/mortgage/entry.ts — схема и код ветки едут отдельным чанком
export const mortgageEntry: FormEntry<MortgageBranch> = {
  id: 'branch-mortgage',
  version: '1.0.0',
  owner: 'credit',
  schema: {
    kind: 'module',
    load: () => import('./schema.json').then((m) => m.default as unknown as JsonFormSchema<MortgageBranch>),
  },
  registry: { kind: 'module', load: () => import('./registry').then((m) => m.createMortgageRegistry()) },
  behavior: { kind: 'module', load: () => import('./behavior').then((m) => m.mortgageBehavior) },
  initial: { kind: 'inline', value: BLANK_MORTGAGE },
};
```

```ts
// form-setup.ts — под-модель ветки живёт рядом с родительской
export function createCreditSetup() {
  const model = createCreditModel();
  const branchModel = createModel<MortgageBranch>({ ...BLANK_MORTGAGE });

  const jsonForm = createJsonForm<CreditForm>({ schema, registry, model, behavior: creditBehavior });

  const submit = async () => {
    const isMortgage = model.loanType === 'mortgage';
    // Ветка сводится вручную: её модель родителю не принадлежит.
    const payload = { ...model.get(), ...(isMortgage ? { mortgage: branchModel.get() } : {}) };
    await api.submit(payload);
  };

  return { ...jsonForm, branchModel, submit };
}
```

```ts
// render-behavior.ts — модель инъектируется пропом, видимость решает загрузку чанка
export const createCreditRenderBehavior =
  (form: FormProxy<CreditForm>, branchModel: FormModel<MortgageBranch>): RenderBehaviorFn<CreditForm> =>
  (schema) => {
    // patchProps работает на контейнере — узел FormOutlet им и является.
    onInit(schema.node('branch-slot'), () => {
      schema.node('branch-slot').patchProps({ model: branchModel });
    });
    // Скрытый узел рендерится как `return null` ДО монтирования FormOutlet,
    // поэтому loadForm не вызывается и import() не выполняется.
    hideWhen(schema.node('branch-slot'), () => form.loanType.value.value !== 'mortgage');
  };
```

```json
{
  "selector": "branch-slot",
  "component": "$component(FormOutlet)",
  "componentProps": { "id": "branch-mortgage" }
}
```

### Как это работает

`FormOutlet` регистрируется обычным компонентом (`reg.component('FormOutlet', FormOutlet)`) и
становится узлом схемы. Пока `hideWhen` отдаёт `true`, `RenderNodeComponent` возвращает `null` **до**
контейнерной ветки — `EntryMount` не монтируется, `useFormResource` не зовёт `loadForm`, динамический
`import()` не выполняется. Выбрали ипотеку → узел смонтировался → поехал чанк → `MountedForm` собрал
форму, причём с моделью из пропа, а не из записи.

`id` тоже можно сделать живым — `componentProps: { id: "$model(loanType)" }`: конвертер превращает
`$model` в сигнал, а контейнерная ветка разворачивает сигналы верхнего уровня `componentProps` через
`useSignalProps` и на них подписывается. Тогда один узел обслуживает все ветки.

**Почему здесь безопасно делить модель.** Реестр `registerSignalNode` — глобальный `WeakMap` **без
владельца**, last-write-wins. Если отдать вложенной форме **родительскую** модель, вторая форма
перепривяжет листья родителя на свои ноды, а родительский `GroupNode` продолжит агрегировать `valid`
по осиротевшим — рассинхрон без единого предупреждения. Именно поэтому здесь у ветки **своя**
модель со своими сигналами: коллизии не возникает по построению.

**Что получаете:** настоящий ленивый чанк (схема + реестр + поведение ветки), ветку как отдельную
единицу поставки со своей версией и владельцем, ноль правок в пакетах.

**Чем платите:** ветка не участвует в агрегатах родителя. `form.valid` родителя её не видит, submit
надо сводить вручную, а `model.get()` не содержит её данных. Плюс при смене `id`
`key={entryKeyOf(entry)}` пересоздаёт поддерево — введённое в предыдущей ветке теряется, если
под-модель не держать снаружи (в листинге держится).

---

## Вариант 3. Реактивная группа в ядре

**Правка core. Убирает первопричину, а не обходит её.**

Состав группы становится сигналом — ровно как у массива, — и появляется `ModelGroupNode`, повторяющий
`ModelArrayNode` для объектной ветки.

### Листинг

```ts
// state/form-model.ts
class GroupNode {
  readonly kind = 'group' as const;
  /**
   * Состав группы — СИГНАЛ, а не Map. Иначе `read()` не подписывает на появление ветки: агрегат
   * узла это `computed(() => node.read())`, и без чтения сигнала он не инвалидируется.
   */
  private readonly _children: Signal<ReadonlyMap<string, ModelNode>>;

  /** Совместимость: прежний публичный доступ к составу, теперь через сигнал. */
  get children(): ReadonlyMap<string, ModelNode> {
    return this._children.value;
  }

  constructor(initial: Record<string, unknown>, public path: string) {
    const map = new Map<string, ModelNode>();
    for (const key of Object.keys(initial)) {
      map.set(key, buildNode(initial[key], joinPath(path, key)));
    }
    this._children = signal(map);
  }

  /** Подключить ветку. НОВЫЙ Map, а не мутация: подписчики состава сравнивают по ссылке. */
  attach(key: string, value: unknown): void {
    const next = new Map(this._children.peek());
    next.set(key, buildNode(value, joinPath(this.path, key)));
    this._children.value = next;
  }

  /** Снять ветку целиком — вместе со значениями, чтобы они не уехали в submit. */
  detach(key: string): void {
    const prev = this._children.peek();
    if (!prev.has(key)) return;
    const next = new Map(prev);
    next.delete(key);
    this._children.value = next;
  }

  read(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, node] of this._children.value) out[key] = node.read();
    return out;
  }

  /** `peek()`, а не `.value`: нереактивное чтение обязано остаться нереактивным. */
  peek(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, node] of this._children.peek()) out[key] = node.peek();
    return out;
  }
}
```

Остальные методы (`set`, `resetToInitial`, `captureInitial`, `dirty`, `rebase`) тоже обходят состав —
и каждый должен осознанно выбрать `.value` или `.peek()`. В текущем файле обращений к `children`
семнадцать, и ровно одно из них сегодня нереактивное; при переезде на сигнал каждое становится
решением, а не строкой.

```ts
// form/nodes/model-group-node.ts — зеркало ModelArrayNode для объектной ветки
export class ModelGroupNode<T extends object> extends FormNode<T> {
  private readonly fieldNodes = signal<ReadonlyMap<string, FormNode<unknown>>>(new Map());
  private readonly cache = new Map<string, FormNode<unknown>>();
  private readonly disposeSync: () => void;

  constructor(
    private readonly model: FormModel<T>,
    private readonly buildChild: (key: string, sub: FormModel<object>) => FormNode<unknown>
  ) {
    super();

    this.disposeSync = effect(() => {
      // ownKeys-трап читает состав из сигнала — это и есть подписка на появление ветки.
      const keys = Object.keys(this.model.$ as object);
      const next = new Map<string, FormNode<unknown>>();
      for (const key of keys) {
        let node = this.cache.get(key);
        if (!node) {
          node = this.buildChild(key, (this.model as never)[key]);
          this.cache.set(key, node);
        }
        next.set(key, node);
      }
      // Снятые ветки диспозятся ПОСЛЕ обновления состава — как в ModelArrayNode.
      const stale: FormNode<unknown>[] = [];
      for (const [key, node] of this.cache) if (!next.has(key)) { stale.push(node); this.cache.delete(key); }
      this.fieldNodes.value = next;
      stale.forEach((n) => n.dispose?.());
    });

    const agg = createAggregateSignals({
      getChildren: () => [...this.fieldNodes.value.values()],
    });
    this.valid = agg.valid;
    this.errors = agg.errors;
    // …остальные агрегаты
  }
}
```

```ts
// применение — состав модели следует за выбором, форма данных честная
export const creditBehavior = defineFormBehavior<CreditForm>(({ model }) => {
  onChange(model.$.loanType, () => {
    if (model.loanType === 'mortgage') model.attach('mortgage', { ...BLANK_MORTGAGE });
    else model.detach('mortgage');
  });
});
```

### Как это работает

Асимметрия снимается в источнике: `read()` группы начинает читать сигнал состава, поэтому
`containerSignal` инвалидируется при `attach`/`detach` так же, как при `push`/`clear` массива.
Дальше вся машинерия работает без изменений, потому что она уже написана под динамику:
`createAggregateSignals` принимает thunk, `ModelGroupNode` держит состав в сигнале, рендерер
подписывается на агрегаты.

**Что получаете:** честную форму данных (`model.mortgage.propertyValue`, в payload объект, а не
массив), агрегацию валидности из коробки, один механизм на все ветки — включая шаг визарда. Это
единственный вариант, где «динамическая ветка» становится первоклассным понятием.

**Чем платите и что проверить перед реализацией:**

- `signalsCache` и `facadeCache` — `WeakMap` по идентичности узла; при `detach` узел выпадает, при
  повторном `attach` создаётся **новый** — фасад будет другим. Это ровно то же поведение, что у
  элементов массива, но за ним надо следить в тестах;
- `ownKeys`/`getOwnPropertyDescriptor` трапы `signalsProxy` теперь читают сигнал — надо убедиться,
  что `Object.keys(model)` внутри `computed` не создаёт лишних подписок в горячих местах;
- `buildModelConfig` в `createFormFromModel` строит форму по снимку `model.get()` — корневой
  `GroupNode` формы придётся либо заменить на `ModelGroupNode`, либо материализовать динамические
  ветки отдельно, по аналогии с блоком материализации массивов
  ([create-form.ts:237](../../packages/reformer/src/form/create-form.ts#L237));
- `dispose()` объявлен на `FormNode` как **опциональный** и в рендерерах не вызывается нигде —
  teardown снятых веток придётся делать внутри `ModelGroupNode`, как это делает `ModelArrayNode`.

---

## Вариант 4. Ленивый документ схемы: `$fragment` + фаза резолва

**Правка renderer-json. Работает поверх варианта 1 или 3 — сам по себе модель не актуализирует.**

Единственный способ загрузить разметку ветки по сети. `convertNodeM1` синхронен и обязан получить
полный документ, поэтому асинхронность выносится в **фазу документа**: сперва резолвим ссылки, потом
строим дерево.

### Листинг

```ts
// types/json-schema.ts
export type JsonDefinition = JsonNode | { $src: DataSource<JsonNode> };

export interface JsonFormSchema<T = unknown> {
  version?: string;
  root: JsonNode<T>;
  /** Именованные фрагменты. Значение либо готовый узел, либо ссылка на отложенный источник. */
  definitions?: Record<string, JsonDefinition>;
}
```

```ts
// converter/resolve-definitions.ts
/**
 * Разворачивает `$fragment(...)`, догружая только те определения, что реально нужны.
 *
 * Асинхронность — свойство ДОКУМЕНТА, а не узла: конвертер синхронный, и дерево обязано целиком
 * существовать до `createForm`. Поэтому сперва собираем полный документ, и только потом строим.
 */
export async function resolveSchemaDefinitions(
  schema: JsonFormSchema,
  needed: readonly string[],
  opts: { cache?: SchemaCache; signal?: AbortSignal } = {}
): Promise<JsonFormSchema> {
  const defs = schema.definitions ?? {};
  const resolved: Record<string, JsonNode> = {};

  await Promise.all(
    needed.map(async (name) => {
      const def = defs[name];
      if (!def) throw new Error(`[renderer-json] фрагмент "${name}" не объявлен в definitions`);
      resolved[name] = '$src' in def ? await loadFragment(def.$src, name, opts) : def;
    })
  );

  // Новая идентичность документа — сигнал рендереру пересобрать дерево (useMemo по `schema`).
  return { ...schema, root: inlineFragments(schema.root, resolved) };
}
```

```tsx
// hooks/use-resolved-schema.ts
export function useResolvedSchema(schema: JsonFormSchema, needed: readonly string[]): JsonFormSchema {
  const key = needed.join('|');
  const [resolved, setResolved] = useState(() => stripUnresolved(schema));

  useEffect(() => {
    const ac = new AbortController();
    resolveSchemaDefinitions(schema, needed, { signal: ac.signal })
      .then((next) => { if (!ac.signal.aborted) setResolved(next); })
      .catch(reportSchemaError);
    return () => ac.abort();
  }, [schema, key]);

  return resolved;
}
```

```json
{
  "root": {
    "component": "$component(Box)",
    "children": [
      { "value": "$model(loanType)", "component": "$component(Select)" },
      { "selector": "branch", "fragment": "$fragment(mortgage)" }
    ]
  },
  "definitions": {
    "mortgage": { "$src": { "kind": "http", "url": "/schemas/branches/mortgage.json" } }
  }
}
```

### Как это работает

`useResolvedSchema` отдаёт документ без нерезолвленных фрагментов, а при смене набора нужных веток
догружает недостающие и возвращает **новый объект схемы**. `JsonFormRenderer` держит дерево в
`useMemo` с зависимостью от `schema`, поэтому новая идентичность пересобирает render-дерево.

Ключевой момент, который делает пересборку дешёвой: состояние формы (`touched`, ошибки, `disabled`)
живёт на `FormNode`, а узлы рендера находят его через `getNodeForSignal(node.value)`. Пересборка
**render**-дерева ничего не теряет — теряла бы только пересборка **формы**. Поэтому вариант 4 можно
класть поверх 1 или 3, и оно сойдётся: модель актуализирует нижний слой, разметку догружает верхний.

Кэш схем из `@reformer/form-registry` переиспользуется как есть — `createSchemaCache` работает по
ключу и не знает, что за документ он хранит.

**Что получаете:** ветку, которой в бандле нет вовсе; состав формы может решать бэкенд; фрагмент
версионируется и кэшируется отдельно.

**Чем платите:** новой сущностью в DSL (`definitions`, `$fragment`) и мета-схеме, ещё одним
состоянием загрузки в UI, и обязательным нижним слоем — без варианта 1 или 3 разметка ветки приедет,
а полей под неё в модели не будет. Тогда `$model(...)` резолвится в `undefined`, `validateModel`
роутит ошибки через `getNodeForSignal(sig)?.setErrors(...)` и **опциональная цепочка их проглатывает**,
при этом гейт продолжает блокировать: кнопка не жмётся, сообщений нет. Ровно за этим в реестре форм
завели preflight-проверку `unmaterialized-model-paths`.

---

## Статус листингов

Код выше — **проектные эскизы, а не готовые патчи**: он не компилировался и не запускался. Уровень
доверия у вариантов разный, и ниже он выписан честно, чтобы никто не принял эскиз за реализацию.

| Вариант | Статус | Что проверено |
| --- | --- | --- |
| 1. Массив 0..1 | **API сверен целиком** | `ModelArray.push/clear/length/at`, `each<U>(arr, itemFn: (item: FormModel<U>) => void)`, `ArrayComponentProps`/`ArrayItemSlot` (экспортируются из `@reformer/renderer-react`), форма узла `{ array, item.$template }`, `min` по сабпату `@reformer/core/validators/min` |
| 2. Под-форма из реестра | **Формы сверены, поведение прослежено по коду** | `FormEntry`, `DataSource`/`CodeSource`, `FormMountProps.model`, приоритет `patchProps` в контейнерной ветке, `hideWhen` → `return null` до монтирования |
| 3. Реактивная группа | **Эскиз с известными пробелами** | Асимметрия `children` (Map) ↔ `items` (Signal) и thunk `getChildren` — факты. Сам код неполон, см. ниже |
| 4. `$fragment` | **Наименее проработан** | Синхронность конвертера и закрытый набор операторов — факты. В остальном требует правок за пределами листинга |

### Что нашла проверка и что уже исправлено

- **`ArrayItemSlot.element` не существует** — поле называется `children`. Листинг варианта 1 исправлен;
  в изначальной версии компонент `Branch` не отрисовал бы ничего.
- **`peek()` у группы был пропущен** в варианте 3. Это не косметика: если нереактивное чтение начнёт
  читать `.value`, любой `peek()` станет подпиской, и агрегаты потянут за собой лишние пересчёты.
  Метод добавлен, и рядом отмечено, что решение `.value` vs `.peek()` придётся принять для каждого из
  семнадцати обращений к `children`.

### Что осталось неточным — сознательно

- **Вариант 3, `ModelGroupNode.buildChild`.** В эскизе он вызывается для любого ключа, но у листа
  `model[key]` — это значение, а не под-модель. Настоящая реализация обязана диспетчеризоваться по
  виду узла (лист → `FieldNode` по сигналу, группа → вложенный `ModelGroupNode`, массив →
  `ModelArrayNode`), как это делает `buildModelConfig`. Плюс `FormNode` абстрактен: в эскизе заполнены
  два агрегата из семи.
- **Вариант 4, направление зависимости.** Листинг импортирует `DataSource` и `SchemaCache` из
  `@reformer/form-registry`, но зависимость идёт в обратную сторону: у `renderer-json` в зависимостях
  только `ajv`, `@reformer/core`, `@reformer/renderer-react` и React. Значит либо тип источника
  дублируется/поднимается в `renderer-json`, либо резолв фрагментов живёт в `form-registry`. Это
  архитектурное решение, и его надо принять до кода.
- **Вариант 4, оператор.** `OPERATOR_RE` — закрытая регулярка на шесть операторов
  (`model|component|html|dataSource|fn|locale`). `$fragment` требует правки регулярки, мета-схемы,
  `collectOperatorNames` и preflight-проверок реестра форм — за пределами показанного листинга.
- **Вариант 2, типизация.** `reg.component('FormOutlet', FormOutlet)` не проверялся компилятором:
  `FormOutlet` дженерик, а `RegistryBuilder.component<P>` ждёт `ComponentType<P>`. Скорее всего
  понадобится сужение типа при регистрации.

Ни в одном варианте не выполнялся код — все утверждения о поведении выведены из чтения исходников и
из уже существующих механизмов (`ModelArrayNode`, `hideWhen`, `getNodeForSignal`).

## Сравнение

| | 1. Массив 0..1 | 2. Под-форма из реестра | 3. Реактивная группа | 4. `$fragment` |
| --- | --- | --- | --- | --- |
| Правки в пакетах | нет | нет | core | renderer-json |
| Модель актуализируется | да | своя модель ветки | да | нет (нужен 1 или 3) |
| Форма данных | `mortgage: [{…}]` | отдельный объект | `mortgage: {…}` | — |
| Валидность в агрегате родителя | да | нет | да | — |
| Ленивый код ветки | нет | **да** | нет | да |
| Ленивая разметка по сети | нет | да (вся запись) | нет | **да** (фрагмент) |
| Риск | нулевой | средний | высокий | средний |

## Рекомендация

**Начать с варианта 1.** Он закрывает «актуализацию модели» полностью и сегодня, без правок и без
риска — цена только в форме данных, и она видна на этапе проектирования, а не в проде.

**Вариант 2 брать, когда ветка — самостоятельная единица поставки** (своя команда, свой релиз, свой
чанк). Не брать ради экономии на ветке, которая логически часть одной формы: агрегаты родителя её не
увидят.

**Вариант 3 — если веток много и они пришли надолго.** Это единственный путь, где ветка становится
первоклассным понятием, а не приёмом. Правка точечная (состав группы → сигнал плюс один новый узел
формы по образцу `ModelArrayNode`), но затрагивает самый горячий код ядра — нужен полный прогон
тестов core и отдельные тесты на `attach`/`detach`, teardown и идентичность фасадов.

**Вариант 4 — только когда состав ветки действительно решает сервер.** Поверх 1 или 3, не вместо.

## Проверка

Для любого варианта минимальный набор:

1. `npm test -w @reformer/core` — 3 и 1 затрагивают ядро напрямую;
2. `npm run typecheck` из корня — покрывает все пакеты и обе витрины;
3. страница-стенд по образцу [form-registry-lab](../../projects/react-playground/src/pages/examples/form-registry-lab/README.md):
   переключение ветки, проверка `model.get()` до и после, проверка что ошибки ветки видны, а после
   снятия — исчезли;
4. для вариантов 2 и 4 — счётчик сетевых обращений (обёртка `fetchImpl`, как на стенде реестра):
   доказать, что чанк/фрагмент не едет, пока ветка не выбрана.
