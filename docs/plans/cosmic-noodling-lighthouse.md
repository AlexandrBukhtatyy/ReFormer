# Клиент `@reformer/builder` собранным, прод-сборка приложения — с заглушкой

Задача ReFormer-t51r, пункты 1 и 3 (пункт 2, пространство имён хранилищ, закрыт ReFormer-uwhq,
коммит `9dba78ed`).

## Контекст

Встраивание билдера в приложение работает только внутри монорепозитория. В реестре
`@reformer/builder@3.0.0-beta.14` нет ни `exports`, ни `vite/`, ни `src/client`: правка
`files`/`exports` от 9 октября (839a5524) не уехала, потому что релизный шлюз CI был красным.
А то, что лежит в репозитории, тоже не годится для потребителя: `exports["."]` указывает
на сырой `src/index.ts`, объявлений типов никто не эмитит, peer-зависимостей нет, и без
плагина dev-сервера клиент всё равно целиком уезжает в прод-бандл приложения (вместе
с чтением `sessionStorage` на уровне модуля), хотя там он только рисует детей.

**Решено с пользователем:** прод-сборку чистит плагин. `reformerBuilder()` возвращает два плагина:
прежний serve и новый build, который псевдонимом ведёт `@reformer/builder` на заглушку
`@reformer/builder/noop` с тем же API. Не условия `exports` (ломаются от `NODE_ENV=development`
в `.env` и от своих `resolve.conditions` у приложения).

Факты, на которых стоит план (проверены):

- Клиент `src/client/` чистый: только `react` и соседи, без `@/`, CSS и `react-dom`; ESLint
  это запрещает (`eslint.config.js:82-109`). Компилируется по образцу `@reformer/cdk`
  (Vite lib mode + `vite-plugin-dts` 4.5.4, уже поднят в корень).
- `vite/plugin.mjs` целиком `apply: 'serve'` (L194-195); Vite 7.2.6 разворачивает массивы
  плагинов, фильтрует `apply` до `config`-хуков, а псевдоним на голый спецификатор дорезолвит
  сам через `this.resolve(…, { skipSelf: true })` (`vite/dist/node/chunks/config.js:8141-8150`).
- Сборка SPA пишет в `dist/` с `emptyOutDir`, `dist/` раздают лаунчер и плагин — клиент туда
  класть нельзя. В lib-режиме `copyPublicDir` остаётся `true` (есть `public/vite.svg`).
- Образец packaging-smoke: `packages/reformer-mcp/scripts/check-packaging.mjs` (песочница
  в `os.tmpdir()`, npm через `npm_execpath`, чистый `env`), чистка `env` —
  `packages/reformer-ui-kit/scripts/check-subpaths.mjs:52-56`.
- Релиз: semantic-release по conventional commits, changesets нет; `feat(reformer-builder)`
  на `develop` даст `3.0.0-beta.15`; `ci:`/`docs:` релиз не запускают.
- `required-builds.json` e2e знает только `packages/*`; `serve-host.mjs` правим напрямую.
- Корневые `npm run lint`/`format:check` (CI) увидят собранный `client/` — нужны игноры.

## Шаги

### 1. Вход клиента и заглушка (`projects/reformer-builder/src/client/`)

- **`src/client/index.ts`** (новый) вместо `src/index.ts` (удалить; больше его никто не импортирует,
  кроме `package.json` и `docs/project-structure.md:49,242`): шапка из `src/index.ts:1-24`
  с поправкой «клиент едет собранным, `client/`», экспорты те же три:
  `ReformerBuilder`, типы `ReformerBuilderLabels`, `ReformerBuilderProps` из `./ReformerBuilder`,
  `FormModuleLoader` из `./FormStand`.
- **`src/client/noop.ts`** (новый, именно `.ts`): `createElement(Fragment, null, props.children)`
  из `react`, чтобы не тянуть `react/jsx-runtime`; `export type` трёх типов из настоящих модулей
  (с `verbatimModuleSyntax` стираются, в сборке от клиента не остаётся ни байта); никаких
  побочных действий на уровне модуля. Шапка: зачем заглушка и кто её подставляет.
