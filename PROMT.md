# Бриф (итерация 2): MCP должен подсказать UI-kit + систему стилей

## Контекст (что обнаружено в итерации 1)

Итерация 1 показала, что MCP-документация **успешно** подсказывает структуру (FormSchema, validation, behaviors, RenderSchema, JSON registry, wizard) — sub-agent'ы выходят на чистый `tsc` за 1–4 итерации после соответствующих фиксов в `docs/llms/`. Полный отчёт: [docs/specs/credit-application-mcp-report.md](docs/specs/credit-application-mcp-report.md).

**Что не получилось:** реализованные формы (`projects/react-playground/src/pages/examples/mcp-credit-application*`) **визуально не похожи** на baseline `complex-multy-step-form*`. Они работают, но используют plain HTML inputs / минимальный layout, без `@reformer/ui-kit` и без Tailwind. Sub-agent выбрал «безопасный» fallback потому что MCP не обозначил, какой стек UI/styling предполагается.

**Корневая причина:** `create-form` prompt не спрашивает про UI-kit и систему стилей. Sub-agent не имеет способа узнать, что в текущем проекте: (а) подключён `@reformer/ui-kit`; (б) используется Tailwind; (в) есть baseline-страницы, к которым стиль формы должен подтянуться.

## Цель итерации 2

Доработать MCP так, чтобы sub-agent, имея доступ только к MCP, реализовал форму **визуально похожую на baseline** `complex-multy-step-form*` — с использованием компонентов `@reformer/ui-kit` и Tailwind для layout.

## Что должно появиться в MCP

1. **Auto-detection доступных пакетов.** `create-form` (и другие) должны читать `package.json` рабочего проекта и:
   - Если `@reformer/ui-kit` в `dependencies` — рекомендовать его компоненты (`Input`, `Select`, `Checkbox`, `Textarea`, `Section`, `Box`, `FormField`, `Button`, `Collapsible`, ...) с импортами и примерами.
   - Если не подключён — выдать "MCP gap" pseudo-question: «Какие UI-компоненты использовать? (a) `@reformer/ui-kit`, (b) shadcn/ui, (c) MUI, (d) plain HTML, (e) другое — укажите». Sub-agent должен попросить уточнение у оркестратора.

2. **Auto-detection системы стилей.** Аналогично: проверять `tailwindcss` / `@tailwindcss/vite` в зависимостях, наличие `tailwind.config.{js,ts}`, `postcss.config.js`. Варианты для уточнения: Tailwind, CSS Modules, Emotion / styled-components, vanilla CSS, inline style.

3. **Layout-rec** в `create-form` prompt'е. Когда `@reformer/ui-kit` + Tailwind detected, prompt должен показать **полноценный layout-skeleton** (по аналогии с `complex-multy-step-form-renderer/render-schema.ts`):
   - `Section` как обёртка шага с `title`,
   - `Box` (`grid grid-cols-2 gap-4`) для двухколоночных полей,
   - `FormField` через `settings.fieldWrapper`,
   - явные Tailwind классы для отступов/spacing.

4. **Visual-similarity hint.** В `create-form` prompt — короткий блок «target visual baseline» если в проекте есть страницы с похожими формами (детектируется по соседним директориям с `index.tsx` + `<Form...>` импортами). Без peek-в-код baseline — только указатель «такую же визуальную плотность как `<path>`».

## Запреты для агента (КРИТИЧНО)

Сохраняются все запреты итерации 1, плюс:

- **Не читать `packages/`** — кроме `package.json` каждого пакета (для детекта зависимостей это разрешено, исходники запрещены).
- **Не читать `projects/react-playground/`** — никаких страниц, layout-ов, конфигов, `App.tsx`, **включая** `complex-multy-step-form*` (baseline для visual reference, но peek в код = инвалидный тест MCP).
- **Не читать `projects/react-playground-e2e/`** кроме каталога новой итерации `screenshots/mcp-credit-v2/page<N>/` (куда лежат новые screenshots; gitignored).
- **Не читать `projects/react-playground/src/pages/examples/mcp-credit-application*`** (старая итерация — sub-agent не должен унаследовать её решения; новая реализация — с нуля в новых каталогах).
- **Не читать `docs/specs/credit-application-mcp-report.md`** (отчёт первой итерации; sub-agent должен подходить «свежим взглядом»).
- **Можно** читать: текущую спеку (`credit-application-form.md`), `AGENTS.md`, корневой `README.md`, `package.json` любого пакета и проекта (для детекта зависимостей), `tsconfig.json`, `tailwind.config.*`, `vite.config.*` (конфиги стилей и сборки).

