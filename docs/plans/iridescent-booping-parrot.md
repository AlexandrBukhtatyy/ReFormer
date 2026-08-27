# Open-core: приватный репозиторий для платных пакетов

## Context

`AlexandrBukhtatyy/ReFormer` — публичный репозиторий под MIT, из него публикуются 8 пакетов
(`@reformer/core`, `cdk`, `renderer-react`, `ui-kit`, `renderer-json`, `form-registry`, `mcp`,
`builder`). Задача — начать разрабатывать **новые** платные пакеты так, чтобы их исходники не
попадали в публичный репозиторий, при этом:

- существующие 8 пакетов остаются публичными и MIT — модель open-core, ядро продолжает расти;
- публичный CI, `package-lock.json` и опыт внешних контрибьюторов **не деградируют**;
- канал дистрибуции платных пакетов (приватный registry vs публичный npm + лицензионный ключ)
  остаётся не выбранным и не зашивается в раскладку;
- локальная разработка pro-пакетов идёт по живым исходникам ядра, без ожидания публикации беты.

Ключевые факты репозитория, на которых строится решение (проверены):

- npm workspaces: `packages/*`, `packages/ui-kits/*`, `projects/*`; один корневой lock-файл.
- Связи между `@reformer/*` — `peerDependencies: "*"` (гейт `check:peer-ranges` это **требует**).
  Значит pro-пакет подключается к ядру без version-lock, ровно как публичные пакеты друг к другу.
- Точки расширения для open-core **уже существуют и публичны**: `defineRegistry` /
  `composeRegistries` с parent-chaining ([component-registry.ts](../../packages/reformer-renderer-json/src/registry/component-registry.ts)),
  пользовательские behavior-операторы объявлены равноправными встроенным
  ([behaviors/index.ts](../../packages/reformer/src/form/behaviors/index.ts)), валидаторы —
  обычные функции с subpath-экспортами, `createFormRegistry` + `ConflictPolicy` в form-registry.
- В репозитории уже есть прецедент приватного workspace: `packages/ui-kits/reformer-hexa-ui`
  (`private: true`, проприетарная зависимость Kaspersky).

## Решение: инвертированное вложение

Два репозитория. Приватный — **корень npm-воркспейса**, публичный клонируется внутрь него в
`oss/` (в `.gitignore` приватного репо).

```
ReFormer-pro/                  ← приватный репозиторий, КОРЕНЬ npm
├─ oss/                        ← gitignored клон публичного ReFormer (полноценный git-чекаут)
│  ├─ packages/…               ← @reformer/core, cdk, … (исходники, не npm-тарболы)
│  └─ projects/…
├─ packages/
│  └─ <pro-pkg>/               ← @reformer-pro/<pro-pkg>
├─ projects/
│  └─ playground-pro/          ← превью pro-фич (oss/projects/* трогать нельзя — это публичные файлы)
├─ package.json                ← workspaces спанит оба дерева
├─ package-lock.json           ← свой; публичный lock не затрагивается вообще
├─ eslint.config.js            ← re-export из oss + правила pro
├─ tsconfig.json               ← extends ./oss/tsconfig.json
├─ commitlint.config.js        ← re-export из oss
├─ LICENSE                     ← проприетарная
└─ scripts/setup-oss.mjs       ← клонирует/обновляет oss/
```

`ReFormer-pro/package.json`:

```jsonc
{
  "workspaces": [
    "oss/packages/*",
    "oss/packages/ui-kits/*",
    "oss/projects/*",
    "packages/*",
    "projects/*"
  ],
  "scripts": {
    "postinstall": "patch-package --patch-dir oss/patches"
  }
}
```

### Почему вложение именно в эту сторону

Интуитивный вариант — клонировать приватный репо внутрь публичного (`ReFormer/pro/`) и добавить
`pro/packages/*` в корневые workspaces — ломается о npm-специфику:

- npm ведёт **один** lock-файл на корень. Любой `npm install` у разработчика с `pro/` вписал бы
  pro-пакеты в публичный `package-lock.json`. Закоммитить его нельзя (утечка имён + публичный
  `npm ci` упал бы: lock ссылается на отсутствующий workspace), а обновлять публичные зависимости
  без коммита lock-файла невозможно.
- `npm ci` у такого разработчика перестаёт работать вовсе: lock из git не содержит pro-воркспейсов,
  которые присутствуют на диске. Паритет с CI теряется локально.

