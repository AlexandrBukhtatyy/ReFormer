# План: вернуть правилу раскладки файлов авторитет в tool-канале

## Контекст

Расследование (`.tmp/layout-check/report.md`, 16 диагностических агентов + 2 независимые
репликации) установило: правило именования файлов формы из
`packages/reformer-mcp/docs/llms/06-form-directory-layout.md` доставляется агенту-консументу ровно
одним самообслуживаемым каналом — чтением ресурса `reformer://guide` (~47 КБ) целиком. Прогон,
работавший точечными запросами, получил 5/10 совпадений с каноном; прогон, прочитавший guide
первым действием, — 8/9. Исходная форма `new-mcp-test` дала 8/10 только благодаря контаминации
контекста.

Причины трёхслойные: правило по конструкции принадлежит prompt-каналу (недоступному агентам);
корпус renderer-json противоречит канону на двух спорных именах; enforcement'а нет вовсе.

## Принципы решения

1. **Enforcement важнее доставки.** Доставка требует, чтобы агент спросил; проверка срабатывает
   всегда. `generate_form` в репликации вернул канон — и не помог, потому что был вызван после
   записи файлов.
2. **Где канон слабее практики — меняем канон.** Чистый `.json` теряет compile-time проверку
   `$model`-путей, и runtime-валидация её не заменяет. Оба независимых прогона выбрали TS.
3. **Prompts — не канал доставки.** Три независимых наблюдения: у агентов нет ни `ListMcpPrompts`,
   ни `GetPrompt`, ни slash-команд сервера.

## Пункты

### П1. `validate_form kind="layout"` — enforcement

- Новый модуль `packages/reformer-mcp/src/core/validate/layout.ts`: канон per-target
  (`core` / `renderer-react` / `renderer-json`), сверка переданного списка путей модуля.
- Регистрация в `src/core/tools/validate-form.ts`: ветка `case 'layout'`, поля `files` (string[]) и
  `target` в input schema, обновление описания инструмента.
- Новый диагностический код (следующий свободный после `RF010`): имя вне канона, отсутствующий
  обязательный файл, файл сверх набора.
- Диагностика должна называть **ожидаемое имя**, а не только факт нарушения: агент чинит
  переименованием.
- Тесты в `tests/validate-form.test.ts`.

### П2. Убрать противоречие корпуса

- `packages/reformer-mcp/docs/llms/06-form-directory-layout.md`: для renderer-json сделать
  `renderer.schema.ts` (TS + `defineJsonSchema<T>`) дефолтом, `renderer.schema.json` — допустимым
  вариантом с явной оговоркой о потере типизации. Обновить §1, per-target наборы, §6 reuse map.
- `packages/reformer-renderer-json/docs/llms/07-form-wizard.md` и прочие вхождения: `render-behavior.ts`
  → `renderer.behavior.ts`, `json-schema.json` → `renderer.schema.ts`.
- `packages/reformer-mcp/src/prompts/templates/plan-form.md` (~строка 74): `schema.ts` → канон.
- Предусмотреть слот под wizard-шим для renderer-json (§1 сейчас его запрещает, а библиотека
  `RendererFormWizard` не экспортирует — нарушение воспроизвели оба прогона).
- Регенерацию `llms.txt` **не** делать в этом пункте — она централизована в П5.

### П3. Перенести указатель из prompt-канала в tool-поверхность

- Описания `plan_form`, `generate_form`, `validate_form` в их tool definitions: назвать канон и/или
  указать `find_recipe directory-layout`. Сейчас строка-указатель есть только в
  `prompts/templates/{create-form,plan-form}.md`.
- `src/index.ts`: описание ресурса `reformer://guide` + короткий entry-блок, чтобы правило доезжало
  не только при чтении всех 47 КБ.
- `generate_form`: возвращать полный per-target список имён (сейчас 5 из 10 без сигнала о неполноте;
  `renderer.behavior.ts` отсутствует) — `src/core/generate/builders.ts`.

### П4. Точечные правки каналов

- `src/core/context/builder.ts`, `packagesFor()`: включить `@reformer/mcp` при распознанном target
  (сейчас вырезается, и §1/§2 недостижимы через `get_context`).
- `src/core/tools/find-recipe.ts`: алиасы `create-form`, `file-naming`, `naming`, `form-files` →
  `form-directory-layout`. Сейчас `create-form` уводит на `createForm` API пакета core.
- `src/core/tools/search-docs.ts:212`: не применять `OWN_DOCS_PENALTY = 0.4` к секциям, у которых нет
  альтернативы в библиотечных пакетах.
- Тесты в `tests/{get-context,find-recipe,search-docs}.test.ts`.

### П5. Регрессия и сборка

- Новый eval-кейс `eval/corpus/07-layout.json` — раскладка per-target.
- `npm run generate:llms` в затронутых пакетах, `npm run build` в `reformer-mcp`, `npm test`.

### П6. Живая верификация

Поднять собранный `dist/index.js` как MCP-сервер по stdio и проверить на **свежем** сервере, что
правило теперь доезжает без чтения guide целиком: `get_context` с target, `find_recipe create-form`,
`generate_form`, `validate_form kind="layout"` на фактической раскладке `mcp-layout-check-json/`
(должен поймать расхождения) и `mcp-layout-check-react/` (должен пройти).

### П7. Оргвопросы

- Перенести `projects/react-playground/src/pages/examples/mcp-layout-check-*` в
  `.tmp/layout-check/artifacts/` — замер зафиксирован в отчёте и `file-plan.md`.
- Завести bd-issues по П1–П5 со ссылкой на отчёт.

## Раскладка работ по агентам (без конфликтов файлов)

| Агент | Пункт | Файлы |
| --- | --- | --- |
| A | П1 | `src/core/validate/layout.ts` (новый), `src/core/tools/validate-form.ts`, `tests/validate-form.test.ts` |
| B | П4 | `src/core/context/builder.ts`, `src/core/tools/find-recipe.ts`, `src/core/tools/search-docs.ts`, их тесты |
| C | П2 | только `*.md` корпуса (mcp, renderer-json, prompts/templates) |
| D | П3 | `src/index.ts`, `src/core/generate/builders.ts`, описания в `src/core/tools/{plan-form,generate-form}.ts` |
| E | П5 | `eval/corpus/07-layout.json`, регенерация llms.txt, сборка, прогон тестов |
| F | П6 | верификация на свежем dist, ничего не правит |

A–D параллельно, затем барьер, затем E, затем F.

## Ограничения

- `docs/specs/` — read-only.
- Коммитов и push нет без отдельной просьбы.
- `packages/reformer-mcp/docs/llms/` — это корпус библиотеки, а не спека; правки разрешены.
