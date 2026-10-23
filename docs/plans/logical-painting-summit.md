# Нижняя панель «Журнал» и запись в журнал из плагинов

## Context

Нижняя панель билдера называется «Проблемы». Она показывает только живой свод диагностик
(`DiagnosticsService`). У плагинов нет способа оставить человеку запись о том, что произошло:
сбой загрузки, отказ команды, подробности ошибки. Сейчас всё это уходит в `console.error`, а тосты
отсылают к консоли («Подробности — в консоли»).

Что делаем:
- переименовываем панель в «Журнал»;
- даём в SDK службу, через которую любой плагин пишет записи в журнал;
- журнал показывает два вида с переключателем: «Проблемы» (как сейчас) и «События» (лента записей).

Решения, принятые с пользователем:
- **Вид панели.** Строка над списком: «Проблемы N | События M | Очистить». Виден один вид из двух.
- **Текст записи.** `messageKey` + `params` переводятся при показе, как у уведомлений и диагностик.
  Непереводимые подробности (текст исключения, стек) идут в поле `detail`.
- **Что оболочка пишет сама.** Сбои плагинов: отказ активации, деактивации или `provides`, проблемы
  каталога (загрузка, ленивый импорт) и отказы `run` команд.
- **Где живёт панель.** Новый плагин приложения `base/journal`. Панель проблем переезжает в него из
  `base/files`.

Название службы — `LogService` (`reformer.log`), а не «journal». Слово «журнал» в коде уже занято:
так называется журнал правок рабочей области (`shell/platform/workspace/journal/*`, `JournalOrigin`
в SDK). «Журнал» — только подпись в интерфейсе.

## 0. Задача beads

Перед кодом заводится задача: `bd create --type=feature`, «Нижняя панель „Журнал“ и служба записей
`reformer.log` в SDK». Её ID ставится в `Refs:` коммитов.

## 1. SDK — `packages/reformer-builder-plugin-api`

**Новый файл `src/services/log.ts`** — объявление по образцу `services/notifications.ts`:

```ts
export type LogLevel = 'info' | 'warning' | 'error';

export interface LogEntryRequest {
  readonly level?: LogLevel;              // по умолчанию 'info'
  readonly source: string;                // о ком запись — обычно ctx.id; подпись строки
  readonly messageKey: string;            // голый — словарь оболочки; свой — pluginMessageKey(ctx.id, key)
  readonly params?: Record<string, unknown>;
  readonly detail?: string;               // непереводимые подробности, показываются как есть
  readonly resource?: ResourceId;         // щелчок по строке открывает ресурс
}
export interface LogEntry extends LogEntryRequest { readonly id: string; readonly level: LogLevel; readonly time: number }
export interface LogService {
  append(entry: LogEntryRequest): LogEntry;
  entries(): readonly LogEntry[];         // по порядку поступления; ТА ЖЕ ссылка между изменениями
  clear(): void;
  observe(cb: () => void): Disposable;
}
export const LogServiceToken = defineService<LogService>('reformer.log');
export function errorDetail(error: unknown): string | undefined; // stack ?? message ?? String(error)
```

- Вспомогательных `info/warning/error` нет. Правило шапки `index.ts` — «по факту, а не на будущее»,
  а `append` покрывает всё.
- `errorDetail` — чистая функция в SDK. Ошибку в `detail` превращают и оболочка, и плагины, и копия
  у каждого разошлась бы (тот же довод, что у `usableFixes`).
- Экспорт из `src/index.ts`: `LogServiceToken`, типы `LogService`/`LogEntry`/`LogEntryRequest`/`LogLevel`,
  `errorDetail`. Место — рядом с `NotificationsServiceToken` (L230–235). Строка в `internal.ts` —
  как у notifications (L43).

**Новый файл `src/services/diagnostics/summary.ts`.** Сюда из `base/files/src/diagnostics.ts`
переезжают `summarize` (новое имя — `summarizeDiagnostics`) и типы `SeverityCounts`/`DiagnosticsSummary`.
Свод ресурса теперь нужен двум плагинам: пометке в дереве (files) и значку и группам журнала
(journal). Плагины друг друга не видят. Экспорт — рядом с `SEVERITY_RANK` (L531–535). Тесты
переезжают из `files/src/diagnostics.test.ts` в `summary.test.ts`.