Инверсия убирает обе проблемы структурно, а не гейтом: публичный `package.json` и
`package-lock.json` **не меняются ни на байт**, публичный `npm ci` продолжает работать в чистом
клоне, и физически нет способа записать pro-зависимость в публичный lock. При этом сохраняются все
плюсы вложенности: один `npm install`, один `node_modules` (значит одна копия React /
`@preact/signals-core` — критично, см. `dedupe` в
[react-playground/vite.config.ts:23-35](../../projects/react-playground/vite.config.ts#L23-L35)),
живые исходники ядра, атомарная отладка сквозных изменений.

Публичная работа при этом не требует второго чекаута: `oss/` — обычный git-чекаут, коммиты и пуши
в публичный репозиторий делаются прямо из него.

## Именование и npm scope

Отдельный scope **`@reformer-pro/*`**, не `@reformer/pro-*`.

Причина техническая и решающая для отложенного выбора дистрибуции: маршрутизация в `.npmrc`
работает по scope. `@reformer-pro:registry=https://…` направит в приватный registry **только**
платные пакеты, а публичные продолжат ставиться с npmjs. При общем scope переключение registry
захватило бы и публичные пакеты — потребители потеряли бы `@reformer/core` без токена.

Scope одинаково пригоден для обоих сценариев: приватный registry (npm paid org / GitHub Packages /
Verdaccio) и публичный npm + лицензионный ключ. Единственная точка смены канала —
`publishConfig.registry` в `package.json` pro-пакета.

Перед стартом: проверить, свободна ли организация `reformer-pro` на npm.

## Границы: чем pro расширяет ядро, не форкая его

Правило: **pro-пакет не патчит ядро**. Если механизма расширения не хватает — сначала PR в
публичный репозиторий, добавляющий seam, затем pro-реализация поверх него. Обратный порядок
приводит к форку ядра, который придётся вечно ребейзить.

Уже доступные seam'ы:

| Что расширяем           | Публичный API                                     | Где                                                |
| ----------------------- | ------------------------------------------------- | -------------------------------------------------- |
| Компоненты рендерера    | `defineRegistry`, `composeRegistries`             | `@reformer/renderer-json`                           |
| Поведения формы         | `defineFormBehavior`, `effect`, `onChange`, `getScope` | `@reformer/core/behaviors`                     |
| Валидаторы              | обычные функции, subpath-экспорты                 | `@reformer/core/validators/*`                       |
| Реестр форм микрофронтов| `createFormRegistry`, `ConflictPolicy`            | `@reformer/form-registry`                           |

Манифест pro-пакета повторяет конвенцию публичных: `@reformer/*` — только в `peerDependencies`
со значением `"*"` (иначе потребитель не поставит `@beta` без `--legacy-peer-deps`), `react` /
`react-dom` — диапазонами, как в существующих пакетах.

## Что закрыть от утечки

Раскладка защищает исходники, но вокруг публичного репозитория есть каналы, через которые
приватный roadmap утекает текстом. Требуют явного правила в `CLAUDE.md`/`AGENTS.md` обоих репо:

1. **`.beads/issues.jsonl` трекается в git и публичен.** Задачи по pro заводить только в beads-БД
   приватного репозитория; в публичном не упоминать ни в issue, ни в `bd remember`.
2. **`docs/plans/*.md` и `docs/specs/` публичны.** Планы и спеки pro-фич — только в приватном репо.
3. **Сообщения коммитов** публичного репо не должны раскрывать pro-фичи. Добавление seam'а
   формулируется как самостоятельное улучшение публичного API — чем оно и является.
4. **`oss/` обязан быть в `.gitignore` приватного репо** — иначе публичные исходники попадут в
   приватную историю (не утечка, но неразбираемый мусор и конфликты).

Лицензионная сторона: MIT позволяет использовать код публичного репозитория (включая вклад внешних
контрибьюторов) в проприетарных пакетах, CLA для этого не требуется. Стоит зафиксировать в
`CONTRIBUTING.md` одну строку о том, что проект развивается по модели open-core. Каждый pro-пакет
несёт собственный `LICENSE`; при копировании кода из публичного репо — сохранять MIT-нотис.

## Порядок внедрения

### Этап 1 — скелет приватного репозитория

Создать приватный репо `ReFormer-pro` со структурой выше. Файлы, требующие внимания:

- `package.json` — workspaces спанят оба дерева; `postinstall: patch-package --patch-dir oss/patches`
  (в публичном репо есть `patches/semantic-release-monorepo+8.0.2.patch`, а `patch-package` по
  умолчанию ищет `./patches` относительно корня).
- `eslint.config.js` — `export { default } from './oss/eslint.config.js'` плюс блоки для `packages/*`
  приватного репо. Глобальные ignore публичного конфига (`**/dist`, `**/node_modules`, …)
  наследуются как есть.
- `tsconfig.json` — `"extends": "./oss/tsconfig.json"`.
- `commitlint.config.js` — re-export публичного, чтобы конвенция коммитов не разъехалась;
  scope-список дополнить именами pro-пакетов.
- `.husky/` — свои хуки для приватного репо. Отдельно: после первого `setup-oss` выполнить
  `npx husky` **внутри `oss/`** — иначе публичные `commit-msg`/`pre-commit`/`pre-push` не
  активируются (в `oss/` мы никогда не запускаем `npm install`, а значит и `prepare: husky`).
- `scripts/setup-oss.mjs` — клонирует публичный репо в `oss/`, если его нет; при наличии делает
  `git fetch`. Печатает предупреждение, если обнаружил `oss/node_modules` (второй `node_modules`
  ломает дедупликацию singleton-рантаймов).
- `.gitignore` — `/oss/`, `node_modules`, `dist`.

### Этап 2 — первый pro-пакет и сквозная проверка

Создать `packages/<pro-pkg>/` с минимальным содержимым (одна фича или даже один экспорт) и
`projects/playground-pro/` для превью. В `vite.config.ts` playground'а скопировать блок `dedupe`
из [react-playground/vite.config.ts:23-35](../../projects/react-playground/vite.config.ts#L23-L35) —
причина та же (`instanceof Signal`, контекст Radix).

Тест-скрипт pro-пакета переиспользует общий враппер:
`"test": "node ../../oss/scripts/run-vitest.mjs"` (обходит зависание vitest 4.0.x).

Цель этапа — доказать цикл: `npm install` → сборка ядра из `oss/` → сборка и тесты pro → рендер
pro-компонента в playground'е.

### Этап 3 — CI приватного репозитория

Workflow воспроизводит локальную раскладку двумя checkout-шагами: приватный репозиторий в корень
workspace (`path` по умолчанию), публичный — в `oss/` (`actions/checkout` с `path: oss`). Оба пути
внутри workspace, поэтому относительные ссылки (`oss/patches`, `oss/scripts/run-vitest.mjs`,
`./oss/eslint.config.js`) в CI и локально совпадают.

Шаги: `npm ci` → сборка пакетов `oss/` в топологическом порядке (тот же список, что в
[release.yml](../../.github/workflows/release.yml): core → cdk → renderer-react → ui-kit →
renderer-json → form-registry → mcp) → сборка и тесты pro-пакетов.

Ветка публичного репо для checkout — `develop` по умолчанию, с возможностью переопределить входом
workflow. Побочная польза: приватный CI ловит поломки ядра раньше публичного релиза.

Релиз pro-пакетов — `semantic-release` по образцу
[packages/reformer/.releaserc.json](../../packages/reformer/.releaserc.json), но с
`publishConfig.registry` как единственной точкой выбора канала.

### Этап 4 — правила против утечки

Внести раздел «Open-core: что не пишем в публичный репозиторий» в `CLAUDE.md` и `AGENTS.md` обоих
репозиториев (пункты 1–4 выше) и строку об open-core в публичный `CONTRIBUTING.md`.

### Этап 5 — дистрибуция (отложено)

Решение по каналу принимается позже; к этому моменту оно сводится к правке `publishConfig` и
`.npmrc`-инструкции для клиентов. Раскладка менять не потребуется.

## Изменения в публичном репозитории

По этой схеме — **ни одного обязательного**. Опционально и вне критического пути:

- [CONTRIBUTING.md](../../CONTRIBUTING.md) — строка об open-core модели.
- [CLAUDE.md](../../CLAUDE.md) — раздел с правилами против утечки roadmap.

Расширения публичного API (seam'ы) добавляются обычными PR по мере надобности — как самостоятельные
улучшения, а не как «подготовка к pro».

## Верификация

Порядок проверок от дешёвых к дорогим; каждая ловит свой класс ошибки.

1. **Публичный репозиторий не задет.** В чистом клоне `ReFormer`:
   `git status --porcelain` пусто, `npm ci` проходит, `npm run lint && npm run format:check`
   зелёные. Это главный инвариант схемы — он должен остаться верным после всех этапов.
2. **Один установочный корень.** В `ReFormer-pro/`: `npm ls @reformer/core` показывает symlink
   на `oss/packages/reformer`; `ls oss/node_modules` — отсутствует. Появление `oss/node_modules`
   означает, что кто-то запустил `npm install` внутри `oss/`, и singleton-рантаймы задвоятся.
3. **Одна копия React и сигналов.** `npm ls react @preact/signals-core` из приватного корня —
   ровно по одной резолюции (дедуп проверяется до запуска UI, а не по симптому «hooks error»).
4. **Сборка ядра из исходников.** Из `ReFormer-pro/`: `npm run build -w @reformer/core` и далее по
   топологическому списку. Артефакты появляются в `oss/packages/*/dist`.
5. **Pro собирается и тестируется поверх собранного ядра.**
   `npm run build -w @reformer-pro/<pkg> && npm run test -w @reformer-pro/<pkg>`.
6. **Peer-конвенция соблюдена.** `npm run check:peer-ranges` из `oss/`-скриптов, применённый к
   pro-манифестам: `@reformer/*` — строго `"*"`, внешние peer'ы — закрытыми диапазонами.
7. **Рантайм-проверка.** `npm run dev -w playground-pro`, pro-компонент рендерится и реагирует на
   ввод. Это единственная проверка, ловящая задвоение контекста Radix и `instanceof Signal`.
8. **Изоляция публикации.** `npm pack -w @reformer-pro/<pkg>` и проверка, что в тарболе нет
   исходников `@reformer/*` (они peer, а не bundled) и присутствует проприетарный `LICENSE`.
9. **Отсутствие утечки.** В публичном репозитории `git log --oneline -20` и
   `grep -ri "<pro-pkg>" .beads/issues.jsonl docs/` — пусто.
