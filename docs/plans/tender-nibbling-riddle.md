# Dev-режим reformer-builder-v2: разработка плагинов в каталоге проекта

## Context

Цель — рабочий цикл разработки плагина в `<проект>/.ui_builder/plugins/<id>/`. Решения
пользователя: **внешний IDE — главный путь** (встроенный monaco — бонус), режим —
**пер-плагинный** («в разработке» помечается конкретный плагин), перезагрузка —
**авто где возможно**, вместо scaffold-команды — **шаблонный плагин-пример**, который
копируют и переименовывают.

Состояние по исследованию (3 агента, всё с file:line): механика готова ПОЛНОСТЬЮ, dev-цикла
нет СОВСЕМ. `ProjectPluginCatalog` умеет list/subscribe/refresh/enable/disable/**reload**
([catalog.ts:444](../../projects/reformer-builder-v2/src/shell/platform/plugin/catalog.ts#L444) —
«снять вклады → перечитать → поднять»), `main.ts` транспилируется на лету с подстановкой
расширения ([loader.ts:212](../../projects/reformer-builder-v2/src/shell/platform/plugin/loader.ts#L212)).
Но: ни одной команды/панели для каталога (`projectPlugins` читается только в boot.ts), ошибки
уходят в `console.error` (onProblem не передан, boot.ts:580), правка извне не видна никому
(наблюдения ФС нет, divergence проверяет только открытые вкладки), правка изнутри видна шине
`WorkspaceDidChange`, на которую никто не подписан, словарь i18n плагину каталога поставить
нечем (все его titleKey — маркеры `⟦id.key⟧`).

## Принципы (унаследованные — не нарушаем)

- **Явное включение каждого плагина человеком** (граница доверия, catalog.ts:9) — никакого
  авто-enable; авто-перезагрузка касается только уже включённых и помеченных dev.
- **Никакого поллинга и локального процесса** (решение №4 core-contracts) — триггеры только
  событийные: сохранение в Workspace и возврат фокуса в окно (паттерн, уже предписанный
  контрактом `Source.watch` и реализованный в divergence.ts:307).
- **Гейт `source.capabilities.executesCode`** остаётся без обхода (loader.ts:343).
- Семантика reload не меняется: полный цикл, свежий граф (правило linker.ts:9).

## Этап 1 — цикл замыкается

1. **Пометка dev**: настройка `workspace.plugins.dev` (workspace-scope, по образцу
   `createSettingsEnabledPlugins`, [boot.ts:193](../../projects/reformer-builder-v2/src/shell/boot/boot.ts#L193)).
   Каталог: `entry.dev`, `setDev(id, on)`, восстановление рядом с `restoreEnabled`.
2. **Команды в палитре**: провайдер динамических пунктов по образцу переключения китов
   ([kits/plugin.ts createKitPaletteProvider](../../projects/reformer-builder-v2/src/plugins/kits/plugin.ts#L77)) —
   на каждый плагин каталога: включить/выключить, перезагрузить, режим разработки вкл/выкл;
   в `detail` — состояние (`enabled/disabled/failed` + текст problem). Регистрирует композиция.
3. **Ошибки видимы**: boot передаёт `onProblem` → тост через NotificationsService
   (ключи `plugins.problem.*` в словари платформы ru/en; полнота — под существующим
   i18n-completeness).
4. **Авто-перезагрузка, триггер А (правка в билдере)**: подписка на `WorkspaceDidChange`
   (шина общая, boot.ts:298; `ResourceId` разбирается `parseResourceId` на источник+путь),
   фильтр `type === 'saved'` и путь под `.ui_builder/plugins/<id>/`, плагин dev+enabled →
   `reload(id)`. Пакет событий коалесцируется в один reload; триггер во время reload — в очередь.
5. **Авто-перезагрузка, триггер B (внешний IDE)**: `focus`/`visibilitychange` с троттлингом 1с
   (образец [divergence.ts:307](../../projects/reformer-builder-v2/src/shell/platform/workspace/merge/divergence.ts#L307)):
   для каждого dev+enabled плагина обойти его каталог (тот же отбор, что collectFiles: код +
   manifest + styles), сравнить карту `path → stat().revision` со снимком после последней
   загрузки; разошлось → reload. Цена — stat только dev-плагинов и только по фокусу.
6. **Новый модуль** `platform/plugin/dev-watch.ts` (+ тест): чистый, зависимости инжектируются
   (catalog, source-getter, events, window/document). Тест внешней правки — `MemorySource.put()`
   ([memory.ts:88](../../projects/reformer-builder-v2/src/shell/platform/source/memory.ts#L88) —
   заведён ровно для имитации правки снаружи) + фейковый window.
7. **Wiring в boot**: dev-store в каталог, dev-watch подключается на смену проекта — рядом
   с `attachFocusChecks` (boot.ts:666).

## Этап 2 — ошибки читаемы

1. Позиция ошибки TS: движок отдаёт `start/length`, транспилятор их выбрасывает
   ([typescript-transpiler.ts:164](../../projects/reformer-builder-v2/src/shell/platform/plugin/typescript-transpiler.ts#L164)) —
   довезти file:line:col первой ошибки.
2. `PluginProblem` + опциональные `phase` (`resolve|transpile|evaluate`) и `file`: сейчас
   `ModuleLinkError.phase/chain` теряются при схлопывании в `code-failed` (loader.ts:386).
3. `sourceURL` с id плагина: сейчас два плагина c `main.ts` дают одинаковый
   `builder-module:///main.ts` (linker.ts:173) — префиксовать имена набора id-ом; относительные
   импорты резолвятся внутри набора, при согласованном префиксовании работают — закрепить тестом.
4. Кэш транспиляции плагинам: boot.ts:593 `prepare` → `prepareCached` (ключ включает содержимое —
   compile-cache.ts:27 — безопасно; сейчас каждый reload будит движок на 3.5 МБ).
5. (Опция, если останется дёшево) inline sourcemap только для dev-плагинов — отдельные опции
   транспиляции, `optionsVersion` в ключе кэша их разведёт.

## Этап 3 — словарь плагина каталога

- Конвенция `locales/{ru,en}.json` в каталоге плагина (в код-набор не попадают: `.json` нет
  в `PLUGIN_CODE_EXTENSIONS`).
- `enablePlugin` читает их через Source и отдаёт в `i18n.forPlugin(id).contribute(...)`
  (зависимость каталогу передаёт boot). Битый словарь → новый problem-код `locales-invalid`,
  включение отказывает — та же атомарность, что у встроенных (i18n.ts:149).
- reload перечитывает; удалённые ключи живут до перезагрузки страницы (register пишет поверх,
  i18n.ts:168) — задокументировать как известное ограничение.
- Снимает маркеры `⟦id.key⟧` в палитре/панелях (CommandPalette.tsx:280) — без этого любой
  плагин каталога выглядит сломанным.

## Этап 4 — шаблонный плагин

- `examples/plugin-template/`: `manifest.json` (`"main": "main.js"`, рядом `main.ts` —
  конвенция подстановки расширения), `main.ts` (definePlugin: команда, панель `PanelPoint`,
  пункты палитры `PaletteItemsPoint`, уведомление через `NotificationsServiceToken`, вся
  гигиена — через `ctx.subscriptions`), `locales/{ru,en}.json`, `styles.css`, README
  («скопируй, переименуй: id обязан совпадать с именем каталога», manifest.ts:236).
- **Взаимодействие с чужим плагином** — как оно устроено by design: исполнение чужой команды
  (`ctx.commands.execute` — `PluginCommandRegistry = Omit<CommandRegistry,'forPlugin'>`,
  command.ts:377) и событие через `ctx.events`; прямой импорт невозможен и в примере это сказано.
- **Ratchet-тест** `boot/integration/plugin-template.test.ts`: файлы шаблона читаются с диска
  (как это делает i18n-completeness), кладутся в `MemorySource`, каталог включает плагин,
  вклады встают. Шаблон не сможет молча протухнуть при изменении API.

## Обновление документов

- `plugin-and-shell.md`, раздел «Разработка в каталоге»: решение «перезагрузка — команда,
  а не автоматика» замещается; довод прежнего решения (без опроса и без процесса) сохраняется —
  триггеры событийные.
- Запись в `decisions-log.md`.

## Не делаем (и почему)

- Наблюдение ФС (FileSystemObserver/таймер) — против решения №4 core-contracts; фокус-триггер
  покрывает цикл «IDE → alt-tab → браузер».
- Авто-включение найденного плагина — граница доверия.
- Инкрементальная пересборка одного файла — против правила «граф свежий на каждую загрузку»;
  цену снимает кэш транспиляции.
- Полноценная панель управления плагинами — палитры для цикла достаточно; панель отдельным
  заходом (в текущую модель настроек список не помещается by design, settings-ui.ts:15).
- Сохранение состояния плагина через reload (HMR) — storage и так переживает reload.

## Порядок и проверка

Этапы — отдельные коммиты (этап 1 можно дробить: пометка+палитра+ошибки / триггер А / триггер B).
После каждого: `tsc -b`, workspace-lint, оба прогона vitest. Новые модули — с тестами на
`MemorySource`/фейковом window; каждую новую проверку предъявить падающей.

Приёмка этапа 1 руками: `npm run dev` → открыть проект с плагином → включить, пометить dev →
править `main.ts` во внешнем IDE → alt-tab в билдер → плагин перезагрузился сам; сломать код →
тост с позицией ошибки; выключить плагин → вклады ушли.
