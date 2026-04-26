# Бриф: проверка работы reformer-mcp на реальной форме

## Цель

Убедиться, что ИИ-агент, имея **только** спеку формы и доступ к `reformer-mcp`, может реализовать рабочую форму на `@reformer/*`. Тест MCP-сервера, не агента: проверяем, что **подгружаемая через MCP документация (resources, tools, prompts) достаточна** для построения сложной формы.

## Запреты для агента (КРИТИЧНО)

Чтобы тест был валиден — нельзя «подсмотреть и скопировать» существующее.

- **Не читать `packages/`** — никаких `Read` / `Grep` / `Glob` по `packages/reformer*/src/`, `packages/reformer*/dist/`, `packages/reformer*/llms.txt`, `packages/reformer*/docs/`. Вся информация о библиотеках — только через MCP-tools и MCP-resources (`reformer://docs/<pkg>`, `reformer://api/<pkg>`, `get_symbol_docs`, `find_recipe`, prompts).
- **Не читать `projects/react-playground/`** — никаких страниц, layout-ов, компонентов, конфигов, `App.tsx`. Каталог целиком запрещён, кроме того подкаталога `src/pages/examples/mcp-credit-application*/`, в котором суб-агент сейчас пишет.
- **Не читать `projects/react-playground-e2e/`** — никаких тестов и POM. E2E вне scope этого теста.
- **Не читать `docs/specs/` кроме файла, переданного как ввод задачи** (`credit-application-form.md`).
- **Можно** читать: текущую спеку, `AGENTS.md`, корневой `README.md`, `package.json` пакетов (для версий/peer-deps), `tsconfig.json`. Это каркас репо, не реализация.

Если суб-агент случайно открыл запрещённый файл — каталог страницы **удаляется целиком** (`git clean -fd`, `git restore`), этап перезапускается с нуля новым суб-агентом. Никакого «частично загрязнённого» результата не сохраняем.

## Что реализовать

Спека: [docs/specs/credit-application-form.md](docs/specs/credit-application-form.md) — 1270 строк, 6 шагов (Кредит / Личные данные / Контакты / Работа / Дополнительно / Подтверждение), условные поля, вычисляемые поля, FormArray (имущество, существующие кредиты, созаёмщики).

**Три новые страницы** в `projects/react-playground/src/pages/examples/`. Каждая — самодостаточный модуль, экспортирующий React-компонент. Существующие `complex-multy-step-form*` **не трогаем** — они служат baseline-ом для сравнения.

| Каталог | Стек | Зачем эта вариация |
|---|---|---|
| `mcp-credit-application/` | `@reformer/core` + `@reformer/cdk` + ручной React + `@reformer/ui-kit` | Тест MCP на минимальном стеке: FormSchema, behaviors, validations, FormWizard, FormArray. |
| `mcp-credit-application-renderer/` | + `@reformer/renderer-react` (TS RenderSchema) | Тест MCP на декларативной схеме: RenderSchemaFn, hideWhen, renderEffect, lifecycle. |
| `mcp-credit-application-renderer-json/` | + `@reformer/renderer-json` (JSON-схема + Registry) | Тест MCP на JSON-схеме: defineRegistry, FIELD_WRAPPER, $template для массивов, source values. |

Регистрация маршрутов, layout-интеграция, нав-меню — **out of scope**. Это пользовательская приёмка после готовности компонента.

## Как должен работать ИИ-агент

Работа ведётся в формате **оркестратор + суб-агенты**.

1. Зарегистрировать MCP-сервер в Claude Code (см. [packages/reformer-mcp/README.md](packages/reformer-mcp/README.md)):
   ```bash
   claude mcp add --transport stdio reformer -- node /absolute/path/to/ReFormer/packages/reformer-mcp/dist/index.js
   ```
2. **Оркестратор** (родительский Claude Code) держит спеку, MCP-сервер и контроль над файловой системой. Сам код формы он не пишет — для каждого этапа спавнит **суб-агента** через Task tool с минимальным контекстом:
   - текущая спека (`credit-application-form.md`),
   - scope этапа (что именно реализовать),
   - перечень разрешённых MCP-инструментов и запрещённых файлов.
