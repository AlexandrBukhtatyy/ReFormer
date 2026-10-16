# Автономный билдер открывает любой каталог: слой плагинов под dev и настройки без `.ui_builder`

## Контекст

Под `npm run builder -w reformer-builder-playground` (vite dev, порт 5184) каталог без
`.ui_builder/` «не открывается»: диалог закрывается, и ничего не происходит. Раньше открывался
любой каталог.

Открытие на самом деле проходит (`ProjectHost.open`, `shell/boot/project/project.ts:348-386`),
но показать проект нечем. С 5 октября (a65af9d6) дерево файлов, редакторы и движки — не часть
оболочки, а плагины. В готовой сборке (`npx reformer-builder`) они едут слоем плагинов
приложения из `dist/plugins/`, и любой каталог работает. Под dev-сервером слоя нет: он включается
только переменной `REFORMER_BUILDER_PLUGINS` (`vite.config.ts:52-90`, решение ReFormer-eeq0.9
«слой по просьбе»), а скрипт `builder` её не ставит. Дерево появляется лишь у каталога, где
`reformer.files` лежит как ПРОЕКТНЫЙ плагин и включён в `.ui_builder/settings.json`, — то есть
только у playground. Ни один тест не открывает каталог без `.ui_builder`: засев e2e всегда
копирует playground целиком.

Второй дефект, найденный по пути: настройки области `workspace` (включённые плагины, права,
выбор кита) пишутся файлом `.ui_builder/settings.json` (`services/settings-project.ts:113-121`),
а файловый источник не создаёт каталог под запись (`source/fs-access.ts:374-378`, по контракту).
В каталоге без `.ui_builder` каждая такая запись отвергается, служба настроек откатывает кэш,
и выбор теряется после перезагрузки. Запасной путь в IndexedDB (`settings-layers.ts:91-98`)
включается только у источника без права записи, а не при отсутствии каталога.

**Решения с пользователем:**

- слой плагинов приложения под dev-сервером включён **по умолчанию** — тем же набором, что
  у опубликованного билдера (`application-plugins.json`); автономный dev ведёт себя как dist;
- в каталоге без `.ui_builder` настройки области **живут в браузере** (IndexedDB), как до
  переезда в файл; билдер ничего не создаёт в чужой папке сам. Каталог `.ui_builder` создавать
  перед записью нельзя: плагины пишут настройки и при старте (ReFormer-91ee), и файл появлялся
  бы в любой просто открытой папке.

## Шаги

### 1. Слой плагинов приложения под dev — по умолчанию (`projects/reformer-builder/vite.config.ts`)

`devApplicationPlugins()` (L66-90):

- `const DEFAULT_APPLICATION_PLUGINS = 'application-plugins.json'`;
  `named === undefined` → `DEFAULT_APPLICATION_PLUGINS`; `named === ''` → слоя нет (явный отказ,
  прежнее поведение для того, кто разрабатывает плагины только как проектные); иначе — как сейчас.
- Набор без сборок: существующий `onMissing` предупреждает «плагины не собраны: …» — дописать
  подсказку `npm run plugins:build -w reformer-builder-playground`. Индекс отдаёт то, что
  собрано (`bin/plugins-index.mjs:186-249`), сервер не падает.
- Комментарий L52-64 переписать: слой есть по умолчанию, что именно и почему; переменная
  называет другой каталог или набор либо пустым значением выключает слой.

Копии тех же плагинов в открытом playground помечаются `overridden`
(`platform/plugin/catalog.ts:369-382`): работает экземпляр приложения, а каталог живой —
пересобранный плагин перезагружается по возврату фокуса (`plugin-and-shell.md:617-624`).
Разработка плагинов на месте не ломается. Скрипт `builder` в playground не меняется.

### 2. Настройки без `.ui_builder` — в браузер (`services/settings-layers.ts`)

- `write` и `remove` для `workspace`: `try { await carryOver(); await deps.project.write(…) }`,
  `catch (error) { if (!isSourceError(error, 'not-found')) throw error; await deps.browser.write(…);
  legacy = true; }` — то же для `remove` (`deps.browser.remove`). `isSourceError` —
  из `@/shell/platform/source/errors` (L93). Ошибка от `settings-project.writeFile` приходит
  как есть: `SourceError('not-found', …)` файлового источника.
- Шапка модуля: к трём вопросам добавить четвёртый — «куда пишем, если в папке нет
  `.ui_builder`»: в прежнее место, пока каталог не появится; первая удачная запись в файл
  переносит накопленное (`carryOver`).
- `settings-project.ts` шапка («Что здесь считается нормой»): «каталога нет — запись отвергается
  отказом источника `not-found`, и слои настроек уводят её в браузер».
- `shell/boot/boot.ts:472-475` комментарий: «…и когда в проекте нет каталога `.ui_builder`».

### 3. Тесты

