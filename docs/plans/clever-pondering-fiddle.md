# Ревизия документации ReFormer: сайт, раздел билдера, README, llms-доки

## Context

С 16.10 по 07.11 прошло ~300 коммитов (≈140 — билдер, 30 — MCP, 26 — ядро с breaking-изменениями),
а сайт `projects/reformer-doc` не правился с 16.10. Пользователь: «документация местами сложная,
непонятная, а где-то вообще пусто», нужно обновить, добавить инфографику и примеры.

Аудит (три разведки + ручная сверка) показал:

- **Сайт местами неверен.** `patterns/submit-and-reset.md:174` описывает «два сброса», которые
  485fbf41 заменил на один; `schemas/form-schema.md` — `disabled` как начальное состояние (851e221c
  сделал его постоянной блокировкой); `validation/built-in.md:209` — даты «любой парсящейся строкой»
  (78790070: только `Date` или `YYYY-MM-DD`); `mcp/*` не знает `form_build` и 8 из 12 инструментов.
- **Правки сайта молча не видны.** `i18n/ru/docusaurus-plugin-content-docs/current/` — 31 побайтная
  копия `docs/`; ru — локаль по умолчанию, `translate` выводится в `true` по наличию каталога
  (`@docusaurus/core/lib/server/i18n.js`), и сайт читает копии, а не `docs/`.
- **Сложно:** жаргон без глоссария (сборка, ручка, замечание, точка отсчёта, M1), ~15 страниц
  с «Удалены: … (→ …)», дубли (`schemas/validation-schema.md` 408 стр. повторяет `validation/*`),
  стены текста (`schemas/composition.md` 610, `patterns/project-structure.md` 408),
  `validation-strategies.md` открывается дампом интерфейсов и «под капотом».
- **Пусто:** 72 страницы ui-kit и cdk — абзац + автодемо; нет страниц form-registry, локализации,
  глоссария, миграции, FAQ, тестирования; `examples/index.md` — сирота вне сайдбара; renderer-json/
  renderer-react — по одной сжатой странице; **о билдере на сайте нет ничего**.
- **Схем нет вообще** (mermaid не подключён, в `static/img` только логотип). Живых примеров на
  страницах ядра/валидации/поведений/паттернов нет; у `ComponentDoc` код — отдельная строка,
  расходится с рендером.
- **README/llms:** llms-доки библиотеки в основном актуальны (источник истины для фактов); устарели
  README и доки MCP (4 из 12 инструментов), шаблоны промптов MCP ссылаются на несуществующие
  разделы (`cdk/formarrayhandle-api`, `core/cycle-detection-prevention-checklist`, …), README ui-kit
  говорит о «v7» при версии 6.0.0, README plugin-api противоречит коду (`compatibility.builder`).

Решения пользователя: полная ревизия всех четырёх слоёв; инфографика — **Mermaid + несколько
нарисованных SVG**; примеры — **живые на странице**; язык — **русский, перевод на en вторым заходом —
закладываемся** (строки компонентов и схем — через `translate()`, без хардкода).

Ограничения: `docs/specs/**` и `projects/reformer-builder/docs/specs/**` — read-only; коммиты —
только по явной просьбе; скриншоты проверок — в `projects/react-playground-e2e/screenshots/docs-site/`,
временное — в `.tmp/`.

## Роли слоёв (против тройного дублирования)

| Слой | Роль | Правило |
|---|---|---|
| `packages/*/docs/llms` | источник истины фактов API, рецепты для ИИ | факты сначала правятся здесь |
| Сайт | человеческое руководство: зачем → пример → детали | сигнатуры не переписывает, ссылается на API |
| README | вход на npm/GitHub, ≤ ~120 строк | установка, один пример, таблица входов, ссылки |

## Этап 0. Фундамент сайта (без него остальное не видно или не переводимо)

1. **Убрать теневые копии:** удалить `i18n/ru/docusaurus-plugin-content-docs/current/**` (31 .md и
   `_category_.json`); `i18n/ru/code.json`, `navbar.json`, `footer.json` оставить. Устаревший
   `i18n/ru/.../current.json` (ключи `docsSidebar`) перегенерировать `write-translations`.