3. **Суб-агент** обязан использовать только MCP. Доступные инструменты:
   - **Prompts** для проектирования: `create-form` (структура и FormSchema по описанию), `add-validation` (валидаторы), `add-behavior` (computeFrom/enableWhen/copyFrom/...), `add-form-array` (массивы), `add-wizard` (multi-step).
   - **Tools** для справки: `get_symbol_docs`, `find_recipe`.
   - **Resources** для углубления: `reformer://docs/<pkg>`, `reformer://api/<pkg>`, `reformer://troubleshooting/<pkg>`.
4. Если в каком-то месте суб-агент не справился — это **сигнал, что MCP-документация неполная**. Оркестратор фиксирует пробел через tool `report_issue`, дополняет `docs/llms/` или JSDoc, регенерирует `llms.txt`, пересобирает MCP, удаляет результат провалившегося суб-агента и спавнит новый.

Новый суб-агент стартует со свежим контекстом и со свежей stdio-сессией MCP, поэтому подхватывает обновлённый `llms.txt` без перезапуска основной сессии Claude Code.

## Итеративный процесс (КРИТИЧНО)

Задача — **не «сделал форму»**, а «**отполировал MCP**, пока через него можно построить форму без ошибок». Поэтому работа идёт **этапами**, на каждом — цикл «спавн суб-агента → проверить → если плохо: исправить MCP-доки, пересобрать, удалить результат, спавнить нового».

### Шаблон одного этапа

