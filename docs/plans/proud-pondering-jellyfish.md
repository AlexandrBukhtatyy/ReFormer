# Major bump v4.0.0 для всех @reformer/\* пакетов

## Context

В монорепе 6 публикуемых пакетов. На npm + git они на разных major-номерах:

- `@reformer/core` — **уже на 4.0.0** (тег `v4.0.0`, npm @latest)
- `@reformer/cdk` / `@reformer/ui-kit` / `@reformer/renderer-react` / `@reformer/renderer-json` — все на **1.0.0**
- `@reformer/mcp` — на **2.0.0**

User хочет синхронизировать все 6 пакетов на **4.0.0** через semantic-release CI (без manual `npm publish`). Это требует bump 5 пакетов на несколько major'ов одновременно. Стандартный semantic-release делает только +1 major за итерацию (1.0.0 → 2.0.0), не +3. Чтобы прыгнуть сразу на 4.0.0 за один CI-run, используем **synth-tag baseline** на v3.0.0 — commit-analyzer берёт `last git tag` для расчёта next version, и `BREAKING CHANGE: ...` тогда выдаёт 4.0.0.

Особенности проекта (учтены в плане):

- `package.json` versions у всех пакетов **не синхронны** с реальными publish — semantic-release не использует `@semantic-release/git` plugin, обновлённые `version` поля никогда не пушатся обратно. Source-of-truth: git tags + npm registry. **`version` в package.json НЕ трогаем** — SR подставит сам.
- Per-package tag prefix'ы: `v` (core), `cdk-v`, `ui-kit-v`, `renderer-react-v`, `renderer-json-v`, `mcp-v`.
- CI workflow `.github/workflows/release.yml` запускается на `push` в `main`/`develop` с `paths: packages/**`. Sequential matrix-run для всех 6 пакетов; SR self-check на свой workspace path → если новых commits на свой scope нет, run завершается с «no release needed».

## План

### 1. Создать synth git tags baseline = v3.0.0 (5 пакетов, кроме core)

**Цель**: дать `commit-analyzer` точку старта 3.0.0 для пакетов на 1.0.0, чтобы BREAKING → 4.0.0 (а не 2.0.0).

```bash
# на HEAD develop — где будем коммитить bump
git tag cdk-v3.0.0 HEAD
git tag ui-kit-v3.0.0 HEAD
git tag renderer-react-v3.0.0 HEAD
git tag renderer-json-v3.0.0 HEAD
git tag mcp-v3.0.0 HEAD

# core НЕ трогаем — у него уже v4.0.0
```

Push tags нужен **до** push'а bump-коммита, чтобы SR увидел их при запуске на CI.

### 2. Обновить cross-references peerDependencies

В 5 package.json (всех кроме `@reformer/core`) обновить `peerDependencies` на `^4.0.0`:

| Файл                                                                                           | Поле                                           | Было                        | Станет   |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------- | --------------------------- | -------- |
| [packages/reformer-cdk/package.json](packages/reformer-cdk/package.json)                       | `peerDependencies["@reformer/core"]`           | `>=1.1.0-beta.0`            | `^4.0.0` |
| [packages/reformer-renderer-react/package.json](packages/reformer-renderer-react/package.json) | `peerDependencies["@reformer/core"]`           | `>=1.1.0-beta.0`            | `^4.0.0` |
| [packages/reformer-ui-kit/package.json](packages/reformer-ui-kit/package.json)                 | `peerDependencies["@reformer/core"]`           | `>=1.1.0-beta.0`            | `^4.0.0` |
|                                                                                                | `peerDependencies["@reformer/cdk"]`            | `>=1.0.0-beta.0`            | `^4.0.0` |
|                                                                                                | `peerDependencies["@reformer/renderer-react"]` | `>=1.0.0-beta.0`            | `^4.0.0` |
| [packages/reformer-renderer-json/package.json](packages/reformer-renderer-json/package.json)   | `peerDependencies["@reformer/core"]`           | `>=1.1.0-beta.0`            | `^4.0.0` |
|                                                                                                | `peerDependencies["@reformer/renderer-react"]` | `>=1.0.0-beta.0`            | `^4.0.0` |
|                                                                                                | `peerDependencies["@reformer/ui-kit"]`         | `>=1.0.0-beta.0` (optional) | `^4.0.0` |
| [packages/reformer-mcp/package.json](packages/reformer-mcp/package.json)                       | `peerDependencies["@reformer/core"]`           | `>=1.0.0-beta.1` (optional) | `^4.0.0` |

