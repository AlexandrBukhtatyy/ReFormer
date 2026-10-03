# Пресеты «движок × кит»: готовые конфиги и переключатель в строке состояния

Обозначения: `B/` = `projects/reformer-builder/`, `SDK/` = `packages/reformer-builder-plugin-api/src/`,
`HEXA/` = `packages/ui-kits/reformer-hexa-ui/`.

## Контекст

Конструктор уже умеет все четыре сочетания — ReFormer + ReFormer UI, ReFormer + HexaUI,
RJSF + ReFormer UI, RJSF + HexaUI, — но собираются они из двух независимых настроек, и ни одна
не доступна человеку «в один щелчок»:

- движок — поле `preset` конфига запуска (`reformer.builder` | `rjsf.builder`), состав плагинов
  фиксируется до `boot`, меняется только правкой файла и перезапуском;
- кит — настройка `plugin.kits.active` (`reformer-ui-kit` | `hexa-ui`), переключается только
  пунктом палитры команд.

Готовых конфигов под сочетания в репозитории нет (документация ссылается на несуществующий
`.tmp/configs/rjsf-hexa.json`), автопроверки четырёх сочетаний тоже нет.

Нужно: четыре готовых файла конфига с dev-скриптами и переключатель сочетаний в самом
конструкторе.

## Принятые решения

С пользователем:

1. **Готовые файлы конфигов** в существующем формате; встроенных профилей под сочетания не заводим.
2. **Переключатель — одна ячейка в строке состояния** «движок · кит», по клику список сочетаний;
   те же пункты в палитре команд; перед сменой движка — подтверждение перезагрузки.
3. **В списке — всё доступное сейчас**: предлагаемые движки × `kits.available()`. Сочетания с
   HexaUI появляются, когда плагин включён в открытом проекте. Организация сужает набор движков
   конфигом запуска.
4. **HexaUI остаётся плагином проекта**; добавляется скрипт сборки демо-проекта.

Мои (можно поправить при согласовании):

| Что | Решение | Почему |
| --- | --- | --- |
| Поле конфига | `presetChoices: string[]` | `presets` отличалось бы от `preset` одной буквой. Сливается списком уровня целиком, как `profiles`. Меньше двух имён — переключения движка нет |
| Настройка выбора | `host.preset`, область user | В ряду `host.locale`, `host.theme`, `host.keymap` |
| Плагин | `B/src/plugins/base/stack-switch/`, id `reformer.stack-switch`, в `builder.base` | Потребитель двух служб, не часть китов и не часть стека; в основе его получают все профили-конструкторы |
| Вид списка | выпадающее меню `@reformer/ui-kit/dropdown-menu` с отметкой текущего | Так выглядел согласованный макет; логика списка остаётся без React |
| Имена профилей | `name`: «ReFormer», «RJSF» вместо «ReFormer Builder», «RJSF Builder» | В списке читается «ReFormer + Kaspersky HexaUI»; `name` нигде больше не показывается |
| Сброс выбора кита | `KitsService.resetChoice()`, возможность `reformer.kit.catalog` 2.1.0 | Ключ настройки — приватная константа плагина китов; минор не ломает внешний `kit-hexa-ui` (`^2`) |

## Поведение, о котором надо знать

Выбор человека в переключателе сильнее конфига запуска — та же доктрина, что уже действует для
кита (`B/docs/decisions-log.md:3331-3350`). Следствие: после переключения в интерфейсе запуск
готового файла может открыть не то сочетание, что в нём записано. Решается явно, без скрытых
правил:

- выбор движка, равный движку конфига, не хранится, а снимает запись;
- в списке есть пункт «Как в конфиге запуска» — снимает оба выбора (движок и кит);
- сохранённый выбор действует, только если профиль входит в проверенный список предлагаемых
  (собирается и содержит сам переключатель — в состав без пути назад попасть нельзя).

Вариант «помнить выбор вместе с `preset` конфига» отвергнут: он закрывает только ось движка, а
готовые файлы попарно делят один `preset`.

## Шаги

Каждый шаг оставляет проверки зелёными.

### 0. Задача в beads

`bd create` — фича под эпиком `ReFormer-tbbt`, `bd update --claim`. Отложенное из раздела
«За рамками» — отдельными задачами.

### 1. Готовые конфиги и демо-проект (независим от остального)

Создать:

- `B/presets/{reformer-ui-kit,reformer-hexa-ui,rjsf-ui-kit,rjsf-hexa-ui}.json` —
  `$schema: "../runtime-config.schema.json"`, `preset`, `defaults.settings["plugin.kits.active"]`.
