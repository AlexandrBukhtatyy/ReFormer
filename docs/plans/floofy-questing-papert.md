# Ускорение ассистента билдера: меньше шагов, меньше токенов

## Context

Ассистент билдера (`projects/reformer-builder/src/agent/`) работает медленно, потому что одна
пользовательская команда разворачивается в десятки последовательных обращений к модели, и каждое
из них тащит весь контекст заново.

Замеры по коду и по реальному захвату хода (`.tmp/builder-agent-test/req-447.json`, локальный
Ollama):

| Что | Сейчас |
| --- | --- |
| tool-call'ов на «3 шага × 4 поля» | **23**, из них **15 (65 %) — чтение**: `get_form_outline` ×8, `get_form_node` ×4, `list_components` ×3 |
| Постоянная часть каждого запроса | ~11 КБ: `tools[]` ≈ 9.1 КБ + `SYSTEM_PROMPT` 2.4 КБ ≈ **2800 токенов** |
| Дублирование внутри `tools[]` | `REF_PROP` ×7 + `EXPECT_PROP` ×6 = **2652 Б (29 %)** буквальных копий |
| Последний запрос хода | 51 КБ, из них `reasoning_content` **28 КБ (55 %)** |
| Суммарно за ход | ~800 КБ ≈ **200–230 K входных токенов** |
| Кеширование префикса | **не включено ни на одном провайдере** |

Причины структурные, а не «модель тупая»:

