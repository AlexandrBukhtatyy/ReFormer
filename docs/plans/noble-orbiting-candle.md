# Публикация `reformer-builder` в npm как устанавливаемого dev-tool

## Context

Сейчас `reformer-builder` — приватный, неопубликованный Vite React SPA в `projects/reformer-builder/`
(`"private": true`, `"version": "0.0.0"`, без `bin`/`files`/`publishConfig`). Единственный канал его
«дистрибуции» — статический деплой на GitHub Pages под `/builder` (`deploy-docs.yml`). Пользователь хочет,
чтобы билдер можно было **поставить как dev-dependency и запускать через `npx` / `npm run`**, и чтобы он
**публиковался в npm**.

Ключевые факты, определяющие подход:

- Билдер — **чисто клиентский SPA**. Вся работа с файлами проекта идёт в браузере через **File System
  Access API** (`window.showDirectoryPicker`, Chromium-only). Серверной части нет. Основной режим («Mode B»)
  открывает папку проекта потребителя, редактирует JSON-схемы форм и пишет их обратно в исходники.
- Каталог компонентов **вкомпилируется в бандл на этапе сборки** (`src/catalog/contract.ts:19`
  `import uiKitCatalog from '@reformer/ui-kit/catalog'`). Prebuilt `dist/` самодостаточен.
- В репозитории **уже есть зрелый пайплайн публикации**: `semantic-release` + `semantic-release-monorepo`,
  по `.releaserc.json` на пакет, драйвится `.github/workflows/release.yml`. Секреты `NPM_TOKEN`/`GH_TOKEN`
  подключены, Node 22, ветки `main`→`latest`, `develop`→`-beta`. Прецедент публикуемого CLI —
  `@reformer/mcp` (`bin: { "reformer-mcp": "./dist/index.js" }`). Ничего с нуля строить не нужно —
  вписываемся в существующий паттерн.

**Итог подхода:** публикуем билдер как **prebuilt-SPA пакет с zero-dependency `bin`-launcher'ом**, который
поднимает локальный статик-сервер и открывает браузер. Всё приложение (React, Monaco, Radix, пять
`@reformer/*`, `ajv`) инлайнится Vite в `dist`, поэтому у опубликованного пакета **ноль runtime-зависимостей**.

## Решения (подтверждены пользователем)

- **Имя пакета:** `@reformer/builder` (scoped, в семействе `@reformer/*`). CLI-команда — `reformer-builder`.
- **Версионирование:** независимое, semantic-release выпускает первую версию `1.0.0` (с `develop` — `1.0.0-beta.1`).
  Выравнивание под 6.x семейства **не** делаем.

## Линчпин (обязательно к учёту)

Закоммиченный `projects/reformer-builder/dist/` собран с `BUILDER_BASE=/ReFormer/builder/` (Pages-сборка):
`index.html` ссылается на `/ReFormer/builder/assets/...`, а Monaco-воркеры (`editor.worker-*.js`,
`json.worker-*.js` — классические IIFE-воркеры) содержат **абсолютные** URL с этим base. Такой `dist`
**неработоспособен** при отдаче с `http://localhost:PORT/`.

→ **npm-артефакт обязан пересобираться с дефолтным `base: '/'`** (т.е. в CI-шаге сборки билдера для релиза
`BUILDER_BASE` НЕ выставляется). Тогда воркеры становятся `new Worker("/assets/...worker....js")` и корректно
отдаются root-статик-сервером. Клиентского роутера нет (`App` → `EditorLayout`, без `BrowserRouter`), поэтому
SPA-fallback тривиален.

## Изменения (execution-ready)

### 1. `projects/reformer-builder/package.json`
Зеркалить форму метаданных с `packages/reformer-mcp/package.json`.

- `"name"`: `reformer-builder` → **`@reformer/builder`**.
- Убрать `"private": true`.
- `"version"`: оставить `0.0.0` (semantic-release перезапишет).
- Добавить:
  - `"bin": { "reformer-builder": "./bin/reformer-builder.mjs" }`
  - `"files": ["dist", "bin", "README.md", "LICENSE"]`
  - `"engines": { "node": ">=18" }`
  - `"publishConfig": { "access": "public" }`
  - `"description"`, `"keywords"`, `"author": "Alexandr Bukhtatyy"`, `"license": "MIT"`,
    `"repository": { "type":"git", "url":"git+https://github.com/AlexandrBukhtatyy/ReFormer.git", "directory":"projects/reformer-builder" }`,
    `"bugs"`, `"homepage"` — по образцу mcp-пакета.
