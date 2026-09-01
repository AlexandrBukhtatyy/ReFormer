# Структура проекта v2

> К [implementation-plan.md](implementation-plan.md) и [core-contracts.md](core-contracts.md).
>
> Главное правило: **раскладка должна делать нарушение границы механически заметным.**
> Если «платформа не знает про формы» держится на дисциплине, оно продержится до первого
> дедлайна.
>
> Документ переписан при реорганизации 2026-09 (см. запись в [decisions-log.md](decisions-log.md)):
> прежняя редакция описывала `app/` из двух файлов при сорока двух по факту и обещала сущности,
> которые так и не появились (`host/index.ts`, `services/workers.ts`, `scripts/check-boundaries.mjs`,
> плагины `source-fs`/`source-memory`). Теперь здесь целевая структура, совпадающая с фактом,
> и правила, по которым она не расползётся снова.

## Решение: один проект, границы проверяются, а не подразумеваются

Внешний документ предлагает раскладку из npm-пакетов (`host`, `plugin-sdk`, `plugins/*`, `app`).
Сейчас это преждевременно: v2 приватный, локальный, публикуется не отсюда, и мы уже решили
не строить версионирование API и маркетплейс до появления внешнего автора.

Поэтому **один проект с внутренними слоями**, но раскладка такая, что вынос в пакеты позже —
перемещение каталога, а не переработка. Граница держится не соглашением, а правилом импортов
в линтере.

## Пять слоёв и правила импорта

Бывшие `src/host` и `src/app` живут под одной крышей `src/shell/` — оболочка как целое:
`platform/` — механизмы, `boot/` — их сборка в конкретное приложение. Отношение «boot собирает
platform» читается из самого дерева, а слово «host» осталось в единственном значении —
`plugins/*/host.ts`, «порт платформы, который просит плагин».

| Слой              | Что это                                                    | Кому можно импортировать           |
| ----------------- | ---------------------------------------------------------- | ---------------------------------- |
| `shell/platform/` | платформа: примитивы, Workspace, Source, сервисы, оболочка | только `shell/platform/` и внешние |
| `sdk/`            | поверхность, которую видит плагин                          | только типы из `shell/platform/`   |
| `lib/`            | чистый домен: модель схемы, каталог, киты, кодоген         | `lib/` и внешние библиотеки        |
| `plugins/*`       | вся предметная логика как вклады                           | `sdk/`, `lib/`, свой каталог       |
| `shell/boot/`     | композиция: какая платформа с какими плагинами             | всё                                |

Три запрета, ради которых всё это и делается:

1. **`shell/platform/` не импортирует `lib/` и `plugins/`.** Это буквальное выражение принципа
   «платформа не знает предметных сущностей». Нарушение видно сразу.
2. **`plugins/*` не импортируют друг друга.** Связь — через сервисы, команды и события.
3. **`lib/` не импортирует `shell/`.** Домен остаётся переносимым: именно поэтому его можно
   было взять из v1 почти дословно и позже вынести в пакет.

Импорты между подсистемами пишутся через псевдоним `@/…` — это не косметика: правила
`no-restricted-imports` ловят только такие пути, поэтому относительный импорт, пересекающий
границу слоя, был бы невидим линтеру. Соседей внутри одного каталога импортируем как `'./x'`.

## Раскладка

