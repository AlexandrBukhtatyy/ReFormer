# QuickJS для компиляции форм в браузере: разбор и рекомендация

## Context

Вопрос пользователя: что сейчас компилирует формы в браузере (builder, превью формы) и даст ли
что-нибудь QuickJS. Ниже — как устроено сейчас, что QuickJS может и чего не может, и что
рекомендуется сделать вместо него.

## Что делаем (решение пользователя)

**Шаг 1 — завести три задачи в beads** (`bd create`, без коммита и экспорта; синхронизация
`issues.jsonl` — только по просьбе пользователя). Порядок задан приоритетом, жёстких зависимостей
нет — задачи технически независимы:

| # | Заголовок | Тип | Приоритет | Суть |
| - | --------- | --- | --------- | ---- |
| 1 | builder: эксперимент — sucrase вместо typescript для транспиляции в браузере | task | P1 | второй `Transpiler` за флагом, тест эквивалентности на примерах форм, замеры чанка и холодной компиляции; решение по итогам замеров |
| 2 | builder: защита превью от зависания кода формы | task | P2 | проектный документ: бесконечный цикл или утечка памяти в файле формы вешают вкладку; сравнить QuickJS, Worker, сторожевой таймер с учётом требования «один экземпляр сигналов и React»; без кода |
| 3 | Code Mode: песочница QuickJS в браузере (билдер) | feature | P3 | браузерный вариант `quickjs-emscripten` за интерфейсом `ScriptSandbox` из `reformer-mcp`, чтобы агентские скрипты исполнялись прямо в билдере |

В описании каждой — ссылка на этот файл (раздел «Что QuickJS может и чего не может») и критерии
приёмки из разделов ниже.

**Шаг 2 — взять в работу задачу 1** (`bd update <id> --claim`) и выполнить шаги эксперимента
ниже. Задачи 2 и 3 остаются открытыми.

## Как сейчас

Конвейер общий для формы и плагинов (служба `host/modules`):

1. **Транспиляция TS → JS** — `typescript.transpileModule`, пофайлово, `module=commonjs`,
   `jsx=react-jsx`, `isolatedModules`, без проверки типов.
   [typescript-transpiler.ts](projects/reformer-builder/src/shell/platform/plugin/typescript-transpiler.ts).
   Движок — ленивый чанк ≈3.5 МБ (`await import('typescript')`), грузится только если нужен.
   Движок сменный: [transpilers.ts](projects/reformer-builder/src/shell/platform/modules/transpilers.ts)
   (`TranspilerRegistry`, «последний зарегистрированный побеждает»).
2. **Кэш** — OPFS, ключ `sha256(engine, version, options, path, source)`, два уровня (файл/набор).
   Если весь набор в кэше — движок не грузится вовсе.
   [compile-cache.ts](projects/reformer-builder/src/shell/platform/modules/compile-cache.ts).
3. **Исполнение** — CJS-линковщик: `new Function(exports, require, module, __filename, ...ambient)`
   в главном потоке, с правами приложения. Bare-импорты (`@reformer/core`, `react`) берутся ТОЛЬКО
   из реестра модулей оболочки — чтобы у формы и превью был один экземпляр сигналов и React.
   [linker.ts](projects/reformer-builder/src/shell/platform/modules/linker.ts).
4. **Компиляция формы** — синтетическая точка входа → `prepare` (кэш/прогрев движка) → `load` →
   запись в кэш. [compile.ts](projects/reformer-builder-playground/.ui_builder/plugins/reformer/render/src/compiling/compile.ts).
5. **Изоляция** — лексическая подмена `fetch/Date/Math` (`ambient`) и `overrides` из фикстуры;
   доступ — запрет исполнения кода по источнику (`executesCode`).

QuickJS в репозитории уже есть, но только на Node, в MCP Code Mode:
[quickjs-sandbox.ts](packages/reformer-mcp/src/platform/cli/quickjs-sandbox.ts)
(лимиты памяти/времени, своё API через хэндлы; TS снимает тот же `typescript`).

## Что QuickJS может и чего не может

**Главное: QuickJS — не компилятор, а интерпретатор JS** (wasm ≈0.5 МБ). TS → JS он не
переводит, поэтому `typescript` останется в любом случае. Заменить QuickJS может только шаг 3,
исполнение (`new Function`).