```
1. Оркестратор согласует scope этапа со спекой (какие поля/фичи добавляем).
2. Оркестратор спавнит суб-агента (чистый контекст). Промт суб-агенту:
   «Реализуй <scope> в <каталог>. Используй только MCP. Запрещено: <список>».
3. Суб-агент работает, возвращает результат + лог использованных MCP
   tools/prompts/resources.
4. Оркестратор проверяет:
   - тип-чек: tsc проходит,
   - ручной запуск: `npm run dev`, страница рендерится, инкремент виден/работает.
5. Если результат приемлемый → оркестратор коммитит файлы суб-агента → следующий этап.
6. Если есть проблемы (суб-агент использовал несуществующий API, выдал тривиальный
   код, не нашёл нужный рецепт через find_recipe и т. п.):
   a. Оркестратор фиксирует проблему через MCP tool `report_issue`
      (запишется в `~/.reformer/issues.jsonl`).
   b. Правит ИСТОЧНИК MCP — `packages/<pkg>/docs/llms/*.md` и/или JSDoc
      в `packages/<pkg>/src/`. Никогда не редактировать `llms.txt` напрямую.
   c. Регенерирует: `npm run generate:llms`.
   d. Пересобирает MCP-сервер: `npm run build -w @reformer/mcp`.
   e. Удаляет файлы провалившегося суб-агента: `git clean -fd <каталог>`,
      `git restore <каталог>`.
   f. Спавнит НОВЫЙ суб-агент (чистый контекст, свежий MCP) — этап с нуля.
7. Если этап потребовал ≥2 итераций — оркестратор фиксирует в commit-сообщении
   перечень правок MCP-документации этой итерации.
```

### Этапы внутри одной страницы

| Этап | Содержание | Проверка |
|---|---|---|
| 1. FormSchema | Типы, поля, начальные значения, группы (`group`), массивы (`array`). Без валидации/behavior. | tsc, страница рендерит пустые поля. |
| 2. Валидация | Built-in + кастомные + async + cross-field по требованиям спеки. | Невалидный ввод даёт ошибки. |
| 3. Behaviors | `computeFrom` (interestRate/monthlyPayment), `enableWhen`/`hideWhen` (условные поля), `watchField` (загрузка справочников), `copyFrom`/`syncFields` если есть в спеке. | Изменение зависимого поля — реакция. |
| 4. FormArray | Имущество, существующие кредиты, созаёмщики (см. шаг 5 спеки). | Add/remove работает, items валидируются. |
| 5. Multi-step | 6 шагов через FormWizard, `STEP_VALIDATIONS`, `fullValidation`, переход с валидацией. | Все 6 шагов проходимы, валидация блокирует переход. |

После этапа 5 для текущей страницы — переходим к следующей странице (renderer-react → renderer-json) и **начинаем с этапа 1 заново** (не «портируем готовое»). Это ловит, что MCP подсказки одинаково качественны для всех трёх стеков. Промпты `to-renderer` / `to-renderer-json` в этом тесте **не используются** — это отдельный сценарий валидации.

### Между страницами

| Сквозной этап | Содержание |
|---|---|
| После каждой завершённой страницы | Просмотр `~/.reformer/issues.jsonl` — собрать все накопившиеся `report_issue` записи; превратить в правки MCP-документации; закоммитить эти правки отдельно от страничного коммита. |
| После всех 3 страниц | Финальный smoke-test MCP (`npm run generate:llms` идемпотентен, `--audit` 0/0, build чистый) и заполнение отчёта. |

## Технические рамки

- Не править `packages/*` помимо MCP-доков и JSDoc по итогам `report_issue`.
- Каждая страница самодостаточна: формы могут переиспользовать общие типы (`CreditApplicationForm` interface), но FormSchema/behavior/validation пишутся заново.
- UI-компоненты — только из `@reformer/ui-kit` (`Input`, `Select`, `Checkbox`, `Button`, `Section`, `Box`, `FormField`, …) или собственные простые обёртки внутри каталога страницы.
- Стилизация — Tailwind.
- Mock-данные (списки регионов, типов кредита и т. п.) — inline в файле страницы.

## Definition of Done

- 3 страницы в `projects/react-playground/src/pages/examples/mcp-credit-application*/` собираются (`tsc` чистый), каждая экспортирует готовый React-компонент с реализованной 6-шаговой формой.
- Регистрация маршрутов, layout-интеграция, e2e — **не входит в DoD** (пользовательская приёмка).
- Если оркестратор в процессе нашёл и записал пробелы в MCP-документации (через `report_issue` либо явно в коммите) — они закрыты дополнительными `docs/llms/` или JSDoc правками.
- Гранулярность коммитов: один коммит на «страница × этап» (conventional message); правки MCP — отдельными коммитами с префиксом `docs(<pkg>):` или `feat(mcp):`. История коммитов должна показывать чередование «страничный этап → MCP-фикс → удаление → этап заново → ...» где это случилось.
- В commit-сообщении (или PR-описании) явно перечислить **какие MCP-tools/prompts/resources были использованы** — это аудит-trail для проверки, что суб-агент действительно работал через MCP. Пример: `Used: prompt create-form (target=core), prompt add-validation, prompt add-form-array, tool get_symbol_docs(copyFrom), resource reformer://docs/cdk`.
- Финальный отчёт `docs/specs/credit-application-mcp-report.md` — заполняет **сам оркестратор** по ходу работы. Таблица «страница × этап × количество итераций × что было исправлено в MCP». Это и есть основной артефакт теста — он показывает, где MCP проседал.

## Out of scope

- Регистрация маршрутов в `App.tsx`, layout-интеграция, нав-меню — пользовательская приёмка.
- E2E-тесты (Playwright). Промпт-генератор для e2e в этом тесте не валидируем.
- Промпты `to-renderer` / `to-renderer-json` — не применяются в этом тесте.
- Реальный backend submit. Mock-handler с `setTimeout` достаточно.
- Адаптивная вёрстка / accessibility сверх того, что даёт `@reformer/ui-kit`.
- Перевод спеки/UI на английский. Всё остаётся на русском.
- Замена `complex-multy-step-form*` baseline. Эти три каталога **не трогаем**.

## Связанные документы

- Спека формы: [docs/specs/credit-application-form.md](docs/specs/credit-application-form.md)
- Конвенция документации: [docs/llms-convention.md](docs/llms-convention.md)
- README MCP-сервера: [packages/reformer-mcp/README.md](packages/reformer-mcp/README.md)
- AGENTS.md: [AGENTS.md](AGENTS.md)
