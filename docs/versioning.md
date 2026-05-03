# Versioning convention

ReFormer — monorepo из 6 npm-пакетов. Все они версионируются **lockstep** по
major+minor (одинаковые `X.Y.*`), patch (`*.*.Z`) разрешено расходиться.

| Package                    | npm                                                    | git tagFormat                |
| -------------------------- | ------------------------------------------------------ | ---------------------------- |
| `@reformer/core`           | https://www.npmjs.com/package/@reformer/core           | `v${version}`                |
| `@reformer/cdk`            | https://www.npmjs.com/package/@reformer/cdk            | `cdk-v${version}`            |
| `@reformer/ui-kit`         | https://www.npmjs.com/package/@reformer/ui-kit         | `ui-kit-v${version}`         |
| `@reformer/renderer-react` | https://www.npmjs.com/package/@reformer/renderer-react | `renderer-react-v${version}` |
| `@reformer/renderer-json`  | https://www.npmjs.com/package/@reformer/renderer-json  | `renderer-json-v${version}`  |
| `@reformer/mcp`            | https://www.npmjs.com/package/@reformer/mcp            | `mcp-v${version}`            |

## Правила

### Branch → channel → version суффикс

Версионирование привязано к ветке, с которой делается release:

| Branch    | npm dist-tag       | Версия                          | Пример                                         |
| --------- | ------------------ | ------------------------------- | ---------------------------------------------- |
| `main`    | `latest` (default) | stable, **без суффикса**        | `3.0.0`, `3.0.1`, `3.1.0`                      |
| `develop` | `develop`          | prerelease, суффикс **`-beta`** | `3.0.0-beta.0`, `3.0.0-beta.1`, `3.1.0-beta.0` |

- `npm install @reformer/core` → ставит `latest` (3.0.0) — стабильный код из main.
- `npm install @reformer/core@develop` → ставит свежую beta из develop.
- Обе ветки публикуют в один и тот же npm-пакет; различаются только dist-tag и version-суффикс.

Конфигурируется через `branches` в `.releaserc.json` каждого пакета:

```json
{ "branches": ["main", { "name": "develop", "prerelease": "beta" }] }
```

semantic-release сам определяет правильный dist-tag и суффикс по ветке. `align-versions.yml` валидирует input version против ветки (на main отбивает версии с `-beta`, на develop — без `-beta`).

### Lockstep на major + minor

`X.Y` у всех пакетов **обязательно совпадают**. Например:

- ✅ Все на `3.0.x` (3.0.1, 3.0.2, 3.0.7 — patch расходится).
- ✅ Все на `3.1.x`.
- ❌ core=`3.1.0`, cdk=`3.0.5` — minor расходится, **запрещено**.
- ❌ core=`4.0.0`, cdk=`3.5.0` — major расходится, **запрещено**.

### Patch может расходиться

`Z` (третий компонент) — независим per-package. Это by-design:

- Bug fix в `@reformer/cdk` без эффекта на остальные → `cdk` 3.0.4 → 3.0.5; остальные остаются на 3.0.4. Не нужно версионировать пакет, в котором ничего не поменялось.
- Patch-bump триггерится `fix:`-коммитом в `packages/<pkg>/**` через semantic-release.

### Когда меняется major+minor

Любой **`feat:`** или **`feat!:` / `BREAKING CHANGE:`** в любом пакете требует:

1. Coordinated release всех пакетов на новый minor (для `feat:`) или major (для breaking).
2. Совместная команда — НЕ дать semantic-release автоматически бампать только один пакет.

Конкретно: после `feat:`-commit'а в `cdk` → нельзя ждать пока CI выпустит `cdk@3.1.0` оставив остальные на `3.0.x`. Нужно сразу тригернуть **align workflow** (см. ниже) на `3.1.0-beta.0`, потом дать semantic-release продолжать с этой baseline.

### Почему так

- **API stability**: `@reformer/cdk@3.1.0` ожидает `@reformer/core@3.1.x` peer. Когда minor расходится, у потребителя в `node_modules` оказываются несовместимые версии — runtime breakage.
- **Уменьшает confusion**: пользователь видит matching versions — знает что пакеты протестированы вместе.
- **Releaseable changelog**: одна release-нота описывает что изменилось во всём фреймворке за версию.

## Workflow

### Регулярный release (patch)

`fix(reformer-cdk): edge case in array validator` → push в `develop`. Release workflow (`release.yml`) запустит semantic-release для всех 6 пакетов sequential. cdk получит `3.0.X+1`, остальные пропустят release ("no relevant changes"). Patch расходится — это OK.

### Coordinated minor / major release

1. Сделать `feat:` или `BREAKING CHANGE:` коммит в нужном пакете (или сразу в нескольких).
2. **НЕ ждать** автоматического release — он бампнет только тот пакет, остальные останутся позади.
3. Перед `git push` или сразу после CI — **триггернуть align**:
   - GitHub UI → Actions → "Align package versions" → Run workflow
   - **Branch**: `develop` для beta-канала или `main` для stable
   - **Target version**:
     - С `develop` — обязательно с `-beta` суффиксом, например `3.1.0-beta.0`
     - С `main` — без суффикса, например `3.1.0`
     - Workflow валидирует это и провалится если не совпадает.
   - **dry_run**: `true` сначала — посмотреть diff и логи bumpа без публикации; затем повторить с `false`.
4. Workflow сделает: `npm version`, build, `npm publish --tag <latest|develop>` (по ветке), git tags, commit обновлённых package.json.
5. Дальше semantic-release продолжит обычно с этой новой baseline.

### Major bump

Идентично minor, но bump `4.0.0-beta.0` (с develop) или `4.0.0` (с main). После align — все пакеты на 4.x.

### Promote develop → main

Когда beta-цикл (`3.0.0-beta.N`) готов к stable выпуску:

1. Merge `develop` → `main` (regular PR-flow).
2. Push в main триггерит `release.yml`. semantic-release автоматически:
   - Перепакует последние beta-релизы как stable: `3.0.0-beta.N` → `3.0.0`
   - Сменит npm dist-tag с `develop` на `latest` (так что `npm install @reformer/core` начнёт ставить `3.0.0`)
3. Если semantic-release упускает что-то (manual jump на новый major) — триггерим `align-versions.yml` с branch=`main`, version=`3.0.0`.

## Текущее состояние и планируемая sync

На момент `2026-05-03` пакеты разъехались:

- `@reformer/core` — latest `3.0.0`, develop `2.0.0-beta.11`
- `@reformer/cdk`, `@reformer/ui-kit`, `@reformer/renderer-react`, `@reformer/renderer-json` — на `1.0.0-beta.X`
- `@reformer/mcp` — latest `1.0.1`, develop `1.0.0-beta.12`

План: align на `3.0.0-beta.0` через [`align-versions.yml`](../.github/workflows/align-versions.yml). После этого все на `3.0.x` channel.

Дальше lockstep правила вступают в силу.

## Implementation references

- [`.github/workflows/release.yml`](../.github/workflows/release.yml) — обычный release (sequential matrix, по-package semantic-release).
- [`.github/workflows/align-versions.yml`](../.github/workflows/align-versions.yml) — align на единую версию (manual trigger, обходит semantic-release).
- [`packages/*/​.releaserc.json`](../packages) — semantic-release config per package; `tagFormat` управляет именами git tags.