**Почему для превью формы он не подходит.** Форма — это живые объекты, а не функция «вход → выход»:
узлы модели на сигналах, валидаторы и поведение, которые срабатывают на каждое изменение поля,
React-компоненты из `schema/registry.ts`, `wireSubmit`. Превью рендерит их в React оболочки.
Объекты из памяти QuickJS в V8 не попадают — только через хэндлы и сериализацию. Отсюда:

- `@reformer/core` пришлось бы исполнять внутри QuickJS, то есть получить второй экземпляр ядра —
  именно то, от чего защищается линковщик. React-компоненты там не отрендерить вообще.
- Каждое нажатие клавиши (валидаторы, `computeFrom`) проходило бы через границу wasm с маршалингом.
- В QuickJS нет JIT: горячий код выполняется на порядок медленнее, чем в V8.
- Пропадёт отладка: DevTools, точки останова, `//# sourceURL` (сейчас стек показывает
  `form/validation.ts`).
- Плюс ≈0.5 МБ wasm к загрузке.

**Что QuickJS дал бы реально:**

- защиту от зависания: прерывание по времени и лимит памяти (сейчас `while (true)` в сайдкаре
  вешает вкладку);
- настоящую изоляцию от `window`, `localStorage`, cookies и сети.

Обе выгоды требуют переделать превью: модель в песочнице, а хост получает снимки состояния и шлёт
события. Это отказ от принципа «один экземпляр сигналов» и по сути новый рендер. Код же
исполняется только из источников, где это разрешено (проект пользователя с диска), так что угроза
небольшая.

**Где QuickJS в браузере уместен:** Code Mode, если агент появится прямо в билдере. Интерфейс
`ScriptSandbox` уже отделён ([run-script.ts](packages/reformer-mcp/src/core/codemode/run-script.ts)),
нужен только браузерный вариант `quickjs-emscripten`.

## Рекомендация: если цель — скорость и вес компиляции, менять транспилятор, а не исполнитель

Архитектура уже готова к смене движка (`createTypeScriptTranspiler(engine)`, `TranspilerRegistry`,
`engineId` в ключе кэша). Кандидат — **sucrase**: сотни КБ вместо ≈3.5 МБ, синхронный (подходит
к синхронному `require`), в разы быстрее `transpileModule`, умеет `typescript + jsx(automatic) +
imports→CJS`.

Выигрыш — только на холодном пути: первое открытие формы без кэша и первая правка в сессии, когда
приходится грузить движок. С тёплым OPFS-кэшем движок и сейчас не грузится.

Риски, которые надо проверить:
- sucrase терпимее TS к части ошибок: некоторые синтаксические находки уйдут из панели сборки;
- текст и позиция ошибки другие (`SyntaxError` с `pos`) — нужно сопоставить с `TranspileFinding.range`;
- interop `default` у импортов — сверить с [esm-interop.ts](projects/reformer-builder/src/shell/platform/modules/esm-interop.ts);
- `const enum`, `namespace`, декораторы поддерживаются частично.

### Шаги (эксперимент, за флагом)

1. `sucrase-transpiler.ts` рядом с `typescript-transpiler.ts`: тот же `Transpiler`, свой `id`,
   своя подпись опций (ключ кэша разойдётся сам), `SyntaxError.pos` → `TranspileFinding.range`.
2. Подключение через ту же ленивую фазу `ensure`: движок выбирается в
   [plugin-modules.ts:155](projects/reformer-builder/src/shell/boot/plugin-modules.ts#L155)
   (`createTypeScriptSupport(modules.transpilers)`), а идентичность кэша — в
   [boot.ts:721](projects/reformer-builder/src/shell/boot/boot.ts#L721) (`engineId`,
   `engineVersion`, `optionsVersion` обязаны следовать за выбранным движком). Выбор — настройкой,
   по умолчанию остаётся `typescript`. Зависимость `sucrase` — в `projects/reformer-builder/package.json`.
3. Тест на эквивалентность: прогнать сайдкары всех примеров форм обоими движками, исполнить
   через линковщик и сравнить экспорты (`readEntryExports`).
4. Замеры: размер чанка, время холодной компиляции формы (без OPFS) и пересборки после правки.

### Проверка

- Юнит-тесты `projects/reformer-builder` (`transpilers`, `linker`, `loader`, `compile-cache`) и
  плагина `reformer/render` (`compiling/*.test.ts`, `pipeline.test.ts`).
- Браузерные тесты `module.browser.test.tsx`, `validation.browser.test.tsx` на обоих движках.
- Ручная проверка в билдере: открыть форму с пустым OPFS, внести синтаксическую ошибку — находка
  подсвечена в нужном месте.