```text
projects/reformer-builder-v2/
├── docs/                           план, контракты этапов, журнал решений, этот файл
│
├── src/
│   ├── shell/
│   │   ├── platform/          ПЛАТФОРМА. Не знает слова «форма»
│   │   │   ├── primitives/      resource (+ resource-path), service, extension-point,
│   │   │   │                    command, event, disposable, when-expr, when-context
│   │   │   ├── workspace/       рабочая область; внутри journal/ merge/ model/ storage/
│   │   │   ├── source/          контракт источника, fs-access, fs-handles, memory-двойник, registry
│   │   │   ├── services/        службы платформы — один каталог, один ответ на вопрос
│   │   │   │                    «какие они есть»: i18n/, diagnostics/, validation/,
│   │   │   │                    settings, theme, notifications, prompt, selection,
│   │   │   │                    context-keys, resource-clipboard
│   │   │   ├── modules/         механика загрузки кода: registry, linker, transpilers, compile-cache
│   │   │   ├── plugin/          рантайм плагинов: types, context, registry, loader, catalog, storage, styles
│   │   │   └── ui/              оболочка и слоты
│   │   │       ├── Shell.tsx  slots.ts        корень = точка сборки оболочки
│   │   │       ├── chrome/      EditorArea, EditorActions, DocumentTabs, MenuBar, StatusBar,
│   │   │       │                panels, layout-settings, usePanels, useWorkspaceViews
│   │   │       ├── keyboard/    keybindings, keybinding-rules, keybinding-editor, chords,
│   │   │       │                focus, keymap, scope, KeybindingsDialog
│   │   │       ├── menu/        menu, menu-issues, editor-menu, resource-menu, palette, CommandPalette
│   │   │       ├── contributions/  editors, editor-choice, decorations
│   │   │       ├── dialogs/     SettingsDialog + settings-ui, HelpDialogs, MergeDialog + merge,
│   │   │       │                NotificationCenter + notifications, PromptHost, storage-purge
│   │   │       └── state/       tabs, status, resource-tree + ResourceTree, when-context-store
│   │   └── boot/              КОМПОЗИЦИЯ. Единственный слой, которому можно всё
│   │       ├── boot.ts          сборка приложения, последовательность запуска
│   │       ├── plugins.ts       единственное место со списком встроенных плагинов
│   │       ├── plugin-modules.ts  защищённые слоты реестра модулей
│   │       ├── settings-sections.ts  состав окна настроек
│   │       ├── ports/           адаптеры портов плагинов: files, monaco, markdown, schema,
│   │       │                    preview, ai, codegen, templates + мосты live-surface, kit-namespace
│   │       ├── project/         project, workspace-session, document-models, opened-tabs,
│   │       │                    project-status, useProject, ProjectTree
│   │       └── integration/     интеграционные тесты СБОРКИ — единственное узаконенное
│   │                            исключение из правила «тест рядом с кодом»
│   │
│   ├── sdk/                   ЧТО ВИДИТ ПЛАГИН
│   │   └── index.ts             definePlugin + типы; этот объект загрузчик
│   │                            подставляет плагину как '@builder/sdk'
│   │
│   ├── lib/                   ОБЩИЕ ЧИСТЫЕ БИБЛИОТЕКИ (домен ReFormer)
│   │   ├── form-model/          модель схемы формы
│   │   ├── catalog/             контракт каталога компонентов
│   │   ├── kits/                дескрипторы дизайн-систем
│   │   ├── codegen/             машина печати кода (решения о целях — в plugins/codegen)
│   │   ├── form-fixture/  form-inspect/  form-mock/   данные форм
│   │
│   ├── plugins/               ВСЯ ПРЕДМЕТНАЯ ЛОГИКА (анатомия — в разделе ниже)
│   │   ├── editor-schema/       визуальный редактор: model/ session/ canvas/ schematic/
│   │   │                        live/ editing/ palette/ ui/
│   │   ├── editor-monaco/       runtime/ sync/ diagnostics/ ui/
│   │   ├── editor-markdown/     render/ state/ ui/
│   │   ├── validator-schema/    валидатор схемы (флат — размер позволяет)
│   │   ├── preview/             compiling/ runtime/ schema/ surface/ state/ ui/
│   │   ├── codegen/             pipeline/ (+ __golden__) commands/ ui/
│   │   ├── templates/           content/ render/ commands/ stores/ ui/
│   │   ├── files/               ui/
│   │   ├── kits/                активный кит как сервис (флат)
│   │   └── ai/                  model/ loop/ tools/ session/ knowledge/ providers/ ui/
│   │                            (каталога core/ нет: имя не сообщало ничего и притягивало всё)
│   │
│   ├── testing/               browser-setup (зашит в vitest.browser.config), render
│   ├── main.tsx  App.tsx  index.css
│
├── eslint.config.js           границы слоёв — no-restricted-imports по блокам files
├── vite.config.ts   vitest.config.ts   vitest.browser.config.ts
├── tsconfig.json  tsconfig.app.json  tsconfig.node.json
└── package.json
```

## Библиотека и плагин — не одно и то же

Правило «плагины не связываются друг с другом» относится к **рантайм-состоянию и сервисам**,
а не к общему чистому коду. Модель схемы, каталог и кодоген нужны сразу нескольким плагинам —
редактору, валидатору, кодогену, ассистенту. Сделать их плагинами значит либо заставить плагины
зависеть друг от друга, либо гонять чистые функции через реестр сервисов.

Поэтому: **чистое и без состояния — в `lib/`, импортируется напрямую. Состояние и жизненный цикл —
в плагине, достаётся через сервис.**

Пример на активном ките: дескрипторы и типы китов — `lib/kits/` (чистые данные, импортируются
кем угодно), а «какой кит активен сейчас» — сервис плагина `plugins/kits/`. Второй пример —
кодоген: `lib/codegen` — машина печати (шаблоны, сборка контекста), а решение «какие файлы
производить» — вклады в `plugins/codegen`.

## Устройство плагина

```text
plugins/editor-schema/
├── index.ts          единственный экспорт наружу — обязателен у каждого плагина
├── plugin.ts         definePlugin + activate: регистрация вкладов   (+ plugin.test.ts)
├── host.ts           порт платформы: структурная копия интерфейса, который плагин
│                     просит у композиции; реализуется в shell/boot/ports/<name>.ts
├── contract.ts       собственная точка расширения плагина (если есть)
├── messages.ts       ключи словаря — ОБЯЗАН лежать в корне
├── locales/{ru,en}.json                — ОБЯЗАН лежать в корне
├── testing.ts        двойник порта для юнитов (если есть)
├── ui/               React-компоненты
└── <домен>/          доменная логика по темам, тест рядом с модулем
```

Правила, за которыми следим:

- **В корне плагина — только служебные имена** из списка выше. Доменная логика живёт
  в тематических подкаталогах.