- **Перенести ВСЕ текущие `dependencies` в `devDependencies`** (react, react-dom, monaco, radix, tailwind,
  react-router-dom и пять `@reformer/*` с `"*"`). Обоснование: Vite инлайнит их в `dist` на сборке; у
  потребителя devDependencies зависимости не ставятся, `"*"`-диапазоны безвредны, in-monorepo сборка не
  ломается (`npm ci` ставит devDeps всех workspace'ов).
- **Добавить недостающий `"ajv": "^8.17.1"`** в `devDependencies` (импортируется в `src/catalog/contract.ts:14`,
  сейчас резолвится только через hoisting; `8.17.1` — уже стоящая в корне hoisted-версия).
- `prepack`/`prepublishOnly` НЕ добавлять (паритет с существующими пакетами; сборку делает CI).

### 1b. Пересобрать `package-lock.json` (КРИТИЧНО)
После правок п.1 обязательно `npm install` (из корня), чтобы обновить `package-lock.json`, и закоммитить его.
Причины: lockfile фиксирует dev/prod-разбивку по-пакетно (сейчас у `projects/reformer-builder` — `dependencies`
с 5 `@reformer/*`, станет `devDependencies`), плюс переименование меняет self-symlink ключ
(`node_modules/reformer-builder` → `node_modules/@reformer/builder`) и добавляется `ajv`. **Если lockfile не
пересобрать, `npm ci` в `test.yml`/`release.yml` упадёт** (strict-проверка соответствия lock ↔ package.json).
Проверка: `git diff --stat package-lock.json` показывает изменения; локально `npm ci` проходит.

### 2. Новый `projects/reformer-builder/bin/reformer-builder.mjs` (zero-dep Node ESM launcher)
Ответственности:
- Shebang `#!/usr/bin/env node`.
- Резолв упакованного `dist/`: `new URL('../dist/', import.meta.url)`. Если `dist/index.html` нет — понятная ошибка.
- Аргументы: `--port` (дефолт напр. 4321, при `EADDRINUSE` — следующий свободный), `--host` (дефолт `127.0.0.1`),
  `--no-open`, `--help`, `--version` (версию читать из своего `package.json`).
- Статик-сервер на `node:http` + `node:fs`: guard от path-traversal (запрет выхода за `distDir`), MIME-карта
  (`.js`/`.mjs`→`text/javascript`, `.css`→`text/css`, `.json`→`application/json`, `.svg`→`image/svg+xml`,
  `.ttf`→`font/ttf`, плюс `.woff2`/`.wasm`/`.map` на будущее).
- **SPA-fallback только для навигации:** отдаём `index.html`, если путь GET без расширения и не под `/assets/`.
  Реальный отсутствующий ассет → **404** (никогда не index.html), чтобы fetch воркера не получил HTML.
- После `listen`: печать URL + строка-предупреждение «Mode B (открыть папку проекта) требует Chromium-браузер
  (File System Access API)».
- Автооткрытие браузера (если не `--no-open`): `darwin`→`open`, `win32`→`cmd /c start ""`, иначе `xdg-open`,
  через `node:child_process`; сбой открытия не фатален.

### 3. Новый `projects/reformer-builder/.releaserc.json`
Копия любого из `packages/*/.releaserc.json`, отличается только `tagFormat`:

```json
{
  "extends": "semantic-release-monorepo",
  "branches": ["main", { "name": "develop", "prerelease": "beta" }],
  "tagFormat": "builder-v${version}",
  "plugins": [
    ["@semantic-release/commit-analyzer", { "preset": "conventionalcommits" }],
    ["@semantic-release/release-notes-generator", { "preset": "conventionalcommits" }],
    "@semantic-release/npm",
    "@semantic-release/github"
  ]
}
```

### 4. Новые `projects/reformer-builder/README.md` и `projects/reformer-builder/LICENSE`
- README: установка (`npm i -D @reformer/builder`), запуск (`npx reformer-builder [--port] [--no-open]`),
  оговорка про Chromium/Mode B, что это офлайн-SPA с вшитым каталогом `@reformer/ui-kit`.
- LICENSE: MIT, по образцу `packages/reformer/LICENSE` (нужен, т.к. указан в `files`).

### 5. `.github/workflows/release.yml`
- В `on.push.paths` добавить `- 'projects/reformer-builder/**'`.
- **После** цикла сборки 6 пакетов (перед «Fetch git notes») — новый шаг сборки билдера с дефолтным base:
  ```yaml
  - name: Build reformer-builder (npm base '/')
    run: npm run build -w @reformer/builder   # без BUILDER_BASE → base '/'
  ```
  Ставится после пакетов, т.к. `tsc -b`/`vite build` резолвят пять `@reformer/*` из их собранного `dist`.
- В массив release-цикла (последним, билдер зависит от всех) добавить:
  `"@reformer/builder:projects/reformer-builder"` — цикл сам делает `cd projects/reformer-builder && npx
  semantic-release` в fault-isolated `if(...)` с уже заданными `GITHUB_TOKEN`/`NPM_TOKEN`/`NODE_AUTH_TOKEN`,
  ничего дополнительно подключать не нужно.
- Связность: сбой сборки билдера в новом build-шаге прервёт весь release-джоб до публикации (как и для 6
  пакетов). Это соответствует существующей философии workflow («нельзя публиковать из несобранного», см.
  комментарий в `release.yml`), а тип-здоровье билдера и так гейтит релиз через `typecheck` — новый риск
  только в vite-build-специфичных сбоях, что редко.

### 6. Правка селекторов `-w`, сломанных переименованием
- `package.json` (root) `dev:builder`: `--workspace reformer-builder` → `--workspace @reformer/builder`.
- `.github/workflows/deploy-docs.yml` (шаг «Build builder», строка 63): `-w reformer-builder` → `-w @reformer/builder`.
  (Pages-сборка остаётся с `BUILDER_BASE=/ReFormer/builder/` — не трогаем.)

Это **единственные два** места, ломающихся переименованием (проверено grep'ом по имени). Всё остальное
ссылается на **путь** `projects/reformer-builder/` (typecheck `-p …/tsconfig.app.json`, триггеры/`cp` в
deploy-docs) и переименованием не задето. `commitlint.config.js:30` — это scope-enum (`'reformer-builder'`),
не имя пакета: оставляем как есть, релизные коммиты — `feat(reformer-builder): …` (scope path-based, semantic-release
это устраивает).

### Осознанно НЕ делаем
- В `test.yml` билдер отдельным build/test-шагом не добавляем: гейт **уже типизирует билдер** — `test.yml`
  прогоняет `npm run typecheck` (строка 120), а корневой `typecheck` включает
  `projects/reformer-builder/tsconfig.app.json`. То есть тип-здоровье билдера уже гейтит релиз (существующая
  связность). После переноса deps→devDeps билдер обязан по-прежнему проходить typecheck (devDeps ставятся при
  `npm ci`) — проверить локально `npm run typecheck`.
- В `align-versions.yml` билдер не добавляем (независимое версионирование).
- `@reformer/ui-kit`'s `component-catalog.json` вне `files` ui-kit — для prebuilt-билдера неважно (каталог уже
  вшит в бандл на сборке).

## Verification (локально, без публикации)

0. **Lockfile + типы:** после правок package.json — `npm install` (обновляет `package-lock.json`), затем
   `npm ci` проходит без ошибок и `npm run typecheck` зелёный (билдер по-прежнему типизируется).
1. **Сборка с npm-base:** `npm run build -w @reformer/builder` (убедиться, что `BUILDER_BASE` не выставлен).
   Проверить, что `projects/reformer-builder/dist/index.html` ссылается на `/assets/...` (а НЕ на
   `/ReFormer/builder/assets/...`) и `grep -o 'new Worker("[^"]*"' dist/assets/*.js` показывает `/assets/...worker...`.
2. **Содержимое тарбола:** из `projects/reformer-builder` — `npm pack --dry-run`. Убедиться, что внутри
   `dist/**`, `bin/reformer-builder.mjs`, `README.md`, `LICENSE`, `package.json` — и НЕТ `src/`, tsconfig,
   `node_modules`.
3. **Реальная установка bin:** `npm pack` → в свежей temp-папке `npm i -D <path-to-tarball>` → запуск
   `npx reformer-builder --no-open --port 4321`. Сервер поднимается, печатает URL.
4. **Smoke в браузере (Chromium):** открыть URL, редактор монтируется; открыть панель Monaco JSON — в
   DevTools/Network все `/assets/*.worker-*.js` дают 200 с `text/javascript`, запросов на `/ReFormer/builder/`
   нет. Можно прогнать через Playwright MCP (navigate + `browser_network_requests`, проверить отсутствие non-200
   на ассетах/воркерах). Скриншот — в `projects/react-playground-e2e/screenshots/builder-publish/`.
5. **Pages-канал не сломан:** `BUILDER_BASE=/ReFormer/builder/ npm run build -w @reformer/builder` по-прежнему
   даёт subpath-сборку.

## Notes / pitfalls

- **Первый релиз требует релизного коммита**, затрагивающего `projects/reformer-builder/**` с типом
  `feat:`/`fix:` (scope `reformer-builder`) — иначе semantic-release-monorepo напишет «no release needed».
  С `develop` первая версия будет `1.0.0-beta.1`, с `main` — `1.0.0`.
- Публикация выполняется **автоматически** при merge в `develop`/`main` (не нужен ручной `npm publish`).
  Опубликованный манифест сохранит `devDependencies` с `"*"` — косметически необычно, но безвредно
  (devDeps зависимости у потребителя не ставятся).
- **Dist-tag:** до первого релиза в `main` тега `latest` нет — с develop публикуется под dist-tag `develop`
  (`1.0.0-beta.x`). Значит `npm i -D @reformer/builder` (без тега = `latest`) заработает только после merge в
  `main`; до этого — `npm i -D @reformer/builder@develop`. Это стоит отразить в README.
- Rename безопасен: ни один исходник в репо не импортирует пакет по имени `reformer-builder` (проверено grep'ом),
  ломаются только 2 workspace-селектора `-w` (п.6).
- Триггер `release.yml` теперь срабатывает и на builder-only пуши — 6 пакетов в таком ране просто получат
  «no release needed» (fault-isolated). Приемлемый оверхед.
- `postinstall: patch-package` в корне на потребителя не влияет (корневой `package.json` не публикуется).
