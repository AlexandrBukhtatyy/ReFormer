# Ускорение release.yml — схлопывание matrix в один последовательный джоб

## Context

`.github/workflows/release.yml` публикует 6 пакетов через **matrix с `max-parallel: 1`** (строго последовательно из-за гонки на общий git-notes ref `refs/notes/semantic-release`). Проблема: matrix при `max-parallel: 1` **не даёт параллелизма** — только оверхед. Каждая из 6 итераций = отдельный runner: свой `checkout` (fetch-depth 0), свой `npm ci`, своя пересборка цепочки зависимостей. Фикс-стоимость оплачивается 6×, пакеты пересобираются многократно.

**Baseline (реальный зелёный прогон):** Release ~11.8 мин = test-гейт 2.6 + 6 release-джобов ~8.7 мин (последовательно). Всего по матрице: **18 build-ов, 6× npm ci, 6× checkout**.

**Цель:** один последовательный джоб — 1 checkout, 1 npm ci, 6 build-ов (каждый пакет раз), 6 semantic-release. Оценка: release-джоб ≈ **~4–5 мин** (Release total ~7 мин, ~вдвое короче).

## Ключевые решения (проверены по файлам)

- **Порядок сборки — явный цикл, НЕ `npm run build --workspaces`.** npm не топо-сортирует workspaces (mcp = `tsc`, собрался бы до dist своих зависимостей → TS2307) и захватил бы `projects/*`. Порядок как в `test.yml` и уже-рабочем `align-versions.yml`: `core → cdk → renderer-react → ui-kit → renderer-json → mcp` (ui-kit и renderer-json взаимно независимы; оба перед mcp).
- **Изоляция сбоев релиза** (замена `fail-fast: false`): bash-цикл, `if ( cd "$dir" && npx semantic-release )` — под дефолтным `set -eo pipefail` команда в условии `if` НЕ рвёт скрипт; «no release needed» = exit 0, реальный сбой → копим в `failed[]`, `exit 1` в конце. Один упавший пакет не блокирует остальные.
- **git notes:** `git fetch refs/notes/semantic-release` **один раз перед циклом** (checkout не тянет notes, а semantic-release хранит там каналы релиза). Между пакетами fetch не нужен — в одном джобе локальный ref обновляется сам; гонка параллельных runner-ов исчезает → `max-parallel: 1` больше не нужен.
- **Core-тесты в release убрать** — `needs: test` (reusable `test.yml`) уже собрал и прогнал тесты всех пакетов + dist-deps/size/typecheck. Дублирование лишнее.
- **Читаемость логов:** `::group::Build $pkg` и `::group::Release $ws` секции (как в `align-versions.yml`), `::error::` при падении пакета — компенсирует потерю per-package строк-джобов.
- **Размен:** линейная build-фаза → падение сборки любого пакета прервёт весь джоб ДО релиза (приемлемо: нельзя публиковать из несобранного; `needs: test` уже собрал те же пакеты теми же командами). Отличие от matrix: раньше падение сборки ui-kit роняло только ui-kit+mcp, остальные публиковались. Сознательный размен ради простоты; при желании сохранить точную семантику — слить build+release в один защищённый per-package цикл (вариант, не основной).
- **`concurrency` (workflow-level), `on`, джоб `test`, `permissions`, `cache: 'npm'` — без изменений.** Concurrency защищает от гонки между разными запусками workflow (ортогонально matrix).

## Изменяемый файл

Единственный: **[.github/workflows/release.yml](.github/workflows/release.yml)** — переписать джоб `release`:

