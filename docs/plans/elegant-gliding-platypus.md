# Ассистент билдера: разные промпты → «одна и та же форма + добавки»

## Context

Пользователь заметил, что в чате ассистента reformer-builder-playground разные описания форм дают
похожую форму, к которой потом что-то дописывается, и заподозрил, что формы где-то захардкожены.

Диагностика: **жёстко прописанной формы нет**. `plan_form` по свободному описанию отдаёт пустой
intent (0 полей, проверено вызовом), `create_form` без шаблона создаёт действительно пустой `Box`,
fake-провайдер в проде не используется. Эффект складывается из двух причин.

1. **Ход идёт в открытую форму, а не туда, о чём просят** (главная причина «старая форма + добавки»).
   - `pickTarget` ([bridge.ts:889-903](../../projects/reformer-builder-playground/.ui_builder/plugins/forms/ai/src/session/bridge.ts#L889-L903))
     берёт закреплённую форму или форму активной вкладки; текст запроса не учитывается.
   - После `create_form` новая форма открывается на переднем плане ([bridge.ts:1146](../../projects/reformer-builder-playground/.ui_builder/plugins/forms/ai/src/session/bridge.ts#L1146)),
     поэтому следующий запрос «сделай форму X» уходит в режим правки предыдущей формы.
   - Промпт режима правки ([prompt.ts:86-141](../../projects/reformer-builder-playground/.ui_builder/plugins/reformer/ai/src/loop/prompt.ts#L86-L141))
     о новой форме молчит. `create_form` стоит последним в списке инструментов, и комментарий в
     [tools/index.ts:115-121](../../projects/reformer-builder-playground/.ui_builder/plugins/reformer/ai/src/tools/index.ts#L115-L121)
     исходит из того, что «при открытой форме новую просят редко».
   - `build_form` без `parent` на непустой форме отказывает фразой «pass parent — the step or
     section to add to» ([build-form/index.ts:172-177](../../projects/reformer-builder-playground/.ui_builder/plugins/reformer/ai/src/tools/build-form/index.ts#L172-L177)):
     сам подталкивает модель дописывать в старую форму.
2. **Образец из грамматики `build_form` копируется в форму.** `BUILD_FORM_EXAMPLE`
   ([grammar.ts:21-75](../../projects/reformer-builder-playground/.ui_builder/plugins/reformer/ai/src/tools/build-form/grammar.ts#L21-L75))
   вклеивается в затравку каждого хода по пустой форме
   ([seed.ts:58-63](../../projects/reformer-builder-playground/.ui_builder/plugins/reformer/ai/src/stack/seed.ts#L58-L63),
   [structured.ts:139-147](../../projects/reformer-builder-playground/.ui_builder/plugins/reformer/ai/src/stack/structured.ts#L139-L147)).
   - Поля образца: email, kind («Client type»), inn, sameEmail/billingEmail, price/qty/total,
     массив children, секция Passport, шаги Client/Order/Delivery.
   - Нигде не сказано, что это только синтаксис, и небольшие локальные модели переносят эти поля
     в любую новую форму.

То же у внешних агентов через MCP. `form_build` отдаёт грамматику на образце кредитной заявки
(`GRAMMAR_EXAMPLE` в [intent-grammar.ts](../../packages/reformer-mcp/src/core/generate/intent-grammar.ts)),
и её первая строка — `{"formName":"Заявка","interfaceName":"Application",…}`.

**Почему существующий замер этого не увидел.** Стенд на живой модели
([assistant-scenarios-eval.test.ts](../../projects/reformer-builder-playground/.ui_builder/plugins/reformer/integration/assistant-scenarios-eval.test.ts))
слеп к обеим причинам:

- стартовая форма `CLIENT` (name, email, phone, password, kind физлицо/юрлицо, inn, price, qty,
  total, pickup, deliveryAddress) и сценарий B.1 (inn, billingEmail, total) совпадают по словарю
  с образцом. Перенесённые поля образца там неотличимы от заказанных;
- сценария «новая форма, когда другая открыта» нет (21.4b — новая форма без вкладки);
- проверки вида «полей ≥ N» не видят лишних полей. Это уже записано в ограничениях
  [builder-intent.md](../mcp-eval/builder-intent.md#ограничения).

Цель: запрос новой формы при открытой форме ведёт к `create_form`, в новую форму попадают только
поля из запроса, и это измеряется — вместе с ценой в токенах.

## Изменения

Пути ниже — от `projects/reformer-builder-playground/.ui_builder/plugins/`.

### 1. Новая форма при открытой форме → `create_form`

Ограничение: системный промпт режима правки — около 4100 символов при потолке
`PROMPT_BUDGET = 4200` ([model/types.ts:219](../../projects/reformer-builder-playground/.ui_builder/plugins/reformer/ai/src/model/types.ts#L219)).
Правило проекта — прозу сжимать, а потолок не поднимать. Поэтому основная инструкция идёт в
затравку и в отказ инструмента, а в промпт — одна короткая строка.

- `forms/ai/src/loop/run-turn.ts`, `activeFormLines`: после `Active form: …` добавить строку: «A
  request for a different, new form → create_form; this form stays as it is.» Затравку модель
  читает внимательнее, чем системный промпт.
- `reformer/ai/src/loop/prompt.ts`, «Hard rules»: строка не длиннее ~90 символов — «A new form
  (another subject) → create_form; never build it into the open form.» Не влезает — сжать соседнюю
  прозу, `PROMPT_BUDGET` не трогать.
- `reformer/ai/src/tools/build-form/index.ts:172-177`: к отказу «The form already has content»
  дописать «If the user asked for a new form, call create_form instead.»
- `reformer/ai/src/tools/index.ts:115-121`: поправить комментарий про «новую просят редко».
- `reformer/ai/src/loop/file-prompt.ts`: если в наборе режима файлов есть `create_form`, добавить
  то же правило.

### 2. Образец грамматики — только синтаксис

- `reformer/ai/src/tools/build-form/grammar.ts`, `buildFormGrammar`: под заголовком добавить
  строку: «Examples show the SYNTAX on a sample form. Build only the fields from the user's
  request; never copy the sample fields.» `BUILD_FORM_EXAMPLE` не менять: его собирает тест на
  каждом ките.
- `reformer/ai/src/tools/build-form/index.ts` — детерминированная подстраховка, предупреждение, а не
  отказ:
  - условие: три и больше имён из intent (`fields[].name`, `arrays[].name`) совпадают с
    `BUILD_FORM_EXAMPLE`;
  - тогда к успешному ответу добавить строку «Fields a, b, c match the grammar example; keep them
    only if the user asked for them.»;
  - строка идёт туда, где ответ уже складывает пояснения, иначе — последней.

### 3. MCP: та же оговорка для внешних агентов (малая правка)

`packages/reformer-mcp/src/core/generate/intent-grammar.ts`, `intentGrammar`:

- в строке-скелете заменить `"formName":"Заявка","interfaceName":"Application"` на заглушки
  `"<имя формы из задания>"` и `"<ИмяИнтерфейса>"`;
- добавить строку «Примеры ниже — синтаксис на образце кредитной заявки; поля бери из задания, а
  не из образца».

`GRAMMAR_EXAMPLE` не трогать: его проверяет настоящая сборка.

### 4. Стенд: сценарии и метрики, которые видят проблему

Файл [assistant-scenarios-eval.test.ts](../../projects/reformer-builder-playground/.ui_builder/plugins/reformer/integration/assistant-scenarios-eval.test.ts).

- **Новые сценарии.** Предметные области не пересекаются с образцом, ключи полей названы в
  запросе, чтобы проверка шла по ним (как у B.1):

  | №   | Старт    | Запрос                                                                                                                    | Засчитан, если                                                                       |
  | --- | -------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
  | N.1 | `client` | «Сделай новую форму записи к ветеринару: кличка (petName), вид животного (species: кошка, собака, другое), дата визита (visitDate), причина (reason), телефон владельца (ownerPhone).» | создана ровно одна форма, `CLIENT` не изменилась, в новой ровно 5 заказанных полей |
  | N.2 | `client` | «Нужна анкета отзыва о ресторане: оценка 1–5 (rating), понравилось ли обслуживание (serviceOk), комментарий (comment), email для ответа (replyEmail).» | то же для 4 полей                                                                    |
  | N.3 | `none`   | запрос N.1                                                                                                                | создана форма, ровно 5 заказанных полей, ни одного поля образца                      |
  | N.4 | `empty`  | запрос N.2 без слов «новую»                                                                                               | форма не создаётся, в пустую форму легли 4 поля                                      |

  N.4 страхует от обратного перекоса: пустая открытая форма — законная цель, создавать новую не
  нужно.
- **Новые метрики в `EvalResult`.** Они попадают в JSON и в таблицу консоли:
  - `extraFields` — поля результата вне списка заказанных ключей (кнопка отправки не считается);
  - `leakedExample` — пересечение `extraFields` с именами `BUILD_FORM_EXAMPLE`;
  - `createdForms` — число вызовов `create_form` за ход.

  У старых сценариев с известным набором полей (1.1, 1.3, 21.4b, B.1) `extraFields` тоже
  считается. Вердикт от неё не меняется, но лишние поля становятся видны.
- **Обвязка.** `EvalState` сейчас отдаёт схему формы хода. Для N.1/N.2 нужны две схемы: итоговая
  исходного документа (сравнить с `CLIENT`) и созданной формы. Расширить `runScenarioOnce`:
  отдельно читать `DOCUMENT` и файл из `created`.

### Задача в beads

Перед реализацией:

- завести задачу `bd create` («ассистент: новая форма при открытой форме дописывается в старую;
  образец build_form копируется; стенд не видит лишних полей»);
- взять её через `bd update --claim`.

Коммит и push — только по явной просьбе.

## Как проводятся тесты и замеры

Три слоя: детерминированные тесты без модели, статический замер стоимости запроса, A/B на живой
модели. Первые два гоняются на каждую правку. Третий — один раз до правок, чтобы подтвердить
диагноз, и один раз после.

### Слой 1. Детерминированные тесты (без модели, годятся для CI)

| Что проверяем                                                                                          | Где                                                                  |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| В промпте есть правило про `create_form`, промпт ≤ `PROMPT_BUDGET`                                     | `reformer/ai/src/loop/prompt.test.ts`                                |
| Отказ `build_form` на непустой форме называет `create_form`                                            | `reformer/ai/src/tools/build-form.test.ts`                           |
| Предупреждение о совпадении с образцом есть у intent из образца и нет у intent ветеринарной формы      | там же                                                               |
| Грамматика содержит строку «only syntax», образец по-прежнему собирается на каждом ките                | там же и `reformer/integration/assistant-build-form-kits.test.ts`    |
| `activeFormLines` печатает строку про новую форму                                                      | тест рядом с `forms/ai/src/loop/run-turn.ts` или `bridge.test.ts`    |
| Поверхность инструментов не выросла (`TOOL_SURFACE_BUDGET = 13654`)                                    | `reformer/integration/assistant-surface.test.ts`                     |
| Ход с подменённой моделью: вызов `create_form` из режима правки открывает новую форму, старая не тронута | `reformer/integration/assistant-bridge.test.ts` (сценарный провайдер) |
| MCP: грамматика собирается, ответы инструментов не выросли                                             | тесты `packages/reformer-mcp`, `npm run mcp:evaluate` (гейт статики и `tokensPerTask`), `npm run mcp:scenarios -- --matrix smoke` |

Запуск:

- `npx vitest run` в `reformer/ai`, `forms/ai` и `reformer/integration` (eval-файлы без
  `EVAL_MODEL` пропускаются);
- `tsc --noEmit` этих пакетов;
- для MCP — тесты пакета и две команды выше из корня.

### Слой 2. Статический замер: постоянная часть запроса

Каждый запрос к модели заново несёт системный промпт, затравку и описания инструментов. Ход из
N запросов платит за них N раз, поэтому рост постоянной части — главный рычаг стоимости.

Измеряем символы до и после правки и переводим в токены как `символы / 4` (та же условность, что
у `mcp:evaluate`):

| Часть                                                                 | Как получить                                     |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| системный промпт режима правки                                        | `systemPrompt(catalog).length`                   |
| промпт создания                                                       | `creationPrompt().length` (≤ 800)                |
| затравка пустой формы с грамматикой                                   | `buildFormEmptySeed(buildFormGrammar(catalog)).length` |
| строки активной формы                                                 | `activeFormLines(...)`                           |
| поверхность инструментов                                              | `measureToolSurface` (уже в `assistant-surface.test.ts`) |
| грамматика MCP                                                        | длина `intentGrammar(catalogs)`                  |

Снять одним временным скриптом в `.tmp/eval/static/` до и после правки. Цифры занести в отчёт.

Порог: постоянная часть растёт не больше чем на ~400 символов (~100 токенов) на запрос, промпт —
в пределах `PROMPT_BUDGET`, поверхность — в пределах `TOOL_SURFACE_BUDGET`.

### Слой 3. A/B на живой модели: работает ли и сколько стоит

**Откуда берутся токены.**

- Мост считает их по каждому запросу из `usage` провайдера: вход, вход из кэша, выход,
  рассуждение, число запросов, время до первого куска (`forms/ai/src/session/telemetry.ts`,
  `loop/drive.ts`).
- Если OpenAI-совместимый канал (Ollama) `usage` не прислал, вход оценивается по телу запроса
  (`providers/ai-sdk.ts:274`). Такие прогоны помечаются в отчёте.
- Стенд складывает это в `EvalResult` (`inputTokens`, `outputTokens`, `reasoningTokens`,
  `requests`, `modelSeconds`) и пишет JSON в `.tmp/eval/`.
- Вручную в билдере то же видно в консоли браузера с `?rb-trace`: таблица по запросам хода.

**Плечи.**

- **A (база)** — текущий HEAD без правок, отдельным worktree.
- **B (эксперимент)** — с правками.

Модель, канал и настройка рассуждения в обоих плечах одинаковые:

- `EVAL_MODEL` — модель, на которой пользователь воспроизводит проблему;
- эталонная модель стенда — `qwen3.8:27b-32k`, вторая — `gemma4:26b`;
- облачное плечо (`EVAL_KIND=anthropic`, `EVAL_API_KEY`) — только если пользователь даст ключ.

**Порядок.**

1. **До правок подтвердить диагноз.** Сначала в стенд добавляются только сценарии и метрики
   (раздел 4), без правок 1–3. Затем на плече A:

   ```bash
   EVAL_MODEL=<модель> EVAL_ONLY=N.1,N.2,N.3,N.4 EVAL_DUMP=../../../../../../.tmp/eval/dumps/A \
     npx vitest run assistant-scenarios-eval.test.ts
   ```

   (×3 повтора, из `.ui_builder/plugins/reformer/integration`.) Ожидание: N.1/N.2 в базе правят
   `CLIENT` без `create_form`, у N.3 есть `leakedExample`. Если диагноз не подтвердится, правки
   1–2 не делать и разбирать дампы.
2. **Плечо A, полный набор ×1 и N.1–N.4 ×3.** Разброс модели велик (22.1 шёл от 246 до 1146 с),
   поэтому новые сценарии повторяются.
3. **Плечо B — то же самое.**
4. **Сравнение:**

   ```bash
   npm run mcp:import-builder -- .tmp/eval/form-scenarios-<A>.json
   npm run mcp:import-builder -- .tmp/eval/form-scenarios-<B>.json   # облако: --price-in 3 --price-out 15
   npm run mcp:compare -- <A> <B> --md .tmp/eval/compare-new-form.md
   ```

   `mcp:compare` даёт прохождение с интервалами, p-value, токены и цену по сценариям.
5. **MCP, внешний агент (только правка 3).** То же A/B на стенде сценариев:

   ```bash
   npm run mcp:scenarios -- --agent ollama --model <модель> --scenario 'L1-*' --repeats 3 [--server <dist плеча A>]
   ```

   Затем `mcp:compare`. Дополнительно — grep по `form.intent.json` прогонов на имена
   `GRAMMAR_EXAMPLE` (loanType, quantity, vat, smsCode, contacts, sameAddress…), которых нет в
   контракте сценария. Плечо `claude-code` тратит деньги — только с согласия пользователя и с
   `--max-usd-batch`.

**Критерии — фиксируются до прогона:**

| Условие                                                                                                         | Решение                                                                                         |
| --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| N.1+N.2: `create_form` вызван и `CLIENT` не изменилась — в ≥ 5 из 6 прогонов B                                   | правка маршрутизации принята                                                                    |
| То же — меньше 5 из 6                                                                                           | промптом не лечится: отдельная задача на детерминированную маршрутизацию (классификация «правка или новая» в мосте) |
| `leakedExample` в N.1–N.3 плеча B — 0 во всех прогонах                                                           | правка грамматики принята; иначе — убрать образец из затравки, отдавать по запросу              |
| N.4 и точечные правки (4.1, 4.2, 7.1, 8.1, 17.1, 20.2, 21.3): ноль лишних `create_form`, прохождение не ниже A | нет обратного перекоса                                                                          |
| Полный набор: прохождение не ниже A с поправкой на разброс                                                      | регрессий нет                                                                                   |
| Медиана входных токенов на сценарий полного набора выросла не больше чем на 5%; постоянная часть — по слою 2    | цена приемлема; иначе — сжимать добавленные строки                                              |
| Медиана времени выросла не больше чем на 10% (локальная модель)                                                 | цена приемлема                                                                                  |

**Отчёт.** Новый документ `docs/mcp-eval/builder-new-form-routing.md` в формате
[builder-intent.md](../mcp-eval/builder-intent.md):

- критерии, записанные до прогона;
- методика и модели;
- таблицы A/B: прохождение, `extraFields`/`leakedExample`, запросы, вход/выход токенов, время;
- статический замер слоя 2;
- «Чего замер не говорит»;
- «Как повторить».

Сырые JSON и дампы лежат в `.tmp/eval/` и не коммитятся.

## Ручная проверка в билдере

На модели пользователя, с `?rb-trace`:

1. Без открытой формы: «форма записи к ветеринару: кличка, вид животного, дата визита, причина,
   телефон». В форме только эти поля, без email/kind/inn/price/qty/total/children.
2. Не переключая вкладку: «анкета отзыва о ресторане: оценка 1–5, обслуживание понравилось?,
   комментарий, email». Ожидается вызов `create_form` и новый модуль, форма ветеринара не
   изменилась.
3. В консоли сверить вход/выход токенов хода с цифрами стенда.