**Реестр команд.** В `CommandRegistryOptions` (`src/primitives/command.ts` ~L373) добавляется
необязательный `onRunError?: (error, info: { commandId; owner?: string }) => void`. Оболочка зовёт его,
когда `run` бросил или отклонил промис, а затем пробрасывает ошибку дальше. Отдельный колбэк, а не
новая фаза `onError`: вызывающие (меню, вкладки, палитра) уже пишут в консоль сами, и умолчание
`onError` задвоило бы вывод.

Тест `module-specifiers.test.ts` требует расширение `.js` в относительных импортах — соблюдать.
`README.md`: короткий раздел «Журнал» с контрактом рядом с «Контракт словаря». Что пишется, кем
переводится, что такое `source`/`detail`/`resource`, память только на сессию.

## 2. Оболочка — `projects/reformer-builder`

- **`src/shell/platform/services/log.ts` + `log.test.ts`** — `createLogService()` по образцу
  `services/notifications.ts`:
  - своя шина `defineEvent('log.didChange')`;
  - замороженный снимок с кэшем;
  - id вида `l${n}`, `time: Date.now()`;
  - кольцевой предел `MAX_ENTRIES = 500` (старые вытесняются);
  - `clear`.
- **`src/shell/platform/primitives/command.ts`, `execute` (L206–225)** — `try { return await command.run(args) }`.
  В `catch`: `options.onRunError?.(error, { commandId, owner })`, затем `throw`. Ошибки `CommandError`
  (`not-found`, `disabled`) бросаются раньше и в колбэк не попадают. `AbortError` пропускается:
  отмена — не сбой. Тест — в `command.test.ts`.
- **`src/shell/boot/boot.ts`:**
  - `const log = createLogService()` создаётся ДО `createCommandRegistry` (L445), регистрация —
    `services.register(LogServiceToken, log)` рядом с L516–517;
  - `createCommandRegistry({ ..., onRunError })` → `log.append({ level: 'error', source: owner ?? 'host',
    messageKey: 'log.command.failed', params: { commandId }, detail: errorDetail(error) })`;
  - `createPluginRegistry({ ..., onError })` (L656) → прежний `console.error` плюс запись
    `log.plugin.failed` с `{ id, phase }` и `detail`;
  - `reportPluginProblem` (L815) → плюс запись `log.plugin.problem` с `{ id, code, message }`
    и `detail: errorDetail(problem.cause)`. Тост остаётся.
- **Словарь оболочки** `src/shell/platform/services/i18n/locales/{ru,en}.json`: ключи `log.command.failed`,
  `log.plugin.failed`, `log.plugin.problem`. Полноту проверит `boot/integration/i18n-completeness.test.ts`.
- **Тест на проводку.** Отказ `activate` у тестового плагина и отказ `run` команды дают по записи
  в `LogServiceToken`. Место — рядом с тестами boot (`shell/boot/integration/`).

## 3. Новый плагин `base/journal` — `projects/reformer-builder-playground/.ui_builder/plugins/base/journal/`

Каркас копируется с `base/files`:
- `package.json` (`@reformer/builder-base-journal`, те же скрипты и devDependencies);
- `tsconfig.json`, `vitest.config.ts`, `vitest.browser.config.ts`, `.gitignore`;
- в `src/`: `manifest.json` (`id: reformer.journal`, `name: «Журнал»`, styles scoped, БЕЗ permissions),
  `contract.ts`, `messages.ts`, `index.ts`, `main.ts`, `locales/{ru,en}.json`.

Модули:
- **`host.ts` / `host-from-context.ts`** — порт `JournalHost`. Из `FilesHost` сюда переезжают поля,
  нужные только панели: `useTranslate`, `useDiagnosticMessage`, `useQuickFixTitle`, `openResource`,
  `documentOf` (имя открытого документа), `nameOf`.
  - Новое поле — `useHostMessage()`: `useTranslate(HostMessagesCapability)`. Служба уже переводит
    и голый ключ, и ключ с владельцем (`host-messages.ts` L30–32), поэтому этим же переводятся
    записи журнала.
  - Тесты переезжают из `files/src/host-from-context.test.ts` (openResource/nameOf).
- **`problems.ts`** (+ тест) — `groupProblems`, `ProblemRow`, `ProblemGroup`, `ResourceNaming`,
  `CommandAccess`, `totalCounts` из `files/src/diagnostics.ts`. Свод — через SDK `summarizeDiagnostics`.
