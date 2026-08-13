# AI-ассистент в reformer-builder: семантический слой команд поверх редактора

## Context

Есть внешний разбор (ChatGPT) с предложением архитектуры AI-ассистента для `reformer-builder`.
Его главный тезис верен и принимается: **AI не генерирует JSON-схему целиком, а вызывает
типизированные операции редактора**; builder решает, допустимы ли они. Это снимает у модели
ответственность за `$model`/`$component`/array-templates/wizard-steps/порядок ключей и позволяет
использовать модели попроще.

Разбор писался по README и беглому чтению, поэтому часть его выводов под этот репозиторий
избыточна, а часть — не учитывает уже существующих швов. Этот план — переложение его идей на
фактический код, с проверкой каждого утверждения.

Что из разбора **отбрасывается после проверки кода**:

| Предложение разбора                                             | Почему не нужно                                                                                                                                                                                                    |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Свой DSL `FormCommand` + `CommandExecutor` (§42–43, §115–116)   | [`model/mutate.ts`](../../projects/reformer-builder/src/model/mutate.ts) — уже 25 чистых функций `(schema, …) => MutationResult`. Это и есть словарь команд; инструменты оборачивают его 1:1.                      |
| Transaction layer / `aiTransaction` / batch (§15–18)             | При Preview→Apply не нужен вообще: агент правит **отдельную копию** схемы, а применение — один `replaceSchema`, который даёт ровно одну запись истории ([reducers.ts:402](../../projects/reformer-builder/src/store/reducers.ts#L402)). Правок в сторе — ноль. |
| `node_a8f21`-ссылки + side-map (§10–11)                          | `toPointer`/`fromPointer` уже есть ([paths.ts:96-113](../../projects/reformer-builder/src/model/paths.ts#L96-L113)) и используются для подсветки raw-JSON. Проверено: индексы-строки из `fromPointer` корректно едят `isIndex` ([query.ts:52](../../projects/reformer-builder/src/model/query.ts#L52)), `siblingInfo` ([:198](../../projects/reformer-builder/src/model/query.ts#L198)) и `removeAt` ([paths.ts:81](../../projects/reformer-builder/src/model/paths.ts#L81)). |
| `SchemaRevision` (§97–98)                                        | Конфликт ловится сравнением ссылок на объект схемы — ровно так уже работает `isDirty` ([reducers.ts:886](../../projects/reformer-builder/src/store/reducers.ts#L886)). Счётчик заводить незачем.                    |
| Своя фабрика узлов                                               | `makeNodeFor(name, role, compoundParent)` ([make-node.ts:307](../../projects/reformer-builder/src/catalog/make-node.ts#L307)) уже умеет field/container/array/wizard/step + 15 compound-шаблонов.                   |

**Смежный документ.** В репозитории лежит [RFC-0002](../../projects/reformer-builder/docs/rfcs/0002-ai-chat-and-webmcp.md)
(статус «предложение»), покрывающий ту же территорию шире — с WebMCP и слоем провайдеров.
Решено вести этот план независимо; WebMCP вне скоупа. Чтобы документы не разъезжались, реестр
инструментов делается адаптеронезависимым — WebMCP-адаптер добавляется позже одним файлом.
Из RFC берётся один факт, подтверждённый чтением кода, — **ограничение L3** (ниже).

## Ограничения, которые задают дизайн

1. **Гейт валидации сегодня не поймает галлюцинацию имени компонента.**
   [`io/validate.ts:43`](../../projects/reformer-builder/src/io/validate.ts#L43) собирает
   `componentNames` из **самой проверяемой схемы** (`ops.components`) и объединяет с
   `knownComponentNames()`. Для ручных правок это осознанно (в standalone имена project-specific
   компонентов знать неоткуда), для машинного входа — дыра: проверка самоисполняющаяся.
   Это делает строгий режим гейта **первым** этапом, ещё до любого AI.

2. **`coalesceKey` не даёт транзакции.** Схлопывает только **подряд идущие** правки с тем же
   ключом ([reducers.ts:365](../../projects/reformer-builder/src/store/reducers.ts#L365)), а
   `undo`/`redo` сбрасывают `lastCoalesceKey` в `null` ([:422](../../projects/reformer-builder/src/store/reducers.ts#L422)).
   Preview→Apply обходит это целиком, а не чинит.

3. **Правая зона захардкожена под инспектор**, `ui.rightOpen` — булево
   ([EditorLayout.tsx:483-497](../../projects/reformer-builder/src/app/EditorLayout.tsx#L483-L497)),
   аналога `LEFT_PANELS` нет. А секция `ui` в **публикуемой**
   [`runtime-config.schema.json`](../../projects/reformer-builder/src/config/runtime-config.schema.json)
   объявлена `additionalProperties: false` — любой новый UI-флаг = версионируемая правка контракта.
   ⇒ В первой итерации чат — **drawer**, а не четвёртая resizable-панель. `RIGHT_PANELS` отложен.

4. **`dist` ≈ 8.6 МБ.** Панель чата, AI SDK и каждый провайдер обязаны быть отдельными
   динамическими импортами: кто не открыл чат — не платит.

5. **Тесты билдера — `environment: 'node'`, `include: ['src/**/*.test.ts']`**
   ([vitest.config.ts](../../projects/reformer-builder/vitest.config.ts)); `.tsx`-тестов в проекте
   нет вовсе. ⇒ Ядро агента обязано быть **без React и без обращений к стору**, иначе оно
   непокрываемо принятыми в проекте средствами.

6. **`Ctrl+Shift+K` свободна** глобально (единственный обработчик —
   [EditorLayout.tsx:213-397](../../projects/reformer-builder/src/app/EditorLayout.tsx#L213-L397)),
   но это дефолтный `deleteLines` в Monaco ⇒ внутри редактора перехват через `editor.addCommand`,
   как уже сделано для `⇧⌘V`/`⌘K V` ([CodeArea.tsx:62-72](../../projects/reformer-builder/src/canvas/CodeArea.tsx#L62-L72)).

7. **BYOK из браузера.** Anthropic официально поддерживает прямой вызов заголовком
   `anthropic-dangerous-direct-browser-access: true`. У OpenAI CORS **не подтверждён** —
   проверяется `curl` с preflight **до** написания адаптера, а не после.

## Целевой API

Ядро — чистые функции над схемой. Стор не участвует до момента Apply.

```ts
// agent/core/types.ts
export interface AgentTool<P = unknown> {
  readonly name: string; // ≤30 символов
  readonly description: string; // ≤500 символов
  readonly inputSchema: object; // сырой JSON Schema, как в @reformer/mcp
  readonly readOnly: boolean;
  run(params: P, ctx: ToolContext): ToolOutcome;
}

export interface ToolContext {
  /** Черновик схемы хода — НЕ схема стора. */
  readonly draft: JsonFormSchema;
  /** Схема на начало хода: база для diff и для проверки конфликта. */
  readonly base: JsonFormSchema;
}

export interface ToolOutcome {
  ok: boolean;
  /** Текст для модели, ≤1.5 КБ. */
  text: string;
  /** Новая схема черновика; отсутствует у read-only. */
  schema?: JsonFormSchema;
  /** Человекочитаемая строка для списка изменений: «+ Email (EmailField)». */
  op?: ChangeOp;
  error?: ToolError;
}

/** Структурированная ошибка — модель по ней чинится сама (разбор §93–95). */
export interface ToolError {
  code:
    | 'UNKNOWN_COMPONENT'
    | 'INVALID_PROPS'
    | 'STALE_POINTER'
    | 'INVALID_PARENT'
    | 'SCHEMA_INVALID';
  message: string;
  /** Например, похожие имена компонентов из каталога. */
  suggestions?: string[];
}
```

**Адресация узлов** — JSON Pointer + защита от устаревания без side-map:

```ts
// Каждый write-инструмент принимает необязательный expect и возвращает новый указатель.
interface NodeRefParams {
  pointer: string; // '/root/children/2'
  expect?: { component?: string; model?: string };
}
// Executor сверяет expect ДО мутации; несовпадение → STALE_POINTER + свежий outline в тексте.
// Ответ write-инструмента всегда содержит toPointer(result.newPath).
```

**Провайдер** — свой интерфейс, AI SDK внутри как деталь реализации:

```ts
// agent/providers/types.ts
export interface AiProvider {
  readonly id: 'anthropic' | 'openai' | 'openai-compatible' | 'fake' | (string & {});
  readonly displayName: string;
  readonly origin: 'browser' | 'loopback';
  detect(): Promise<{ available: boolean; reason?: string }>;
  capabilities(): { tools: boolean; streaming: boolean; images: boolean };
  stream(req: AiRequest, signal: AbortSignal): AsyncIterable<AiEvent>;
}

export type AiEvent =
  | { type: 'delta'; text: string }
  | { type: 'tool_call'; id: string; name: string; args: unknown }
  | { type: 'tool_result'; id: string; result: ToolOutcome }
  | { type: 'error'; message: string; retryable: boolean }
  | { type: 'done'; reason: 'complete' | 'aborted' | 'error' };
```

**Набор инструментов первой итерации.** Read-only: `get_form_outline`, `get_form_node`,
`list_components`, `describe_component`, `validate_form`. Write (над черновиком):
`insert_node`, `set_node_prop`, `set_node_model`, `remove_node`, `move_node`, `duplicate_node`,
`group_nodes`, `set_layout`.

`set_layout` принимает семантику (`direction`, `columns`, `gap`), а не Tailwind-классы — модель
не должна знать про `flex gap-4`; преобразование делает executor поверх `mutate.flipDirection` и
`DEFAULT_ROW_CLASS`/`DEFAULT_COL_CLASS` ([mutate.ts:41-43](../../projects/reformer-builder/src/model/mutate.ts#L41-L43)).

Сознательно **нет**: файловых операций, запуска процессов, произвольной замены схемы. Генерация
«с нуля» — это те же `insert_node` поверх `emptySchema()`
([normalize.ts:13](../../projects/reformer-builder/src/model/normalize.ts#L13)), проходящие тот же гейт.

## Файлы

```
projects/reformer-builder/src/
├── agent/                      ← НОВОЕ. Ядро: без React, без стора (см. ограничение 5)
│   ├── core/
│   │   ├── types.ts            AgentTool · ToolContext · ToolOutcome · ToolError
│   │   ├── registry.ts         createToolRegistry() · invoke() с валидацией входа (ajv)
│   │   ├── node-ref.ts         pointer ⇄ JsonPath · проверка expect
│   │   ├── outline.ts          дайджест схемы поверх walkNodes
│   │   ├── catalog-digest.ts   поверх getCatalog() — единственный источник имён
│   │   ├── changeset.ts        ChangeSet · ChangeOp · описание операций для UI
│   │   ├── loop.ts             агентский цикл над AiProvider (лимит шагов + AbortSignal)
│   │   ├── prompt.ts           системный промпт (EN)
│   │   └── tools/*.ts          по файлу на инструмент
│   ├── providers/
│   │   ├── types.ts · registry.ts · fake.ts
│   │   ├── ai-sdk.ts           общий адаптер: streamText → AiEvent
│   │   └── anthropic.ts · openai.ts · openai-compatible.ts
│   ├── keys.ts                 BYOK-хранилище (отдельно от всего остального)
│   └── session.ts              createStore<AgentSession> — как остальные микро-сторы
├── panels/agent/               ← НОВОЕ. React
│   ├── ChatDrawer.tsx · MessageList.tsx · ToolCallRow.tsx
│   ├── ChangePreview.tsx · ProviderPicker.tsx
└── io/validate.ts              ← ПРАВКА: строгий режим (единственная правка существующего кода)
```

Правка `io/validate.ts` — аддитивная, сигнатура сохраняет обратную совместимость:

```ts
export function validateSchema(
  schema: JsonFormSchema,
  opts?: { strict?: boolean; baseline?: JsonFormSchema }
): ValidationResult;
```

Существующий вызов из `triggerSave` ([save-actions.ts:552](../../projects/reformer-builder/src/app/save-actions.ts#L552))
не меняется — поведение ручного сохранения остаётся прежним.

**Уточнение, найденное реализацией Э1** (первоначально в плане было «`componentNames` = только
каталог»). Так делать нельзя по двум причинам, обе выявлены тестами:

1. `knownComponentNames()` — это уже производная каталога (`getCatalog().filter(isRegistrable)`)
   **плюс INFRA-имена** `FormField`/`AsyncBoundary`/`List`. Взяв «только каталог», мы бы уронили
   display-массивы с `$component(List)`.
2. Каталог билдера в standalone **не знает project-specific компонентов**: фикстура
   [`sample-schema.ts`](../../projects/reformer-builder/src/model/__fixtures__/sample-schema.ts)
   использует `RendererFormWizard`, который живёт в реестре конкретного проекта. Строгий режим
   «только известные имена» отверг бы валидную пользовательскую форму.

Поэтому самоисполняющимся источником имён становится **не проверяемая схема, а база хода**
(`ToolContext.base`, она же `opts.baseline`): что у пользователя уже было — законно, а новое
выдуманное имя не проходит. Preview→Apply даёт эту базу бесплатно.

## Этапы

Каждый этап оставляет репозиторий зелёным и коммитится отдельно.

**Э1 — строгий гейт и поверхность чтения. AI не участвует.**
`validateSchema(schema, { strict: true })`; `outline.ts`; `catalog-digest.ts`; `node-ref.ts`;
реестр + пять read-only инструментов. Юнит-тесты по образцу `model/`/`store/`: пустая форма,
вложенные контейнеры, wizard (`componentProps.steps`), массив (`item.$template`).
*Ценность вне AI: закрывает ограничение 1 и даёт машиночитаемое описание редактора.*

**Э2 — write-инструменты и ChangeSet. Всё ещё без сети.**
Восемь write-инструментов поверх `mutate.ts`; `changeset.ts`; `loop.ts`; fake-провайдер со
сценарными ответами. Golden-тесты: prompt → ожидаемая последовательность вызовов → ожидаемая
схема. Проверяется главное — **непричастные узлы не изменились**.

**Э3 — UI и применение.**
`ChatDrawer` на `@reformer/ui-kit/sheet`, монтируется рядом с существующими модалками
([EditorLayout.tsx:513-516](../../projects/reformer-builder/src/app/EditorLayout.tsx#L513-L516));
`Ctrl+Shift+K` + перехват в Monaco; видимые tool calls («✓ Добавлено поле Email»), а не сырой JSON;
`ChangePreview` со списком операций и построчным diff через существующий
[`io/diff.ts`](../../projects/reformer-builder/src/io/diff.ts); Apply → `editorActions.replaceSchema(draft)`;
проверка конфликта сравнением `activeTab.schema !== base` с выбором «пересчитать / применить / отменить».

**Э4 — провайдеры, строго по одному.**
BYOK-хранилище + экран согласия; `ai-sdk.ts` поверх `streamText` со `stopWhen: stepCountIs(N)`,
где `execute` инструмента ходит в реестр. Порядок: **Anthropic** (подтверждённо работает из
браузера) → `curl`-проверка preflight → **OpenAI** → **OpenAI-совместимый локальный**
(Ollama `:11434/v1`, LM Studio `:1234/v1`; Ollama требует `OLLAMA_ORIGINS`). Выбор модели в UI;
провайдер без `capabilities().tools` не предлагается для правок и объясняет это явно.

**Э5 — бюджет и документация.**
Проверка, что первый чанк не вырос; README: как включить чат, куда уходит ключ, что схема
считается недоверенными данными.

## Что уточнилось при реализации

Факты, разошедшиеся с планом. Все выявлены проверкой, а не предположением.

| В плане                                        | По факту                                                                                                                                                                                        |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ai@^6`                                        | Согласованный набор — **`ai@^7`** (7.0.63) + `@ai-sdk/anthropic@4` / `openai@4` / `openai-compatible@3`: пакеты провайдеров отдают `LanguageModelV4`, который `ai@6` не принимает.               |
| CORS у OpenAI под вопросом (риск R4)           | **Подтверждён** preflight-запросом до написания адаптеров: `Access-Control-Allow-Origin: http://localhost:5173`, `access-control-allow-headers: authorization,content-type`. Риск снят.        |
| Чат на `@reformer/ui-kit/sheet`                | Обычный fixed-слой: `Sheet` построен на radix Dialog и захватывает фокус, а чат обязан оставлять холст рабочим — пользователь смотрит на форму, пока идёт ход.                                  |
| Строгий гейт = «только каталог»                | Источник исключений — база хода (см. уточнение выше): иначе падают project-specific компоненты и INFRA-имена.                                                                                    |
| Указатели узлов «съезжают» — нужна страховка   | Помимо `expect` понадобилась нормализация индексов в `refToPath`: `fromPointer` отдаёт строки, а `ungroupNode` проверяет `typeof === 'number'` и на строке молча ничего не делает.               |

Фактический бюджет бандла: `byok` (SDK и адаптеры) — 707 kB отдельным чанком, `ChatDrawer` — 38 kB
отдельным чанком. В основной чанк из ассистента попадает только `agent/session.ts`, поэтому первый
экран не вырос.

## Верификация

```bash
npm run test -w @reformer/builder      # юниты ядра: реестр, инструменты, golden-цикл
npm run lint -w @reformer/builder
npm run typecheck                      # из корня; builder уже в списке tsconfig'ов
npm run size                           # бюджеты .size-limit.json — контроль ограничения 4
npm run dev:builder                    # ручная проверка
```

Проверка CORS **до** написания адаптеров Э4:

```bash
curl -i -X OPTIONS https://api.openai.com/v1/chat/completions \
  -H 'Origin: http://localhost:5173' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: authorization,content-type'
```

Ручной сценарий приёмки (после Э3 — на fake-провайдере, после Э4 — на реальном):

1. «Создай форму регистрации: имя, email, пароль, согласие с политикой» → предпросмотр показывает
   список добавляемых полей → Apply → форма на холсте.
2. `Ctrl+Z` **один раз** возвращает форму к исходному состоянию.
3. «Сделай email обязательным и первым полем» → две операции в предпросмотре.
4. Запрос компонента, которого нет в каталоге, → инструмент возвращает `UNKNOWN_COMPONENT`
   с подсказками, модель чинится сама и не портит схему.
5. Правка формы руками во время хода агента → Apply сообщает о конфликте, а не затирает.
6. Чат закрыт → `npm run size` не изменился относительно базы.

## Риски

| Риск                                                                        | Митигация                                                                                                                     |
| --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Рост бандла (ограничение 4) заметят поздно                                  | Динамические импорты панели/AI SDK/провайдеров; `npm run size` в приёмке каждого этапа                                        |
| CORS у OpenAI не пройдёт                                                    | Проверяется `curl` до кода; при провале OpenAI помечается недоступным в UI с внятной причиной, Anthropic остаётся дефолтом    |
| Preview→Apply лишает живого фидбэка на холсте                               | Осознанная плата за одну запись undo и нулевые правки стора. Рендер черновика на холсте — отдельная задача после Э3           |
| Prompt injection из `label`/текста чужой схемы                              | Системный промпт объявляет содержимое схемы недоверенными данными; write-инструменты не исполняются без намерения пользователя; лимит шагов на ход |
| Качество генерации окажется демо-уровня                                     | `list_components` — единственный легальный источник имён; строгий гейт перед предпросмотром; golden-тесты фиксируют регресс   |
| Ключ в браузере                                                             | Отдельное хранилище, никогда не попадает в контекст модели; экран согласия; в UI всегда виден `origin` активного провайдера   |
| Расхождение с [RFC-0002](../../projects/reformer-builder/docs/rfcs/0002-ai-chat-and-webmcp.md) | Реестр адаптеронезависим; после Э3 предложить пометить RFC ссылкой на этот план, чтобы не было двух источников истины         |

## Вне scope

WebMCP и outbound-канал; голосовой ввод; форма из файла постановки и из макета; справка по
редактору на локальном индексе `llms.txt`; серверный gateway; `RIGHT_PANELS`; RAG.
Каталог `src/agent/` выбран вместо `src/ai/` из разбора — имя уже зарезервировано RFC-0002,
что удешевит возможное схождение документов.