- Шапка `src/client/ReformerBuilder.tsx:11-16`: одна фраза про собранный клиент и заглушку.

### 2. Сборка клиента

- **`tsconfig.client.json`** (новый): `extends ../../tsconfig.json`; `lib ES2022/DOM/DOM.Iterable`,
  `jsx react-jsx`, `types: []`, `skipLibCheck`, `verbatimModuleSyntax`, `isolatedModules`,
  `noEmit: false`, `declaration` + `emitDeclarationOnly`, `declarationDir`/`outDir: client`,
  `rootDir: src/client`; `include: ["src/client"]`, `exclude` тестов (они тянут `vitest/browser`
  и `@/testing/render`). В `tsconfig.json` `references` **не** добавлять: эмитит его только dts.
- **`vite.client.config.ts`** (новый, по образцу `packages/reformer-cdk/vite.config.ts`):
  `react()` + `dts({ tsconfigPath: './tsconfig.client.json', entryRoot: 'src/client', exclude: TEST_FILES })`;
  `publicDir: false`; `build.outDir: 'client'`, `emptyOutDir: true`,
  `lib.entry { index: src/client/index.ts, noop: src/client/noop.ts }`, `formats: ['es']`,
  `rollupOptions.external` предикат `/^react($|\/)/`, `/^react-dom($|\/)/`
  (как `packages/reformer-form-registry/vite.config.ts:20-25`), `output.entryFileNames '[name].js'`.
  Ожидаемый выход: `client/{index,noop}.js` и `.d.ts` на каждый модуль клиента.
- `tsconfig.node.json:23` — добавить `vite.client.config.ts` в `include`, чтобы `tsc -b` его типизировал.
- `package.json` scripts: `build:client: vite build -c vite.client.config.ts`;
  `build: tsc -b && vite build && npm run build:client` (release.yml:84-89 и deploy-docs.yml:83-88
  без правок); `check:packaging: node scripts/check-packaging.mjs`.
  devDependencies: `vite-plugin-dts ^4.5.4`; затем `npm install` в корне (lock-файл).
- `projects/reformer-builder/.gitignore`: строка **`/client`** с якорем (голый `client` скрыл бы
  `src/client/`), комментарий про `build:client`.

### 3. Манифест публикации (`projects/reformer-builder/package.json`)

```json
"main": "./client/index.js", "module": "./client/index.js", "types": "./client/index.d.ts",
"exports": {
  ".":      { "types": "./client/index.d.ts", "import": "./client/index.js" },
  "./noop": { "types": "./client/noop.d.ts",  "import": "./client/noop.js" },
  "./vite": { "types": "./vite/plugin.d.mts", "default": "./vite/plugin.mjs" },
  "./runtime-config.schema.json": "./runtime-config.schema.json",
  "./package.json": "./package.json"
},
"sideEffects": false,
"files": ["dist", "bin", "vite", "client", "application-plugins.embedded.json",
          "runtime-config.schema.json", "README.md", "LICENSE"],
"peerDependencies": { "react": "^18.0.0 || ^19.0.0", "vite": "^6.0.0 || ^7.0.0" },
"peerDependenciesMeta": { "vite": { "optional": true } }
```

Из `files` уходят `src/index.ts`, `src/client` и их `!…test` (L22-25). `react-dom` не peer:
клиент его не импортирует (`dedupe` в плагине — подсказка резолверу, не импорт); принцип
репозитория — объявлять то, что dist реально импортирует. `vite` необязателен: лаунчер
`npx reformer-builder` работает без него. `check:peer-ranges` сканирует и `projects/*`:
верхние границы есть.

### 4. Плагин Vite — два плагина (`vite/plugin.mjs`, `vite/plugin.d.mts`)