- **`events.ts`** (+ тест) — чистые правила ленты: порядок «новые сверху», формат времени
  (`Intl.DateTimeFormat(locale, { timeStyle: 'medium' })`), подсчёт по уровням для переключателя.
- **`view-state.ts`** — какой вид выбран («Проблемы»/«События»). Хранится в замыкании `activate`,
  чтобы выбор пережил размонтирование тела при свёртке дока. Без хранилища — только на сессию.
- **`ui/JournalPanel.tsx`** — строка-переключатель (Toggle/ToggleGroup из `@reformer/ui-kit`)
  со счётчиками, кнопка «Очистить» (только в «Событиях», недоступна при пустом журнале), тело вида.
- **`ui/ProblemsView.tsx`** — бывший `files/src/ui/ProblemsPanel.tsx` без изменений поведения.
  Браузерный тест переезжает с ним.
- **`ui/EventsView.tsx`** — строки: время, значок уровня (те же `CircleX/CircleAlert/Info`), `source`
  бейджем, переведённое сообщение. `detail` свёрнут и раскрывается щелчком. Строка с `resource`
  открывает ресурс. Пустое состояние — «Записей нет». Подписка `useSyncExternalStore(log.observe, log.entries)`.
  Свой браузерный тест.
- **`ui/JournalBadge.tsx`** — бывший `ProblemsBadge`: считает находки, как сейчас. События в значок
  не идут: у ленты нет признака «прочитано», а сбои плагинов и так показывает тост.
- **`plugin.ts`:**
  - вносит `PanelPoint` `{ id: 'journal.panel', slot: 'panel.bottom', titleKey: 'journal.title', icon: ScrollText, order: 10, Badge, Body }`;
  - `CommandAccess` строится над `ctx.commands`, как в files L273–280. Сбой быстрого исправления
    идёт записью в журнал, а не в `console.error`.
- **Словарь:** `journal.title` «Журнал» / "Log"; `journal.view.problems` «Проблемы» / "Problems";
  `journal.view.events` «События» / "Events"; `journal.clear` «Очистить» / "Clear";
  `events.empty.*`; `problems.empty.*`; `problems.origin` (перенос); `fix.failed`.
- Сохранённая вкладка дока `files.problems` пропадёт. `resolveActivePanelId` (`chrome/panels.ts` L98–105)
  сам выберет первую видимую, то есть журнал (order 10). Миграция настроек не нужна.

**Регистрация плагина:**
- `projects/reformer-builder/application-plugins.json` и `application-plugins.embedded.json` —
  `"base/journal"` сразу после `"base/files"`;
- `npm install` из корня — новый workspace попадёт в `package-lock.json`.

## 4. Плагин файлов `base/files` — что уходит и что меняется

- Удаляются `src/ui/ProblemsPanel.tsx`, `ProblemsPanel.browser.test.tsx`, `ProblemsBadge.tsx`.
- Из `plugin.ts` уходят `filesProblemsPanel`, `FILES_PROBLEMS_PANEL_ID`, `ProblemsIcon` и вклад панели.
- Из `diagnostics.ts` уходит всё, кроме `SEVERITY_TONE` и `diagnosticDecoration`. `summarize` берётся
  из SDK.
- Из `host.ts`/`host-from-context.ts` уходят поля только для панели.
- Из словарей уходят `problems.*`. `tree.problems.*` остаются.
- **Первый потребитель журнала.** В `operations.ts` `report()` (L193–196) при наличии `error`
  делает `deps.log?.append({ level: 'error', source: FILES_PLUGIN_ID, messageKey: notifyKey(key), detail: errorDetail(error) })`.
  - `log` — новое необязательное поле `FilesOperationsDeps`; в `plugin.ts` —
    `ctx.services.get(LogServiceToken) ?? null`.
  - Тексты `notify.*.failed` в ru/en меняются: «Подробности — в консоли» → «Подробности — в журнале».
  - `console.error` остаётся для разработчика.
- Шапки модулей и описание в `package.json` правятся: «панель проблем» больше не здесь.
- Тесты: `plugin.test.ts` (панели проблем больше нет), `diagnostics.test.ts` (остаётся пометка),
  `operations.test.ts` (отказ пишет запись в журнал с `detail`).

## 5. Тексты в других плагинах