- `B/scripts/demo-project.mjs` (без зависимостей): каталог `.tmp/builder-presets-demo/` (или
  `--out`); при отсутствии `packages/reformer-builder-plugin-cli/dist/cli.js` собрать SDK и CLI;
  `npm run plugin:build -w @reformer/kit-hexa-ui -- --out <demo>/.ui_builder/plugins/kit-hexa-ui`
  (CLI сам кладёт сборку, копировать `dist/` не нужно); записать `<demo>/.ui_builder/settings.json`
  с `workspace.plugins.enabled: ["kit-hexa-ui"]`, сохранив прочие ключи; скопировать образцы форм.
- `B/scripts/demo-project/forms/contact.rjsf.json` — литерал `sampleForm()` из
  `B/src/plugins/rjsf/core/defaults.ts:36`.
- `B/scripts/demo-project/forms/contact/form.schema.json` — по образцу
  `projects/react-playground/src/pages/debug/builder-tests/test-01/form.json`, только компоненты,
  общие для обоих китов (`Input`, `Checkbox`, `Select`).
- `B/src/application/launch-presets.test.ts`: файлов ровно четыре и они образуют матрицу
  `{reformer.builder, rjsf.builder} × {reformer-ui-kit, hexa-ui}`; `parseRuntimeConfig(...).problems`
  пуст; `applicationFromRuntime` собирает без `console.warn`; образцы распознаются
  `looksLikeRjsfForm` и `looksLikeFormSchema`.

Изменить `B/package.json`: `cross-env` в devDependencies (уже стоит в корневом `node_modules`
от `react-playground`); скрипты `dev:<имя>` вида
`cross-env REFORMER_BUILDER_CONFIG=presets/<имя>.json npm run dev` (вложенный `npm run dev`
сохраняет `predev`); `demo:project`.

### 2. Поле `presetChoices`

- `B/src/shell/boot/runtime-config.ts`: поле в `RuntimeConfig`, ключ в `RUNTIME_CONFIG_KEYS`,
  разбор (список непустых строк, пустой допустим, имена не сверяются — как у `preset`),
  слияние `over ?? base`, шапка модуля.
- `B/runtime-config.schema.json`: свойство и упоминание в корневом описании.
- `B/src/application/profiles/builtin.config.json`:
  `"presetChoices": ["reformer.builder", "rjsf.builder"]`; `name` двух профилей — «ReFormer», «RJSF».
- `B/src/application/profiles/registry.ts`: экспорт `defaultPresetChoices`.
- `B/src/shell/boot/boot.ts:867-875`: строка «`presetChoices` действует только на уровне запуска».
- Тесты: `runtime-config.test.ts` (разбор, слияние, сверка ключей со схемой), `registry.test.ts`
  (умолчание называет существующие профили; `PROFILES.size` остаётся 6).

### 3. Служба профилей в SDK

`SDK/services/application-profiles.ts`, обычный `defineService` (не возможность оболочки):

```ts
export interface ApplicationProfileInfo { readonly id: string; readonly name: string }
export interface ApplicationProfilesService {
  current(): ApplicationProfileInfo;            // собрано на самом деле
  launch(): ApplicationProfileInfo;             // что задаёт конфиг запуска
  offered(): readonly ApplicationProfileInfo[]; // меньше двух — переключения нет
  select(id: string): Promise<void>;            // запомнить и перезапустить; launch.id — снять выбор
}
export const ApplicationProfilesServiceToken =
  defineService<ApplicationProfilesService>('reformer.application.profiles');
```

Экспорт в `SDK/index.ts` (курируемый список) и `SDK/internal.ts`. Относительные импорты с `.js`
(`module-specifiers.test.ts`).

### 4. Оболочка: что собрано, выбор до boot, порт

- `B/src/shell/boot/composition.ts`: `ApplicationComposition.profile: ApplicationProfileInfo`;
  тип `ProfileChoices { launch; offered }`.
- `B/src/application/composer/compose.ts`: `fromProfile` кладёт `profile` — откат
  `applicationFromRuntime` на полный профиль тогда правдив сам собой.
- `B/src/shell/boot/stored-preset.ts`: `PRESET_SETTINGS_KEY = 'host.preset'`,
  `readStoredPreset(): Promise<string | null>` через
  `createIdbSettingsBackend(createWorkspaceMetaStore()).read('user')`; не отвергается никогда.
- `B/src/shell/boot/ports/application-profiles.ts`:
  `createApplicationProfilesService({ current, choices?, settings, reload, stored })`. `select`:
  отказ, если id не в `offered` и не равен `launch`; `await settings.set(KEY, id === launch.id ? undefined : id)`
  (промис разрешается после коммита транзакции); сверка чтением через `stored()` — при
  расхождении исключение без перезагрузки (IndexedDB недоступна); `reload()`, только если id
  отличается от `current.id`.
