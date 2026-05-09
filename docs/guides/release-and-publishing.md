# Релизы и публикация пакетов

Документ описывает как версионируются и публикуются 6 npm-пакетов ReFormer. Setup: `semantic-release` 25 + `semantic-release-monorepo` (path-aware filtering) + GitHub Actions CI.

## Пакеты и tag format

| Пакет                      | Каталог                             | git tag prefix               | npm                                                    |
| -------------------------- | ----------------------------------- | ---------------------------- | ------------------------------------------------------ |
| `@reformer/core`           | `packages/reformer/`                | `v${version}`                | https://www.npmjs.com/package/@reformer/core           |
| `@reformer/cdk`            | `packages/reformer-cdk/`            | `cdk-v${version}`            | https://www.npmjs.com/package/@reformer/cdk            |
| `@reformer/ui-kit`         | `packages/reformer-ui-kit/`         | `ui-kit-v${version}`         | https://www.npmjs.com/package/@reformer/ui-kit         |
| `@reformer/renderer-react` | `packages/reformer-renderer-react/` | `renderer-react-v${version}` | https://www.npmjs.com/package/@reformer/renderer-react |
| `@reformer/renderer-json`  | `packages/reformer-renderer-json/`  | `renderer-json-v${version}`  | https://www.npmjs.com/package/@reformer/renderer-json  |
| `@reformer/mcp`            | `packages/reformer-mcp/`            | `mcp-v${version}`            | https://www.npmjs.com/package/@reformer/mcp            |

## Принцип: каждый пакет версионируется независимо

С `semantic-release-monorepo` каждый workspace SR видит **только** commits, затрагивающие его `packages/<pkg>/**`. Поэтому:

- `fix(cdk): edge case` → bump только cdk (например, 1.0.0 → 1.0.1). Остальные `no release needed`.
- `feat(ui-kit): new component` → bump только ui-kit (1.0.0 → 1.1.0). Остальные не трогаются.
- `feat!(core): breaking API change` → bump только core (1.0.0 → 2.0.0). Остальные остаются.

**Lockstep'а на major+minor больше нет.** Версии могут расходиться. Совместимость поддерживается через `peerDependencies` (см. ниже).

## Branch flow

| Branch    | npm dist-tag       | Версия                      | Пример                         |
| --------- | ------------------ | --------------------------- | ------------------------------ |
| `main`    | `latest` (default) | stable, без суффикса        | `1.0.1`, `1.1.0`, `2.0.0`      |
| `develop` | `develop`          | prerelease, суффикс `-beta` | `1.1.0-beta.1`, `2.0.0-beta.3` |

```bash
npm install @reformer/core              # latest stable из main (1.x.y)
npm install @reformer/core@develop      # latest prerelease из develop (X.Y.Z-beta.N)
```

> **Почему dist-tag = `develop`, а суффикс = `-beta`?** В `.releaserc.json` `branches: [{ "name": "develop", "prerelease": "beta" }]` — `name` задаёт npm dist-tag (имя ветки), `prerelease` — суффикс версии. Это разные настройки, разрешено иметь любые комбинации.

Конфигурируется в `.releaserc.json` каждого пакета:

```json
{
  "extends": "semantic-release-monorepo",
  "branches": ["main", { "name": "develop", "prerelease": "beta" }],
  "tagFormat": "<prefix>-v${version}"
}
```

## Conventional commits + scopes