1. **Промт делает разведку обязательной** ([prompt.ts:18-19,27-28](projects/reformer-builder/src/agent/core/prompt.ts#L18-L28)):
   `get_form_outline` → `list_components` → `describe_component` → правка → `validate_form`.
2. **`list_components` теряет поля.** На боевом ките в бюджет 1500 попадают 55 из 105 записей, и из
   16 полей проходит **ровно одно** (`Calendar`) — `Input`, `Select`, `Textarea`, `Checkbox`,
   `Wizard`, `Step`, `FormArray` отсутствуют. Причина: `byCategory` — `Map` в порядке появления
   ([catalog-digest.ts:157-163](projects/reformer-builder/src/agent/core/catalog-digest.ts#L157-L163)),
   каталог алфавитный, «Контейнеры» съедают бюджет первыми. Модель вынуждена звать повторно.
3. **Все инструменты атомарные.** «5 полей» = 5 вызовов, «сделай все поля обязательными» на форме из
   10 полей = 10 вызовов.
4. **`streamText` вызывается голым** ([ai-sdk.ts:81-88](projects/reformer-builder/src/agent/providers/ai-sdk.ts#L81-L88)):
   нет `providerOptions`, `temperature`, `maxOutputTokens`, `timeout`, `prepareStep`.

**Цель:** 23 tool-call'а → 6–8; входные токены хода 200 K → 25–35 K. Провайдеры равнозначны
(Anthropic / OpenAI / локальный OpenAI-compatible), поэтому приоритет у провайдер-независимых
рычагов, а кеширование деградирует молча там, где не поддерживается.

**Вне области:** воспринимаемая латентность (инкрементальное применение правок в канву) и
отзывчивость UI (React-реконсиляция, `scrollIntoView`) — по решению пользователя.

**API проверено** по `projects/reformer-builder/node_modules/ai/dist/index.d.ts` (`ai@7.0.63`):
`instructions` (заменяет deprecated `system`), `prepareStep`, `activeTools`, `toolOrder`, `timeout`,
`stopWhen` (принимает массив), `usage.inputTokenDetails.cacheReadTokens` — всё существует.

---

## Этап 0 — измеритель (делать первым: иначе план неизмерим)

### 0.1. Usage-события из потока SDK

Файлы: [providers/types.ts](projects/reformer-builder/src/agent/providers/types.ts),
[providers/ai-sdk.ts](projects/reformer-builder/src/agent/providers/ai-sdk.ts),
[core/loop.ts](projects/reformer-builder/src/agent/core/loop.ts),
[providers/fake.ts](projects/reformer-builder/src/agent/providers/fake.ts),
[run.ts](projects/reformer-builder/src/agent/run.ts).

- `types.ts`: `AiUsage { inputTokens?, cachedInputTokens?, cacheWriteTokens?, outputTokens? }`
  и событие `| { type: 'step_usage'; usage: AiUsage }`.
- `ai-sdk.ts`: в `switch (part.type)` добавить `case 'finish-step'` →
  `part.usage.inputTokens`, `part.usage.inputTokenDetails?.cacheReadTokens`.
- `loop.ts`: копить `TurnStats { steps, inputTokens, cachedInputTokens, outputTokens }`,
  класть в событие `done`.
- `run.ts`: `console.info('[agent] ход:', stats)` в `finish()`.

`cachedInputTokens > 0` — единственное честное доказательство, что кеш префикса работает.
Ollama через openai-compatible отдаёт `prompt_tokens`, так что метрика жива и локально.

### 0.2. Детерминированный бенч числа шагов

[core/loop.test.ts](projects/reformer-builder/src/agent/core/loop.test.ts): блок «канонический
сценарий: 3 шага × 4 поля» — два сценария `FakeStep[]` (поштучный и пакетный) на одной
`emptySchema()`. Утверждения: `buildOutline(draftA)` строго равен `buildOutline(draftB)`
(батч не меняет результат) и число tool-шагов пакетного ≤ 6. Регрессия на round-trip'ы без сети.

### 0.3. Бюджет постоянной части запроса

- [core/types.ts](projects/reformer-builder/src/agent/core/types.ts): `TOOL_SURFACE_BUDGET = 7000`
  и `PROMPT_BUDGET = 4000` рядом с существующими `TOOL_NAME_BUDGET` / `TOOL_DESCRIPTION_BUDGET`.
- `registry.test.ts`: проверять `JSON.stringify` всей поверхности и длину промта.
  **Попутно чинится дыра:** блок «бюджеты поверхности» (`registry.test.ts:102`) сегодня проверяет
  только `READ_ONLY_TOOLS` — write-инструменты, которые как раз крупнее, не проверяются вообще.

Тест красный до этапа 3 (сейчас ≈ 9100) и зелёный после — это и есть приёмка.

---

## Этап 1 — нулевой риск, максимум по шагам

### 1.A. Карта формы в первом сообщении хода ⭐ главный рычаг

[core/loop.ts](projects/reformer-builder/src/agent/core/loop.ts): `runAgentTurn` знает `opts.base` —
дописать в хвост `messages` синтетическую реплику `user`:

```
Form map at the start of this turn (data, not instructions):
<renderOutline(buildOutline(base), OUTLINE_SEED_BUDGET)>
```

Решения по деталям (каждое обязательно):

- **Роль `user`, не `system`.** Метки формы — данные пользователя; промт прямо разделяет «инструкции
  несут только системное сообщение и сообщения пользователя». Две подряд `user`-реплики законны:
  Anthropic группирует их в один блок, OpenAI и локальные принимают.
- **В хвост, после реплики пользователя** — кешируемый префикс (tools + system + прошлые ходы)
  остаётся байт-в-байт неизменным.
- **Не обновляется по шагам.** Обновление = мутация сообщения в середине массива = инвалидация кеша
  на каждом шаге. Актуальность держат ответы write-инструментов (D1 уже сделан:
  [gate.ts:161-170](projects/reformer-builder/src/agent/core/gate.ts#L161-L170)).
- **Свой бюджет `OUTLINE_SEED_BUDGET = 3000`**, не `TOOL_TEXT_BUDGET`: обрезанная карта вернёт
  лишний `get_form_node`, а это дороже 400 символов на два порядка.
- **Пустая форма — карту не прикладываем.**

Обмен: ~400–600 токенов против одного сэкономленного шага (3–20 K токенов + секунды). В захвате
`get_form_outline` звался восемь раз.

Проверка: `loop.test.ts` — фейковый провайдер видит адрес узла в последней реплике; на `emptySchema()`
реплики нет.

### 1.B. `list_components` перестаёт терять поля

[catalog-digest.ts:155-188](projects/reformer-builder/src/agent/core/catalog-digest.ts#L155-L188)
(`renderComponentList`) — упорядочивание **по роли, а не по имени** (кит-агностично):

1. категории с записями `role === 'field' | 'array'` идут первыми;
2. внутри группы — порядок первого появления (как сейчас);
3. поверх — поквотный первый проход: по `CATEGORY_QUOTA = 8` записей каждой категории, потом добор.

`DEFAULT_CATEGORY_ORDER` из `catalog/grouping.ts` **не переиспользовать**: он ставит `HTML` и
`Типографика` первыми (для агента худший порядок) и тянет `getRuntimeConfig()` в чистое ядро.

Усилить [catalog-digest.test.ts:42-51](projects/reformer-builder/src/agent/core/catalog-digest.test.ts#L42-L51):
сегодня `toBeGreaterThan(0)` проходит при одном поле — заменить на `expect(missing).toEqual([])`
по всему списку полей, плюс кейс «контейнеры не исчезли» (`Box`, `Tabs`). Не сломать существующие
кейсы бюджета (200/500/1000/5000) и «ниже минимальной ширины».

### 1.C. `get_form_node` без pretty-print

[tools/get-form-node.ts:64](projects/reformer-builder/src/agent/core/tools/get-form-node.ts#L64):
`JSON.stringify(node, null, 2)` → `JSON.stringify(node)`. −25…30 % символов ответа, который в
захвате звучал 4 раза. Существующие утверждения `tools.test.ts` переживают.

### 1.D. Промт разрешает параллельные вызовы

[core/prompt.ts](projects/reformer-builder/src/agent/core/prompt.ts), секция «How you work», одна строка:

> Independent edits may be issued in the same step — several `insert_node` calls into the same parent,
> for example. They run in order against a form that is already changing, so for `remove_node` and
> `move_node` pass `expect`.

Инфраструктура уже готова, проверено: `registry.invoke` синхронный, в
[loop.ts:63-71](projects/reformer-builder/src/agent/core/loop.ts#L63-L71) между чтением `set.draft`
и присваиванием `set` нет ни одного `await` — вызовы сериализуются в микротасках, гонки нет.
Съехавший `ref` ловится `resolveRef` → `STALE_POINTER` (отказ, а не тихая правка чужого узла).
Остаточный риск — несколько `remove_node` по возрастанию индексов; закрывается `refs[]` в этапе 5.

**Ожидаемо после этапа 1:** 23 tool-call'а → 12–15.

---

## Этап 2 — промт: снять обязательную разведку

### 2.A. `SYSTEM_PROMPT` строится из каталога и мемоизируется

[core/prompt.ts](projects/reformer-builder/src/agent/core/prompt.ts):
`export const SYSTEM_PROMPT` → `export function systemPrompt(): string` с ленивым модульным кешем
(тот же приём, что `registry ??=` в [run.ts:22-26](projects/reformer-builder/src/agent/run.ts#L22-L26)).
`loop.ts:82` → `opts.system ?? systemPrompt()`.

Добавляемые блоки — всё выводится из каталога, ни одного захардкоженного имени кита:

1. **Стартовый набор имён:** `Fields: <role==='field'>` (16 имён ≈ 200 симв.) + первые N контейнеров
   без `compoundParent` (≈ 120 симв.).
2. **Общие пропы полей:** пересечение ключей `propsSchema` всех field-записей — на боевом ките это
   `label, required, description`. Одна строка.
3. **Формат адреса — один раз:** `Nodes are addressed by JSON Pointer, e.g. /root/children/0`.
   Это освобождает `REF_PROP` (§3.A).

Смягчение жёстких правил ([prompt.ts:27-28](projects/reformer-builder/src/agent/core/prompt.ts#L27-L28)):

- «Never invent component names. Use only names returned by list_components.» → «Component names come
  from the list above; call `list_components` only for something not listed. An invented name is
  refused by the editor.»
- «Never invent property names. Check them with describe_component before setting them.» → «Beyond
  label/required/description, check property names with `describe_component`. A wrong name is refused
  by the editor.»

Защита не теряется — она рантаймовая и уже есть:
[insert-node.ts:59-68](projects/reformer-builder/src/agent/core/tools/insert-node.ts#L59-L68)
(`UNKNOWN_COMPONENT` + `similarNames`) и гейт через `propSchemas`.

Трейд-офф: +320…420 симв. (~110 токенов) в **кешируемый** префикс против одного-двух round-trip'ов.
Даже без кеша: 110 × 24 = 2.6 K против ~20 K за один шаг.

**Риск, который нельзя проглядеть:** промт становится вычисляемым. Если он пересобирается на каждый
запрос и отличается хоть на байт — кеш префикса не сработает **никогда**. Мемоизация обязательна.

Новый файл `core/prompt.test.ts`: `systemPrompt() === systemPrompt()` **по ссылке**; длина ≤
`PROMPT_BUDGET`; содержит имя хотя бы одного field-компонента; в исходнике нет захардкоженного
`'Input'` (grep-тест на кит-агностичность).

### 2.B. `validate_form` перестаёт быть обязательным финальным шагом

[prompt.ts:19](projects/reformer-builder/src/agent/core/prompt.ts#L19) — «After structural changes,
call validate_form» — это гарантированный лишний round-trip в конце **каждого** хода. При том, что
`commitMutation` гоняет строгий гейт на **каждой** правке
([gate.ts:110-120](projects/reformer-builder/src/agent/core/gate.ts#L110-L120)), а `applyChangeSet`
— ещё раз перед применением. Невалидный результат физически не пройдёт.

Новая формулировка: «Every edit is already gated: a rejected edit answers with the reason. Call
`validate_form` only for a cross-node check (tab ↔ panel, wizard steps) before answering.»

**Обязательный спутник** (без него — регрессия качества): `lintStructure` считается в строгом режиме
([io/validate.ts:103](projects/reformer-builder/src/io/validate.ts#L103)), но гейт читает только
`.errors` ([gate.ts:118](projects/reformer-builder/src/agent/core/gate.ts#L118)) — предупреждения
выбрасываются, и `validate_form` был единственным каналом для них. Поэтому `commitMutation` начинает
дописывать в текст **новые** предупреждения (тем же приёмом «не ухудшать»: сравнение с
`lintStructure(ctx.base)`), не более двух строк. Сигнал приходит в момент создания и без отдельного
шага, а `lintStructure` перестаёт считаться впустую.

**Ожидаемо после этапа 2:** −2…4 шага поверх этапа 1.

---

## Этап 3 — сжатие поверхности `tools[]` (9.1 КБ → ≤ 7 КБ)

### 3.A. `REF_PROP` — 108 → 68 Б (×7 = −280 Б)

[tools/params.ts:13-16](projects/reformer-builder/src/agent/core/tools/params.ts#L13-L16):
описание сводится к `'Node address from get_form_outline'`; пример `/root/children/0` уезжает
в промт один раз (§2.A) и приходит с картой формы (§1.A).

### 3.B. `EXPECT_PROP` — 322 → 218 Б (×6 = −624 Б)

[tools/params.ts:23-35](projects/reformer-builder/src/agent/core/tools/params.ts#L23-L35): убрать
вложенные `description` у двух самоочевидных ключей, смысл «null = не проверять» поднять в общее
описание. **`type: ['string','null']` сохранить дословно** — это пункт D4 предыдущего плана,
он стоил двух сожжённых шагов в живом прогоне. Регрессия ловится существующим `tools.test.ts:87`.

### 3.C. Чистка дублей в описаниях (−340 Б)

Убрать то, что дословно повторяет промт или рантайм-отказ:

- `remove_node`: «Always pass expect for destructive edits…» — правило уже в промте.
- `set_layout`: «Never write CSS classes directly…» — дословный дубль.
- `list_components`: «Take component names ONLY from here…» — после §2.A живёт в промте.
- `get_form_outline`: «Call this FIRST when working with an existing form» — после §1.A прямо вредно.

**Удалять НЕЛЬЗЯ** (несёт то, чего нет ни в промте, ни в схеме): у `set_node_prop` — про ключ `text`
(спецмаршрут в `setTextChild`,
[set-node-prop.ts:60](projects/reformer-builder/src/agent/core/tools/set-node-prop.ts#L60));
у `group_nodes` — «ADJACENT … in document order» (предусловие); у `describe_component` — «prop names
differ between UI kits» (единственное объяснение, зачем звать); у `set_node_model` — «Write the path
bare» (ловушка `$model(...)`).

Итого этапа 3: ≈ −1250 Б (−14 %). До 7000 добирает этап 5.

### 3.D. Подмножество инструментов по состоянию формы — НЕ делать

Соблазн: на пустой форме шесть write-инструментов бессмысленны, ~4 КБ ≈ 1000 токенов. Против:

1. **Ломает кеш ровно там, где он нужен.** Префикс Anthropic упорядочен `tools → system → messages`;
   любое изменение `tools` инвалидирует **весь** префикс. Форма перестаёт быть пустой после первого
   `insert_node` — промах на шаге 2, когда впереди ещё 20. Автокеш OpenAI — та же механика.
2. **Модели плохо переносят исчезающие инструменты** — у Anthropic под это заведён отдельный
   `providerOptions.anthropic.toolChanges`, само существование которого об этом и говорит.
3. **Экономия одноразовая** — только на первом ходе с нуля.

Если когда-нибудь возвращаться — решать состав **один раз на ход** (в `runAgentTurn` по `opts.base`),
а не по шагам. Сейчас безусловное сжатие даёт сопоставимую экономию на **каждом** запросе.

---

## Этап 4 — параметры генерации и кеш префикса

### 4.A. Профиль провайдера — точка провайдер-нейтральности

`AiRequest` про Anthropic знать не должен, поэтому настройка живёт в
[providers/ai-sdk.ts](projects/reformer-builder/src/agent/providers/ai-sdk.ts) (файл и так
«единственное место, знающее про API SDK»), а выбор пресета — в
[providers/byok.ts](projects/reformer-builder/src/agent/providers/byok.ts).
`providers/types.ts` и `fake.ts` не меняются.

```ts
export interface AiSdkTuning {
  cacheBreakpoints: boolean;   // cache_control Anthropic
  promptCacheKey?: string;     // автокеш OpenAI
  dropReasoning: boolean;      // не возвращать reasoning в контекст
  pruneReads: boolean;         // схлопывать устаревшие read-результаты
  maxRetries: number;
}
```

| | anthropic | openai | openai-compatible |
| --- | --- | --- | --- |
| `cacheBreakpoints` | ✔ | — | — |
| `promptCacheKey` | — | ✔ | — |
| `dropReasoning` | ✘ | ✘ | ✔ |
| `pruneReads` | ✘ | ✘ | ✔ |
| `maxRetries` | 2 | 2 | **1** |

`maxRetries: 1` локально: если `localhost` не ответил, повтор через 2 с и ещё через 4 с — 6 с
мёртвого времени на шаг без шанса на успех.

### 4.B. Кеш префикса Anthropic

```ts
const instructions = tuning.cacheBreakpoints
  ? { role: 'system' as const, content: req.system,
      providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' as const } } } }
  : req.system;
```

Заодно `system:` → `instructions:` (в `ai@7` `system` — deprecated-алиас, проверено по `index.d.ts:684`).

Breakpoint ставится на системном сообщении, а не на инструментах: префикс Anthropic упорядочен
`tools → system → messages`, поэтому одна точка кеширует **и инструменты, и промт** — ~2400 токенов
на каждом из 24 запросов.

**4.B-bis (после того как §0.1 покажет `cachedInputTokens`):** подвижная точка на хвосте диалога
через `prepareStep` — `system` кеширует 2.4 K токенов, тогда как `messages` вырастают до 15–30 K.
Снимать прошлые точки перед установкой новой (лимит — 4 breakpoint'а). `cache_control` — метаданные,
не содержимое, поэтому перенос точки не меняет байты префикса.

### 4.C. Автокеш OpenAI

`providerOptions: { openai: { promptCacheKey } }` — случайный id сессии, **без** ключа API и
пользовательских данных. Требования автокеша соблюдены: префикс ≥ 1024 токенов (у нас ~2900);
байт-стабильность обеспечена мемоизацией промта (§2.A), фиксированным порядком инструментов и
отказом от `activeTools` (§3.D).

### 4.D. Локальный провайдер

Ничего не получает и ничего не ломает: `@ai-sdk/openai-compatible` читает только namespace
`openaiCompatible`, чужие `providerOptions` игнорирует молча.

### 4.E. Параметры генерации

| Параметр | Значение | Почему |
| --- | --- | --- |
| `temperature` | `0` | структурная работа: меньше выдуманных имён → меньше отказов → меньше round-trip'ов. Безопасно на всех трёх: `@ai-sdk/openai` сам снимает `temperature` для reasoning-моделей; у Anthropic ограничение только при включённом thinking, а мы его не включаем |
| `maxOutputTokens` | `8192` | **потолок, а не оптимизация.** Меньше ставить опасно: think-модель выдаёт 2–3 K reasoning на шаг, обрыв по `length` = сожжённый ход |
| `maxRetries` | из профиля | входных токенов не стоит (неуспешный запрос не тарифицируется) — чистый wall-clock |
| `timeout` | `{ chunkMs: 60_000, totalMs: 600_000 }` | **`firstChunkMs` не ставить**: у крупной локальной модели prompt-eval честно занимает минуту-две. Молчание *после* начала стрима — уже смерть сервера |
| `toolChoice` | не глобально; через `prepareStep` на последнем разрешённом шаге — `'none'` | модель обязана ответить текстом вместо вызова, который всё равно не исполнится: «Ход остановлен на пределе шагов» превращается в осмысленную сводку, лишних шагов не стоит |
| `stopWhen` | `[stepCountIs(maxSteps), budgetGuard]` | `budgetGuard` по накопленным `usage` — потолок стоимости хода |

**Не проглядеть:** сработавший `timeout` абортит через внутренний контроллер SDK, а наш
`signal?.aborted` при этом `false` → [ai-sdk.ts:139-147](projects/reformer-builder/src/agent/providers/ai-sdk.ts#L139-L147)
уйдёт в ветку ошибки с сырым `AbortError`. Нужен маппинг в человеческое сообщение рядом с
`BROKEN_FINISH`.

Проверка: мок `streamText` в `ai-sdk.test.ts` начинает **захватывать аргументы** — при
`cacheBreakpoints` `instructions` объект с `providerOptions`, без — строка.

---

## Этап 5 — контекст внутри хода и batch-параметры

### 5.A. Reasoning не возвращается в контекст (только `openai-compatible`)

Новый модуль `agent/providers/context.ts` + тест (чистые функции — иначе не протестировать).
`dropReasoning(messages)` фильтрует части `type === 'reasoning'` у ассистентских сообщений.

**Крупнейший рычаг по токенам:** 28 064 из 42 466 Б сообщений в захваченном запросе — запрос
сжимается примерно вдвое.

Почему **только** локально:

- **Anthropic — нельзя.** При extended thinking + tool use API требует, чтобы thinking-блоки
  вернулись с подписями; без них — отказ API.
- **OpenAI — нельзя.** Responses API ссылается на reasoning через `item_reference`/`encrypted_content`;
  порванная цепочка теряет непрерывность рассуждения.
- **openai-compatible — можно и нужно.** `reasoning_content` там не верифицируется, а ряд
  DeepSeek-совместимых эндпоинтов **отвечают ошибкой**, если прислать его обратно. То есть правка
  ещё и закрывает латентный баг. В самом провайдере отключить нечем —
  `convertToOpenAICompatibleChatMessages` дописывает поле безусловно.

### 5.B. Схлопывание устаревших read-результатов (только `openai-compatible`)

`pruneSupersededReads(messages)`: ключ = `toolName + JSON.stringify(input)`; у каждого ключа
остаётся содержимое **последнего** результата, у более ранних содержимое заменяется на
`(superseded — a newer result for the same call is below)`.

**Критично: часть-результат никогда не удаляется, только ужимается** — и Anthropic, и OpenAI требуют
результат на каждый `tool_call`. Write-результаты не трогать никогда: они несут адреса созданных
узлов. `describe_component('Input')` и `describe_component('Select')` различаются по ключу и не
схлопываются. Тест на идемпотентность обязателен (`prepareStep` переносит override вперёд).

Водораздел «только локально» тот же: правка сообщения в середине массива обнуляет кеш от точки правки.

### 5.C. `ToolOutcome.op` → `ToolOutcome.ops`

[core/types.ts:90](projects/reformer-builder/src/agent/core/types.ts#L90), `core/changeset.ts`,
`core/loop.ts:92-100`, `run.ts:122-129`. `withOutcome` конкатенирует. `run.ts` кладёт **одну** запись
в `logTool` на **один** вызов: `summary = ops.map(o => o.summary).join('; ')` — журнал панели
остаётся строкой на вызов. `ChangePreview.tsx` не меняется: он рисует `set.ops` и честно покажет
12 добавленных полей.

### 5.D. `insert_node` — массив узлов в один родитель

```jsonc
{ "parent": REF_PROP,
  "index": { "type": "integer", "minimum": 0, "description": "Position of the first inserted node; appended by default" },
  "nodes": { "type": "array", "minItems": 1, "description": "Components to insert into parent, in order",
    "items": { "type": "object",
      "properties": { "component": {...}, "model": {...}, "props": {...} },
      "required": ["component"], "additionalProperties": false } } }
```

**Плоская одиночная форма убирается** — два способа выразить одно противоречат принципу «модель учит
один словарь» ([params.ts:1-8](projects/reformer-builder/src/agent/core/tools/params.ts#L1-L8)).
Плата: вставка одного узла требует `nodes:[{…}]` (~12 выходных токенов). Размер схемы 582 → 705 Б
(+123); вместе с §5.E (−44) итог **+79 Б** за всю пакетную способность.

**Forward-references не поддерживаем.** Один вызов = один родитель, ровно потому что иначе понадобился
бы плейсхолдер «узел из элемента №0» — то есть второй словарь адресации, запрещённый п. 7 предыдущего
плана. Мастер из 3 шагов по 4 поля собирается за 5 вызовов вместо 15.

**Ответ:** `Done: N nodes into <parent>` + строка на узел `«label» (Component) → <address>` через
`joinWithinBudget`. Поддеревья (`subtreeOf`) печатаются **только при ≤ 2 узлах в батче** — иначе 12
compound'ов не влезут ни в какой бюджет, а состав compound'а модель уже знает из `skeleton`
в `describe_component`.

**Частичный сбой — «всё или ничего», с указанием виновника:**

1. Элементы применяются по очереди к локальному черновику напрямую через `insertNode`, минуя
   `commitMutation`; предусловия (неизвестный компонент, `INVALID_PARENT`, правило слота `steps`)
   проверяются как сейчас, до правки.
2. Любой отказ → `fail(...)` с текстом `nodes[2]: <причина>`; `ctx.draft` не тронут.
3. Гейт запускается **один раз** на итоговой схеме — новый `commitBatch(ctx, schema, ops)` в
   `gate.ts`, переиспользующий `baselineErrors`/`introducedErrors`. `commitMutation` остаётся и
   переписывается через него (одноэлементный случай), чтобы не было двух реализаций «не ухудшать».
4. Только **если гейт отверг** — повторный поэлементный проход, чтобы назвать индекс. Медленный
   путь исполняется исключительно на ошибке.

Почему не «применить префикс»: префикс оставляет черновик в состоянии, о котором модель не знает
точно, и следующий вызов адресует по неверным индексам. Побочный эффект п. 3 — ajv гоняется 1 раз
вместо 12.

### 5.E. `set_node_prop` — `refs[]` + `props{}`

`key`/`value` → `refs: string[]` + `props: { additionalProperties: { type: ['string','number','boolean','null'] } }`.
Размер 698 → 654 Б (−44); ограничение типа значения не теряется, оно переезжает в
`additionalProperties`.

**Совместимость с `setTextChild`:** `props` расщепляются — сперва `text` через `setTextChild`, затем
`setComponentProp` по одному ключу. Все существующие отказы `setText`
([set-node-prop.ts:100-145](projects/reformer-builder/src/agent/core/tools/set-node-prop.ts#L100-L145):
поле без содержимого, «подпись — это title», составное содержимое) сохраняются дословно и роняют
**весь** вызов.

**`expect` разрешён только при одном `ref`** (проверка в `run`, не в схеме — чтобы не раздувать JSON
Schema). Обоснование в JSDoc: `expect` страхует от адреса, устаревшего **между ходами**; внутри
одного синхронного вызова над одним черновиком индексы не сдвигаются. Любой неразрешившийся `ref`
даёт `STALE_POINTER` и роняет весь вызов — страховка выражена атомарностью.

### 5.F. `remove_node` — `refs[]`

Тот же приём, +~60 Б. Внутри — применение **по убыванию индекса**, что закрывает класс ошибок
«удалил три подряд, попал не туда» из оговорки §1.D.

### 5.G. Что переписать в тестах

| Файл | Объём | Что |
| --- | --- | --- |
| `write-tools.test.ts` | ~25 вызовов | `insert_node {component,parent}` → `{parent, nodes:[…]}`; `set_node_prop {ref,key,value}` → `{refs:[…], props:{…}}`. Утверждения (адреса, `INVALID_PARENT`, `SCHEMA_INVALID`, structural sharing, D1-поддерево) не меняются |
| `loop.test.ts` | сценарий :38-52 | + бенч из §0.2 |
| `tools.test.ts` | кейс :86-102 | `expect` переезжает на одиночную `refs`-форму |
| `registry.test.ts` | :102 | `READ_ONLY_TOOLS` → `ALL_TOOLS` + бюджет §0.3 |
| `catalog-digest.test.ts` | :42-51 | усиление §1.B |
| `ai-sdk.test.ts` | мок | захват аргументов `streamText` + кейсы §4 |
| новые | 2 файла | `core/prompt.test.ts`, `providers/context.test.ts` |

Новые кейсы: батч из 3 узлов даёт ту же схему, что три последовательных вызова; выдуманный
`nodes[1].component` → `UNKNOWN_COMPONENT` с индексом и `res.schema === undefined`; батч, ломающий
гейт на элементе 2 → `SCHEMA_INVALID` с индексом, схема не тронута; `props: { text, label }` на
`TabsTrigger` → текст в `children`, `label` в `componentProps`; три `refs`, один устарел →
`STALE_POINTER`, не применилось ничего; `remove_node.refs` из трёх соседей → удалены именно они.

---

## Точечные победы (в любой момент, независимо)

1. **C5 — мемоизация ajv.** [renderer-json/src/validate.ts:334-351](packages/reformer-renderer-json/src/validate.ts#L334-L351):
   `new Ajv()` + `compile(metaSchema)` на **каждом** вызове (~12 мс). Ленивые модульные синглтоны;
   кеш валидаторов пропсов — `WeakMap` по ссылке на `propSchemas` (иначе при смене кита протечёт
   схема прошлого). Честно: это **не** рычаг wall-clock (130 мс на ход против секунд на round-trip)
   и не рычаг токенов — гигиена. После §5.D гоняется в разы реже. Обязательно
   `npm run check:ajv-isolation`.
2. **`subtreeOf` строит `buildOutline(schema)` целиком** после каждой записи
   ([gate.ts:163](projects/reformer-builder/src/agent/core/gate.ts#L163)) и выбрасывает всё, что не
   под `ref`. Обходить только поддерево `result.newPath`.
3. **`clamp` режет по символам** (`registry.ts:112`) и способен порвать JSON Pointer пополам — модель
   получит несуществующий адрес. Минимум: суффикс `… (response truncated)` с новой строки.
4. **`HISTORY_LIMIT = 10`** ([run.ts:29](projects/reformer-builder/src/agent/run.ts#L29)) считает
   реплики, а не токены; после §1.A каждый ход тащит ещё и карту. Заменить на бюджет в символах.

---

## Отложено (осознанно)

- **Инкрементальное применение правок в канву, React-реконсиляция, `scrollIntoView`** — воспринимаемая
  латентность, вне области по решению пользователя.
- **Компактная адресация в `get_form_outline`.** Указатели — 46 % карты, но экономия ~150 токенов
  на вызов против риска второго диалекта адресации. Вместо этого — увеличенный бюджет карты (§1.A).
- **Пошаговое обновление карты формы через `prepareStep`** — обнуляет кеш префикса.
- **`insert_node` с `parent` на каждом элементе** (форма целиком за один вызов) — требует
  forward-references; вернуться, если замеры покажут, что 5 вызовов на форму всё ещё дорого.
- **`DEFAULT_MAX_STEPS`** не трогаем: потолок стоимости хода правильнее выражать `stopWhen` по
  накопленным `usage` (§4.E), а не числом шагов.

---

## Ранг по (выигрыш / риск)

| # | Правка | Этап | Шаги | Входные токены | Риск |
| --- | --- | --- | --- | --- | --- |
| 1 | Карта формы в первом сообщении | 1.A | **−1…−7** | −(шаги × контекст) | низкий |
| 2 | Батч `insert_node`/`set_node_prop`/`remove_node` | 5.D–F | **−8…−12** | −(шаги × контекст) | **высокий** |
| 3 | Reasoning не возвращается (local) | 5.A | — | **−50 % запроса** | средний |
| 4 | `list_components` не теряет поля | 1.B | −2…−3 | — | низкий |
| 5 | Стартовый набор + общие пропы в промт | 2.A | −1…−3 | +110 ток. (в кеш) | низкий |
| 6 | Cache breakpoint Anthropic | 4.B | — | −90 % префикса | низкий |
| 7 | Сжатие `EXPECT_PROP`/`REF_PROP`/описаний | 3 | — | −1250 Б × запрос | низкий |
| 8 | `validate_form` не обязателен + warnings в гейт | 2.B | −1 | — | средний |
| 9 | Схлопывание read-результатов (local) | 5.B | — | −10…20 % | средний |
| 10 | `temperature`, `maxRetries`, `timeout`, `toolChoice` | 4.E | −0…1 | — | низкий |
| 11 | `get_form_node` без pretty-print | 1.C | — | −25 % ответа | нулевой |
| 12 | usage-события + бюджетные тесты | 0 | — | измеритель | нулевой |

**Цель на каноническом сценарии «3 шага × 4 поля»:** 23 tool-call'а → **6–8**; входные токены хода
200 K → **25–35 K** (на Anthropic с кешем — ещё вдвое дешевле по оплате).

---

## Верификация

```bash
# тесты пакета (обёртка над vitest, лечит зависание vitest 4)
npm test -w @reformer/builder
npm test -w @reformer/builder -- src/agent      # только слой агента

npm run typecheck                                # включает projects/reformer-builder
npm run lint

# обязательно для точечной победы №1 (ajv трогает renderer-json)
npm run build -w @reformer/renderer-json && npm run check:ajv-isolation
```

**Приёмка по этапам:**

- Этап 0: `[agent] ход:` печатается; бенч §0.2 зелёный; бюджетный тест §0.3 **красный** (это норма).
- Этап 1: бенч §0.2 показывает падение числа шагов; `catalog-digest.test.ts` требует **все** поля.
- Этап 2: `prompt.test.ts` подтверждает мемоизацию по ссылке.
- Этап 3: бюджетный тест §0.3 **зелёный** (поверхность ≤ 7000).
- Этап 4: живой прогон на Anthropic — `cachedInputTokens > 0` начиная со второго шага.
- Этап 5: батч и три последовательных вызова дают идентичный `buildOutline`.

**Живой прогон end-to-end:** `npm run dev:builder`, канал — локальный Ollama
(`http://localhost:11434/v1`), одна и та же фраза до/после («Создай форму: 3 шага, в каждом по 4
разных поля»), метрика — строка `[agent] ход:` из §0.1.

**Стиль:** JSDoc-шапки модулей по-русски (`@module reformer-builder/…`), комментарии объясняют
«почему», тесты рядом с кодом (`vitest`, `environment: 'node'`, `include: ['src/**/*.test.ts']` —
`.tsx`-тестов в билдере нет). Новых файлов **два**: `core/prompt.test.ts` и `providers/context.ts`
с тестом; всё остальное правится в существующих.