`devDependencies` оставить как есть (`*` — local workspace links).

`version` field **не трогать** — semantic-release обновит сам в run-time перед publish.

### 3. Скомпозировать BREAKING-commit

Один общий commit, затрагивающий 5 пакетов (path filter `packages/**` без `packages/reformer/` для core):

```
feat!: sync all @reformer/* packages to v4.0.0

BREAKING CHANGE: align cdk, ui-kit, renderer-react, renderer-json, mcp on
v4.0.0 to match @reformer/core. peerDependencies between @reformer/*
packages now require ^4.0.0.
```

Точечно — изменения только в `peerDependencies`. `package.json` для core НЕ модифицируется (CI matrix-run для `@reformer/core` тогда увидит «no commits on packages/reformer/» → skip → core остаётся на 4.0.0).

### 4. Push на develop (beta) или main (stable)

- `develop` push → SR @ `develop`-channel выпустит pre-release: `cdk-v4.0.0-beta.1`, ui-kit, renderer-react, renderer-json, mcp на npm `@beta`. Это **рекомендованный first step** — даёт обкатать prerelease перед stable.
- `main` push → SR выпустит stable `v4.0.0` на npm `@latest`.

User делает push сам.

### 5. Verification

После CI run:

```bash
# Проверить все теги созданы
git fetch --tags
git tag -l 'cdk-v4.0.0' 'ui-kit-v4.0.0' 'renderer-react-v4.0.0' 'renderer-json-v4.0.0' 'mcp-v4.0.0'

# Проверить npm
for pkg in @reformer/cdk @reformer/ui-kit @reformer/renderer-react @reformer/renderer-json @reformer/mcp; do
  npm view "$pkg" version
done
# Все должны вывести 4.0.0
```

Также в GitHub Actions — workflow `Release` должен показать 6 sequential jobs:

- `@reformer/core` → "no release needed" (skip, OK)
- остальные 5 → published 4.0.0

### 6. Cleanup synth tags (опционально)

После того как реальные `cdk-v4.0.0` etc. созданы CI-runner'ом, synth `cdk-v3.0.0` etc. больше не используются. Можно оставить их (не мешают) или удалить:

```bash
git tag -d cdk-v3.0.0 ui-kit-v3.0.0 renderer-react-v3.0.0 renderer-json-v3.0.0 mcp-v3.0.0
git push origin :refs/tags/cdk-v3.0.0  # ... etc
```

**Рекомендация**: оставить — это снимок «откуда стартовали 4.0.0 jump», и удаление может смутить будущие SR runs если что-то пойдёт не так.

## Failure modes & mitigation

| Риск                                                                                                                                             | Mitigation                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Synth tag создан не на HEAD develop, а на старом commit'е                                                                                        | `git tag <name> HEAD` явно; verify через `git log --oneline -1 <tag>`                                                                                                                                                                                                   |
| BREAKING-commit задевает `packages/reformer/` (core) случайно                                                                                    | Diff перед commit: `git diff --stat HEAD -- packages/reformer/` должен быть пуст                                                                                                                                                                                        |
| CI matrix запускает SR для core и тот видит синхро changes                                                                                       | Path filter в release.yml = `packages/**`, но SR self-check за scope (по `@semantic-release/commit-analyzer` + monorepo-aware plugins) — если коммитом изменены только `packages/reformer-{cdk,ui-kit,renderer-react,renderer-json,mcp}/`, core run выйдет «no release» |
| `peerDependencies` несовместимы — npm install ломается у downstream                                                                              | После CI — manual smoke: `npx create-react-app test && cd test && npm i @reformer/core@4 @reformer/cdk@4 @reformer/ui-kit@4 @reformer/renderer-react@4`                                                                                                                 |
| SR решит выпустить минорный bump вместо major (если BREAKING footer не распознан)                                                                | semantic-release строго парсит `BREAKING CHANGE:` (с двоеточием, на отдельной строке в footer'е) — соблюсти точный формат коммита                                                                                                                                       |
| Уже опубликованный `mcp-v2.0.0` означает что MCP пройдёт от 2 → 4 (synth 3.0.0 baseline → BREAKING → 4.0.0). Проверить что 4 > 2 для npm publish | npm не требует sequential majors — публикация 4.0.0 поверх 2.0.0 валидна                                                                                                                                                                                                |

## Out of scope

- Migration guide для consumer'ов — user выбрал «conventional commits достаточно», SR сгенерирует release notes автоматически из BREAKING-commit'а.
- `package.json version` field sync — SR не push'ит обратно (нет `@semantic-release/git` plugin'а), и это исторический pattern проекта.
- Manual `npm publish` — обходим semantic-release CI (user выбрал CI-flow).
- Удаление существующих 1.x / 2.x publish'ей с npm — npm не позволяет unpublish после 72ч; они останутся доступны через explicit `@1`-tag, что норма для major bump.