- **Подкаталоги — один уровень.** Правило линтера `denyFromPlugins` запрещает `../../../**`
  (выход за границу плагина), и второй уровень вложенности превращает легальные внутриплагинные
  импорты в нарушение. Именно поэтому у `ai/` группы `loop/ model/ tools/` лежат на уровне
  плагина, а не под бывшим `core/`.
- **`messages.ts` и `locales/` — в корне.** Тест полноты словарей
  (`shell/boot/integration/i18n-completeness.test.ts`) распознаёт плагины со словарём ровно
  по этим двум именам в корне каталога плагина.
- **Наружу плагин отдаёт только `index.ts`.** `shell/boot/plugins.ts` импортирует плагины
  только через их `index.ts`.
- **Словари везёт плагин.** Иначе платформа снова начнёт знать предметные строки.
  Пространство имён словаря — идентификатор плагина.
- **Именование каталогов плагинов по роли**: `editor-*`, `validator-*`. Роль видна в дереве
  без открытия файлов.
- **`shell/boot/plugins.ts` — единственное место со списком плагинов.**

## Как проверяется

`no-restricted-imports` в [eslint.config.js](../eslint.config.js), по одному блоку `files`
на слой. Правила ловят импорты через `@/…` и запрет `../../../**` в плагинах — поэтому
межслойные импорты обязаны писаться через `@/`.

**Правило приёмки:** нарушение границы валит `npm run lint --workspace reformer-builder-v2`
(именно workspace-level: корневой `npm run lint` правил слоёв не содержит — см. decisions-log,
запись t0-2). После каждой правки конфига границ — проверка пробником: временно внести
нарушение, увидеть ошибку, удалить.

## Пути, зашитые вне импортов

Перемещая файлы, помни про места, которые компилятор не проверяет:

- `shell/boot/integration/plugins.test.ts` — динамический импорт
  ``import(`.../plugins/${id}/locales/ru.json`)`` с путём относительно файла теста;
- `shell/boot/integration/i18n-completeness.test.ts` — `new URL('../../../plugins', import.meta.url)`;
- `plugins/ai/loop/prompt.test.ts` — читает собственный исходник `./prompt.ts` через `readFileSync`;
- `plugins/codegen/pipeline/golden.test.ts` — `toMatchFileSnapshot('./__golden__/…')`:
  голдены живут в каталоге теста и переезжают только вместе с ним;
- `package.json` (`generate:knowledge`) и `.gitignore` монорепо — путь
  `src/plugins/ai/knowledge/generated`;
- `vitest.browser.config.ts` — `setupFiles: ['./src/testing/browser-setup.ts']`;
- `src/index.css` — относительный `@source` до `packages/reformer-ui-kit`.

## Соглашения

- **Тесты рядом с кодом**, `*.test.ts` (node) и `*.browser.test.tsx` (Chromium);
  исключение одно — `shell/boot/integration/` для интеграционных тестов сборки,
  у которых нет модуля рядом.
- **Псевдоним `@/`** на `src/` — обязателен для импортов, пересекающих границы подсистем.
- **Порог плоскости — примерно 15 файлов.** Каталог, выросший заметно больше, пора делить
  по темам; образцы — `shell/platform/workspace/`, `plugins/preview/`.

## Каталог рядом с проектом

Конфигурация и плагины живут в `.ui_builder/` в корне открытого проекта:

```text
<проект>/.ui_builder/
├── config.json
├── component-catalog.json
├── templates/<slug>/
├── kits/<id>.json
└── plugins/<id>/          manifest.json, main.js, styles.css
```

Имя отличается от `.reformer/`, который v1 уже использует для шаблонов форм. Это осознанно:
каталог принадлежит инструменту, а не библиотеке форм, и разведение имён избавляет от вопроса,
чей это конфиг, когда рядом лежат оба.

## Что переезжало из v1 и куда (историческая справка)

Домен переносился почти дословно, оболочка и состояние написаны заново. Пути указаны
в сегодняшних именах (после реорганизации 2026-09; тогда `shell/platform` назывался `host`,
а `shell/boot` — `app`).

| v1                                 | v2                                                     |
| ---------------------------------- | ------------------------------------------------------ |
| `model/`                           | `lib/form-model/`                                      |
| `catalog/`                         | `lib/catalog/`                                         |
| `kits/` (дескрипторы)              | `lib/kits/`                                            |
| `kits/` (активный кит)             | `plugins/kits/`                                        |
| `preview-runtime/live/`            | `shell/platform/modules/` + `plugins/preview/`         |
| `codegen/`                         | `lib/codegen/` + `plugins/codegen/`                    |
| `templates/`, `app/*-templates.ts` | `plugins/templates/`                                   |
| `canvas/`, `panels/`               | `plugins/editor-*/`                                    |
| `agent/core/`                      | `plugins/ai/`                                          |
| `io/fs-*`, `discovery`             | `shell/platform/source/`                               |
| `io/opfs`, `io/idb`, `draft-store` | `shell/platform/workspace/storage/`                    |
| `app/EditorLayout.tsx`             | `shell/platform/ui/Shell.tsx` + вклады                 |
| `store/reducers.ts`                | `shell/platform/workspace/` + `plugins/editor-schema/` |