- Рядом с `HOST_BRIDGE_ID` (L82): `CLIENT_ID = /^@reformer\/builder$/` (в точности: `/vite`
  и `/noop` под подмену не попадают) и `CLIENT_NOOP_ID = '@reformer/builder/noop'`; фабрика
  `productionStub()` → `{ name: 'reformer-builder:production', apply: 'build',
  config: () => ({ resolve: { alias: [{ find: CLIENT_ID, replacement: CLIENT_NOOP_ID }] } }) }`.
  `enforce` не нужен: alias вливается в `resolve.alias` конфига, плагинный встаёт перед
  пользовательскими (`mergeAlias`).
- `reformerBuilder()` (L178-328): прежний объект → `const devServer = {…}; return [devServer, productionStub()]`;
  JSDoc `@returns {import('vite').Plugin[]}`. Шапка (после L14): раздел «Два плагина:
  dev-сервер и прод-сборка». `productionStub` не экспортировать — тестируем через фабрику.
- `plugin.d.mts:30-31`: `reformerBuilder(options?): Plugin[]`, doc про `serve` и `build`.

### 5. Игноры собранного `client/`

Корневой `eslint.config.js` (`globalIgnores`, L86-108) — `projects/reformer-builder/client`;
`projects/reformer-builder/eslint.config.js:140` — `globalIgnores(['dist', 'client'])`;
корневой `.prettierignore` — `projects/reformer-builder/client/`.

### 6. Packaging smoke — `projects/reformer-builder/scripts/check-packaging.mjs` (новый)

Скелет из `packages/reformer-mcp/scripts/check-packaging.mjs` (`run()`, `pack()`, песочница,
`try/finally rmSync`, пробник системным `node` с `cwd = consumer`), `cleanEnv` — из ui-kit.

0. Предусловия до `npm install`: `dist/index.html`, `dist/plugins/index.json`,
   `client/{index,noop}.{js,d.ts}` — иначе выход 1 с подсказкой, какие сборки запустить.
1. `npm pack` билдера → `tarballs/`.
2. `consumer/package.json`: `@reformer/builder: file:<tgz>`, `react`, `react-dom`, `vite`,
   `@vitejs/plugin-react`, `@types/react`, `@types/node` — диапазоны из `devDependencies`
   самого билдера (то, против чего он собран); `npm install --no-audit --no-fund`.
3. Раскладка установленного пакета (fs): есть `vite/plugin.mjs`, `vite/plugin.d.mts`,
   `client/*`, `dist/index.html`, `dist/plugins/index.json`, `bin/reformer-builder.mjs`;
   **нет** `src/`; `client/noop.js` не содержит `ReformerBuilder.js`.
4. `smoke.mjs` в песочнице: `import('@reformer/builder')` и `/noop` — `ReformerBuilder`
   функция, наборы экспортов равны; `import('@reformer/builder/vite').reformerBuilder()` —
   массив из двух с именами `reformer-builder`/`reformer-builder:production`, `apply`
   `serve`/`build`.
5. Прод-сборка приложения: `index.html` + `src/main.jsx` (`<ReformerBuilder><div>smoke</div></ReformerBuilder>`)
   + `vite.config.mjs` с `reformerBuilder()`; `vite` бинарник через `createRequire(consumer/package.json)`
   (приём `serve-host.mjs:86-89`). Маркер `data-reformer-builder`: отсутствует во всех
   `dist/assets/*.js`, присутствует в `node_modules/@reformer/builder/client/index.js`.
   Отрицательный контроль: сборка с `SMOKE_WITHOUT_PLUGIN=1` (конфиг без плагина) обязана
   содержать маркер — исключает именно псевдоним, а не tree-shaking.
