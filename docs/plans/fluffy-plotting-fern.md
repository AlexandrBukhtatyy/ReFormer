# Недавние проекты в reformer-builder — «Открыть недавние» как в VSCode

## Контекст

Нужна фича «недавно открытые», как в VSCode. В билдере проект — это одна локальная папка
(File System Access). Одновременно открыт один проект; переключение идёт без перезагрузки,
несохранённые правки переживают его (рабочая копия лежит в OPFS/IndexedDB по проекту).

Сырьё для списка уже копится, но пользователю не показывается:

- `WorkspaceRecord` хранит `label` (имя папки) и `lastOpenedAt`
  ([idb.ts:84-95](projects/reformer-builder/src/shell/platform/workspace/storage/idb.ts#L84-L95));
- `listWorkspaces()` отдаёт записи от свежих к старым, но читает его только `restoreLast()`
  ([project.ts:322-345](projects/reformer-builder/src/shell/boot/project/project.ts#L322-L345)).

Чего нет:

- открытия проекта по id;
- выбора из списка, который команда может открыть и дождаться;
- стартовой страницы (слот `editor.main` пуст).

Попутный дефект: уведомление при старте просит нажать «Разрешить доступ», а кнопки нет
([boot.ts:265-272](projects/reformer-builder/src/shell/boot/boot.ts#L265-L272)).

**Согласовано с пользователем:**

- **Объём** — недавние проекты на трёх поверхностях: подменю «Файл › Открыть недавние»,
  «Открыть недавние…» по `Ctrl+R` (список с кнопкой «убрать»), блок «Недавние» на стартовой
  странице.
- **Владелец** — плагин `files`, рядом с «Открыть папку…». Список и «открыть по id» живут
  в `ProjectHost`, до плагина доходят через порт `FilesHost`.

**Что берём у VSCode** (сверено по исходникам):

- в меню до 10 пунктов, затем «Ещё…» и «Очистить…»;
- `Ctrl+R` открывает список, у каждого пункта кнопка «Remove from Recently Opened»;
- на Welcome до 5 пунктов, текущий проект исключён, плюс «Ещё…»;
- «убрать из недавних» не удаляет данные, а повторное открытие возвращает проект в список.

## Шаг 0 — перед стартом

- В рабочем дереве лежит незакоммиченная Phase 0 плана v4: `boot.ts`, `sdk/index.ts`,
  `plugins.ts`, `plugin-and-shell.md`, служба документов. Фича трогает те же файлы.
  Спросить пользователя: закоммитить Phase 0 отдельно до начала (рекомендую) или работать
  поверх.
- `bd create --type=feature` — «builder: недавние проекты (Open Recent как в VSCode)»,
  затем `bd update <id> --claim`.

## 1. Хранилище: флаг вместо удаления

Файл: [idb.ts](projects/reformer-builder/src/shell/platform/workspace/storage/idb.ts)

- **`WorkspaceRecord.hiddenFromRecent?: boolean`.** Не `removeWorkspace`: тот стирает
  журнал и вкладки, а рабочая копия с несохранёнными правками остаётся в OPFS сиротой.
- **`WorkspaceMetaStore.hideWorkspaces(ids): Promise<void>`.**
  - Чтение и запись одной транзакцией по `workspaces`, как в `putWorkspaceSettings`: так не
    затирается `lastOpenedAt`, который параллельно пишет `start()`.
  - Неизвестные id пропускаются; вызов идёт как `write(undefined, …)`.
  - В `unavailableStore()` (:828) добавить `hideWorkspaces: fail`.
- **Версию БД не поднимаем** — поле необязательное.
- **`start()` пишет запись заново и флаг не переносит** — это намеренно: любое открытие
  (включая восстановление) возвращает проект в список, как VSCode возвращает текущую область
  при старте. Оставить об этом комментарий.

## 2. Список и «открыть по id»

Каталог `shell/boot/project/`.

**Новый модуль `recent.ts`** (в каталоге станет 8 модулей из 15):

- `RecentProject { id; label; lastOpenedAt }`.
- Чистая функция `recentFromRecords(records, currentId)`:
  - пропускает скрытые записи и текущий проект;
  - порядок сохраняет (список уже от свежих к старым);
  - если `label` нет, подпись — id.
- `createRecentProjects({ meta, currentId })` возвращает
  `{ get(); subscribe(); refresh(); forget(id); clear() }`.
  - `get()` отдаёт стабильный снимок: его читают синхронные `items()` меню и
    `useSyncExternalStore`. Приём тот же, что `TemplateSnapshot` в
    [context-menu.ts:100-135](projects/reformer-builder/src/plugins/templates/commands/context-menu.ts#L100-L135).
  - Подписка отдельная от `ProjectHost.subscribe`. Иначе смена списка гоняла бы тяжёлых
    подписчиков смены проекта в `boot.ts`: гидрацию настроек и синхронизацию плагинов каталога.
  - `clear()` скрывает всех, кроме текущего.
  - Отказ хранилища даёт пустой список и `console.error`, а не падение.

**[project.ts](projects/reformer-builder/src/shell/boot/project/project.ts):**

- **`ProjectHost.recent: RecentProjects`.** Снимок обновляется:
  - после `putWorkspace` в `start()`;
  - в `setSession`, потому что меняется исключаемый текущий проект.
- **`ProjectHost.openWorkspace(id): Promise<boolean>`.**
  - Тело `restoreLast()` выносится во внутренний `reopen(record)`.
  - `openWorkspace`: `getWorkspace(id)`, затем `reopen`.
  - `restoreLast`: берёт первую запись; если она `hiddenFromRecent`, возвращает `false`
    («последний проект — первая запись» сохраняется).
  - Если id уже открыт — возвращает `true`, сессию не пересоздаёт.
- **`ProjectFailure.workspaceId?: string`** заполняется при неудаче `reopen`, чтобы сообщение
  могло предложить действие.
- **Комментарий про жест пользователя.** `openWorkspace` зовут из щелчка или Enter, и
  `requestPermission` успевает в окно активации: перед ним только чтения IndexedDB.

## 3. Кнопки в уведомлениях об отказе

Файл: [boot.ts](projects/reformer-builder/src/shell/boot/boot.ts)

- **Новый модуль `shell/boot/project/project-failure.ts`** (в каталоге станет 9 модулей).
  Туда переезжает `projectFailureMessageKey`: сейчас это экспорт `boot.ts` без теста и без
  других потребителей, а node-тест не должен тянуть за собой всё приложение.
- **Там же чистая `projectFailureAction(failure, { reopen, forget })`.** Для `unavailable`
  с `workspaceId`:
  - `denied` → кнопка «Разрешить доступ», которая зовёт `project.openWorkspace(id)`; щелчок по
    тосту — это жест. Так закрывается существующий дефект;
  - `missing` → кнопка «Убрать из недавних», которая зовёт `project.recent.forget(id)`.
- **`reportProjectFailure`** передаёт действие в `notifications.info(…, { action })`.
- **Словарь Host** ([ru.json](projects/reformer-builder/src/shell/platform/services/i18n/locales/ru.json),
  en.json):
  - добавить ключи `files.notify.action.grant` и `files.notify.action.forget`;
  - текст `files.notify.unavailable.missing` сделать нейтральным: он теперь и про открытие из
    списка, а не только про «прошлый проект».

## 4. Выбор из списка — третий вид `PromptService`

Почему здесь: плагин шаблонов прямо назвал «выбери из списка» недостающим третьим видом
службы запросов ([context-menu.ts:49-56](projects/reformer-builder/src/plugins/templates/commands/context-menu.ts#L49-L56)).
`Ctrl+R` нужен клавиатурный список, меню этого не умеет. Палитра тоже не подходит: это общий
список команд без своего режима и без кнопок у пунктов.

**[prompt.ts](projects/reformer-builder/src/shell/platform/services/prompt.ts):**

- `PromptPickItem { id; label; description? }`.
- `PromptPickRequest extends PromptRequestBase`: `kind: 'pick'`, `items`, `placeholderKey?`,
  `emptyKey?`, `remove?: { labelKey; run(id) }`.
- `pick(request): Promise<string | null>` — возвращает id выбранного пункта или `null` при
  отмене.
- Очередь, `cancelAll` и `MAX_PENDING` общие с `input` и `confirm`.
- Шапку модуля дополнить третьим видом.

**Новый `shell/platform/ui/dialogs/PickPrompt.tsx`** (в каталоге станет 10 модулей):

- Каркас как у [CommandPalette.tsx](projects/reformer-builder/src/shell/platform/ui/menu/CommandPalette.tsx):
  окно кита и `Command` с `shouldFilter={false}`, `top-[12vh]`, ширина 560, не больше 50
  видимых пунктов.
- Отбор — `filterPaletteItems` из [palette.ts](projects/reformer-builder/src/shell/platform/ui/menu/palette.ts):
  те же правила поиска (подстрока, слова по «И»), `order` = индекс, то есть свежесть.
- Изоляция клавиш скопирована из палитры: `stopPropagation` на стрелках, Home, End и Enter,
  плюс `onEscapeKeyDown`.
- Кнопка «убрать» (lucide `X`, `aria-label` из `remove.labelKey`):
  - `preventDefault` на pointerdown и `stopPropagation` на click, чтобы не выбирать пункт и не
    уводить фокус из поля;
  - пункт исчезает локально, окно остаётся открытым.

**[PromptHost.tsx](projects/reformer-builder/src/shell/platform/ui/dialogs/PromptHost.tsx):**
третья ветка `pending.kind === 'pick'`; словарь владельца выбирается по `pluginId`, как у
остальных видов.

**[sdk/index.ts](projects/reformer-builder/src/sdk/index.ts):** экспорт типов
`PromptPickItem` и `PromptPickRequest` рядом с `PromptService`. Поверхность растёт по факту
потребления — ими пользуется плагин `files`.

## 5. Плагин files: команды, меню, стартовая страница

**Порт [host.ts](projects/reformer-builder/src/plugins/files/host.ts):**

- Необязательный `recent?: FilesRecentProjects` с методами `list()`, `onDidChange(cb)`,
  `open(id)`, `forget(id)`, `clear()`, плюс структурный `FilesRecentProject`.
- Необязательный — по тому же образцу, что `openResource?` и `nameOf?`: без него плагин не
  вносит «недавние», двойники в `ProblemsPanel.browser.test.tsx` не трогаем.
- Тип экспортировать из [index.ts](projects/reformer-builder/src/plugins/files/index.ts).

**Композиция [ports/files.ts](projects/reformer-builder/src/shell/boot/ports/files.ts):**
`recent` собирается из `project.recent` и `project.openWorkspace`; каждый вызов читает текущее
состояние, как весь остальной порт.

**Новый `plugins/files/recent.ts`.** В корне плагина станет 3 доменных модуля из 6; форма та
же, что у `operations.ts`: команды плюс пункты меню.

- **`files.openRecent`** — «Открыть недавние…».
  - `keybinding: 'mod+r'`, `allowInEditable: true`, **без `enabled`**. Диспетчер гасит
    перезагрузку страницы (`preventDefault`), только если правило сработало; иначе `Ctrl+R`
    перезагрузит страницу, в том числе из Monaco.
  - `run(args)` с `{ id }` зовёт `recent.open(id)`.
  - Без аргументов:
    1. если `prompt.current() !== null` — выход. Повторный `Ctrl+R` внутри списка дойдёт до
       команды снова, потому что область даёт приоритет, а не исключительность
       ([scope.ts:16-22](projects/reformer-builder/src/shell/platform/ui/keyboard/scope.ts#L16-L22));
    2. `prompt.pick(...)`: пункты из `list()`, в `description` — дата последнего открытия
       (`Intl.DateTimeFormat`), чтобы различать одноимённые папки, раз путей File System
       Access не даёт; `remove.run` = `recent.forget`;
    3. выбранный id уходит в `recent.open(id)`.
- **`files.clearRecent`** — «Очистить список недавних…».
  - `enabled`, если список не пуст и служба запросов есть.
  - `prompt.confirm` с пояснением «рабочие копии и несохранённые правки останутся», затем
    `recent.clear()`.
- **Меню.**
  - Подменю `{ menu: 'file', submenu: 'file/recent', group: '1_open', order: 10 }`.
  - Внутри `file/recent`:
    - динамическая группа `1_projects`: до 10 пунктов с командой `files.openRecent`,
      `args: { id }` и `title: label`;
    - `2_more` «Ещё…» — та же команда без аргументов, у пункта показано `Ctrl+R`;
    - `3_clear` — `files.clearRecent`.
  - `onDidChange` вешается на подменю и на группу, как у шаблонов
    ([context-menu.ts:264-298](projects/reformer-builder/src/plugins/templates/commands/context-menu.ts#L264-L298)).

**Новый `plugins/files/ui/WelcomePage.tsx`** — панель `files.welcome` в слоте `editor.main`.
Слот показывается, когда нет открытых вкладок, и с проектом, и без него
([EditorArea.tsx:245-249, 321-334](projects/reformer-builder/src/shell/platform/ui/chrome/EditorArea.tsx#L245-L249)).

- «Открыть папку…» зовёт `files.openProject`. Если `!canOpenProject()`, кнопка неактивна и
  рядом подсказка.
- «Недавние»: до 5 пунктов, щелчок зовёт `files.openRecent` с `{ id }`; «Ещё…», если пунктов
  больше; текст для пустого списка.
- Подписка — `useSyncExternalStore(recent.onDidChange, recent.list)`.
- Команды — через `CommandAccess` ([diagnostics.ts:43](projects/reformer-builder/src/plugins/files/diagnostics.ts#L43)),
  перевод — `host.useTranslate()`.

**[plugin.ts](projects/reformer-builder/src/plugins/files/plugin.ts):** в `activate` всё это
регистрируется и вносится только при наличии `host.recent`. Сам `host.recent` при активации
не вызывается: контракт требует только регистрировать, а стенд композиции подставляет
Proxy-заглушку.

**Словарь [messages.ts](projects/reformer-builder/src/plugins/files/messages.ts)** (ru и en):
`files.command.openRecent`, `files.command.clearRecent`, `menu.recent`, `menu.recent.more`,
`recent.pick.*`, `recent.clear.*`, `welcome.*`.

## 6. Запись решений

- **[decisions-log.md](projects/reformer-builder/docs/decisions-log.md)** — запись под
  `## 2026-09-11` в формате записи от 2026-09-05:
  - флаг вместо удаления;
  - `pick` как третий вид запроса;
  - владелец — плагин `files`;
  - перехват `Ctrl+R`;
  - `restoreLast` не поднимает скрытую первую запись;
  - кнопки в уведомлениях об отказе.
- **[menu.ts:297-300](projects/reformer-builder/src/shell/platform/ui/menu/menu.ts#L297-L300)** —
  комментарий, что недавние проекты приходят от Host через `hostMenuEntry`, переписать под
  принятое решение: открытие проектов показывает плагин, данные Host отдаёт портом.
- **[plugin-and-shell.md](projects/reformer-builder/docs/plugin-and-shell.md)** — строка
  про `prompt.pick` в разделе служб.

## Тесты

Рядом с кодом, заголовки на русском.

| Файл | Что проверяем |
|---|---|
| `workspace/storage/idb.test.ts` | `hideWorkspaces`: ставит флаг, пропускает неизвестные id; `putWorkspace` без флага возвращает запись в список |
| `boot/project/recent.test.ts` (новый) | фильтр скрытых и текущего, стабильность снимка, `forget`/`clear` вызывают `hideWorkspaces` с нужными id |
| `boot/project/project.test.ts` (стенд :49-112) | `openWorkspace`: успех, неизвестный id, `unavailable` с `workspaceId`, уже открытый; `restoreLast` при скрытой первой записи; повторное открытие снимает флаг |
| `services/prompt.test.ts` | `pick`: ответ, отмена, `cancelAll`, общая очередь |
| `dialogs/PromptHost.browser.test.tsx` | список, фильтр, Enter выбирает первый, Escape даёт `null`, «убрать» не выбирает пункт и оставляет окно, пустой список |
| `plugins/files/recent.test.ts` (новый) | `mod+r` и `allowInEditable`, с аргументами и без, защита от повтора, `clearRecent` с подтверждением, меню: подменю, ≤10 пунктов, «Ещё…» без аргументов |
| `plugins/files/plugin.test.ts` | вклады при `host.recent` и деградация без него |
| `plugins/files/ui/WelcomePage.browser.test.tsx` (новый) | ≤5 пунктов плюс «Ещё…», пустой список, щелчок зовёт команду с `{ id }`, обновление по сигналу |
| `boot/project/project-failure.test.ts` (новый) | ключ сообщения по виду и причине; `denied` даёт «Разрешить доступ», `missing` — «Убрать из недавних»; без `workspaceId` кнопки нет |

Существующие сторожа это поймают сами: `structure.test.ts`, `i18n-completeness` (словари
`files` и Host), `keybindings-wiring` (конфликтов по `mod+r` нет), `plugins.test.ts`.

## Проверка

1. Из каталога `projects/reformer-builder`, **не из корня**: `npm test`,
   `npm run test:browser`, `npm run lint`, `npx tsc -b`.
2. Сквозной прогон на dev-сервере (`npm run dev`, порт 5174) через playwright MCP.
   `showDirectoryPicker` подменяется каталогами OPFS — приём из записи decisions-log от
   2026-09-05. Сценарий:
   - открыть `proj-a`, затем `proj-b`: «Файл › Открыть недавние» показывает `proj-a`;
   - `Ctrl+R`, в том числе с фокусом в Monaco, открывает список без перезагрузки страницы;
   - Enter переключает на `proj-a`, и `proj-b` появляется в списке;
   - `X` убирает пункт;
   - «Очистить…» спрашивает подтверждение;
   - стартовая страница видна без вкладок;
   - перезагрузка поднимает последний проект.

   Скриншоты — в `projects/react-playground-e2e/screenshots/builder-recent/`.
3. Руками в Chrome на настоящей папке (у OPFS доступ всегда выдан, автоматизировать нельзя):
   - после перезапуска браузера кнопка «Разрешить доступ» в уведомлении поднимает проект;
   - щелчок по недавнему пункту вызывает запрос разрешения браузера.

## Вне объёма — завести в beads

- Недавние файлы внутри проекта (история в `Ctrl+P`): нужен быстрый переход к файлу. Второй
  этап, по решению пользователя.
- Повторное `Ctrl+R` двигает выделение по списку (quick navigate из VSCode).
- Команда «Закрыть папку»: `ProjectHost.close()` есть, в интерфейсе её нет.
- Уборка брошенных рабочих областей: `removeWorkspace` и `handles.remove` никто не зовёт.

## Ограничения

- Подпись — только имя папки: File System Access пути не даёт. Одноимённые папки различаются
  датой в описании пункта.
- «Очистить кэш» стирает обе базы, а значит и список недавних.
- `Ctrl+R` перехватывает перезагрузку страницы, как в vscode.dev. F5 работает; сочетание
  переназначается через `host.keymap`.
