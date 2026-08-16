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

- `fix(reformer-cdk): edge case` → bump только cdk (например, 1.0.0 → 1.0.1). Остальные `no release needed`.
- `feat(reformer-ui-kit): new component` → bump только ui-kit (1.0.0 → 1.1.0). Остальные не трогаются.
- `feat(reformer)!: breaking api change` → bump только core (1.0.0 → 2.0.0). Остальные остаются.

**Lockstep'а на major+minor больше нет.** Версии могут расходиться — и расходятся сильно (core 11.x, renderer-\* 12.x, ui-kit 13.x). Совместимость держится общим релизным пайплайном, а не диапазонами в `peerDependencies` (см. раздел [peerDependencies](#peerdependencies) — там же почему внутренние диапазоны обязаны быть `"*"`).

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

## Merge-метод: rebase, не squash

**Мерджи PR через Rebase and merge** (fallback — merge commit). **Squash отключён** в настройках репозитория — использовать его нельзя.

Почему это важно: `semantic-release-monorepo` относит коммит к пакету по файлам, которые тот трогает (`packages/<pkg>/**`), а тип бампа берёт из commit message. Squash схлопывает всю ветку в **один** коммит, который:

- трогает файлы **всех** затронутых пакетов, и
- собирает в теле **все** commit-сообщения ветки (`squash_merge_commit_message: COMMIT_MESSAGES`), включая любые `!` / `BREAKING CHANGE`.

В результате каждый пакет «видит» этот единственный коммит (он трогает его пути) с breaking-маркером в теле → **все пакеты бампаются на major** сразу, даже если их собственных изменений не было или они не breaking. Именно так `Develop (#28)`/`(#34)` подняли все 6 пакетов на major.

Rebase (и merge commit) сохраняют оригинальные per-scope коммиты: `feat(reformer)!: …` трогает только `packages/reformer/**` → major только для core, а `docs(reformer-mcp)` / `feat(reformer-mcp)` → релиз только для mcp.

> Особенно для промоушена `develop → main`: делай rebase/merge, иначе весь набор коммитов схлопнется в один «major-для-всех».

## Conventional commits + scopes