6. Типы: `types-probe.ts` импортирует оба входа и `/noop`, использует `ReformerBuilderProps`
   и `reformerBuilder({ ui: 'dist' })`; `tsc` монорепо (`createRequire(repoRoot/package.json)
   .resolve('typescript/package.json')` → `bin/tsc`) с `--noEmit --strict --module esnext
   --moduleResolution bundler --target es2022 --lib es2022,dom --jsx react-jsx --skipLibCheck --types node`.
7. Лаунчер не пробуем: покрыт `launcher.test.ts` и `test:e2e:dist`.

Бюджет ≈ 1–2 мин (pack ~10 с из-за `dist/plugins`, install ~30 с, две сборки, tsc).
Windows-safe: только `execFileSync` с массивами аргументов.

CI (`.github/workflows/test.yml`, **отдельным `ci`-коммитом**, после `feat`): шаг
«Builder packaging smoke» после «Плагины приложения — рядом со сборкой билдера» (L216-224)
и до «Run @reformer/builder tests» (L226): `npm run check:packaging -w @reformer/builder`.

### 7. Тесты

| Файл | Кейсы |
| --- | --- |
| `src/shell/embedded/vite-plugin.test.ts` (новый, node; импорт как в `vite-endpoints.test.ts:23`, переменные окружения не нужны) | массив из двух, имена, `apply`; у serve-плагина есть `configureServer`/`transformIndexHtml`/`resolveId`/`load` и `config()` → dedupe; у build-плагина `config()` даёт один alias с `replacement '@reformer/builder/noop'`, `find` матчит `@reformer/builder` и не матчит `/vite`, `/noop`, `@reformer/builder-plugin-api`; два вызова фабрики — разные объекты |
| `src/client/noop.test.ts` (новый, node) | `ReformerBuilder({children:'x'})` → `type === Fragment`, `props.children === 'x'`; без детей валиден; паритет `Object.keys(import('./index'))` и `./noop` (в node `browserModeStorage()` отдаёт null, импорт безопасен); после импорта noop нет `Symbol.for('reformer.builder.shell-frame')` на `globalThis` |
| существующие браузерные тесты клиента | без изменений |
| `npm run typecheck -w reformer-builder-host-example` | после `build:client` резолвит `client/index.d.ts` |
| `check:packaging` | тарбол: exports, files, типы, исключение из прод-сборки |
| `test:e2e:embedded` / `:dist` (локально) | dev-сценарий целиком через workspace-симлинк |

### 8. Эргономика в монорепо

- `projects/reformer-builder-host-example/package.json:8`: `predev` += `&& npm run build:client -w @reformer/builder`;
  новый `prebuild` с той же сборкой (прод-сборка образца резолвит `/noop` → `client/noop.js`).
  README «Запуск» (L17-21): `typecheck` тоже требует `client/`.
- `projects/reformer-builder-playground-e2e/tests/embedded/shared/serve-host.mjs` шаг 2 (L60-62):
  всегда `npm('run build:client -w @reformer/builder')` для обоих режимов (`source` и `dist`):
  приложение импортирует клиент независимо от того, откуда отдаётся интерфейс. Шапка L8-9
  и README e2e (L100-102) — соответственно.

### 9. Документация

