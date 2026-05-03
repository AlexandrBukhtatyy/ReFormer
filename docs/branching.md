# Branching strategy

ReFormer использует упрощённый **GitHub Flow + развязка stable/beta**: две долгоживущие ветки и feature-ветки по необходимости. Версионирование привязано к ветке — см. [versioning.md](./versioning.md).

## Ветки

### `main` — stable

- Целевой код для пользователей `npm install @reformer/core` (без тэга).
- Защищена: прямые push'и запрещены, обновления только через **merge `develop` → `main`** или hotfix-PR (см. ниже).
- Каждый push в main триггерит [`release.yml`](../.github/workflows/release.yml) → semantic-release публикует stable версию (`3.0.0`, npm dist-tag `latest`).
- Default branch для PR base.

### `develop` — beta

- Активная разработка. Сюда merge'атся feature-ветки и сюда первыми приходят все изменения.
- Каждый push в develop триггерит `release.yml` → semantic-release публикует prerelease (`3.0.0-beta.N`, npm dist-tag `develop`).
- Пользователь может тестировать через `npm install @reformer/core@develop`.
- Не защищена; разрешены fast-forward и обычные merge.

### `feature/*` / `fix/*` / `chore/*` — feature-ветки (опционально)

- Создаются от `develop` для work-in-progress, который не должен сразу попасть в beta-канал.
- PR target — **`develop`**, не `main`.
- После merge feature-ветка удаляется (squash-merge или прямой merge — на усмотрение автора, при соблюдении conventional commits).
- Naming: `feature/wizard-jsonschema`, `fix/array-validator-edge-case`, `chore/upgrade-typescript`. Не критично — semantic-release читает только commit messages, не имена веток.

## Flow

### Регулярная фича / правка

```
1. git checkout develop && git pull
2. (опционально) git checkout -b feature/<name>   # для большой работы
3. ... коммиты с conventional-формой (см. ниже)
4. git push
5. PR в develop → merge
6. release.yml автоматически публикует beta-версию в npm
```

### Promote develop → main (stable release)

Когда beta-цикл (`3.0.0-beta.N`) проверен и готов к stable:

```
1. PR develop → main
2. CI test зелёный → merge (создать merge commit, не squash)
3. Push в main триггерит release.yml
4. semantic-release конвертирует последние beta в stable:
     3.0.0-beta.N → 3.0.0 (npm dist-tag latest)
5. develop остаётся впереди — следующий feat/fix продолжит beta-канал.
```

### Hotfix в production

Если в опубликованном stable нашёлся критичный баг:

```
1. git checkout -b fix/<name> origin/main      # ветка от main, не develop
2. ... починить, conventional commit fix:
3. PR в main → merge
4. release.yml публикует patch (3.0.0 → 3.0.1)
5. Сразу: PR main → develop, merge — чтобы develop включил hotfix
   (иначе фикс будет потерян на следующем develop→main merge)
```

## Conventional commits (важно для semantic-release)

semantic-release читает commit messages чтобы решить, нужен ли release и какой bump. Используем [Conventional Commits 1.0](https://www.conventionalcommits.org/).

### Типы и эффект на release

| Тип                                                           | Bump                      | Когда использовать                          |
| ------------------------------------------------------------- | ------------------------- | ------------------------------------------- |
| `fix:`                                                        | **patch** (3.0.0 → 3.0.1) | bug fix, без изменения API                  |
| `feat:`                                                       | **minor** (3.0.0 → 3.1.0) | новая функциональность, обратно-совместимая |
| `feat!:` или footer `BREAKING CHANGE:`                        | **major** (3.x → 4.0.0)   | ломающее изменение API                      |
| `chore:` / `docs:` / `test:` / `refactor:` / `ci:` / `style:` | **нет release**           | внутренние изменения                        |
| `perf:`                                                       | **patch**                 | оптимизация                                 |

### Scope (`fix(scope):`)

Указывает пакет / область:

- `fix(reformer-cdk):` — изменение в `@reformer/cdk`
- `feat(reformer-renderer-react):` — фича в renderer-react
- `chore(ci):` — общий CI
- `docs(versioning):` — обновление versioning docs

Scope управляет **какие пакеты bumped** semantic-release: `fix(reformer-cdk):` bump'ает только `@reformer/cdk`, остальные пропускают release.

### Lockstep на minor / major

Bump minor или major — это **нарушение lockstep**, если делается через regular `feat:`-commit (бампится только один пакет). Coordinated bump — через [`align-versions.yml`](../.github/workflows/align-versions.yml). Подробности — [versioning.md → Coordinated minor / major release](./versioning.md#coordinated-minor--major-release).

### Примеры

```
fix(reformer-cdk): handle empty array in validator
feat(reformer-ui-kit): add FormWizard.Step skipping API
feat(reformer-renderer-json)!: rename `schema` to `renderSchema`

BREAKING CHANGE: top-level `schema` prop renamed; consumers must migrate.
chore(ci): bump action versions in release workflow
docs(branching): add hotfix flow
```

## CI / Release привязка к веткам

| Branch                    | Trigger             | Workflow                                 | Эффект                                                     |
| ------------------------- | ------------------- | ---------------------------------------- | ---------------------------------------------------------- |
| `develop` push            | conventional commit | `release.yml`                            | `npm publish --tag develop`, версия `3.0.0-beta.N`         |
| `main` push               | conventional commit | `release.yml`                            | `npm publish` (default `latest`), версия `3.0.0`           |
| `develop` или `main` push | любой               | `ci.yml`                                 | lint + format + tests на всех пакетах                      |
| Любая ветка → PR в `main` | —                   | `ci.yml` (event=pull_request)            | те же checks для PR                                        |
| Любой branch              | manual              | `align-versions.yml` (workflow_dispatch) | `npm publish` всех пакетов на одну версию (см. versioning) |

Только `release.yml` и `align-versions.yml` публикуют в NPM. `ci.yml` ничего не публикует — только проверяет.

## Защита веток (рекомендуется)

GitHub → Settings → Branches → Branch protection rules:

- **`main`**:
  - Require pull request reviews before merging
  - Require status checks: `CI / test`
  - Restrict who can push: только через PR
  - Allow force push: ❌
- **`develop`**:
  - (опционально) Require status checks: `CI / test`
  - Allow force push: ❌

Эти правила пока не настроены в репо — это checklist на будущее.

## См. также

- [`versioning.md`](./versioning.md) — что значит `3.0.0` vs `3.0.0-beta.N`, lockstep major+minor, align workflow.
- [`.github/workflows/release.yml`](../.github/workflows/release.yml) — реализация release flow.
- [`.github/workflows/align-versions.yml`](../.github/workflows/align-versions.yml) — manual coordinated bump.
- [Conventional Commits 1.0](https://www.conventionalcommits.org/)
- [semantic-release documentation](https://semantic-release.gitbook.io/)