2. **Mermaid:** `@docusaurus/theme-mermaid@3.9.2` в `projects/reformer-doc/package.json`,
   `markdown: { mermaid: true }`, `themes: ['@docusaurus/theme-mermaid']`, тема mermaid
   light/dark в `themeConfig` — в `docusaurus.config.ts`.
3. **SVG-инфографика:** `src/components/diagrams/` — React-компоненты с inline SVG; цвета — только
   CSS-переменные `--ifm-*`/собственные токены в `src/css/custom.css` (тёмная тема без дублей), подписи —
   `translate({id, message})`. Регистрировать в `src/theme/MDXComponents.tsx`.
4. **Живой пример «код = рендер»:** в `reformerLiveDemoPlugin` (`docusaurus.config.ts:20`) добавить
   webpack-правило `{ resourceQuery: /raw/, type: 'asset/source' }` + `declare module '*?raw'`.
   Новый компонент `<LiveExample component={X} source={xSource} />` на базе существующего
   `src/components/demo/ApiPreview.tsx` (Preview/Code), примеры — файлы
   `src/components/demo/live/<тема>/<пример>.tsx`, импортируются дважды: как модуль и `?raw`.
   Зарегистрировать в MDXComponents.
5. **i18n-готовность демо:** заменить хардкод в `Demo.tsx`, `ComponentDoc.tsx`, `VariantGallery.tsx`,
   `ApiPreview.tsx` («Загрузка демо…», «Variants», «Dark mode», «Тип») на `translate()`; подписи
   категорий сайдбара — через `current.json` (переводимы `write-translations`).
6. **Стиль и словарь:** `docs/guides/docs-style.md` — шаблон страницы (что это → когда нужно →
   минимальный пример → детали → подводные камни → см. также), запрет миграционных заметок в
   руководствах, список жаргона с заменами; страница сайта `reference/glossary.md`.
7. **Сеть безопасности:** `onBrokenMarkdownLinks: 'throw'`, `onBrokenAnchors: 'throw'`; job сборки
   сайта в `.github/workflows/test.yml` (сейчас сайт собирается только деплоем из `develop`).

## Этап 1. Исправить неверное — во всех слоях (быстрый, самый ценный)

- Сайт: `patterns/submit-and-reset.md` (один сброс, точка отсчёта), `schemas/form-schema.md`
  (`disabled` — постоянная блокировка), `validation/built-in.md` (строгие даты), `core-concepts/nodes.md:78`
  (отключённая группа — ни valid, ни invalid), `cdk/overview.md` (входы `./autocomplete`, `./list`,
  `./option-source`), `mcp/*` (12 инструментов, `form_build`, вход `@reformer/mcp/intent`).
  Сверять с `packages/reformer/docs/llms/28-submit-and-reset.md` и соседями.
- MCP: мёртвые `reformer://docs/...` в `packages/reformer-mcp/src/prompts/templates/{plan-form,add-form-array,add-behavior}.md`
  и `src/prompts/{create-form,plan-form}.ts`; `docs/llms/02-tools.md` + `form_build`; `01-guide.md`
  «5 пакетов» → 6; пример `getReformerForm` в описании `get_symbol_docs`.
- README: таблица инструментов MCP → ссылка на `02-tools.md`; ui-kit «v7/миграция» → CHANGELOG;
  plugin-api — `compatibility.builder` и список прав; toolkit — путь ядер доменов.

## Этап 2. Сайт библиотеки: структура, ясность, схемы, живые примеры

**Сайдбар** (`sidebars.ts`): Введение · Начало работы · Основные концепции · Валидация · Поведение ·
React · Рендеринг (renderer-react, renderer-json) · Многошаговые формы · Локализация · Паттерны ·
Микрофронтенды (form-registry) · CDK · UI Kit · MCP · Примеры · Справочник (глоссарий, миграция на v6,
FAQ/проблемы, API).