- `B/src/shell/boot/boot.ts`: `BootOptions.profileChoices?` (:350-368); `reload` — одной константой
  для `storage.reload` (:1150-1154) и службы; регистрация рядом со службой запросов (:457-463).
- Тесты: `stored-preset.test.ts`, `ports/application-profiles.test.ts`,
  `integration/profile-switch.test.ts` (настоящий boot, заглушка перезагрузки, после `select`
  запись читается `readStoredPreset()`).

### 5. Плагин `reformer.stack-switch`

`B/src/plugins/base/stack-switch/`: `manifest.json` (`requires.optional: reformer.kit.catalog ^2`),
`index.ts`, `plugin.ts`, `contract.ts`, `messages.ts`, `locales/{ru,en}.json` и

- `combinations.ts` — движки `unique(current, launch, ...offered)` × `kits.available()`; без китов
  только движки, без службы профилей только киты. Без React, node-тесты.
- `switching.ts` — тот же движок: `kits.activate(kitId)`; другой: `prompt.confirm` →
  `kits.activate(kitId)` → `profiles.select(profileId)`. Отказ `select` → `notifications.error`.
- `ui/StatusCell.tsx` — нативная `<button>` окрашенным текстом (довод шапки `StatusBar.tsx:15-23`)
  как триггер `DropdownMenu`; пункты — радио-группа с отметкой текущего и пометкой «перезагрузит
  конструктор» у сочетаний с другим движком; подписки на `onDidChange` и `onDidChangeAvailable`.
  Компонент передаётся пропсом, не создаётся в рендере (правило `react-hooks/static-components`
  корневого линтера).

В `activate`: словарь, `ctx.capabilities.observe(KitsCapability, …)`, вклад в `PanelPoint` (слот
`statusbar`) и в `PaletteItemsPoint` (пункты «Сочетание: …»). Запись в
`composer/builtin-plugins.ts` не нужна — карта собирается обходом `plugins/*/*/manifest.json`.
Добавить `"reformer.stack-switch"` в `builder.base` в `builtin.config.json`.

Тесты: `combinations.test.ts`, `switching.test.ts`, `plugin.test.ts` (состав вкладов, снятие,
кит появился позже), `ui/StatusCell.browser.test.tsx`.

### 6. Состав по выбору человека

- `B/src/application/builder-application.ts`: `launchFromRuntime(config, stored): { application, profileChoices }`.
  Предлагаемые — `config.presetChoices ?? defaultPresetChoices`; профиль проходит, если найден,
  собирается с поправками конфига и содержит переключатель, иначе `console.warn` и пропуск. Выбор
  применяется, если входит в предлагаемые и отличается от профиля конфига; несобравшийся выбор
  откатывается на состав конфига, не на полный профиль.
- `B/src/main.tsx`: `Promise.all([fetchRuntimeConfig(), readStoredPreset()])` →
  `boot({ runtime, application, profileChoices })`; обновить комментарий.
- Тесты в `builder-application.test.ts`: без выбора; выбор применён; выбор равен конфигу; выбор
  вне списка; `presetChoices: []`; свой профиль `all-stacks` вне списка остаётся текущим;
  неизвестное имя; профиль без переключателя (`minimal`); `plugins.disable` переключателя.

### 7. Сброс «Как в конфиге запуска»

- `SDK/kits/service.ts`: `resetChoice(): Promise<void>`, версия возможности `2.1.0`.
- `B/src/plugins/kits/registry/service.ts`: `settings?.set(KIT_SETTINGS_KEY, undefined)` — активный
  кит пересчитает существующая подписка (:409-412).
- `B/src/plugins/kits/registry/manifest.json`: `2.1.0` (иначе падает `builtin-plugins.test.ts:262`).
- Переключатель: пункт сброса в меню и палитре — `kits.resetChoice()` + `profiles.select(launch.id)`.
- Тесты: `kits/registry/service.test.ts`, `switching.test.ts`.

### 8. Документация

- `B/docs/composition.md`: разделы «Готовые конфиги» и «Переключатель сочетаний» (приоритет
  выбора, сброс, сужение `presetChoices`), скрипт демо-проекта; заменить ссылку на
  `.tmp/configs/rjsf-hexa.json` (:122).
- `B/docs/decisions-log.md`: датированный раздел с отвергнутой альтернативой.
- `B/docs/plugin-and-shell.md` (:812-833): выбор профиля читается до boot; первая ячейка строки
  состояния — вкладом.
- `B/docs/project-structure.md`: `presets/`, `scripts/`, `stored-preset.ts`, порт, плагин, состав
  `builder.base`.
- `B/README.md` (:20-35): поле `presetChoices`.
- `packages/reformer-builder-plugin-api/README.md`: служба профилей; киты → 2.1 и `resetChoice`.

## Что переиспользуем

