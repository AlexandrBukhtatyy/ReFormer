# Переиспользуемые фрагменты схемы (TS ↔ JSON)

> Статус: **план реализации**, ожидает приземления ветки `$html`/`text` (см. [Ф0](#ф0--предпосылка)).
> Выбранный вариант — **C + B** из обсуждения: `defineFragment` как общая сущность обоих рендереров
> плюс локальные `definitions` внутри JSON-схемы.

## Оглавление

1. [Контекст](#контекст)
2. [Как устроено сейчас](#как-устроено-сейчас)
3. [Контракт](#контракт)
4. [Инварианты, которые обязана держать реализация](#инварианты-которые-обязана-держать-реализация)
5. [Фазы реализации](#фазы-реализации)
6. [Верификация](#верификация)
7. [Что намеренно не делаем](#что-намеренно-не-делаем)

---

## Контекст

В проекте две схемы UI: TS-`RenderSchema` (`@reformer/renderer-react`) и JSON-схема
(`@reformer/renderer-json`). Вопрос, с которого начался план: **можно ли переиспользовать одну
внутри другой?**

Ответ по факту исследования кода:

| Направление | Сегодня |
|---|---|
| JSON-фрагмент внутри TS-схемы | ✅ работает: `convertJsonToM1Tree(schema, registry, scope)` возвращает обычный `RenderNode` |
| TS-фрагмент внутри JSON-схемы | ❌ невозможно |
| JSON-блок внутри JSON-схемы (DRY) | ❌ невозможно |

Обратное направление ломается по трём причинам:

1. Узел JSON дискриминируется строкой-оператором — `isArrayNode`/`isFieldNode`/`isContainerNode`
   ([types/json-schema.ts:137-180](../../packages/reformer-renderer-json/src/types/json-schema.ts#L137-L180));
   вида «подставь готовое поддерево» нет.
2. Реестр знает роли `component | dataSource | fn | locale`
   ([registry/types.ts:24](../../packages/reformer-renderer-json/src/registry/types.ts#L24)); резолверы
   жёстко проверяют роль и бросают при несовпадении.
3. Обход через `$component(X)` **не эквивалентен**: React-компонент не является узлом схемы, его не
   развернёт `harvestFieldConfig` ([create-form.ts:120-123](../../packages/reformer/src/form/create-form.ts#L120-L123)),
   поэтому валидаторы/`updateOn`/`disabled` полей внутри такого блока молча потеряются, а
   `schema.node(selector)` его поддерево не увидит.

Цель: единый словарь переиспользуемых блоков («адрес», «загрузчик документов», «контакты»),
объявляемых один раз и подставляемых и в TS-, и в JSON-схему, без потери валидаторов,
без коллизий селекторов и с явным scope модели.

Релевантные файлы:
[renderer-react/core/types.ts](../../packages/reformer-renderer-react/src/core/types.ts) ·
[render-schema-proxy.ts](../../packages/reformer-renderer-react/src/core/render-schema-proxy.ts) ·
[render-node.tsx](../../packages/reformer-renderer-react/src/core/render-node.tsx) ·
[json-to-render-schema.ts](../../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts) ·
[operators.ts](../../packages/reformer-renderer-json/src/operators.ts) ·
[registry/types.ts](../../packages/reformer-renderer-json/src/registry/types.ts) ·
[schema/index.ts](../../packages/reformer-renderer-json/src/schema/index.ts) ·
[validate.ts](../../packages/reformer-renderer-json/src/validate.ts) ·
[create-form.ts](../../packages/reformer/src/form/create-form.ts)

## Как устроено сейчас

Опоры, на которых строится контракт (всё уже существует, изобретать не нужно):

- **Относительный scope уже реализован** — в item-шаблоне массива конвертер подменяет scope на
  под-модель элемента: `item: (im) => convertNodeM1(template, im, registry)`
  ([json-to-render-schema.ts:221](../../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts#L221)).
  Фрагмент использует ровно тот же механизм, только scope приходит из `scope: '$model(path)'`.
- **`RenderNode` — рантайм-представление**, `createForm` обходит его generic-обходом по
  `Object.entries`, поэтому ему безразлично, кто построил ветку.
- **Селекторы — плоские `Map`** в `createRenderSchema`
  ([render-schema-proxy.ts:168-186](../../packages/reformer-renderer-react/src/core/render-schema-proxy.ts#L168-L186)) →
  два инстанса одного фрагмента без префикса дадут коллизию `hiddenOverrides`/`propsOverrides`.
- **У листьев коллизии нет**: `refRegistry` фоллбэчит на `__path` сигнала
  ([render-node.tsx:444](../../packages/reformer-renderer-react/src/core/render-node.tsx#L444)), а он
  абсолютен от корня модели. Префикс нужен только узлам с явным `selector`.

## Контракт

### Ядро — `@reformer/renderer-react`

```ts
// packages/reformer-renderer-react/src/core/fragment.ts
export interface FragmentContext<S = any, P = Record<string, unknown>> {
  /** Scope модели: под-модель, к которой привязаны листья фрагмента. */
  scope: FormModel<S>;
  /** Литеральные параметры из точки подстановки (title, labels, флаги). */
  params: P;
  /** Префикс, применённый к селекторам этого инстанса (для чтения; применяется автоматически). */
  selectorPrefix?: string;
}

export interface Fragment<S = any, P = Record<string, unknown>> {
  readonly name: string;
  /** @internal — сырой билдер, вызывается конвертером JSON. */
  build(ctx: FragmentContext<S, P>): RenderNode<any>;
  /** Точка подстановки в TS-схеме. */
  at(scope: FormModel<S>, params?: P, opts?: { selectorPrefix?: string }): RenderNode<any>;
}

export function defineFragment<S, P = Record<string, unknown>>(
  name: string,
  build: (ctx: FragmentContext<S, P>) => RenderNode<any>,
): Fragment<S, P>;
```

`at()` = `build()` + автоматическое префиксование селекторов (`prefixSelectors`, Ф2).

### Точка подстановки в JSON — узел `fragment`

Один вид узла, два источника: реестр (`$fragment(name)`) и локальные `definitions` (`$def(name)`).

```ts
export interface JsonFragmentNode {
  selector?: string;
  /** Ссылка на фрагмент реестра либо на локальный `definitions`. */
  fragment: FragmentOp | DefOp;
  /** Scope модели для фрагмента. По умолчанию — текущий scope узла. */
  scope?: ModelOp;
  /** Префикс селекторов внутри фрагмента. По умолчанию — `selector`, если задан. */
  selectorPrefix?: string;
  /** Литеральные параметры; операторы в значениях резолвятся как в `componentProps`. */
  params?: Record<string, unknown>;
}
```

```json
{
  "version": "1.0",
  "definitions": {
    "AddressBlock": {
      "component": "$component(Section)",
      "children": [
        { "value": "$model(city)",   "component": "$component(Input)" },
        { "value": "$model(street)", "component": "$component(Input)" }
      ]
    }
  },
  "root": {
    "component": "$component(Box)",
    "children": [
      { "fragment": "$def(AddressBlock)", "scope": "$model(registrationAddress)", "selectorPrefix": "reg" },
      { "fragment": "$def(AddressBlock)", "scope": "$model(factAddress)",         "selectorPrefix": "fact" },
      { "fragment": "$fragment(DocumentUploader)", "params": { "title": "Скан-копии" } }
    ]
  }
}
```

Внутри фрагмента пути **относительны** (`$model(city)`, не `$model(registrationAddress.city)`) —
та же семантика, что в item-шаблоне массива.

### Регистрация и использование

```ts
// fragments/address-block.ts — объявляется один раз
export const AddressBlock = defineFragment<Address, { title?: string }>(
  'AddressBlock',
  ({ scope, params }) => ({
    selector: 'address',
    component: Section,
    componentProps: { title: params.title ?? 'Адрес' },
    children: [
      { selector: 'address.city', value: scope.$.city, component: Input, validators: [required] },
      { value: scope.$.street, component: Input },
    ],
  }),
);
```

```ts
// TS-схема
children: [
  AddressBlock.at(model.registrationAddress, { title: 'Адрес регистрации' }, { selectorPrefix: 'reg' }),
  AddressBlock.at(model.factAddress,         { title: 'Фактический адрес' }, { selectorPrefix: 'fact' }),
]
schema.node('reg.address').setHidden(true);   // namespace изолирован

// JSON-схема — тот же объект через реестр
const registry = defineRegistry((reg) => { reg.fragment(AddressBlock); });
```

Обратный адаптер замыкает круг — JSON-блок становится обычным `Fragment`:

```ts
export function fragmentFromJson<S, P>(name: string, node: JsonNode, registry: ComponentRegistry): Fragment<S, P>;
```

## Инварианты, которые обязана держать реализация

Каждый пункт — кандидат в тест (см. фазы).

1. **Разворот на этапе build, не render.** Фрагмент разворачивается внутри `convertNodeM1`/`at()`,
   до `createForm`. Реализация «фрагмент = компонент, рендерящий поддерево» **запрещена** — она
   теряет валидаторы (`harvestFieldConfig` не заглядывает в React-компоненты).
2. **Scope обязателен и проверяем.** `scope: '$model(x)'`, не резолвящийся в модели, — ошибка
   конвертации с внятным текстом, а не `undefined` в листьях.
3. **Селекторы префиксуются автоматически**, рекурсивно, включая поддеревья, возвращаемые
   `item`-фабриками. Фрагмент не обязан помнить про префикс.
4. **Стабильность ссылок.** `Fragment` создаётся один раз (модульная константа / `useMemo`);
   дерево строится один раз на конвертацию. Иначе ломается кэш поддеревьев массива, завязанный на
   identity `node.item` ([render-node.tsx:236-252](../../packages/reformer-renderer-react/src/core/render-node.tsx#L236-L252)).
5. **Циклы — ошибка.** `$def(A)` → `$def(B)` → `$def(A)` даёт исключение со стеком имён, не переполнение.
6. **`fragment` проверяется первым** в цепочке дискриминации (до `array`/`value`/`component`) — и в
   рантайм-guard'ах, и в `definitions.node` мета-схемы.
7. **Фрагменты резолвятся и в `componentProps`** — там уже есть ветка вложенных узлов
   (`looksLikeNode` → `convertNodeM1`), через неё идут, например, steps визарда.
8. **Разная природа — разные гарантии, и это документируется:** JSON-фрагмент проходит полный
   convert (операторы, `$locale`, `text` работают, валидируется мета-схемой); TS-фрагмент —
   чёрный ящик для валидатора, взамен даёт функции (`item`, `validators`, обработчики).

## Фазы реализации

### Ф0 — предпосылка

Незакоммиченная работа по `$html(tag)` + `text` трогает **ровно те же файлы**: `operators.ts`
(`OPERATOR_RE`), `types/json-schema.ts` (union + guards), `converter`, `schema/index.ts`,
`validate.ts`, `form-schema.schema.json`, а также `renderer-react` `types.ts`/`utils.ts`/
`render-node.tsx`/`index.ts`. Начинать после её приземления, иначе гарантированные конфликты.

### Ф1 — `defineFragment` в `renderer-react`

- Новый `src/core/fragment.ts`: типы `FragmentContext`/`Fragment` + `defineFragment`.
- Экспорт из `src/index.ts`.
- Ничего существующего не меняет; ценность уже есть (переиспользование внутри TS).

**Тесты** `src/core/fragment.test.ts`: `at()` возвращает узел с подставленным scope; `params`
доходят до билдера; дефолт `params = {}`; два инстанса с разным scope дают разные сигналы в листьях.

### Ф2 — авто-префиксование селекторов

- `prefixSelectors(node, prefix)` в `fragment.ts`: рекурсивно по `children`, оборачивает `item`-фабрику.
- Применяется в `at()`; чистая функция, экспортируется для переиспользования конвертером.

**Тесты**: вложенные `children` префиксуются на всю глубину; узлы без `selector` не получают его;
поддерево из `item(im)` префиксуется; без префикса дерево возвращается **той же ссылкой**
(инвариант 4); два инстанса → `schema.node('reg.address')` и `schema.node('fact.address')`
управляются независимо (интеграционный тест с `createRenderSchema`).

### Ф3 — `$fragment(...)` и роль реестра в `renderer-json`

- `operators.ts`: `FragmentOp`, `DefOp`, ветки в `OPERATOR_RE`, `isFragmentOp`/`isDefOp`.
- `registry/types.ts`: роль `'fragment'` в `ComponentMetadata.type`; `RegistryBuilder.fragment(frag)`
  (имя берётся из `frag.name`).
- `component-registry.ts`: реализация builder-метода с проверкой формы (`typeof frag.build === 'function'`),
  симметрично тому, как `reg.fn` бросает на не-функции.
- `types/json-schema.ts`: `JsonFragmentNode`, `isFragmentNode`, расширение union.
- `converter`: ветка фрагмента **первой** в `convertNodeM1`; проброс `prefix` вниз по дереву;
  резолв scope через существующий `resolveModelPath`; ветка `isFragmentOp` в `transformPropValue`.

**Тесты** `converter/json-to-render-schema.test.ts`: подстановка TS-фрагмента; относительные пути
резолвятся от `scope`; неизвестное имя → внятная ошибка со списком доступных; запись роли
`component`, использованная как `$fragment(...)`, → ошибка (симметрия существующим проверкам ролей);
фрагмент внутри `componentProps`; валидаторы фрагмента доезжают до `createForm` (интеграционный:
`createForm({model, schema: convertJsonToM1Tree(...)})` → поле внутри фрагмента невалидно при пустом значении).

### Ф4 — локальные `definitions` + `$def(...)`

- `JsonFormSchema.definitions?: Record<string, JsonNode>`.
- Контекст конвертации `ConvertCtx { definitions, stack, prefix }` вместо голых аргументов.
- Резолв `$def(name)` с детектом циклов по `stack`.

**Тесты**: два инстанса одного `definition` с разным scope; вложенный `$def` внутри `$def`;
цикл → ошибка со стеком имён; `$def` на несуществующее имя → ошибка со списком доступных;
`definitions` сам по себе не рендерится.

### Ф5 — валидация

- `schema/index.ts`: `getFragmentNames(registry)`; в `buildFormSchemaMetaSchema` — сужение
  `fragmentOp` до enum (как уже сделано для `componentOp`).
- `form-schema.schema.json`: `definitions.fragmentNode`, `fragmentOp`, `defOp`; вставка ветки
  `if: { required: ['fragment'] }` **первой** в цепочку `definitions.node`; `definitions` в корневой схеме.
- `validate.ts`: ветка `op === 'fragment'` в `walkOperatorNames` (имена против реестра, как
  `$component`); ветка `op === 'def'` — проверка против ключей `schema.definitions`.

**Тесты** `validate.test.ts`: неизвестный `$fragment` → ошибка; неизвестный `$def` → ошибка;
валидная схема с фрагментами проходит; узел `fragment` не проваливается в ветку `containerNode`
(регрессия на порядок дискриминации).

### Ф6 — `fragmentFromJson` (замыкание круга)

JSON-блок оборачивается в `Fragment` и вставляется в TS-схему через тот же `at()`.

**Тесты**: `fragmentFromJson(...).at(model.x)` даёт то же дерево, что `$def` того же блока со
`scope: '$model(x)'` (структурное сравнение путей сигналов и имён компонентов).

### Ф7 — документация и пример

- `docs/llms/` в `renderer-json` и `renderer-react`: раздел про фрагменты, таблица «JSON-фрагмент vs
  TS-фрагмент» (инвариант 8); перегенерировать `llms.txt` (`npm run generate:llms` в пакетах).
- Пример в playground: адрес, переиспользованный дважды, — в TS- и JSON-варианте одной формы.
- MCP: рецепт `fragment` в `find_recipe`, чтобы генератор форм умел предлагать переиспользование.

## Верификация

```bash
# юнит-тесты затронутых пакетов
cd packages/reformer-renderer-react && npm test
cd packages/reformer-renderer-json  && npm test
cd packages/reformer               && npm test

# типы и линт по монорепо
npx tsc -b && npx eslint .

# MCP-проверка мета-схемы: схема с фрагментами должна валидироваться
# (mcp__reformer__validate_json_schema с componentNames из реестра примера)
```

E2E: playground-пример с двумя инстансами фрагмента — заполнение обоих адресов независимо,
`schema.node('reg.address').setHidden(true)` скрывает **только** первый (прямая проверка
инварианта 3). Скриншоты — в `projects/react-playground-e2e/screenshots/fragments/`.

Ручная проверка инварианта 1: поле с `validators: [required]` внутри фрагмента → форма невалидна
до заполнения. Это тот самый случай, который молча ломается при реализации фрагмента компонентом.

## Что намеренно не делаем

- **Сериализация TS → JSON** (`serializeRenderNode`). Технически частично возможна (сигнал несёт
  `__path`, компонент — через обратный индекс реестра), но `item`-фабрики, `when`, `validators`,
  обработчики и `itemLabel`-функции не сериализуются в принципе. Годится как devtool для миграции —
  отдельной задачей, не частью этого контракта.
- **Оператор `$fragment` без `defineFragment`** (вариант A из обсуждения) — подмножество текущего
  контракта, отдельной ценности не несёт.
- **Типовая проверка соответствия `scope` форме фрагмента в JSON.** В TS её даёт generic `S`;
  в JSON путь — строка, поэтому проверка только рантайм (инвариант 2).
