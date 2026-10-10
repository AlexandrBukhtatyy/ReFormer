# Скомпилированная схема — compileSchema, виды узлов и области

## Purpose

Авторская схема (`FormSchemaNode`) описывает вид узла ключами: `model`, `item`, `part`,
`children`. Разбирать их по-своему раньше приходилось каждому, кто обходил дерево. Теперь дерево
разбирает один компилятор — `compileSchema(tree, model)` — и все читают его итог,
`CompiledSchema`: у каждого узла явный вид (`kind`), нормализованная привязка к модели,
идентификатор и область.

`createForm` компилирует дерево **один раз**: ноды формы и рендерер читают одну и ту же
компиляцию, она лежит в `bundle.render.tree`. Сам `compileSchema` нужен редко — своему
рендереру, инструментам (инспектор дерева, проверка селекторов в тестах) и фабрикам, которые
собирают форму без `createForm`.

## API

```typescript
import {
  compileSchema,
  isCompiledNode,
  type CompiledSchema,
  type CompiledNode,
  type CompiledChild,
  type SchemaNodeId,
  type SchemaScopeId,
} from '@reformer/core';

function compileSchema(
  tree: FormSchemaNode,
  model?: object, // модель области: корень сборки, под-модель строки или группы
  options?: { scope?: SchemaScopeId } // по умолчанию корень '#'
): CompiledSchema;

function isCompiledNode(value: unknown): value is CompiledNode; // узел компилятора, а не автора

interface CompiledSchema {
  readonly scope: SchemaScopeId; // '#', '#/address', '#/phones[3]'
  readonly model: object | undefined; // модель области
  readonly root: CompiledNode; // корневой узел области
  readonly nodes: ReadonlyMap<SchemaNodeId, CompiledNode>; // узлы ЭТОЙ области по id
  readonly fields: ReadonlyMap<object, CompiledFieldNode>; // поля по ручке — области и её подформ
  readonly arrays: ReadonlyMap<object, CompiledArrayNode>; // массивы под-форм по ручке
}
```

### Виды узлов — `kind`

| `kind`      | Узел автора                                              | Что добавляет компилятор                                          |
| ----------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `field`     | `{ model: model.$.<лист или массив целиком>, component }` | `handle` (ручка значения), `disabled`                            |
| `array`     | `{ model: model.$.<массив>, item: (row) => узел }`       | `handle`, `control` (фасад массива модели), `initialValue`, `row(rowModel)` |
| `part`      | `{ model: model.$.<группа>, part: (sub) => узел }`       | `handle`, `model` (под-модель группы), `content` — схема части   |
| `container` | всё остальное: `children`, `component`                   | `children: CompiledChild[]` — узлы и текст по порядку            |
| `text`      | подряд идущие строки, числа, сигналы среди `children`    | `parts` — склеенные части; только ребёнок контейнера             |

Общие поля узла (кроме `text`): `id`, `path` (позиционный путь `#/0/2`), `selector`, `scope`,
`component` (как есть — ядро его не интерпретирует), `props` (`componentProps` автора, без них —
пустой объект), `source` (авторский узел).

Порядок распознавания важен: ручка массива — тоже ручка значения, поэтому сначала проверяется
`item` (массив под-форм), затем `part` (подформа), затем привязка-значение (поле), остальное —
контейнер. Контейнер без `component` рендерер рисует как одних детей.

### Идентификатор узла — `id`

- Узел с `selector` — `id` равен `selector`.
- Узел без `selector` — позиционный путь от корня области: `#`, `#/0`, `#/0/2`.
- Текст — позиционный путь первой части.
- `SchemaNodeId` — строка с брендом: в `compiled.nodes.get(...)` ключ приводят
  (`'email' as SchemaNodeId`).

### Области — `scope`

| Область          | Идентификатор                | Что в ней                               |
| ---------------- | ---------------------------- | --------------------------------------- |
| корень сборки    | `#`                          | дерево `schema(model)`                  |
| подформа (`part`) | `#/registrationAddress`     | содержимое части; путь группы от модели области |
| строка массива   | `#/phones[<ключ>]`           | разметка строки из `item(rowModel)`     |
| вложенные        | `#/coBorrowers[3]/phones[7]` | область внутри области                  |

- В скобках строки — **стабильный ключ** строки, а не индекс: он держится за элемент модели и не
  меняется при `move` / `swap`. Тот же ключ отдаёт `FormArray.keyAt(index)`.
- **`selector` уникален в своей области.** Повтор в одной области — исключение при сборке с путями
  обоих узлов. Селекторы строк массива и подформ живут в своих областях и с корнем не
  пересекаются: одна часть, подключённая дважды, даёт две области без конфликта.
- По `selector` узел адресуют поведение (`schema.node(selector)` — в своей области) и шаги потока
  (`flow.steps[].id` — `selector` узла шага в корневой области).

### Подформы и строки

- **Подформа** компилируется сразу; её содержимое — `content` (своя `CompiledSchema`). Поля и
  массивы части попадают и в `fields` / `arrays` родителя: у части нет отдельной формы, её поля
  принадлежат той же сборке (`form.registrationAddress.city`).
- **Строка массива** компилируется при первом обращении: `arrayNode.row(rowModel)` — одна
  компиляция на под-модель строки; форма строки и рендерер получают один и тот же объект. Узлы
  строк в `nodes` корня не лежат.

### Что компилятор проверяет