**Переписать сложное:** `schemas/overview.md` → короткая карта; `schemas/validation-schema.md` и
`behavior-schema.md` → обзор формата + ссылки на разделы (убрать повтор); разрезать
`schemas/composition.md` и `patterns/project-structure.md`; из `validation-strategies.md` убрать дамп
интерфейсов и «под капотом»; все «Удалены: …» собрать в новую `reference/migration-v6.md`;
`behaviors/overview.md` — сначала DSL, императив потом.

**Заполнить пустое:** локализация (`I18nProvider`, локали ядра/кита/cdk, `$locale`), form-registry
(из `packages/reformer-form-registry/docs/llms`), renderer-json и renderer-react — по 3–4 страницы
(из их `docs/llms`), многошаговые формы (концепция), тестирование, FAQ/проблемы, TypeScript-рецепты
(`packages/reformer/docs/llms/30-type-safety-recipes.md`), `examples/index.md` — в сайдбар, роуты
`/demo/...` — ссылками. Хук `useSignalSnapshot`, который два раза пишется руками, — отметить задачей
в beads (это API, не документация).

**Инфографика** (SVG — 3 ключевые, остальное Mermaid):

| Схема | Вид | Страница |
|---|---|---|
| Карта пакетов и зависимостей | SVG | intro |
| Анатомия bundle: model / form / validation / flow / submission / render | SVG | quick-start, model |
| Поток реактивности: сигналы модели → состояние нод → хуки | Mermaid flowchart | reactive-state |
| Прогон валидации: стратегия → validateModel → замечания → сообщения | Mermaid sequence | validation/overview |
| Исходы отправки | Mermaid flowchart | submit-and-reset |
| Точка отсчёта: `form.reset` / `model.reset` / `captureInitial` | Mermaid state | submit-and-reset |
| Граф поведений: чтения → цели, обнаружение цикла | Mermaid flowchart | behaviors/computed |
| Машина шагов мастера | Mermaid state | многошаговые формы, cdk/form-wizard |
| JSON-документ + реестр → createForm → FormRenderer | SVG | renderer-json |
| form-registry между микрофронтендами | Mermaid flowchart | form-registry |

**Живые примеры** (`<LiveExample>`): quick-start, model, синхронная и асинхронная валидация,
computed и enableWhen, массивы, submit+reset, мастер, renderer-json, локализация.

**API:** расширить `entryPoints` typedoc (`docusaurus.config.ts:99`) входами ядра `./validation`,
`./validators`, `./behaviors`, `./i18n`, `./model`, `./signals`, `./locale`.

## Этап 3. UI Kit и CDK: из заглушек — в страницы

Шаблон страницы компонента: назначение и когда использовать (против соседей) → анатомия → примеры
(`ComponentDoc`) → доступность → локализация → см. также. 59 конфигов `src/components/demo/examples/*.tsx`
перевести с устаревшего `props` на вкладку `api` (`types.ts` помечает `props` deprecated). Новые
страницы: `field`, `icon`, `label`, `list`, `separator`, локали кита. FieldArray — скрытие «добавить»
на `maxItems` (09e8bf87). Выполнять пачками по категориям (формы, оверлеи, навигация, данные…) —
параллельными субагентами с одним шаблоном и общим чек-листом.

## Этап 4. Раздел «Билдер» на сайте (новый `builderSidebar`)

Живой билдер в страницу не встраивается (нужен Vite dev-сервер; без папки проекта видна только
стартовая), поэтому — **скриншоты + кнопка «Открыть билдер ↗»** на
`https://alexandrbukhtatyy.github.io/ReFormer/builder/` (ссылка уже в навбаре, `docusaurus.config.ts:209`).

Страницы (≈12): Обзор · Быстрый старт · Интерфейс · Редактирование формы · ИИ-ассистент (провайдеры,
Ollama/LM Studio и `OLLAMA_ORIGINS`, режимы, пределы) · Экспорт кода и шаблоны · Киты и движки
(ui-kit, HexaUI, RJSF) · Конфигурация `.ui_builder/` · Встраивание в Vite-приложение · Плагины: понятия ·
Первый плагин (`reformer-plugin create/validate/dev/pack`) · Манифест и API плагина · Сборка и стили.
Источники — `projects/reformer-builder/README.md`, `docs/{embedding,composition}.md`,
`projects/reformer-builder-host-example/README.md`, README `builder-plugin-{api,cli}`, локали плагинов
(реальные имена в UI). Внутренние `decisions-log.md`, `implementation-plan.md` и пр. не переносим —
берём только «зачем».