Правила [conventional commits](https://www.conventionalcommits.org/), scope = имя директории пакета (`reformer`, `reformer-cdk`, …). Полный список закрыт линтером — см. [commitlint.config.js](../../commitlint.config.js) и [CONTRIBUTING.md](../../CONTRIBUTING.md).

| Commit                                      | Эффект                                   |
| ------------------------------------------- | ---------------------------------------- |
| `fix(reformer): null guard`                 | core → patch (`1.0.0` → `1.0.1`)         |
| `feat(reformer-cdk): new hook`              | cdk → minor (`1.0.0` → `1.1.0`)          |
| `feat(reformer-ui-kit)!: rewrite input api` | ui-kit → major (`1.0.0` → `2.0.0`)       |
| `fix(reformer-renderer-json): typo`         | renderer-json → patch                    |
| `chore: bump deps`                          | **никакого** release (chore не triggers) |
| `docs: update readme`                       | то же                                    |

**Пакет определяется путями изменённых файлов, а не scope.** `semantic-release-monorepo` фильтрует коммиты через `onlyPackageCommits` — коммит «принадлежит» пакету, если тронул файл внутри его директории. Поэтому коммит, тронувший два пакета, поднимет оба независимо от того, что написано в скобках. Scope нужен для читаемости истории и группировки в release notes; версию бампает `type` (`feat` → minor, `fix` → patch, `!`/`BREAKING CHANGE` → major).

> Отсюда практическое следствие: **не смешивай в одном коммите изменения разных пакетов**, если не хочешь бампнуть их вместе. Разделяй по пакетам — тогда и scope, и релиз совпадут с намерением.

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

Перечисли все затронутые scope через запятую. Сообщение пиши в файл и коммить через `-F` — так оно не проходит через квотинг шелла (см. «Git commits — процедура» в [CLAUDE.md](../../CLAUDE.md)):

```bash
# .commit-msg.txt
# feat(reformer,reformer-cdk,reformer-ui-kit): introduce new validation api
#
# Adds <name> validator + ui-kit FormField wrapper + cdk hook.
# Backward compatible.

npx --no commitlint < .commit-msg.txt   # проверить ДО коммита
git commit -F .commit-msg.txt
```

CI выпустит **только** core/cdk/ui-kit на minor (1.0.0 → 1.1.0 каждый); остальные `no release needed`. Напомним: пакеты определяются путями изменённых файлов — scope здесь для читаемости.

При **breaking** cross-package change — те же scopes, но с `!` после закрывающей скобки:

```
feat(reformer,reformer-cdk,reformer-ui-kit)!: rename form-proxy generic
```

→ core/cdk/ui-kit на major (1.x.y → 2.0.0 каждый). Peer-диапазоны между ними при этом **не трогаются** — почему, см. следующий раздел.

## peerDependencies

Правил два, и они противоположны.

**Внутренние `@reformer/*` — всегда `"*"`, без версий.**

```json
"peerDependencies": {
  "@reformer/core": "*",
  "react": "^18.0.0 || ^19.0.0"
}
```

Причина — prerelease. По правилам semver версия с суффиксом (`11.0.0-beta.3`) удовлетворяет диапазону, только если хотя бы один его компаратор имеет **тот же `major.minor.patch` и собственный prerelease-суффикс**. Поэтому бета не проходит ни `>=1.1.0`, ни `^11.0.0`, ни `^11.0.0-0` (последний примет только беты ровно `11.0.0`, а с develop уезжают и минорные — `11.3.1-beta.1`). Практический итог: с версионным диапазоном `npm i @reformer/core@beta @reformer/cdk@beta` у потребителя падает с `ERESOLVE` и требует `--legacy-peer-deps`.

Работает единственная запись — `"*"`: npm обрабатывает её **до** semver'а (`arborist/lib/dep-valid.js`: `if (requested.fetchSpec === '*') return true`), одинаково во всех живых мажорах npm. Ни `"x"`, ни `">=0.0.0-0"` в это короткое замыкание не попадают.

Совместимость внутри монорепо держится не диапазоном, а тем, что все `@reformer/*` выпускаются из одного репозитория одним пайплайном. Версионный диапазон её всё равно не обеспечивал: core уехал на 11.x, а peer'ы так и стояли `">=1.1.0"` с первых версий — правило «обнови peers при major bump» не соблюдалось ни разу.

**Внешние (`react`, `recharts`, `cmdk`, …) — наоборот, с обязательной верхней границей** (`">=8 <9"`, `"^18.0.0 || ^19.0.0"`). Открытый диапазон обещает совместимость с ещё не вышедшим мажором и превращает чужой релиз в нашу поломку.

Оба правила — гейты в CI, а не договорённость:

| Проверка                                                           | Что делает                                                                                |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| [`check:peer-ranges`](../../scripts/check-peer-ranges.mjs)         | манифесты: внутренние строго `"*"`, у внешних есть верхняя граница                        |
| [`check:peer-prerelease`](../../scripts/check-peer-prerelease.mjs) | поведение: пакеты с фальшивыми prerelease-версиями ставятся в чистый проект дефолтным npm |

Второй нужен потому, что внутри монорепо баг не воспроизводится: в рабочем дереве версии стабильные, а корневой `.npmrc` долго глушил ошибку через `legacy-peer-deps=true`.

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

- [ ] commit message в conventional-format (`type(scope): description`), scope — из списка в [commitlint.config.js](../../commitlint.config.js)
- [ ] коммит не смешивает изменения разных пакетов (иначе бампнутся оба — фильтр идёт по путям файлов)
- [ ] `BREAKING CHANGE:` footer (или `!` после type, т.е. `feat(scope)!:`) если есть breaking
- [ ] `peerDependencies`: внутренние `@reformer/*` остались `"*"`, у новых внешних есть верхняя граница (гейт — `npm run check:peer-ranges`)
- [ ] PR target = `develop` (для prerelease beta) или `main` (для stable)
- [ ] merge через **Rebase and merge** (или merge commit) — **не Squash** (squash ломает per-package версионирование → major для всех)
- [ ] CI green: lint + format:check + tests + 6× release jobs

## Implementation references

- [`.github/workflows/release.yml`](../../.github/workflows/release.yml) — основной release pipeline
- [`.github/workflows/align-versions.yml`](../../.github/workflows/align-versions.yml) — emergency escape hatch
- [`packages/*/.releaserc.json`](../../packages/) — semantic-release config per package
- [`semantic-release-monorepo`](https://github.com/pmowrer/semantic-release-monorepo) — npm пакет, обёртка для path-aware фильтрации
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — общий contribution-flow
- [`docs/branching.md`](../branching.md) — стратегия веток