- Удалить весь блок `strategy:` (`max-parallel`, `fail-fast`, `matrix` — строки ~37–77).
- `name: Release ${{ matrix.workspace }}` → `name: Release all packages`.
- Заменить «Build dependencies» + «Build ${{ matrix.workspace }}» одним шагом «Build all packages in dependency order» (цикл `for pkg in core cdk renderer-react ui-kit renderer-json mcp; do npm run build -w …; done` с `::group::`).
- Удалить шаг «Run tests».
- «Fetch git notes» оставить (один раз перед циклом), обновить комментарий.
- «Release …» заменить fault-isolated циклом по `workspace:dir`; `env` (GITHUB_TOKEN/NPM_TOKEN/NODE_AUTH_TOKEN) перенести на этот шаг.
- Обновить комментарий-шапку файла (строки 3–13) — убрать описание `max-parallel: 1 / 6×30s`.

Эталоны для копирования паттернов: [align-versions.yml](.github/workflows/align-versions.yml) (ordered build-loop + `::group::` + субшелл `(cd "$dir" && …)`), [test.yml](.github/workflows/test.yml) (порядок сборки, полнота гейта).

## Готовый YAML джоба `release`

```yaml
  release:
    name: Release all packages
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: write
      issues: write
      pull-requests: write
      id-token: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GH_TOKEN }}
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
          registry-url: 'https://registry.npmjs.org'
      - name: Install dependencies
        run: npm ci
      - name: Build all packages in dependency order
        run: |
          for pkg in @reformer/core @reformer/cdk @reformer/renderer-react \
                     @reformer/ui-kit @reformer/renderer-json @reformer/mcp; do
            echo "::group::Build $pkg"; npm run build -w "$pkg"; echo "::endgroup::"
          done
      - name: Fetch git notes
        run: git fetch origin refs/notes/semantic-release:refs/notes/semantic-release || true
      - name: Release all packages (sequential, fault-isolated)
        env:
          GITHUB_TOKEN: ${{ secrets.GH_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: |
          packages=(
            "@reformer/core:packages/reformer"
            "@reformer/cdk:packages/reformer-cdk"
            "@reformer/renderer-react:packages/reformer-renderer-react"
            "@reformer/ui-kit:packages/reformer-ui-kit"
            "@reformer/renderer-json:packages/reformer-renderer-json"
            "@reformer/mcp:packages/reformer-mcp"
          )
          failed=()
          for entry in "${packages[@]}"; do
            ws="${entry%%:*}"; dir="${entry#*:}"
            echo "::group::Release $ws"
            if ( cd "$dir" && npx semantic-release ); then echo "$ws: done"
            else echo "::error::semantic-release failed for $ws"; failed+=("$ws"); fi
            echo "::endgroup::"
          done
          if [ ${#failed[@]} -ne 0 ]; then echo "::error::Release failed for: ${failed[*]}"; exit 1; fi
```

## Верификация

1. **actionlint** `.github/workflows/release.yml` — YAML + `${{ }}` + встроенный shellcheck bash-скриптов (кавычки, массивы, set -e).
2. **Порядок сборки локально:** `npm ci` → `for pkg in @reformer/core … @reformer/mcp; do npm run build -w "$pkg"; done` — должен пройти до конца (особенно mcp/tsc, резолвящий dist ui-kit/renderer-json).
3. **Настоящий dry-run на `develop`** (beta-канал в каждом `.releaserc.json`): push мелкого коммита или `workflow_dispatch` — прогонит новый джоб по-настоящему до релиза в main. В логах: одна build-фаза (`::group::Build …`), затем `::group::Release …` по пакету; пакеты без коммитов → «no release needed» exit 0.
4. **Замер «after»:** длительность нового release-джоба против baseline ~8.7 мин (ожидание ~4–5).
5. **Branch protection:** required status checks НЕ завязаны на старые matrix-имена джобов («Release @reformer/core» …). Проверено: ruleset репозитория содержит только `deletion` + `non_fast_forward`, required-checks нет → переименование джоба безопасно.

## Follow-up (не в этом плане)

- Переиспользование `dist` между `test` и `release` через `upload/download-artifact` — выигрыш мал (~6 сборок), `npm ci` в release всё равно обязателен; `node_modules`-артефакт — анти-паттерн. Отложить.