| Ситуация                                                  | Итог                                                   |
| --------------------------------------------------------- | ------------------------------------------------------ |
| повтор `selector` в одной области                         | исключение с путями обоих узлов                        |
| узел содержит сам себя                                    | исключение — дерево зациклено                          |
| ключ узла, который сборка не читает (`value`, `array`, …) | dev-предупреждение с подсказкой замены                 |
| `item` на привязке не-массиве, `part` на не-группе        | dev-предупреждение, узел становится контейнером        |
| нераспознанная привязка (`model: model.email` без `$`)    | dev-предупреждение, узел становится контейнером        |
| ребёнок — группа модели или под-модель вместо узла        | dev-предупреждение, ребёнок пропущен                   |
| `null` / `undefined` / `boolean` среди `children`         | пропускается молча — условная вставка `cond && узел`   |

Вложенные узлы читаются только из `children` и из поддерева `part`; в `componentProps` и под
произвольными ключами компилятор не заглядывает.

## Examples

### Компиляция и поиск узлов

```typescript
import { compileSchema, createModel, type SchemaNodeId } from '@reformer/core';

const model = createModel({ email: '', phones: [{ number: '' }] });

const compiled = compileSchema(
  {
    children: [
      { selector: 'email', model: model.$.email, component: Input },
      { model: model.$.phones, item: (row) => ({ model: row.$.number, component: Input }) },
    ],
  },
  model
);

compiled.nodes.get('email' as SchemaNodeId)?.kind; // 'field'
compiled.fields.get(model.$.email)?.component; // Input
compiled.arrays.get(model.$.phones)?.row(model.phones.at(0)!).scope; // '#/phones[<ключ строки>]'
compiled.nodes.get('#/1' as SchemaNodeId)?.kind; // 'array' — узел без selector: позиционный id
```

### Схема сборки — `bundle.render.tree`

```typescript
const bundle = createForm<CreditForm>({ model: createCreditModel(), schema: creditSchema });

bundle.render.tree; // CompiledSchema корневой области; без schema — undefined
bundle.render.node('wizard'); // управление узлом корневой области по selector
```

Своему рендереру и инструментам нужна именно эта компиляция: повторный `compileSchema` того же
дерева даёт другие объекты и другой кэш строк.

### Обход дерева — список селекторов

```typescript
import type { CompiledNode, CompiledSchema } from '@reformer/core';

function selectorsOf(schema: CompiledSchema): string[] {
  const out: string[] = [];
  const walk = (node: CompiledNode): void => {
    if (node.selector !== undefined) out.push(`${node.scope} ${node.selector}`);
    if (node.kind === 'container') {
      for (const child of node.children) if (child.kind !== 'text') walk(child);
    }
    if (node.kind === 'part') walk(node.content.root); // часть — своя область
    // строки массива — node.row(rowModel) для каждой под-модели строки
  };
  walk(schema.root);
  return out;
}
```

### Свой рендерер — разбор по `kind`

```tsx
function renderNode(node: CompiledChild): ReactNode {
  switch (node.kind) {
    case 'text':
      return node.parts.map((part) => (typeof part === 'object' ? part.value : part)).join('');
    case 'field':
      return <Field key={node.id} handle={node.handle} component={node.component} props={node.props} />;
    case 'array': // у каждой строки своя область: node.row(под-модель строки)
      return Array.from({ length: node.control.length }, (_, i) =>
        renderNode(node.row(node.control.at(i) as object).root)
      );
    case 'part':
      return renderNode(node.content.root);
    case 'container':
      return node.children.map(renderNode);
  }
}
```

## Anti-patterns

```typescript
// ❌ Два узла с одним selector в корне — исключение при сборке
children: [
  { selector: 'address', model: model.$.registrationAddress, part: address },
  { selector: 'address', model: model.$.residenceAddress, part: address },
];

// ✅ Разные селекторы; внутри части селекторы свои — повтор в двух частях не конфликтует
children: [
  { selector: 'registration', model: model.$.registrationAddress, part: address },
  { selector: 'residence', model: model.$.residenceAddress, part: address },
];
```

```typescript
// ❌ Индекс строки в идентификаторе области: после move/swap он указывает на чужую строку
const scope = `#/phones[${index}]`;

// ✅ Ключ строки — FormArray.keyAt(index); он же стоит в скобках области строки
const scope = `#/phones[${form.phones.keyAt(index)}]`;
```

```typescript
// ❌ Узел строки массива ищется в nodes корня — его там нет
bundle.render.tree?.nodes.get('co-borrower' as SchemaNodeId); // undefined

// ✅ Узел строки — в схеме строки; в поведении — applyEach + schema.node(...) строки
const coBorrowers = bundle.render.tree?.arrays.get(model.$.coBorrowers);
coBorrowers?.row(model.coBorrowers.at(0)!).nodes.get('co-borrower' as SchemaNodeId);
```

```typescript
// ❌ Узлы в componentProps — компилятор туда не заглядывает, поле не появится
{ component: Section, componentProps: { content: { model: model.$.email, component: Input } } }

// ✅ Вложенные узлы — только в children
{ component: Section, children: [{ model: model.$.email, component: Input }] }
```

## See also

- [09-formschema.md](./09-formschema.md) — авторский формат узлов
- [35-unified-contract.md](./35-unified-contract.md) — одна схема, одна сборка, одно поведение
- [38-form-flow.md](./38-form-flow.md) — шаги потока адресуются `selector` узлов шагов
- [10-arrays.md](./10-arrays.md) — массивы под-форм и `keyAt`