## Файлы для создания

### Prompt definitions + handlers (TypeScript, по существующему паттерну `create-form.ts`)

1. [`packages/reformer-mcp/src/prompts/generate-form-core.ts`](packages/reformer-mcp/src/prompts/generate-form-core.ts) — `target=core`
2. [`packages/reformer-mcp/src/prompts/generate-form-renderer-react.ts`](packages/reformer-mcp/src/prompts/generate-form-renderer-react.ts)
3. [`packages/reformer-mcp/src/prompts/generate-form-json.ts`](packages/reformer-mcp/src/prompts/generate-form-json.ts)

Каждый файл экспортирует:

- `{target}PromptDefinition: { name, description, arguments }` для `ListPromptsRequestSchema` handler'а
- `async function get{Target}Prompt(args)` для `GetPromptRequestSchema` switch

### Handlebars-шаблоны (Markdown, по паттерну `create-form.md`)

4. [`packages/reformer-mcp/src/prompts/templates/generate-form-core.md`](packages/reformer-mcp/src/prompts/templates/generate-form-core.md)
5. [`packages/reformer-mcp/src/prompts/templates/generate-form-renderer-react.md`](packages/reformer-mcp/src/prompts/templates/generate-form-renderer-react.md)
6. [`packages/reformer-mcp/src/prompts/templates/generate-form-json.md`](packages/reformer-mcp/src/prompts/templates/generate-form-json.md)

## Файлы для модификации

7. [`packages/reformer-mcp/src/prompts/index.ts`](packages/reformer-mcp/src/prompts/index.ts) — добавить 3 ре-экспорта рядом с существующими
8. [`packages/reformer-mcp/src/index.ts`](packages/reformer-mcp/src/index.ts) — добавить 3 записи в массив `ListPromptsRequestSchema`-handler'а и 3 case'а в `GetPromptRequestSchema` switch

## Контракт каждого prompt'а

```ts
{
  name: 'generate-form-{target}',
  description: 'Сгенерировать форму ReFormer для target={target} на основе полной спецификации',
  arguments: [
    { name: 'spec', required: true,  description: 'Полный текст спецификации (markdown). Например содержимое docs/specs/<form>.md.' },
    { name: 'notes', required: false, description: 'Дополнительные инструкции в свободной форме (приоритеты, ограничения, prefill, специфика проекта).' },
  ],
}
```

Handler рендерит `templates/generate-form-{target}.md` через существующий `renderPromptTemplate(name, vars)` (Handlebars-loader, уже используется во всех 10 prompts) с переменными `{ spec, notes }`. Возвращает `{ messages: [{ role: 'user', content: { type: 'text', text: rendered } }] }`.

## Структура каждого шаблона

