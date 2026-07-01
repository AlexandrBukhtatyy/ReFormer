# Чистка кодовой базы после Ф7-рефакторинга: мёртвый код, легаси, tooling

## Context

После масштабного рефакторинга (Ф7 — переход на M1-движок, удаление legacy behaviors/validation-namespace)
в пакетах остались осиротевшие символы: базовые классы старой registry-архитектуры и неиспользуемые
утилиты. Аудит всех шести пакетов (тремя параллельными агентами + ручная верификация grep'ом) показал,
что кодовая база **в целом очень чистая** — закомментированного кода, мёртвых файлов и неиспользуемых
зависимостей практически нет. Реальные находки локализованы в `@reformer/core` и `@reformer/mcp`.

Цель: удалить подтверждённый мёртвый код (включая неиспользуемый публичный API, который пользователь
согласился убрать), навести косметику по границам публичного API и добавить `knip` — чтобы регресс
не накапливался (сейчас есть только ESLint `no-unused-vars`, ловящий лишь внутрифайловый unused,
но не межмодульный мёртвый код).

Инструментов детекта мёртвого кода в репо нет (knip / ts-prune / ts-unused-exports отсутствуют);
`scripts/analyze-imports` строит только граф импортов и для этой задачи не подходит.

## Scope (подтверждено пользователем)

Полная чистка: мёртвый код + неиспользуемый публичный API (`FormObserver`, `RegistryStack`) + knip + косметика.

---

## 1. @reformer/core (`packages/reformer`)

### Удалить файлы целиком
- [packages/reformer/src/core/utils/abstract-registry.ts](packages/reformer/src/core/utils/abstract-registry.ts) — `@internal` базовый класс для BehaviorRegistry/ValidationRegistry (удалены в Ф7). Никто не `extends`.
- [packages/reformer/src/core/utils/registry-stack.ts](packages/reformer/src/core/utils/registry-stack.ts) — единственный реальный потребитель `RegistryStack` — это `AbstractRegistry`. После его удаления остаётся мёртвым.
- [packages/reformer/src/core/utils/form-observer.ts](packages/reformer/src/core/utils/form-observer.ts) — debug/monitoring-утилита (373 строки), публичный экспорт, 0 использований в монорепо.
- [packages/reformer/tests/core/utils/registry-stack.test.ts](packages/reformer/tests/core/utils/registry-stack.test.ts) — тест удаляемого `RegistryStack`.

### Править экспорт-барель
В [packages/reformer/src/core/utils/index.ts](packages/reformer/src/core/utils/index.ts) убрать строки:
- `8` — `export { RegistryStack } from './registry-stack';`
- `17` — `export { AbstractRegistry } from './abstract-registry';`
- `22-30` — `export { FormObserver }` + блок `export type { FormChangeType, FormChangeEvent, FormChangeCallback, FormObserverOptions, ObservableForm, ObservableFormNode }`

Корневой [packages/reformer/src/index.ts](packages/reformer/src/index.ts) **не трогать** — он поднимает утилиты через `export * from './core/utils'` (строка 3), поэтому правки барреля достаточно.

### После удаления
Перегенерировать сгенерированный `packages/reformer/llms.txt` (в нём документированы удаляемые символы):
`npm run generate:llms -w @reformer/core`. Упоминания в `docs/plans/*` и `docs/presentations/*` — историческая документация, **не трогаем**.

---

## 2. @reformer/mcp (`packages/reformer-mcp`)

Удалить неиспользуемые экспортируемые функции (остатки старого набора MCP-инструментов, заменённого на `find_recipe`/`get_symbol_docs`). Ни одна из них не реэкспортируется из `src/index.ts` и не тестируется.

- [packages/reformer-mcp/src/utils/symbols-parser.ts](packages/reformer-mcp/src/utils/symbols-parser.ts): `listSymbols` (строка 113), `clearSymbolsCache` (строка 126). Оставить живые `findSymbol`, `getPublicSymbols`, `PublicSymbol`.
- [packages/reformer-mcp/src/utils/docs-parser.ts](packages/reformer-mcp/src/utils/docs-parser.ts): `searchDocs` (322), `getApiMethod` (366), `getExamples` (416), `getTroubleshooting` (469). **Удаляются вместе** — `searchDocs` вызывается только внутри `getExamples`. Оставить живые `getSection`, `getSectionBySlug`, `listSections`, `listAvailablePackages`, `getFullDocs`, `KNOWN_PACKAGES`, `ReformerPackage`.
- [packages/reformer-mcp/src/utils/prompt-template-loader.ts](packages/reformer-mcp/src/utils/prompt-template-loader.ts): `clearPromptTemplateCache` (строка 93). Оставить живой `renderPromptTemplate`.

При удалении проверить, что не осиротели приватные хелперы, использовавшиеся только этими функциями (удалить их тоже). Барель `src/index.ts` не трогать — импортирует из docs-parser только живые функции (строки 14-19).

---

## 3. Косметика (по границам публичного API)

- **ui-kit**: реэкспортировать живой тип `ResourceConfig` из [packages/reformer-ui-kit/src/index.ts](packages/reformer-ui-kit/src/index.ts). Тип используется в `SelectProps` (`resource?: ResourceConfig<T>`), но не экспортирован наружу — консумент async-Select не может его импортировать. Добавить рядом со строкой 48 (после `SelectProps`): `export type { ResourceConfig } from './components/ui/select';`
- **cdk**: добавить `@internal` в JSDoc к `Step` ([Step.tsx](packages/reformer-cdk/src/components/form-wizard/Step.tsx)) и `Slot` ([Slot.tsx](packages/reformer-cdk/src/components/form-wizard/Slot.tsx)) — прояснить, что это внутренние компоненты, намеренно не выведенные в главный index. **Не удалять** — используются внутри пакета.

### Осознанно НЕ трогаем (ложные срабатывания аудита)
- Комментарии про «Ф7 / legacy удалён» в [core index.ts:21-22](packages/reformer/src/index.ts#L21) и [json-form-renderer.tsx:141-142](packages/reformer-renderer-json/src/components/json-form-renderer.tsx#L141) — это **информативные пояснения текущего поведения** (почему `validators`-namespace устроен так, почему `model` обязателен), а не мёртвый код. Оставляем.
- `@internal`-хуки `useCondition` / `useNodeLifecycle` / `RenderBehaviorEffects` в renderer-react — живые (используются в `render-node.tsx` / `form-renderer.tsx`), просто не реэкспортированы. Норма для `@internal`.
- Barrel-файлы, малые headless-компоненты cdk/ui-kit — намеренный паттерн.

---

## 4. knip — защита от регресса

- Добавить `knip` в `devDependencies` корневого [package.json](package.json).
- Добавить npm-скрипты: `"knip": "knip"` и `"knip:fix": "knip --fix"`.
- Создать `knip.json` в корне, сфокусированный на **`packages/*`** (библиотеки, где чистота публичного API важна):
  - `workspaces` для каждого `packages/reformer*` с `entry: "src/index.ts"` (+ доп. entry: `src/validators.ts` для core, bin для mcp) и `project: "src/**/*.{ts,tsx}"`.
  - `ignore`: `**/_generated/**`, `**/.tmp/**`, `**/dist/**`, `**/*.test.ts`.
  - `projects/*` (playground / e2e / docs) на первом шаге **не включать** — приложения дают много «unused» из-за динамики; подключить позже с настройкой порогов.
- Замечание: для библиотек knip помечает весь неиспользуемый-внешне публичный API как unused-export — это шумно. Основную ценность на старте берём из **unused files**, **unused dependencies** и **unused внутренних exports**; правило `unused exports` для публичных index держать в режиме ревью, не авто-fix.
- Прогнать `npm run knip` после чистки для валидации, что HIGH-находки закрыты и новых не появилось.

---

## Verification (end-to-end)

Выполнять из корня репо:

1. **Сборка** — `npm run build` (все workspaces). TS-компиляция подтверждает отсутствие битых импортов после удалений.
2. **Тесты core** — `npx vitest run` в `packages/reformer` (либо `-w @reformer/core`). Зелёные после удаления `registry-stack.test.ts`.
3. **Lint** — `npm run lint`. Без ошибок (в т.ч. нет новых unused после правок баррелей).
4. **knip** — `npm run knip`. 0 unused files/deps по `packages/*` (или только осознанно проигнорированное).
5. **MCP smoke** — `npm run build -w @reformer/mcp`, затем проверить, что активные инструменты живы: `find_recipe`, `get_symbol_docs`, `report_issue` (через MCP-tools `mcp__reformer__*`).
6. **llms.txt** — после `generate:llms` убедиться grep'ом, что `FormObserver` / `AbstractRegistry` / `RegistryStack` исчезли из `packages/reformer/llms.txt`.

## Порядок работы

1. core: удаление файлов + правка `utils/index.ts` → build + vitest.
2. mcp: удаление 7 функций + осиротевших хелперов → build + smoke.
3. Косметика: ui-kit реэкспорт + cdk `@internal`.
4. knip: конфиг + скрипты + прогон, добить остаточные находки.
5. Перегенерация llms.txt.
6. Финальный прогон verification (шаги 1-6).

> Коммиты/пуш — только по явному запросу пользователя (см. CLAUDE.md). План изменений оставляем в рабочем дереве.
