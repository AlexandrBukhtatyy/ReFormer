# Prompts

Workflow prompts (use ListPrompts to enumerate). Each returns an instruction message that
orchestrates one step and points you at the resources/tools to read. Invoke them in roughly
this order.

## start-here

No arguments. The entry point: returns the M1 workflow, the map of prompts/tools/resources,
and the reading order. Call it first when asked to build or modify a form.

## discover-context

- `description` (required), `projectPath` (optional).

Detects the target stack (ui-kit / Tailwind / which renderer) from the consumer project and
recommends a render target. Optional first step when the target isn't given.

## plan-form

- `specPath` (required), `target` (optional: core | renderer-react | renderer-json), `projectPath` (optional).

Reads and parses a markdown spec file, then returns a roadmap: steps, fields, conditionals,
behaviors, API endpoints, a risk matrix, and verification scenarios. Use when the form comes
from a written spec.

## create-form

- `description` (required), `target` (optional, default core), `projectPath` (optional).

Turns a free-text form description into build instructions for the chosen target (quick-start,
FormSchema reference, imports, stack-aware skeleton). Use for the initial form when there is no spec file.

## add-feature

Добавить одну возможность в существующую форму. Стадия выбирается аргументом:
- `feature: "validation"` — правила валидации;
- `feature: "behavior"` — реактивные связи;
- `feature: "array"` — массив формы;
- `feature: "wizard"` — шаги мастера.

Аргументы: `code` (текущий код формы) и `requirements` (что добавить; для `wizard` —
перечень шагов и полей).

Схлопывает прежние `add-validation`, `add-behavior`, `add-form-array` и `add-wizard`:
у всех четырёх одна форма аргументов, поэтому слияние не создаёт путаницы, а перечисление
из четырёх записей стоило каждому клиенту токенов при подключении. Содержимое шаблонов
не тронуто.

## to-renderer

Перенести форму `@reformer/core` на рендерер. Целевой стек — аргумент:
- `target: "renderer-react"` (по умолчанию) — RenderSchema;
- `target: "renderer-json"` — JSON-DSL и реестр компонентов.

Аргументы: `code`, опционально `target`. Схлопывает прежние `to-renderer` и
`to-renderer-json`.

## review

- `code` (required).

Cross-package review checklist (state setup, integration, anti-patterns) for existing form code.

---

_A `debug` prompt exists only with `REFORMER_DEBUG=true`._