| Файл | Кейсы |
| --- | --- |
| `services/settings-layers.test.ts` | `fileBackend` получает режим «каталога нет»: `write`/`remove` отвергают `new SourceError('not-found', …)`; кейсы: запись без каталога уходит в браузер и читается обратно; `remove` без каталога; каталог появился — следующая запись переносит накопленное в файл (`carryOver`), и файл становится истиной; отказ с другим кодом по-прежнему пробрасывается |
| `services/settings-project.test.ts` | фейк источника, отвергающий запись в отсутствующий каталог `SourceError('not-found')`, — отказ доходит до вызывающего как есть |
| e2e `reformer-builder-playground-e2e` | `SeedOptions.uiBuilder?: boolean` в `tests/shared/playground-disk.ts:61-69, 225-240`: `false` — в копию не идёт ничего из `.ui_builder/` (конфиг, настройки, плагины, шаблоны, кодоген). Новый `tests/plain-folder.spec.ts` (цели `dev` и `dist`): `seed({ uiBuilder: false })` → `openFolder()` (POM ждёт дерево) → `forms/contact/form.schema.json` открывается редактором схемы, `forms/contact.rjsf.json` — редактором RJSF; после открытия снимок диска без `.ui_builder/` (ничего не создано); перезагрузка страницы — проект восстановлен |
| e2e `tests/application-plugins.spec.ts:14-17` | снять `test.skip` «слой только у собранного»: слой теперь и под dev; шапку поправить. Остальные наборы цели `dev` (`forms`, `code-editor`, `markdown`, `plugins`, `project` «открытие не меняет файлы») прогнать: плагины те же, но экземпляры — приложения, а не проекта |

### 4. Документация

| Файл | Правка |
| --- | --- |
| `projects/reformer-builder/docs/composition.md:333-345` | слой под `npm run dev` есть по умолчанию (набор опубликованного билдера из сборок на месте); `REFORMER_BUILDER_PLUGINS` — другой каталог/набор, пустое значение выключает; «любой каталог открывается, как под лаунчером» |
| `projects/reformer-builder-playground/README.md:66` | у `npm run builder` — те же плагины приложения, что у `builder:dist` |
| `projects/reformer-builder/docs/plugin-and-shell.md:619` | упоминание переменной остаётся верным; добавить «по умолчанию — набор пакета» |
| `projects/reformer-builder/README.md` «Работа»/«Ограничения» | одна фраза: каталог без `.ui_builder` открывается; настройки проекта до появления каталога хранятся в браузере |
| `projects/reformer-builder/docs/decisions-log.md` | запись «Любой каталог под dev-сервером: слой по умолчанию, настройки без `.ui_builder` — в браузере»: 🔀 слой по умолчанию (пересмотр eeq0.9 «по просьбе»: пустое окно у любого, кто открыл не playground); 🔀 настройки в браузер, а не `mkdir` (91ee: плагины пишут при старте — каталог появлялся бы везде); 🔀 копии в проекте уступают, живой каталог сохраняет перезапуск по правке; ⚠️ e2e никогда не открывал каталог без `.ui_builder`; «Проверка:» |

### 5. Учёт и коммиты (коммит — только по просьбе)

- `bd create "builder: каталог без .ui_builder под dev-сервером — пустое окно и потеря настроек" -t bug`,
  claim; в описании сослаться на ReFormer-91ee (не чинится здесь) и eeq0.9.
- Коммиты: `fix(reformer-builder): …` (vite.config, settings-layers, unit-тесты, docs);
  `test(reformer-builder-playground-e2e): …` (засев, новый spec, снятие skip);
  `chore(beads): sync issues jsonl`. `fix(reformer-builder)` на `develop` попадёт
  в `3.0.0-beta.15` вместе с t51r.

## Проверка

```bash
cd projects/reformer-builder && npx tsc -b && npm test
npm run plugins:build -w reformer-builder-playground
npm run test:e2e -w reformer-builder-playground-e2e          # цель dev: новый spec + снятый skip
npm run build -w @reformer/builder && npm run plugins:dist -w reformer-builder-playground \
  && npm run build:plugins -w @reformer/builder && npm run test:e2e:dist -w reformer-builder-playground-e2e
```

Вручную: `npm run builder -w reformer-builder-playground` → «Файл → Открыть папку…» → любой
каталог без `.ui_builder` (настоящий диалог File System Access, автоматизации не поддаётся):
дерево и редакторы на месте; выбрать кит в строке состояния → после перезагрузки выбор на месте;
в каталоге не появилось `.ui_builder`. Затем открыть playground: его копии плагинов в списке
помечены как перекрытые, формы и редакторы работают.

## Риски

- **Цель `dev` в e2e** теперь с живым слоем приложения: наборы про редакторы и формы работают
  экземплярами приложения, а не проекта. Падения правятся по месту; если какой-то сценарий
  проверяет именно проектную копию — ему нужен явный `REFORMER_BUILDER_PLUGINS=` в описании теста,
  а не откат умолчания.
- **`npm run dev` без собранных плагинов** — предупреждение с подсказкой, не отказ; дерева
  не будет, пока плагины не собраны (как раньше, но с объяснением в консоли сервера).
- **`not-found` при записи настроек** приходит только от файлового источника; у других источников
  (память, HTTP) отказ с иным кодом по-прежнему пробрасывается — поведение не меняется.
- **91ee не чинится**: плагины по-прежнему пишут настройки при старте; в каталоге с `.ui_builder`
  файл по-прежнему переписывается тем же содержимым.