Общий каркас (одинаковый для всех 3 target'ов):

1. **Цель** — реализуй форму по спеке для конкретного target.
2. **Спецификация** — `{{spec}}` placeholder.
3. **Дополнительные инструкции** — `{{#if notes}}{{notes}}{{/if}}`.
4. **Hard rules** общие: schema-driven UI (component + componentProps в схеме), testId convention (top-level=fieldName camelCase, nested=`parent-child` через дефис, array items без префикса), type-safety (`satisfies FieldConfig<T>`, `type` не `interface`).
5. **Target-specific stack + recipes pointers** (см. ниже).
6. **Pitfalls** из iter-цикла (вшиваю как «частые ошибки» — они уже задокументированы в recipes, но в промте напоминаем явно).
7. **Verification** — `npx tsc --noEmit -p tsconfig.app.json` + при наличии dev-сервера — runtime smoke.
8. **Output expectations** — какие файлы создать, как структурировать.

### Target-specific содержание шаблонов

**`generate-form-core.md`**:

- Stack: `@reformer/core` + `@reformer/ui-kit` + `FormWizard` (manual JSX). Output: `schema.ts` + `index.tsx`.
- Reference recipes: `core/quick-start`, `core/multi-step`, `ui-kit/form-wizard` (с упором на `STEP_VALIDATIONS: Record<number, ValidationSchemaFn<T>>` — массив = silent no-op), `core/arrays` (tuple `[itemSchema]`, plain leaves для `AddButton.initialValue`), `core/compute-vs-watch`, `core/copy-from`, `core/api-signatures` (`applyWhen` из `validators` имеет 3 args: `triggerField, condition, validatorsFn`).
- Pitfall: TS2769 `'form' does not exist in FormSchema<T>'` → extract `const form: FormSchema<T> = { ... }` для realного error message.

**`generate-form-renderer-react.md`**:

- Stack: `@reformer/renderer-react` + `createRenderSchema` + `<FormRenderer fieldWrapper=FormField>`. Output: `schema.ts` (form-schema + render-schema + behavior) + thin `index.tsx`.
- Reference recipes: `renderer-react/render-schema`, `renderer-react/render-behavior`, `ui-kit/form-field-integration`, `ui-kit/form-array-section` (control: path.array, itemComponent: FC).
- Pitfall: JSX в `.ts`-файле для `itemComponent` FC → либо `createElement`, либо вынеси FC в `.tsx`.

**`generate-form-json.md`**:

- Stack: `@reformer/renderer-json` + closure pattern + JSON-schema + Registry. Output: `schema.json` + `index.tsx`.
- Reference recipes: `renderer-json/cookbook` (особенно секция `JsonFormApp` — closure pattern с `FormRoot.__selfManagedChildren = true`), `renderer-json/json-schema` ($template для arrays, model для leaf-полей), `renderer-json/registry` (defineRegistry, source/field/container).
- Pitfall: `<FormRenderer componentProps={{ form }}>` НЕ работает (`componentProps` нет в `FormRendererProps<T>`). Корректный путь: `reg.source('FORM', form)` + в JSON `root: { component: 'FormRoot', componentProps: { form: 'FORM' }, children: [...] }`. Это закрытый G3-iter15 gap, описан в исправленном cookbook recipe.

## Existing utilities to reuse

- `renderPromptTemplate(name, vars)` — Handlebars loader, путь к шаблонам автодетектится. Используется всеми 10 существующими prompts.
- Существующий паттерн файла `create-form.ts` — образец с `description` arg + auto-detect target. Новые prompts проще: target захардкожен, нет stack-detection. Можно скопировать структуру и упростить.
- Recipes из `packages/reformer-{core,cdk,ui-kit,renderer-react,renderer-json}/docs/llms/*.md` — **не дублирую содержимое** в шаблонах prompt'а, ссылаюсь по slug'у (`find_recipe(topic="form-wizard")` и т.п.). Это держит prompts тонкими и автоматически подтянет обновления recipes без правки prompts.
- iter-baseline `sub-agent-clean.md` — содержит готовые testId-convention блок и hard-rules; перенесу формулировки 1:1 в шаблоны prompt'ов.

## Verification

1. **Build**: `npm run build -w reformer-mcp` — должен пройти `tsc` без ошибок и скопировать 3 новых template'а в `dist/`.
2. **Schema-валидация** (через MCP inspector или прямой вызов JSON-RPC):
   - `prompts/list` возвращает 13 prompts (10 + 3 новых).
   - `prompts/get` для каждого нового prompt'а с `arguments: { spec: '<dummy>', notes: '<dummy>' }` возвращает `messages` с rendered text без `{{spec}}` / `{{notes}}` плейсхолдеров (Handlebars сработал).
3. **End-to-end smoke** (опционально): запросить `prompts/get` с реальной спекой `docs/specs/credit-application-form.md` и убедиться что output содержит:
   - target-specific stack-блок
   - вшитую спеку
   - notes (если переданы)
4. **Регрессия**: existing 10 prompts продолжают работать (`create-form`, `plan-form`, …) — выборочный smoke на 1-2 из них.

## Out of scope

- **Прогон самой генерации** на реальной форме (e.g. credit-application) — это работа консумера MCP-сервера (sub-agent или человек), а не самого prompt'а.
- **Auto-detect target** — отсутствует by-design: имя prompt'а уже фиксирует target.
- **Sampling / discover-context flow** — существующие prompts (`create-form` с `inferTarget()`) уже это делают; новые prompts — простой template render без sampling.
