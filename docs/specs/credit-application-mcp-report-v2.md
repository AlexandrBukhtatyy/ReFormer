# Отчёт: MCP-валидация iteration 2 — credit-application с ui-kit + Tailwind

## Цель и результат

Iteration 1 показала, что MCP-документация подсказывает структуру (FormSchema, validation, behaviors, RenderSchema, JSON registry, wizard), но реализованные формы получились визуально-плоскими: plain HTML-инпуты, без ui-kit, без Tailwind layout. Iteration 2 закрывает этот пробел: MCP должен **сам подсказать** sub-агенту, какой UI-стек и стиль использовать, на базе детектирования зависимостей в `package.json` рабочего проекта.

**Итог:** Все три страницы реализованы за один проход sub-агента на каждый stage (без retry), визуальная плотность совпадает с baseline `complex-multy-step-form*`. MCP `create-form` prompt теперь авто-детектит `@reformer/ui-kit` + Tailwind v4 (`@tailwindcss/vite`) и инжектирует layout-skeleton с правильными импортами.

## Изменения в MCP

| Файл | Изменение |
|---|---|
| `packages/reformer-mcp/src/utils/project-detector.ts` | NEW. Walks up from cwd (или `projectPath` arg) ища `package.json` с deps. Возвращает флаги `hasUiKit`, `hasTailwind`, `hasRendererReact/Json` и т.д. Поддерживает Tailwind v4 inline-config (через `@tailwindcss/vite` plugin без `tailwind.config.*`). |
| `packages/reformer-mcp/src/prompts/create-form.ts` | Добавлен опциональный аргумент `projectPath` (обязателен в монорепо). Stage 0 "MCP discovery" блок: detected stack + конкретные импорты ui-kit + Tailwind layout-skeleton. MCP-gap pseudo-question если ui-kit/Tailwind не найдены. Добавлены 5 новых правил после iter-2 lessons: FormField disambiguation (cdk vs ui-kit), FormFields constraint, tuple `[itemSchema]` array format, FormArray.AddButton initialValue plain leaves, deep-nested `(path: any)` cast pattern. |

После доработки smoke-test:
```
node scripts/mcp-call.mjs prompts/get '{"name":"create-form","arguments":{"description":"...","target":"core","projectPath":"projects/react-playground"}}'
```
возвращает: `**Detected:** @reformer/ui-kit, @reformer/cdk, @reformer/renderer-react, @reformer/renderer-json, Tailwind CSS (v4 via @tailwindcss/vite, inline @theme).` + полный layout skeleton.

## Реализованные страницы

| Страница | Стек | Маршрут | Sub-агент iterations |
|---|---|---|---|
| `mcp-credit-application-v2/` | core + cdk + ui-kit + Tailwind, ручной React | `/examples/mcp-credit-v2` | 5 stages × 1 = 5 |
| `mcp-credit-application-renderer-v2/` | + renderer-react | `/examples/mcp-credit-renderer-v2` | 2 sub-агентов (1+2+3, 4+5) |
| `mcp-credit-application-renderer-json-v2/` | + renderer-json + Registry | `/examples/mcp-credit-renderer-json-v2` | 2 sub-агентов (1+2+3, 4+5) |

**Все sub-агенты прошли с первого раза** — никаких удалений/retry. Это знаковое улучшение vs iteration 1, где page 1 потребовала 15+ итераций.

## Visual similarity (subjective 1-5)

Сравнение с baseline `complex-multy-step-form*`:

| Page | Section spacing | Grid layout | FormField wrapper | StepIndicator | FormArray cards | Submit Button | Overall |
|---|---|---|---|---|---|---|---|
| Page 1 (core) | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | 5/5 | **5/5** |
| Page 2 (renderer-react) | 5/5 | 5/5 | 5/5 | 4/5 | 5/5 | 5/5 | **5/5** |
| Page 3 (renderer-json) | 4/5 | 4/5 | 5/5 | 4/5 | 4/5 | 5/5 | **4/5** |

Page 3 чуть проще визуально (sub-агент не добавил `bg-white border rounded-lg p-6 shadow-sm` обёртки секций), но всё ui-kit + Tailwind, без plain HTML.

## Stage × page × MCP gaps

