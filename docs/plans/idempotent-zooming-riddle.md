# Исправление пробелов MCP, найденных прогоном renderer-json

## Context

22 августа 2026 прогнали контрольный эксперимент: собрать форму «Заявка на кредит»
([docs/specs/credit-application-form.md](../specs/credit-application-form.md) — 6 шагов, ~90 полей,
8 вычисляемых, 3 массива) на `@reformer/renderer-json`, пользуясь **только** MCP-сервером как
источником знаний об API. Форма собралась и работает (tsc/eslint/`validate_form` чисто, сценарий
пройден в браузере; отчёт — `.tmp/new-mcp-test/dev-report.md`), но вскрылись шесть мест, где MCP
уводит консумента в сторону.

Цена измерена на живом прогоне: один silent-отказ стоил ~40 минут диагностики, один пример из
рецепта не компилируется при копировании, `choose_api` противоречит документации своего же пакета,
а eval-харнесс **сертифицирует неверный ответ** как правильный.

Цель — устранить причины, а не симптомы, и там, где это дёшево, поставить гейт, чтобы класс бага
не вернулся. Код формы из эксперимента трогать не нужно.

> **Важная поправка по ходу планирования.** Первичный диагноз пробела #2 («props-схема `Input`
> неполна, надо добавить `disabled`») оказался **неверным**. Ни одна field-схема ui-kit не
> объявляет `disabled`, и это намеренно: [seam.props.ts:11-41](../../packages/reformer-ui-kit/src/fields/seam.props.ts#L11-L41)
> описывает его как seam-проп, а [FormFieldControl.tsx:111](../../packages/reformer-cdk/src/components/form-field/FormFieldControl.tsx#L111)
> ставит `disabled` **после** спреда `componentProps` — то есть `componentProps.disabled` мёртв в
> рантайме, и схема отвергает его именно поэтому. Чинить надо доки, которые его обещают.

## Пробелы

| # | severity | Суть | Корень |
| - | -------- | ---- | ------ |
| 1 | critical | `$component(FormArray)` + `FormArraySection` в реестре → узел молча не рендерится | `ui-kit/docs/llms/08-form-array-section.md` описывает JSON-DSL, которого в renderer-json нет |
| 2 | major | `componentProps.disabled`/`readOnly` отвергаются схемой, но доки их обещают | доки врут: проп мёртв by design |
| 3 | major | рецепт wizard: `onSubmit(values)` против типа `() => void` → TS2322 | пример в `07-form-wizard.md` |
| 4 | major | `choose_api` отвечает `resetWhen` на «сброс при изменении» и на очистку массива | нет правил под `onChange`; `reset-value` ловит слово «очист» |
| 5 | minor | `@example` у 28 из 30 валидаторов учат снятому `validators: [...]` | гейт `check-mcp-prompts` смотрит только в шаблоны промптов |
| 6 | minor | quick-start регистрирует сырой `Input`, рецепт html-nodes — `InputField` | несогласованность примеров |

Все шесть заведены через `report_issue` (`~/.reformer/issues.jsonl`).

## Подход

### 1. FormArray vs FormArraySection

Источник путаницы найден: [`ui-kit/docs/llms/08-form-array-section.md:79-140`](../../packages/reformer-ui-kit/docs/llms/08-form-array-section.md#L79-L140),
секция «JSON (renderer-json)», показывает контракт, которого рендерер не реализует —
`"component": "FormArraySection"` голой строкой, `"control": "properties"` (снято под M1),
`itemComponent` + `$template` внутри `componentProps`, листья `"model":` вместо `"value": "$model(...)"`.
Реальный контракт — только `{ array, item: { $template }, component, initialValue }`
([json-schema.ts:52-69](../../packages/reformer-renderer-json/src/types/json-schema.ts#L52-L69)).

- Переписать эту секцию под реальный контракт, включая строку реестра
  `reg.component('FormArray', FormArray)` с импортом из `@reformer/ui-kit/form-array`.
- В JSDoc [`form-array-section.tsx:133-171`](../../packages/reformer-ui-kit/src/components/form-array/variants/base/form-array-section.tsx#L133-L171)
  добавить разводку: для renderer-json/renderer-react — `FormArray`; `FormArraySection` — TS-flow,
  требует `control` + `itemComponent`.
- **Сделать отказ громким**: `resolveArrayNode` возвращает `null` без предупреждения, когда
  `control === undefined` ([form-array-section.tsx:115-131](../../packages/reformer-ui-kit/src/components/form-array/variants/base/form-array-section.tsx#L115-L131)) —
  ровно эта ветка и даёт пустой экран. Добавить dev-only `console.warn`, называющий вероятную
  причину («похоже, компонент зарегистрирован в JSON-реестре — там нужен `FormArray`»).
- В [`renderer-json/docs/llms/02-json-schema.md:149`](../../packages/reformer-renderer-json/docs/llms/02-json-schema.md#L149)
  дописать к пункту про `$component(FormArray)` импорт, чтобы связка имя→экспорт была однозначной.

### 2. `componentProps.disabled` — убрать ложное обещание

- [`ui-kit/docs/llms/02-text-fields.md`](../../packages/reformer-ui-kit/docs/llms/02-text-fields.md) —
  четыре места (строки ~30-55, 128, 179, 234) объявляют `disabled?: boolean` в таблицах пропов
  Input / InputMask / InputPassword / Textarea. Пометить как seam-проп, задаваемый `control.disable()`,
  а не через `componentProps`.
- [`renderer-json/docs/llms/05-cookbook.md:380`](../../packages/reformer-renderer-json/docs/llms/05-cookbook.md#L380) —
  «Caveat: явный `componentProps.disabled` перебивает каскад» фактически неверен. Заменить на правду
  и дописать рецепт **точечного** read-only (спека требовала его для 8 вычисляемых полей):
  `onInit(node, () => form.<field>.disable())`, с оговоркой, что на `model.get()` это не влияет,
  поэтому вычисленные значения всё равно уезжают в submit. Проверить, повторяется ли утверждение
  в кукбуке renderer-react (§32) — если да, править зеркально.

### 3. Сигнатура `onSubmit` у wizard

[`07-form-wizard.md:100-103`](../../packages/reformer-renderer-json/docs/llms/07-form-wizard.md#L100-L103) —
заменить на безаргументный хендлер со снимком из модели; поправить и комментарий на строке 100
(«получает те же аргументы, что и оригинальный проп» — оригинальный проп аргументов не имеет).

### 4. Правила `choose_api`

Правила — данные в `DECISION_RULES`
([api-decision.ts:45+](../../packages/reformer-mcp/src/decide/api-decision.ts#L45)); регистрировать
ничего не нужно, их подхватывают и `choose_api`, и `get_context`.

- Добавить правило **`reset-on-change`** → `onChange`: сброс зависимого поля по факту изменения
  управляющего (`resetWhen` тут не годится принципиально — он срабатывает по условию).
- Добавить правило **`array-clear-on-flag`** → `onChange` + `.clear()`, со ссылкой на
  документированный «ARRAY CLEANUP PATTERN» в core.
- Добавить `unless` к существующему `reset-value` ([:152-166](../../packages/reformer-mcp/src/decide/api-decision.ts#L152-L166)),
  чтобы «при изменении» и «массив» больше не утекали в него; в его `alternatives` дописать `onChange`.
- Попутно: `watchField` не упомянут в правилах ни разу — добавить альтернативой к `onChange`.

Механика, которую нельзя нарушить: счёт = число совпавших `cues`, любой сработавший `unless`
убивает правило целиком, ничьи разводятся по `id` **алфавитно** — новый id может молча перевернуть
существующую ничью.

Тесты: расширить таблицу `CASES` в
[`tests/api-decision.test.ts`](../../packages/reformer-mcp/tests/api-decision.test.ts) кейсами на RU и EN
(там же инвариант: каждый `recommend` и каждый `alternatives[].symbol` обязан резолвиться);
проверить, что `tests/get-context.test.ts` остался зелёным и что фикстура-бессмыслица
`'zzqq wubble frotz'` по-прежнему не матчится. Обновить список «пар путаницы» в двух рукописных
местах: описание инструмента [`choose-api.ts:24`](../../packages/reformer-mcp/src/tools/choose-api.ts#L24)
и [`mcp/docs/llms/02-tools.md:26-42`](../../packages/reformer-mcp/docs/llms/02-tools.md#L26-L42).

### 5. `@example` валидаторов — все 28 + гейт

- Переписать `@example` во всех 28 файлах `packages/reformer/src/form/validators/` на
  `defineValidationSchema` + `validate(model.$.x, [...])`. Эталон — уже существующий
  [`create-form.ts:296-324`](../../packages/reformer/src/form/create-form.ts#L296-L324); минимальная
  форма — [`operators.ts:19-22`](../../packages/reformer/src/form/validation/operators.ts#L19-L22).
  Заодно: `create-form.ts:210` и `:337`, шапка `validators/index.ts:4-5`.
  Примеры в `field-node.ts` / `node-factory.ts` — легитимная FieldNode-конфигурация, не трогаем
  (перепроверить перед правкой).
- Расширить [`scripts/check-mcp-prompts.mjs`](../../scripts/check-mcp-prompts.mjs): сегодня он
  сканирует только `packages/reformer-mcp/src/prompts/templates/`. Добавить в корпус JSDoc пакетов
  (`packages/*/src/**/*.ts`) и `packages/*/docs/llms/*.md`. Блочную логику «допустимо в отрицательном
  контексте» переиспользуем как есть — именно она не даст залоснить `05-common-mistakes.md`,
  `14-extended-mistakes.md` и `17-nonexistent-api.md`, где снятый API упомянут намеренно.
- **MCP отдаёт JSDoc из `dist/`** (gitignored): без `npm run build -w @reformer/core` правка в `src`
  не проявится в `get_symbol_docs`.

### 6. `Input` → `InputField` в quick-start

[`01-overview.md:68`](../../packages/reformer-renderer-json/docs/llms/01-overview.md#L68) и примеры в
[`03-registry.md:32,64`](../../packages/reformer-renderer-json/docs/llms/03-registry.md#L32) — на
`*Field`-версии: они уже value-based, сырым контролам нужен `resolveFieldAdapter` (кукбук §38).

### 7. eval-корпус и baseline

- [`eval/corpus/04-arrays.json`](../../packages/reformer-mcp/eval/corpus/04-arrays.json) — у задачи
  `arrays/cleanup` заменить `expectAny: ["resetWhen","setValue([])","очист"]` на `onChange` / `clear()`.
  Сейчас харнесс засчитывает как успех ровно тот ответ, который пробел #4 признаёт неверным.
- Все 46 задач имеют `target: core` — renderer-json не проверяется вообще. Добавить задачи с
  `target: renderer-json`: регистрация `FormArray`, сигнатура submit визарда, точечный read-only.
- `eval/lib/corpus-audit.mjs` проверяет, что имена из `expectAny` реально существуют.
- Прогнать `npm run mcp:evaluate`; если метрики сдвинулись законно —
  `npm run mcp:evaluate -- --save docs/mcp-eval/baseline.json`.

## Порядок работ

1. Правила `choose_api` + тесты — самодостаточно, регенерации не требует.
2. Правки доков (6 файлов в трёх пакетах).
3. Свип `@example` по 28 валидаторам.
4. Расширение гейта `check-mcp-prompts` (после свипа — иначе он сразу красный).
5. eval-корпус, затем baseline.
6. Регенерация `llms.txt`, сборка core, прогон гейтов.

## Ограничения и риски

- **В рабочем дереве большая незакоммиченная доработка самого MCP** (`choose-api.ts`, `get-context.ts`,
  `generate-form.ts`, `validate-form.ts`, `src/decide/`, `src/index/` — untracked). Правки строго
  аддитивные, чужую работу не перестраиваем.
- `llms.txt` — генерируемый и **гейтится в CI** (`git diff --exit-code -- 'packages/*/llms.txt'`,
  [test.yml:204-210](../../.github/workflows/test.yml#L204-L210)) плюс pre-push-хук. После любой правки
  `docs/llms/*.md` обязателен `npm run generate:llms`, и повторный прогон не должен давать диффа.
- **Не добавлять и не переименовывать `## `-заголовки** без нужды: нумерация `## NN.` в `llms.txt`
  сквозная, сдвиг меняет слаги и публичные URI `reformer://docs/<pkg>/<slug>` → падает
  `index-artifacts.test.ts:80` и плывёт ранжирование eval. Править **внутри** секций.
- Сохранять маркеры `// ❌` / `// ✅` в фенсах `Anti-patterns` — на них завязан
  `index-artifacts.test.ts:148-165`.
- Не раздувать рецепт за 10 000 символов — `context-budget.test.ts:100-112` ожидает обрезку.
- `llms-index.json` во всех пакетах сейчас untracked (незавершённая работа) — решение о его
  коммите не наше, статус не меняем.
- Коммитов и пушей не делаем без явной просьбы (CLAUDE.md).

## Что НЕ делаем

- Не добавляем `readOnly` в props-схемы (решено: это расширение библиотеки, а не починка MCP).
- Не заводим `*.props.ts` для `FormArray`/`List`. Их отсутствие означает, что `validateFormSchema`
  молча пропускает `componentProps` этих узлов — именно поэтому мой ошибочный `hasItems: true`
  прошёл валидацию. Стоит отдельной задачи в трекере, в этот объём не берём.
- Не трогаем код формы `projects/react-playground/src/pages/examples/new-mcp-test/`.

## Проверка

```bash
npm run generate:llms          # и повторно — диффа быть не должно (идемпотентность)
npm run build -w @reformer/core   # MCP читает JSDoc из dist
npm test -w @reformer/mcp      # api-decision, get-context, index-artifacts, context-budget
npm run check:mcp-prompts      # расширенный гейт
npm run mcp:evaluate           # гейт против docs/mcp-eval/baseline.json
npm run lint && npm run format:check
git diff --exit-code -- 'packages/*/llms.txt'   # то же, что проверяет CI
```

Сквозная проверка **через сам MCP** — теми же вызовами, которыми пробелы и были найдены:

| Вызов | Ожидание |
| ----- | -------- |
| `choose_api("поле carModel очищается при изменении carBrand")` | `onChange`, не `resetWhen` |
| `choose_api("очистить массив properties когда чекбокс снят")` | `onChange` + `.clear()` |
| `find_recipe(topic="form-array", package="ui-kit")` | JSON-секция показывает `array` / `item.$template`, а не `control` / `itemComponent` |
| `find_recipe(topic="wizard", package="renderer-json")` | `onSubmit` без аргументов |
| `get_symbol_docs("required")` | пример на `defineValidationSchema` + `validate` |
| `find_recipe(topic="readonly", package="renderer-json")` | точечный `form.<field>.disable()`, без обещания `componentProps.disabled` |

Финальная проверка «в поле»: перерегистрировать `FormArraySection` вместо `FormArray` в
`new-mcp-test/registry.ts` и убедиться, что теперь в консоли есть внятный warning, а не пустой экран
(после проверки — вернуть `FormArray`).