Инфографика: SVG — раскладка оболочки (рейлы, панели, редактор, статус-бар) и фреймы встраивания
(страница → iframe оболочки → iframe превью); Mermaid — ход ассистента (sequence), экспорт
схема → стек → файлы, слои и домены плагинов, конвейер сборки плагина.

Скриншоты — новый spec `projects/reformer-builder-playground-e2e/tests/docs/screenshots.spec.ts`
(fullPage, светлая тема), выход по правилу CLAUDE.md — `projects/react-playground-e2e/screenshots/builder-docs/`;
отобранные копируются в `projects/reformer-doc/static/img/builder/` (это уже контент сайта, в git).

## Этап 5. README пакетов

Единый шаблон ≤ ~120 строк: что это → установка → минимальный пример → таблица входов
(subpath exports) → ссылки (сайт, `docs/llms`, MCP). Убрать повторы валидации из README
renderer-react/renderer-json и core-контракта; дизайн-обоснования plugin-api — в раздел билдера на
сайте; core — добавить таблицу входов и ссылки; cdk — перечислить FileUpload, Autocomplete,
AsyncBoundary, FormField, List. Корневой `README.md` и `AGENTS.md` — добавить form-registry.
Язык README в этом заходе не меняем (переводит этап 7).

## Этап 6. llms-доки и проверки (осторожно: CI-гейт `mcp:evaluate`)

Сначала снять базовую линию `npm run mcp:evaluate`. Только **добавлять** файлы и разделы, не
переименовывать (переименование ломает `find-recipe.test.ts` и метрики): cdk — рецепты FileUpload,
List, `option-source`; core — `01-overview.md`; mcp — `form_build`, вход `intent`. Починить
маршрутизацию `find_recipe` (алиасы `validation`, `i18n`, `troubleshooting` в
`packages/reformer-mcp/src/core/docs/recipes.ts`). Новые проверки: тест, что каждая
`reformer://docs/...` в шаблонах резолвится; `check-mcp-prompts` и проверку импортов — также по
`docs/llms`; `llms-index.json` — в CI-диф и в `files` form-registry.

## Этап 7 (заложен, не в этом заходе). Перевод на en

Готовность обеспечивают этапы 0.5 и 0.3 (`translate()` в компонентах и схемах), глоссарий (единые
термины) и Mermaid в тексте страниц (переводится вместе со страницей). Перевод → `i18n/en/...`.

## Учёт работы

Эпик в beads + задача на каждый этап (этапы 2–4 — подзадачи по разделам). Работать этапами с
показом результата после каждого; этапы 0 и 1 — первыми, остальные можно переупорядочить.
Вне объёма (отдельные задачи): JSDoc `@example` для ~650 символов (ui-kit 506), хук
`useSignalSnapshot`, демо-режим билдера из памяти для iframe.

## Проверка

- После каждого этапа сайта: сборка пакетов (`npm run build:stackblitz` — core → cdk → renderer-react →
  renderer-json → ui-kit), `npm run build -w reformer-doc` (с `throw` на битые ссылки/якоря),
  `npm run typecheck -w reformer-doc`, eslint по `projects/reformer-doc`.
- Этап 0: после удаления копий правка в `docs/` видна в `npm run serve -w reformer-doc` на ru;
  схемы Mermaid и SVG проверить в светлой и тёмной теме — скриншоты fullPage в
  `projects/react-playground-e2e/screenshots/docs-site/<страница>-{light,dark}.png`.
- Живые примеры: пример работает на странице, вкладка Code показывает тот же файл.
- Этап 4: spec скриншотов билдера проходит; изображения открываются на страницах.
- Этапы 1 и 6: `npm run generate:llms -w <pkg>` дважды без диффа; `npm run test -w @reformer/mcp`;
  `npm run check:mcp-prompts`; `npm run mcp:evaluate` — не хуже базовой линии.
- `git status docs/specs/ projects/reformer-builder/docs/specs/` — пусто.