| Stage | Page 1 | Page 2 | Page 3 |
|---|---|---|---|
| **1. FormSchema** | 1) FormField symbol collision (cdk compound vs ui-kit wrapper); 2) `createForm<T>` vs `<FormSchema<T>>` ambiguity; 3) FormFields constraint в footnote; 4) array tuple format не в create-form prompt | applyWhen import collision (validators vs behaviors); array tuple `[itemSchema]` не surfaced via get_symbol_docs ArrayNode | prompts/get через CLI args не работает; JsonFormRenderer JSDoc показывает deprecated getReformerForm |
| **2. Validation** | validate(callback) sig mismatch (value, ctx) vs (ctx); `form.submit()` doesn't exist; applyWhen два стиля (single field vs group); `validateItems(itemPath: any)` под outer cast не упомянут | (combined со stage 1) | (combined со stage 1) |
| **3. Behaviors** | add-behavior prompt substitutes literal `undefined`; нет recipe для `sum across array via watchField` | (combined) | (combined) |
| **4. FormArray** | `get_symbol_docs push/removeAt` returns Symbol not found; нет recipe для imperative useArrayLength + at + push + removeAt | FormArray.AddButton initialValue expects PLAIN leaves (не FieldConfig); useFormControl return type erased (нужен cast); validateForm signature requires cast | setHidden не exported as symbol; FormArray.AddButton initialValue требует [key:string]:FormValue index sig; нет documented React Context для FormProxy в кастомных JSON-блоках |
| **5. Wizard** | get_symbol_docs не indexes instance methods (`markAsTouched` returns "Symbol not found"); validateForm + useState pattern документирован в 13-multi-step.md но не surfaced via find_recipe topic=wizard | (combined со stage 4) | (combined со stage 4) |

## Список MCP-фиксов сделанных по ходу iter 2

1. **`packages/reformer-mcp/src/utils/project-detector.ts`** (NEW) — auto-detection ui-kit + Tailwind через `package.json` walk + Tailwind v4 vite plugin recognition.
2. **`packages/reformer-mcp/src/prompts/create-form.ts`** — Stage 0 "MCP discovery" block, layout skeleton injection, 5 новых правил после iter-2 lessons.

Остальные gaps зафиксированы в этом отчёте и могут быть закрыты в следующих итерациях:
- Disambiguation в `get_symbol_docs` когда символ существует в нескольких пакетах (FormField, applyWhen).
- `setHidden` / `markAsTouched` / `push` / `removeAt` indexing — instance methods на классах.
- Recipe для imperative FormArray (useArrayLength + at + push + removeAt + custom Buttons).
- Recipe для shared React Context для FormProxy в JSON registry custom blocks.
- `validateForm<T>` constraint relaxation (принимать `FormProxy<T>` без cast).

## Скриншоты (gitignored)

`projects/react-playground-e2e/screenshots/mcp-credit-v2/page<N>/<stage>-<scenario>.png`:

- `page1/`: stage-1-fullpage, stage-2-empty-submit-errors, stage-3-computed-cascade, stage-4-formarray-toggled, stage-5-wizard-step1-initial, stage-5-wizard-step2-after-advance.
- `page2/`: stage-1-3-fullpage, page2-stage4-step5-arrays-hidden / property-active / property-toggled / property-2cards-fixed, page2-stage5-step1-initial / step1-validation-fail / step2-advanced / step6-submit, stage-5-wizard-step1-initial.
- `page3/`: stage-1-3-fullpage, stage-5-step1-initial / step1-errors / step2-after-advance / step6-submit, stage-4-step4-property-array / property-array-2items, stage-4-step5-coborrower-array, stage-5-wizard-step1-initial.

Iteration 1 скриншоты сохранены в `screenshots/mcp-credit/` для side-by-side сравнения.

## Definition of Done — checklist

- [x] 3 страницы `mcp-credit-application-v2*/` собираются (`tsc` clean).
- [x] Все 3 используют `@reformer/ui-kit` + Tailwind, не plain HTML.
- [x] Визуально близки к baseline `complex-multy-step-form*` (subjective 4-5/5).
- [x] MCP `create-form` prompt детектирует ui-kit + Tailwind в `package.json` рабочего проекта.
- [x] При detected — рекомендует импорты с примерами + layout skeleton.
- [x] При не-detected — выдаёт "MCP gap" pseudo-question.
- [x] Скриншоты в `projects/react-playground-e2e/screenshots/mcp-credit-v2/page<N>/`.
- [x] Финальный отчёт `docs/specs/credit-application-mcp-report-v2.md`.
- [x] Все правки MCP — отдельным коммитом `feat(reformer-mcp):` + `chore(reformer-mcp):`.
- [x] Commit-сообщения каждого stage явно перечисляют использованные MCP tools/prompts/resources + MCP gaps.

## Сравнение iter 1 vs iter 2

| Metric | Iteration 1 | Iteration 2 |
|---|---|---|
| Page 1 sub-агент iterations | 15 | 5 (1 per stage, no retry) |
| Page 2 sub-агент iterations | 7 | 2 (1+2+3 combined, 4+5 combined) |
| Page 3 sub-агент iterations | 6 | 2 (1+2+3 combined, 4+5 combined) |
| Использование @reformer/ui-kit | 0% (plain HTML) | 100% |
| Использование Tailwind layout | минимально | full (Section + Box grid) |
| Visual similarity to baseline | 1-2/5 | 4-5/5 |
| MCP правок по ходу | 9 (на page 1) + меньше на 2/3 | 2 (project-detector + create-form preamble extension) |

Iteration 2 показывает что после auto-detection MCP "знает" что предложить с первого раза, и количество правок MCP по ходу иттерации резко падает.