- `parseRuntimeConfig`, `mergeRuntimeConfig` — `B/src/shell/boot/runtime-config.ts`
- `fromProfile`, `findProfile`, `profileFromConfig` — `B/src/application/`
- `settings.set(key, undefined)` — снятие записи области (`B/src/shell/platform/services/settings.ts:217-226`)
- `createIdbSettingsBackend`, `createWorkspaceMetaStore` — чтение записи `user` до boot
- `PromptService.confirm`, `NotificationsService.error`, `PaletteItemsPoint`, `PanelPoint` — SDK
- `createKitPaletteProvider` (`B/src/plugins/kits/registry/plugin.ts:76-90`) — образец динамических пунктов
- `reformer-plugin build --out` — сборка HexaUI прямо в демо-проект

## Храповики, которые придётся обновить

| Файл | Строки | Правка |
| --- | --- | --- |
| `B/src/application/composer/builtin-plugins.test.ts` | 381-391 | владелец `PanelPoint` |
| `B/src/shell/boot/integration/base-profile.test.ts` | 67-73, 88 | состав, владельцы |
| `B/src/shell/boot/integration/plain-profile.test.ts` | 79-86 | состав |
| `B/src/shell/boot/integration/rjsf-profile.test.ts` | 145-154 | состав |
| `B/src/application/builder-application.test.ts` | 23-36, 101-110 | `FULL`, `RJSF_OF_ACME` |
| `B/src/shell/boot/integration/i18n-completeness.test.ts` | 81-97 | `DICTIONARIES` |
| `B/src/shell/boot/runtime-config.test.ts` | 305-325 | ключи ↔ схема |

`structure.test.ts` выполняется раскладкой плагина; `kits/registry/plugin.test.ts` не затрагивается.

## Проверка

Гейты — только из каталога пакета (корневой `tsc -b` эмитит `.js` по всему репозиторию):

- `B/`: `npx tsc -b`, `npm test` (полный прогон), `npm run test:browser`, `npm run lint`;
- `packages/reformer-builder-plugin-api`: `npm test`, `npm run build`;
- `HEXA/`: `npm run typecheck`, `npm run plugin:validate`;
- из корня — `npx eslint --ignore-pattern '**/src/mocks/_generated/**' <изменённые .ts/.tsx>`:
  конфиг хука строже конфига пакета.

Живая матрица (dev-сервер на 5174, логи в `.tmp/dev-logs/`, скриншоты с абсолютным путём в
`projects/react-playground-e2e/screenshots/builder-presets/<сочетание>/`):

1. `npm run demo:project -w @reformer/builder`.
2. Четыре запуска `npm run dev:<сочетание> -w @reformer/builder`, каждый в чистом профиле
   браузера; для HexaUI — открыть `.tmp/builder-presets-demo` (подмена `showDirectoryPicker`
   каталогом OPFS, приём из decisions-log 2026-09-05), кит переключается сам, открыть оба образца.
3. Один запуск, обход четырёх сочетаний через ячейку: тот же движок — без перезагрузки, другой —
   с подтверждением; в консоли нет ошибок.
4. «Как в конфиге запуска» после отклонения по обеим осям.
5. Конфиг с `presetChoices: ["rjsf.builder"]` — движков в списке нет; то же поле в конфиге
   проекта — уведомление.

В сессии планирования сервер Playwright MCP не подключился. Если так останется — матрица
прогоняется одноразовым сценарием Playwright из `projects/react-playground-e2e` (сценарий в
`.tmp/`), и это явно отмечается в отчёте.

В конце: `bd close`, `bd export -o .beads/issues.jsonl`. Коммит и push — только по явной просьбе.

## За рамками (завести задачами)

- сведения о возможностях профиля в `offered()`, чтобы для профиля без китов не показывались
  сочетания с китами;
- метка «отличается от конфига запуска» в ячейке;
- дубль пунктов «Кит: …» и «Сочетание: …» в палитре;
- публикация `presets/` в npm-пакете конструктора;
- e2e-спека матрицы четырёх сочетаний;
- политика `BUILDER_API_VERSION` при добавлении имён в SDK.

## Риски

- **Доступ к папке после перезагрузки.** Chromium может не вернуть его без жеста; сочетания с
  HexaUI исчезают из списка, пока проект не переоткрыт. Выбор кита применится сам, когда плагин
  внесёт кит.
- **Образец ReFormer без сайдкаров** может не рисоваться в превью; запасной путь — создать форму
  шаблоном в конструкторе и сохранить как образец.
- **HexaUI заявляет React ≤ 18** — существующее ограничение кита.
- **Две вкладки.** Вторая узнаёт о смене движка только после своей перезагрузки.
- **Последние нажатия в редакторе** перед перезагрузкой могут не успеть дойти до рабочей копии;
  окно подтверждения даёт паузу, но не гарантию.