Ссылки на панель в интерфейсе редактора схемы, `plugins/reformer/editor/src/locales/{ru,en}.json`:
- `canvas.textOnly`: «…в панели проблем…» → «…в журнале…» (en: "…in the log…");
- `canvas.problems.unplaced`: «— см. панель проблем» → «— см. журнал».

Комментарии в коде других плагинов, где упоминается «панель проблем», не трогаются: вид «Проблемы»
в журнале остался, и смысл у них верный.

## 6. Интеграционные тесты доменов

- `base/integration/application.ts`: в `BASE_PLUGINS` добавляется `{ manifest: journalManifest, create: () => createJournalPlugin() }`.
- `base/integration/base-domain.test.ts`:
  - в списке статусов появляется `'reformer.journal'`;
  - у files остаётся только `panel.left:files.tree`;
  - новая проверка: журнал вносит `panel.bottom:journal.panel` и получает `LogServiceToken` настоящей
    оболочки.
- Статусы перечислены и в `rjsf/integration/rjsf-profile.test.ts:147`, `forms/integration/forms-platform.test.ts:92`
  и `reformer/integration/assistant-contributions.test.ts:60,65` — туда тоже добавляется `'reformer.journal'`.
- `i18n-completeness.test.ts` (base): `JOURNAL_MESSAGES` в `DICTIONARIES`. Тест «список не отстаёт»
  сам потребует его добавить.

## 7. Документация

- `projects/reformer-builder/docs/plugin-and-shell.md` — раздел «Theme, Notifications, Workers»
  (L729) становится «Theme, Notifications, Log, Workers»; абзац о `reformer.log`.
- `composition.md` L71/L83 и `projects/reformer-builder-playground/README.md` L34: новая строка про
  `reformer.journal`, у `reformer.files` убирается «панель проблем».
- `editors-and-preview.md` L469: «вкладка „Проблемы“» → «вид „Проблемы“ журнала».
- `decisions-log.md`: запись `## Нижняя панель «Журнал» и служба записей reformer.log` в конец файла,
  в принятом формате: ID задачи, 🔀/✅ с причинами, абзац «Проверка: …».
- Имена классов Tailwind в документах буквально не писать: Tailwind сканирует docs
  (память `builder-tailwind-scans-docs`).

## Verification

Пакеты проверяются из своих каталогов, корневой `tsc -b` не запускать.

1. SDK: `npm run test -w @reformer/builder-plugin-api`, `npm run typecheck`, затем
   `npm run build -w @reformer/builder-plugin-api`. Плагины берут типы SDK из dist.
2. Оболочка: `npm test -w @reformer/builder` (log, command, boot-проводка, i18n-completeness),
   `npm run test:browser -w @reformer/builder`, typecheck и lint пакета.
3. Плагины:
   - `npm run test -w projects/reformer-builder-playground/.ui_builder/plugins/base` — files, journal,
     integration;
   - `test:browser` для `base/journal` и `base/integration`;
   - `npm run test -w …/plugins/{forms,reformer,rjsf}` — списки статусов;
   - `typecheck` каждого затронутого плагина.
4. Сборка плагинов: `npm run plugins:build -w reformer-builder-playground`, оба набора включают
   `base/journal`.
5. Хук pre-commit: из корня `npx eslint --ignore-pattern '**/src/mocks/_generated/**' <файлы>` и
   `npx prettier --check` (память `eslint-root-vs-package`).
6. Ручная проверка через playwright MCP на запущенном билдере (скриншоты — в
   `projects/reformer-builder-playground-e2e/screenshots/journal/`):
   - вкладка внизу называется «Журнал», значок считает находки;
   - переключатель «Проблемы / События» работает;
   - отказ операции над файлом (например, переименование в занятое имя) даёт тост
     «Подробности — в журнале» и запись с раскрываемым `detail`;
   - «Очистить» опустошает ленту;
   - выбор вида переживает свёртку дока.
7. E2E: новый `projects/reformer-builder-playground-e2e/tests/journal.spec.ts`. Проверяет вкладку
   «Журнал», переключатель и запись об отказе операции файлов. Прогон — вместе с
   `application-plugins.spec.ts` и `project.spec.ts`.
8. Перед окончанием: `git status docs/specs/` пуст. Коммиты и push — только по явной просьбе
   пользователя. Синхронизация beads — по правилам CLAUDE.md.