Правила [conventional commits](https://www.conventionalcommits.org/), scope = имя пакета без `@reformer/` префикса:

| Commit                               | Эффект                                   |
| ------------------------------------ | ---------------------------------------- |
| `fix(core): null guard`              | core → patch (`1.0.0` → `1.0.1`)         |
| `feat(cdk): new hook`                | cdk → minor (`1.0.0` → `1.1.0`)          |
| `feat!(ui-kit): rewrite Input API`   | ui-kit → major (`1.0.0` → `2.0.0`)       |
| `fix(renderer-json): typo`           | renderer-json → patch                    |
| `chore: bump deps`                   | **никакого** release (chore не triggers) |
| `docs: update README`                | то же                                    |
| `feat(core,cdk): coordinated change` | оба пакета → minor (cross-scope)         |

**Scope обязателен** для feat/fix — иначе `semantic-release-monorepo` не может определить какому пакету принадлежит change. Если изменения трогают неск. пакетов — указывай все scopes через запятую: `feat(core,renderer-react): ...`.

### Что НЕ запускает release

- `chore:`, `docs:`, `style:`, `refactor:`, `test:`, `ci:`, `build:` (по default'у, можно настроить)
- Изменения вне `packages/` (например `docs/**`, `projects/**`, root configs)

Если нужно опубликовать что-то без feature/fix-семантики — используй `feat:` со scope (необязательно осмысленным) или просто скоммить с `docs:` и через 1-2 итерации настоящий feat-commit подтянет.

## Что происходит на push

GitHub Actions workflow `.github/workflows/release.yml` триггерится на push в `main` или `develop` если изменены `packages/**` или сам workflow.

Запускает **6 sequential matrix jobs** (по одному на пакет, max-parallel=1 чтобы не было race на `refs/notes/semantic-release`):

```
@reformer/core         → cd packages/reformer       && npx semantic-release
@reformer/cdk          → cd packages/reformer-cdk   && npx semantic-release
@reformer/ui-kit       → cd packages/reformer-ui-kit && npx semantic-release
@reformer/renderer-react → cd packages/reformer-renderer-react && npx semantic-release
@reformer/renderer-json  → cd packages/reformer-renderer-json  && npx semantic-release
@reformer/mcp          → cd packages/reformer-mcp   && npx semantic-release
```

Каждый job:

1. semantic-release читает свой `.releaserc.json`, `extends: semantic-release-monorepo`
2. monorepo-обёртка фильтрует commits — берёт только те, что меняли свой `packages/<pkg>/**`
3. analyze-commits → определяет next version (patch/minor/major) от **last git tag** этого пакета (по `tagFormat`)
4. publish: build → `npm publish` → создать git tag (с правильным prefix) → создать GitHub release с changelog notes

Каждый job выводит либо «Published @reformer/<pkg>@X.Y.Z» либо «No release needed» (если нет relevant commits).

Sequential порядок задан жёстко (matrix.include) с учётом dependency graph:

1. core (без deps)
2. cdk + renderer-react (depend on core)
3. ui-kit (depend on core, cdk, renderer-react)
4. renderer-json (depend on core, renderer-react, ui-kit)
5. mcp (independent)

## Cross-package изменения

Если фича трогает несколько пакетов сразу:

```bash
git commit -m "$(cat <<'EOF'
feat(core,cdk,ui-kit): introduce new validation API

Adds <name> validator + ui-kit FormField wrapper + cdk hook.
Backward compatible.
EOF
)"
```

CI выпустит **только** core/cdk/ui-kit на minor (1.0.0 → 1.1.0 каждый); остальные `no release needed`.

При **breaking** cross-package change — те же scopes, но с `!`:

```
feat!(core,cdk,ui-kit): rename FormProxy<T> generic
```

→ core/cdk/ui-kit на major (1.x.y → 2.0.0 каждый), peerDeps между ними нужно явно проапдейтить в коммите (`packages/cdk/package.json`: `"@reformer/core": "^2.0.0"`).

## peerDependencies

Каждый пакет зависит от других через `peerDependencies` с диапазоном `^X.0.0`. Например, `@reformer/cdk@1.x` требует `@reformer/core@^1.0.0`. Если `@reformer/core` поднимается до 2.0.0 (breaking), `@reformer/cdk` нужно тоже поднять до 2.0.0 с обновлённым peer на `^2.0.0`.

При major bump'е любого `@reformer/*` пакета — пройдись по `packages/*/package.json` и обнови все peers к нему. Это **часть BREAKING-коммита**, не отдельный commit.

## Откат / Unpublish

Если опубликовали ошибочную версию (как было в #17 — core@5.0.0 вместо 4.0.0):

1. **`npm unpublish @reformer/<pkg>@<version>`** — окно 72ч после публикации.
2. После unpublish конкретной версии npm запрещает её повторное использование 24 часа. Чтобы избежать ожидания — публикуй другую версию (1.0.2 вместо переопубликации 1.0.1).
3. Если ошибочный git tag создан — `git tag -d <tag>` локально и `git push origin :refs/tags/<tag>` для удаления на origin.
4. История коммитов остаётся — npm и git tags откатываются, но release notes в GitHub Releases надо удалить вручную.

## Emergency: align-versions.yml

Workflow `.github/workflows/align-versions.yml` — **escape hatch** для редких случаев когда нужно вручную поднять все пакеты на одну версию (обходит semantic-release). Использовался исторически для lockstep-режима. Сейчас, с monorepo-aware SR, это редкий сценарий — но workflow оставлен для:

- emergency reset (как при инциденте с core@5.0.0)
- начальной синхронизации после обновления setup'а
- ручного override когда automatic SR daje wrong version

См. файл workflow для inputs (`version`, `dry_run`).

## Чек-лист регулярного PR

Перед merge feature-PR'а:

- [ ] commit message в conventional-format (`type(scope): description`)
- [ ] scope = имя пакета (или `core,cdk,...` через запятую если cross-package)
- [ ] `BREAKING CHANGE:` footer (или `!` после type) если есть breaking
- [ ] При breaking — обновлены `peerDependencies` затронутых пакетов
- [ ] PR target = `develop` (для prerelease beta) или `main` (для stable)
- [ ] CI green: lint + format:check + tests + 6× release jobs

## Implementation references

- [`.github/workflows/release.yml`](../../.github/workflows/release.yml) — основной release pipeline
- [`.github/workflows/align-versions.yml`](../../.github/workflows/align-versions.yml) — emergency escape hatch
- [`packages/*/.releaserc.json`](../../packages/) — semantic-release config per package
- [`semantic-release-monorepo`](https://github.com/pmowrer/semantic-release-monorepo) — npm пакет, обёртка для path-aware фильтрации
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — общий contribution-flow
- [`docs/branching.md`](../branching.md) — стратегия веток