Если sub-agent случайно открыл запрещённый файл — каталог страницы **удаляется**, итерация перезапускается новым sub-agent'ом.

## Что реализовать

Спека: [docs/specs/credit-application-form.md](docs/specs/credit-application-form.md). **Три новые страницы** в `projects/react-playground/src/pages/examples/`, **отдельные** от итерации 1:

| Каталог | Стек | Цель |
|---|---|---|
| `mcp-credit-application-v2/` | `@reformer/core` + `@reformer/cdk` + `@reformer/ui-kit` + Tailwind | Полная форма ui-kit + Tailwind, ручной React-рендеринг. |
| `mcp-credit-application-renderer-v2/` | + `@reformer/renderer-react` | Та же визуальная плотность, через TS RenderSchema. |
| `mcp-credit-application-renderer-json-v2/` | + `@reformer/renderer-json` | Та же, через JSON-схему + Registry. |

Существующие `mcp-credit-application*` (без `-v2`) **не трогаем** — они остаются как «before» state для сравнения в отчёте. Существующие `complex-multy-step-form*` тоже не трогаем — они остаются baseline.

## Как должен работать ИИ-агент

Тот же оркестратор + sub-agent паттерн как в итерации 1.

1. Зарегистрировать MCP-сервер (см. [packages/reformer-mcp/README.md](packages/reformer-mcp/README.md)) или работать через JSON-RPC helper [scripts/mcp-call.mjs](scripts/mcp-call.mjs).
2. **Оркестратор** держит спеку и MCP, спавнит sub-agent'а на каждый этап через Task tool с минимальным контекстом + scope + запреты.
3. **Sub-agent** работает только через MCP; нарушение запретов = удаление каталога + retry.
4. Если MCP-документация неполная — оркестратор фиксирует пробел через `report_issue`, правит `packages/<pkg>/docs/llms/*.md` и/или JSDoc, регенерирует `llms.txt`, удаляет файлы провалившегося sub-agent'а, спавнит нового.

## Итеративный процесс (КРИТИЧНО)

Тот же шаблон что итерация 1: «спавн → проверка (tsc + visual) → если ОК коммит → если плохо MCP-фикс + удалить + retry». Новое: проверка **визуальной похожести** на baseline.

### Этапы внутри одной страницы (расширены)

| Этап | Содержание | Проверка |
|---|---|---|
| 0. **MCP discovery** *(новый)* | Sub-agent читает `package.json` проекта, детектит ui-kit + Tailwind. Если ui-kit detected — использует его. Если detected, но layout не очевиден — задаёт MCP-gap вопрос; оркестратор уточняет. | Sub-agent в final report показывает какие detected зависимости и какой стек выбрал. |
| 1. FormSchema | Типы + поля + initial values + groups + arrays + `@reformer/ui-kit` компоненты в `FieldConfig.component`. Tailwind layout для steps (Section + Box grid). | tsc clean, визуально страница рендерит **поля с правильным spacing** (sections, grid, gaps), не plain `<input>`-stack. |
| 2. Валидация | Built-in + custom + applyWhen + validateItems. **Errors отображаются через `FormField` wrapper** (label + red error span), не через ручной `<span>`. | Невалидный submit показывает ошибки в том же стиле что baseline `complex-multy-step-form*`. |
| 3. Behaviors | computeFrom/watchField/enableWhen/copyFrom + (для renderer-react/json) `hideWhen` через `RenderBehaviorFn`. | Изменение зависимого поля — реакция; disabled поля визуально отключены через Tailwind. |
| 4. FormArray | Имущество/кредиты/созаёмщики через `FormArray` compound component из `@reformer/cdk` (если detected). Add/remove buttons в стиле `Button` из ui-kit. | Add/remove работает, items в визуально однородной table/list. |
| 5. Multi-step | `FormWizard` compound component из `@reformer/cdk` (если detected) с per-step validation. Step indicator + Назад/Далее/Submit в стиле baseline. | Wizard визуально похож на baseline (numbered tabs + buttons + transition). |

