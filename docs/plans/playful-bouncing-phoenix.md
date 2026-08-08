# Отказ от `text`: текстовое содержимое переезжает в `children`

## Контекст

`text` появился в коммите `c7cee609` («html-узлы в схеме») вместе с оператором `$html(tag)`: до него
презентационная разметка требовала отдельного React-компонента, а в JSON — ещё и регистрации в реестре.
Поле живёт на двух уровнях — `ContainerRenderNode.text` в [renderer-react/core/types.ts](../../packages/reformer-renderer-react/src/core/types.ts)
и `JsonContainerNode.text` в [renderer-json/types/json-schema.ts](../../packages/reformer-renderer-json/src/types/json-schema.ts).

Технически `text` — это **текстовые `children`**, для которых не нашлось места в типе
`children?: RenderNode[]`. В рендере оба слота попадают в один и тот же React-элемент
([render-node.tsx:840-852](../../packages/reformer-renderer-react/src/core/render-node.tsx#L840-L852)):
`{text}{children}`. Отсюда два следствия:

- **дублирующийся контракт** — «содержимое узла» описывается двумя разными ключами;
- **жёсткий порядок** — текст всегда ПЕРЕД детьми. `<p><b>Важно:</b> и далее текст</p>` описать нельзя,
  нужна лишняя обёртка.

Цель: `children` принимает и узлы, и текст (литерал, `$model(...)`, `$locale(...)`); `text` удаляется
из обоих слоёв. Это breaking-изменение публичного API пакетов v6 — major bump.

## Целевой контракт

```jsonc
// было
{ "component": "$html(p)", "text": ["Платёж: ", "$model(monthlyPayment)", " ₽"] }
{ "component": "$html(p)", "text": "Внимание! ", "children": [{ "component": "$html(b)", "text": "Важно" }] }

// стало
{ "component": "$html(p)", "children": ["Платёж: ", "$model(monthlyPayment)", " ₽"] }
{ "component": "$html(p)", "children": ["Внимание! ", { "component": "$html(b)", "children": ["Важно"] }] }
// и то, что раньше было невозможно:
{ "component": "$html(p)", "children": [{ "component": "$html(b)", "children": ["Важно:"] }, " и далее текст"] }
```

```ts
// renderer-react (TS-схема)
{ component: 'p', children: ['Платёж: ', model.$.monthlyPayment, ' ₽'] }
```

## Слой 1 — renderer-react

**[core/types.ts](../../packages/reformer-renderer-react/src/core/types.ts)**
- `RenderTextPart` (`string | number | Signal`) — оставить и экспортировать.
- `RenderText` и `ContainerRenderNode.text` — удалить.
- Ввести `RenderChild<T> = RenderNode<T> | RenderTextPart`; `children?: RenderChild<T>[]`.

**[core/render-node.tsx](../../packages/reformer-renderer-react/src/core/render-node.tsx)**
- `RenderTextContent` остаётся как есть — это готовый механизм точечной подписки на сигналы.
- В контейнерной ветке добавить группировку: подряд идущие текстовые части собираются в один чанк и
  рендерятся одним `RenderTextContent` (сохраняет текущую склейку без разделителя и не плодит текстовые
  DOM-узлы), узлы — через `RenderNodeComponent`. `key` брать по индексу первой части чанка в исходном
  массиве, а не по индексу чанка.
- Void-теги (`hr`/`br`/`img`): поведение прежнее — содержимого не получают вовсе.
- Ветка `__selfManagedChildren` (FormWizard, FormArraySection в ui-kit): такие компоненты получают
  `children` сырыми и ждут узлы — перед передачей отфильтровать текстовые части и, если что-то
  отфильтровано, выдать dev-warn.
- `isTextPart(v)`: `typeof v === 'string' || typeof v === 'number' || v instanceof Signal` — рядом с
  существующим `collectTextSignals`, который уже опирается на `instanceof Signal`.

**Прочее:** проверить публичные ре-экспорты `RenderText` в `index.ts`; обновить unit-тесты, где узлы
задаются через `text`.

## Слой 2 — renderer-json

**[types/json-schema.ts](../../packages/reformer-renderer-json/src/types/json-schema.ts)**
- Удалить `JsonText` и `JsonContainerNode.text`.
- Ввести `JsonTextChild = string | number` и `JsonChild<T> = JsonNode<T> | JsonTextChild`;
  `children?: JsonChild<T>[]`.

**[converter/json-to-render-schema.ts](../../packages/reformer-renderer-json/src/converter/json-to-render-schema.ts)**
- `transformText` заменить на `resolveTextChild(part, scope, registry)`: `$model(path)` → `signalAt`,
  `$locale(key)` → строка каталога, остальные строки и числа — литералы.
- **Ужесточение:** `$component/$dataSource/$fn` в текстовом ребёнке — ошибка конвертации с внятным
  сообщением. Сейчас `transformText` гоняет текст через `transformPropValue`, и такой оператор молча
  возвращает компонент/функцию, что React роняет уже в рендере.
- Объектная форма `{ $locale, params }` в `children` не поддерживается (в этой позиции объект — это узел);
  реактивные параметры — через компонент `I18n`, как и сейчас.
- В контейнерной ветке: `children: node.children?.map(c => typeof c === 'object' ? convertNodeM1(...) : resolveTextChild(...))`.

**[schema/form-schema.schema.json](../../packages/reformer-renderer-json/src/schema/form-schema.schema.json)**
- Удалить `containerNode.properties.text` и определение `textContent`. У `containerNode` стоит
  `additionalProperties: false`, поэтому старые схемы с `text` будут отвергаться валидатором явной
  ошибкой — это желаемое поведение при breaking-переходе.
- `children.items` — через `if/then/else`, а не `anyOf` (тот же довод, что в `$comment` у `node`: с
  `allErrors` ajv вывалил бы ошибки всех веток): `if: { type: "object" } → $ref node`, `else → $ref textChild`.
  Новое определение `textChild`: `anyOf: [{type: string}, {type: number}]` (union-типы запрещены strict-режимом ajv).
- Убедиться, что `buildFormSchemaMetaSchema` ([schema/index.ts](../../packages/reformer-renderer-json/src/schema/index.ts))
  наследует изменение — он правит только enum'ы имён.

**Без изменений:** `validate.ts` (`walkOperatorNames` обходит любые строки дерева — текстовые дети
подхватятся сами), `collect-operator-names.ts`, `collect-schema-selectors.ts`, guard'ы `isContainerNode`.

## Слой 3 — core (`packages/reformer`)

Изменений не требуется: `harvestFieldConfig` ([create-form.ts:73-83](../../packages/reformer/src/form/create-form.ts#L73-L83))
останавливается на `Signal` и игнорирует примитивы, а поля `text` в core нет.

## Слой 4 — builder

**[model/node-kind.ts](../../projects/reformer-builder/src/model/node-kind.ts)** — ключевая правка.
`ChildSlot.nodes: JsonNode[]` заменить на `entries: Array<{ node: JsonNode; index: number }>`, где `index` —
позиция в исходном массиве. Сейчас пути строятся как `[...slot.path, i]` по индексу отфильтрованного
массива ([SchematicCanvas.tsx:279](../../projects/reformer-builder/src/canvas/SchematicCanvas.tsx#L279)) —
со смешанным `children` это разъедется. Заодно чинится существующий баг: `steps.filter(isNodeLike)` уже
сейчас съезжает по индексам, если в `steps` попал не-узел.

Потребители `childSlots`: [SchematicCanvas.tsx](../../projects/reformer-builder/src/canvas/SchematicCanvas.tsx)
(путь ребёнка из `entry.index`), [dnd/resolve-drop.ts](../../projects/reformer-builder/src/dnd/resolve-drop.ts)
(индекс вставки «в конец» — длина исходного массива `children`, не число узлов), [model/query.ts](../../projects/reformer-builder/src/model/query.ts)
(`walkNodes`, `siblingInfo`, `firstChildPath`).

Остальное:
- **[catalog/html-tags.ts](../../projects/reformer-builder/src/catalog/html-tags.ts) + [catalog/make-node.ts](../../projects/reformer-builder/src/catalog/make-node.ts)** —
  `defaultText` кладётся не в `text`, а в `children: ['Заголовок']`. Комментарии про «text — ключ уровня
  узла» переписать. `HtmlContent = 'container' | 'text' | 'void'` остаётся как классификация тега.
- **[panels/Inspector.tsx](../../projects/reformer-builder/src/panels/Inspector.tsx)** — `TextContentField`
  правит текстовых детей вместо `node.text`. Правило: ровно один текстовый ребёнок → редактируем строкой
  (пустая строка удаляет элемент); текстовых нет → добавляем первым элементом `children`; несколько
  текстовых или текст вперемешку с узлами → read-only подсказка «правьте в JSON» (как сейчас для массива
  фрагментов). Нужна мутация `setTextChild(schema, path, value)` в [model/mutate.ts](../../projects/reformer-builder/src/model/mutate.ts)
  с тем же `coalesceKey`, что и сейчас, чтобы набор текста не плодил undo-шаги.
- **[model/mutate.ts](../../projects/reformer-builder/src/model/mutate.ts)** — места, снимающие
  `children![0] as JsonNode` (unwrap группы), должны игнорировать текстовых детей.
- **[model/query.ts](../../projects/reformer-builder/src/model/query.ts)** — `collectModelPaths`
  пропускает строки при рекурсии и дополнительно собирает пути из текстовых `$model(...)`.
- **[preview-runtime/annotate-schema.ts](../../projects/reformer-builder/src/preview-runtime/annotate-schema.ts)** —
  «пустой узел» теперь определяется отсутствием и узлов, и текстовых детей (вместо `c.text == null`);
  маппинг `children` пропускает строки без аннотации.
- **[model/normalize.ts](../../projects/reformer-builder/src/model/normalize.ts)** — добавить одноразовую
  миграцию при открытии файла: узел с `text` переписывается в текстового ребёнка (первым элементом
  `children`). Формально это выходит за «удалить сразу», но билдер открывает файлы с диска, а без миграции
  они станут невалидными без пути починки. Схема после открытия сразу помечается изменённой.
- Обновить тесты: `node-kind.test.ts`, `make-node.test.ts`, `html-tags.test.ts`, `catalog.test.ts`,
  `annotate-schema.test.ts`, `mutate.test.ts`, `query.test.ts`.

## Слой 5 — схемы, примеры, e2e, доки

Миграция схем (≈35 узлов):
- [examples/html-nodes/](../../projects/react-playground/src/pages/examples/html-nodes/) — `json-schema.json` (7),
  `react-schema.ts` (7), `HtmlNodesExample.tsx` (4);
- [examples/registration-form-renderer-json/json-schema.json](../../projects/react-playground/src/pages/examples/registration-form-renderer-json/json-schema.json) (14);
- [examples/alerts-list-renderer-json/json-schema.json](../../projects/react-playground/src/pages/examples/alerts-list-renderer-json/json-schema.json) (3);
- сгенерированные `form-schema.schema.json` в папках примеров — перегенерировать
  [scripts/gen-form-json-schema.ts](../../projects/react-playground/scripts/gen-form-json-schema.ts).

E2E: [tests/pages/html-nodes/html-nodes.spec.ts](../../projects/react-playground-e2e/tests/pages/html-nodes/html-nodes.spec.ts)
— проверить, что селекторы по тексту переживают разбиение на несколько текстовых узлов.

Доки: `packages/reformer-renderer-json/docs/llms/{02-json-schema,05-cookbook}.md`,
`packages/reformer-renderer-react/docs/llms/{02-render-schema,05-cookbook}.md`, затем перегенерировать
llms.txt (`scripts/generate-llms-txt`). MCP-инструмент `validate_json_schema` берёт мета-схему из пакета —
менять не нужно.

`docs/specs/` — не трогаем (read-only по правилам проекта); упоминаний `text` там нет.

## Тонкости

- **SSR-разметка.** Соседние текстовые чанки могут дать `<!-- -->` между узлами в `renderToString`.
  Группировка подряд идущих частей в один `RenderTextContent` (см. слой 1) убирает основной источник;
  проверить unit-тесты пакетов на точное совпадение HTML.
- **Реактивность.** Механизм тот же (`RenderTextContent`), поэтому изменение сигнала по-прежнему
  перерисовывает только текст, а не поддерево. Проверяется e2e, не unit-тестами (`renderToStaticMarkup`
  перерисовку не покажет).
- **Строка, похожая на оператор.** Правила прежние: резолвятся только `$model(...)`/`$locale(...)`,
  остальные строки — литералы.

## Верификация

1. `npm test` в `packages/reformer-renderer-react`, `packages/reformer-renderer-json`, `packages/reformer`,
   `projects/reformer-builder` — все зелёные.
2. Валидатор: схема со старым `text` отвергается с внятной ошибкой; схема с текстом в `children` проходит.
   Отдельный кейс — `$dataSource(...)` в текстовом ребёнке даёт ошибку конвертации.
3. E2E: `projects/react-playground-e2e` — спеки `html-nodes`, `registration-form`, `alerts-list`;
   реактивный текст (`monthlyPayment`) обновляется при вводе.
4. Билдер вручную: открыть старую схему с `text` (миграция), добавить `$html(p)` из палитры, отредактировать
   текст в инспекторе, перетащить узел внутрь абзаца с текстом, проверить canvas/preview и undo/redo.
5. MCP: `mcp__reformer__validate_json_schema` на мигрированной схеме примера — `valid: true`.

## Риски

- **Пути в билдере.** Смешанный `children` — главный источник регрессий (canvas, dnd, undo). Смягчение:
  `ChildSlot.entries` с исходными индексами как единственный способ адресации.
- **Breaking для внешних потребителей.** Пакеты v6 публикуются; схема может приходить с сервера/CMS.
  Нужен major bump и раздел в CHANGELOG с примером «до/после»; в билдере — авто-миграция при открытии.
- **Ужесточение операторов в тексте** формально сузит поведение (`$fn` в `text` сейчас «работает» до
  падения в React) — считаем это исправлением, но упомянуть в CHANGELOG.