| Файл | Правка |
| --- | --- |
| `projects/reformer-builder/README.md` | L36 «не публикуется» → `npm i -D @reformer/builder` (`@beta` для prerelease), peer'ы react 18/19 и vite 6/7; после L84 абзац «Прод-сборка»: плагин подменяет клиент заглушкой, билдер в бандл не попадает никогда; L139-141 (заглушка в прод, без плагина — одно приложение; про хранилище — адрес один, но у билдера своё пространство имён) |
| `projects/reformer-builder/docs/embedding.md` | L74-80 таблица плагина — два плагина; L149 строка таблицы — «прод-сборка с плагином: заглушка, только приложение»; L153-154 исправить неточность (клиент едет собранным, в прод-сборке нет и клиента); L166-167 дополнить; L188, L191 («Клиент — `src/client/`, сборка `client/`»); L365-367 убрать «Публикации клиента»; L370 «Как проверяется» — `vite-plugin.test.ts`, `noop.test.ts`, `check-packaging.mjs` |
| `projects/reformer-builder/docs/project-structure.md` | L39, L48-49, дерево L231-242 (`client/index.ts`, `noop.ts`, нет `src/index.ts`), конфиги `vite.client.config.ts`/`tsconfig.client.json` |
| `projects/reformer-builder-host-example/README.md` | L17-21, L88-94 |
| `docs/guides/release-and-publishing.md` | таблица L7-14 — строка `@reformer/builder` / `builder-v${version}`; L84-85 — `projects/reformer-builder/**` тоже релизит (release.yml:22-28). Отдельный `docs`-коммит |
| `projects/reformer-builder/docs/decisions-log.md` | запись «Клиент — собранным, прод-сборка — с заглушкой»: вступление с ReFormer-t51r и фактом про beta.14; 🔀 псевдоним, а не условие `exports`; 🔀 два плагина из одной фабрики; 🔀 `client/`, а не `dist/`; 🔀 `react-dom` не peer; ⚠️ `copyPublicDir` в lib-режиме; ⚠️ `/client` с якорем; ⚠️ линтеры над сборкой; «Проверка:» |

### 10. Коммиты (по просьбе пользователя, не раньше)

1. `feat(reformer-builder): клиент едет собранным, прод-сборка приложения — с заглушкой` —
   шаги 1–5, скрипт 6, 7, 8, 9 (кроме guides), `package-lock.json`; `Refs: ReFormer-t51r`.
2. `docs(docs): билдер в таблице пакетов и путях релиза`.
3. `ci(ci): packaging smoke билдера` — строго после (1).

После зелёного CI на `develop` выйдет `3.0.0-beta.15`; проверка из реестра:
`npm view @reformer/builder@beta exports files peerDependencies`,
`npm pack @reformer/builder@beta --dry-run` (есть `client/`, `vite/`, `dist/plugins/`, нет `src/`).

## Проверка

```bash
cd projects/reformer-builder
npx tsc -b                                           # noop.ts, index.ts, vite.client.config.ts
npm run build                                        # dist/ и client/
npm run plugins:dist -w reformer-builder-playground && npm run build:plugins   # dist/plugins (из корня)
npm run lint && (cd ../.. && npm run format:check)   # client/ в игнорах
npm test && npm run test:browser
npm run check:packaging                              # песочница вне репозитория
cd ../.. && npm run typecheck -w reformer-builder-host-example
npm run build -w reformer-builder-host-example && grep -rl "data-reformer-builder" projects/reformer-builder-host-example/dist/assets   # пусто
npm run test:e2e:embedded -w reformer-builder-playground-e2e
git status --porcelain projects/reformer-builder     # client/ не в статусе
```

## Риски

- **Псевдоним на голый спецификатор**: Vite дорезолвит через `exports`; регулярка с `$`
  исключает петлю через `/noop`. Покрыто unit-тестом и сборкой в smoke.
- **`tsc -b` и новый tsconfig**: `tsconfig.client.json` не в `references`; `src/client/*`
  проверяет `tsconfig.app.json`, конфиг — `tsconfig.node.json`.
- **`emptyOutDir` SPA**: чистит только `dist/`; `client/` — другой `outDir`.
- **`sideEffects: false`** и модульные `createModeStore`/`createReloadHold`: достижимы только
  из `ReformerBuilder.tsx`, чьи экспорты используются; в прод-сборке заменены заглушкой.
- **Workspace-симлинк**: `@reformer/builder` теперь `client/index.js`, без сборки его нет —
  закрыто `predev`/`prebuild` образца и шагом в `serve-host.mjs`; `resolveUi('auto')`
  по-прежнему видит `src/main.tsx` и отдаёт интерфейс из исходников.
- **Реестр в CI**: установка react/vite в песочницу ~30 с; при росте сужать предусловия,
  но не убирать `dist` из `files`.