После 5 этапа — **переход на следующую страницу с этапа 0 заново**. Sub-agent заново детектит ui-kit/Tailwind, заново выбирает компоненты — это проверка что MCP discovery работает воспроизводимо.

## Тестирование (Playwright)

**Скриншоты лежат в `projects/react-playground-e2e/screenshots/mcp-credit-v2/page<N>/`** (рядом с iteration-1 в `screenshots/mcp-credit/`, под общий gitignore `projects/react-playground-e2e/screenshots/`). Имя файла: `<stage>-<scenario>.png`. `page1` = `mcp-credit-application-v2`, `page2` = `-renderer-v2`, `page3` = `-renderer-json-v2`.

**Не удалять скриншоты предыдущей итерации** — они в `projects/react-playground-e2e/screenshots/mcp-credit/` (старый путь) и в git history. Новая итерация создаёт **свои** screenshots в соседней `mcp-credit-v2/`, чтобы можно было сравнить «before / after» по каждому этапу.

Visual smoke-test через playwright MCP на каждом stage:
1. Navigate на временный route в `App.tsx` (orchestrator-only).
2. Snapshot DOM + 0 console errors.
3. Screenshot fullpage + per-step.
4. Сравнение с baseline screenshot (`complex-multy-step-form*`) — оркестратор делает screenshot baseline один раз и кладёт рядом для side-by-side в отчёте.

## Definition of Done

- 3 страницы `mcp-credit-application-v2*/` собираются (`tsc` clean), используют `@reformer/ui-kit` + Tailwind, визуально близки к `complex-multy-step-form*`.
- MCP-prompts (`create-form` и другие) **детектируют** наличие `@reformer/ui-kit` и Tailwind в `package.json` проекта; при detected — рекомендуют их с примерами; при не-detected — выдают "MCP gap" вопрос.
- Скриншоты в `projects/react-playground-e2e/screenshots/mcp-credit-v2/page<N>/` — fullpage + per-step + ключевые сценарии (валидация, computed cascade, FormArray add/remove, wizard navigation). Gitignored по общему правилу `projects/react-playground-e2e/screenshots/`.
- Финальный отчёт `docs/specs/credit-application-mcp-report-v2.md` — таблица «страница × этап × итераций × MCP-фикс × visual-similarity score (subjective: 1-5)» + side-by-side screenshots ключевых страниц.
- Все правки MCP — отдельными коммитами `docs(<pkg>):` / `feat(mcp):`.
- В commit-сообщении явно перечислять использованные MCP tools/prompts/resources.

## Out of scope

- Замена `mcp-credit-application*` (без `-v2`) — оставляем как baseline first iteration.
- Замена `complex-multy-step-form*` — это baseline ground truth.
- E2E-тесты (Playwright spec-файлы) — только смотрят-без-snapshot smoke через playwright MCP.
- Реальный backend submit, адаптивная вёрстка / a11y сверх ui-kit defaults, перевод на английский.
- Промпты `to-renderer` / `to-renderer-json` — каждая страница пишется с нуля, не через миграцию.

## Связанные документы

- Спека формы: [docs/specs/credit-application-form.md](docs/specs/credit-application-form.md)
- Отчёт итерации 1: [docs/specs/credit-application-mcp-report.md](docs/specs/credit-application-mcp-report.md) — sub-agent **не читает**, оркестратор использует для калибровки.
- Конвенция документации: [docs/llms-convention.md](docs/llms-convention.md)
- README MCP-сервера: [packages/reformer-mcp/README.md](packages/reformer-mcp/README.md)
- AGENTS.md: [AGENTS.md](AGENTS.md)
