/**
 * `@reformer/builder-plugin-api` — вся поверхность платформы, видимая плагину ReFormer Builder.
 *
 * Это буквально тот объект, который оболочка подставит плагину каталога проекта: встроенный
 * плагин импортирует его как обычный пакет, внешний получит ТО ЖЕ САМОЕ через линковщик
 * (слот занят самим пакетом), и разойтись они не смогут, потому что источник один.
 *
 * ## Правило состава
 *
 * Сюда попадает **только то, чем плагин пользуется**, и попадает по факту, а не «на будущее».
 * Модуль этим и ценен: он делает видимой ЦЕНУ платформы для плагина, и любое расширение
 * поверхности видно в diff'е ОДНОГО файла, а не растворяется в сотне импортов по всему
 * `plugins/`. Поэтому файл и остаётся плоским списком: делить его на `primitives/ui/services`
 * значило бы разменять единственное свойство, ради которого он существует.
 *
 * Отсюда же следует, чего здесь нет и не будет: реестров, рабочей области, хранилищ, оболочки.
 * Плагин получает доступ к ним через `PluginContext` — то есть по правилам, а не по импорту.
 *
 * ## Почему это отдельный пакет, а не каталог в билдере
 *
 * Плагин каталога проекта компилируется НЕ в билдере: у него свой `tsconfig`, своя сборка
 * и свой CI. Компилировать его не против чего, пока контракт живёт исходниками приложения,
 * — а «скопируйте типы себе» означает вторую копию, расходящуюся с первой молча. Версия
 * пакета при этом независима от версии билдера: она описывает КОНТРАКТ, а не приложение,
 * и мажор у неё растёт тогда, когда из контракта что-то уходит.
 *
 * ## Что здесь значения, а не только типы
 *
 * Значения бывают ровно четырёх родов, и каждый обязан быть значением:
 *
 * - **точки расширения** — вклад вносится ПО НИМ, и реестр берёт из них `id`, которым ключует
 *   вклады; реэкспорт, а не переобъявление, нужен ради единого источника имени и параметра
 *   типа: разъехавшись по типу вклада, копия сузила бы чужую точку под себя;
 * - **токены служб** — токен и есть ключ реестра, а не описание ключа;
 * - **объявители** (`definePlugin`, `defineService`, `defineCapability`) — проверка и вывод
 *   типов в месте объявления;
 * - **чистые функции и константы** без состояния — вторая их реализация в плагине разошлась бы
 *   с платформенной, а состояния они не несут, поэтому копия ничем не лучше.
 *
 * Ни одно из них не тянет платформу в бандл плагина: это либо стираемые типы, либо мелкие
 * листовые модули.
 *
 * ## Встроенные плагины пользуются тем же входом
 *
 * Встроенный плагин билдера импортирует этот пакет ровно так же, как внешний, — и линтер
 * билдера запрещает ему что-либо ещё из платформы. Второй поверхности для «своих» нет:
 * всё, что нужно встроенному, обязано быть здесь, иначе этого нет и у внешнего.
 *
 * @module @reformer/builder-plugin-api
 */

// Плагин: контракт и объявление.
export { definePlugin } from './plugin/types';
export type { Plugin, PluginContext } from './plugin/types';

// Локализация. Словарь плагина приходит полем контекста (`ctx.i18n`), а не портом: строки
// принадлежат тому, кто их рисует, и пространство имён у них — идентификатор плагина.
// Хук здесь потому, что `t` отвечает «как звучит СЕЙЧАС»: без подписки на смену языка панель
// осталась бы на прежних строках до случайного щелчка.
export { useTranslate } from './ui/useTranslate';
export type { Translate } from './ui/useTranslate';
export type { PluginI18n } from './services/i18n';

// Освобождение: всё, что плагин регистрирует, он кладёт в `ctx.subscriptions`.
export type { Disposable } from './primitives/disposable';

// Адресация: ресурс, на который смотрит документ.
export type { ResourceId, ResourceRef } from './primitives/resource';

// Правила имён записей — платформенные, потому что их проверяет не только плагин файлов:
// шаблон формы спрашивает имя каталога ровно теми же правилами, и вторая их реализация
// разошлась бы с первой на первом же `aux.ts`, который Windows не даёт создать.
export { validateResourceName, splitName } from './workspace/resource-names';
export type { NameRejection } from './workspace/resource-names';

// Диагностика: то, во что плагин облекает найденное.
export type {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTarget,
  NodePart,
  QuickFix,
  TextRange,
} from './services/diagnostics/types';

// Отбор быстрых исправлений по реестру команд. Здесь, а не у каждого потребителя: проверять
// «команда вообще есть?» обязаны все, кто исправления ПОКАЗЫВАЕТ или применяет (панель проблем,
// канвас, ассистент), а плагины не видят друг друга и завели бы по копии — которые совпадали бы
// по договорённости, то есть до первой правки. Тот же довод, что у порядка строгости выше.
export { usableFixes, withUsableFixes } from './services/diagnostics/fixes';
export type { CommandLookup, FixesOptions } from './services/diagnostics/fixes';

// Валидация: точка расширения и контракт вклада.
export { ValidatorPoint } from './services/validation/types';
export type {
  DocumentRef,
  ValidateContext,
  ValidatorContribution,
} from './services/validation/types';

// Вид документа — дискриминант, по которому валидатор решает, ждать ли модель.
export type { DocumentKind } from './workspace/document';

// ── Оболочка: точки расширения интерфейса ───────────────────────────────────────
//
// Панель и редактор — то, ради чего плагин чаще всего и пишется, поэтому их точки обязаны
// быть здесь. Пока их не было, плагин файлов был вынужден объявлять структурные копии типов
// и получать настоящие точки параметром из композиции: работало, проверялось компиляцией,
// но означало, что типобезопасно внести панель средствами SDK нельзя.
//
// Здесь реэкспорт, а не переобъявление. Не потому, что объект обязан быть одним: реестр
// ключуется `id` точки, и структурная копия имени вклад не теряет. Потому, что копия несёт
// СВОЙ параметр типа и расходится с оригиналом по контракту вклада — см. ниже про точку
// модели документа, где это и произошло.
export { PanelPoint } from './ui/slots';
export type { PanelContribution, SlotId } from './ui/slots';
export { EditorPoint } from './ui/contributions/editors';
export type { EditorContribution } from './ui/contributions/editors';
export type { EditorProbe } from './workspace/model/provider';
export { ResourceDecorationPoint } from './ui/contributions/decorations';
export type { Decoration, ResourceDecorationContribution } from './ui/contributions/decorations';
export { PaletteItemsPoint } from './ui/menu/palette';
export type { PaletteItem, PaletteItemProvider } from './ui/menu/palette';
// Настройки плагина каталога: он вносит СХЕМУ ФОРМЫ, а рисует её раздел «Плагины» окна
// настроек — теми же компонентами, которыми билдер рисует формы. Значения плагин читает
// сам, службой настроек по ключу `pluginSettingsKey(ctx.id)`, и там же объявляет умолчания
// через `registerDefault` — второго источника умолчаний нет намеренно.
export { CatalogPluginSettingsPoint } from './ui/contributions/plugin-settings';
export type { CatalogPluginSettingsContribution } from './ui/contributions/plugin-settings';
export { pluginSettingsKey } from './services/plugin-settings';
export type { CommandContribution } from './primitives/command';
export type { WhenContext, FocusTarget } from './primitives/when-context';

// ── Клавиатура: условие применимости как данные ─────────────────────────────────
//
// Строку условия (`CommandContribution.when`) плагин пишет и без импорта, но разбирать её
// обязаны трое одинаково — реестр команд, диспетчер клавиш и тот, кто её показывает.
// Вторая реализация грамматики разошлась бы с первой на первом же операторе, а расхождение
// проявилось бы не отказом, а молча не сработавшей клавишей.
export { parseWhen, compileWhen, evaluateWhen, WHEN_TRUE } from './primitives/when-expr';
export type { WhenExpr, WhenNode, WhenParseError, WhenParseResult } from './primitives/when-expr';

// Контекстные ключи. Без них плагин может выразить «узел выделен на канвасе» только
// предикатом, читающим его собственный реестр сеансов, — то есть непрозрачно: такое условие
// нельзя ни сравнить с чужим при разрешении конфликта клавиш, ни показать в таблице клавиш.
// Область: плагин, открывающий своё окно, обязан её положить — иначе его клавиши не могут
// перебить глобальные, и «пока диалог открыт, работает не то» становится неисправимым снаружи.
export { ScopeStackServiceToken, DIALOG_SCOPE } from './ui/keyboard/scope';
export type { ScopeId, ScopeStack } from './ui/keyboard/scope';

// Действующее сочетание — только чтение. Плагин, показывающий в своём интерфейсе «нажмите X»,
// обязан показать ДЕЙСТВУЮЩЕЕ сочетание, а не объявленное: после переназначения человеком
// его подсказка иначе врёт.
export { chordOfCommand, KeymapServiceToken } from './ui/keyboard/keymap';
export type { KeymapService } from './ui/keyboard/keymap';
export type {
  KeybindingIndex,
  KeybindingLayer,
  KeybindingRule,
} from './ui/keyboard/keybinding-rules';
export { detectPlatformModifier, formatChord, formatKeybinding } from './ui/keyboard/keybindings';
export type { PlatformModifier } from './ui/keyboard/keybindings';

// Разбор аккорда — тем же кодом, что и регистрация: разъедься написание, подпись плагина
// перестала бы совпадать с тем, что человек нажимает.
export { MAX_CHORD_STEPS, normalizeChord, normalizeKeybinding } from './primitives/command';

export { ContextKeyServiceToken } from './services/context-keys';
export type {
  ContextKey,
  ContextKeyReader,
  ContextKeyService,
  ContextKeySnapshot,
} from './services/context-keys';

// ── Сервисы: объявление своих и доступ к чужим ──────────────────────────────────
//
// Без `defineService` плагин **вообще не может объявить сервис** средствами SDK — а сервис это
// основной способ отдать другим плагинам состояние (какой кит активен, какой источник открыт).
// Обнаружено плагином китов: ему пришлось объявить структурную копию токена.
//
// Структурный двойник токена РАБОТАЕТ: реестр служб ключуется строкой идентификатора — тем же
// правилом, что и реестр вкладов. Цена дубликата поэтому не в потере поведения, а в типах
// и гигиене: две копии расходятся по типу службы, и компилятор узнаёт об этом только там, где
// обе стороны встречаются. Дублировать объявление в каждом плагине всё равно нельзя:
// `plugins/**` не могут импортировать друг друга.
export { defineService } from './primitives/service';
export type { ServiceToken, ServiceRegistry } from './primitives/service';

// Возможности — то же объявление, но с версией, и ЗНАЧЕНИЕ здесь по той же причине, что
// и `defineService`: `defineCapability` не описывает токен, а СОЗДАЁТ его — с проверкой версии
// в месте объявления, чтобы диапазон, написанный вместо версии, не превращался в сравнение,
// которое молча всегда ложно. Без этого имени плагин каталога не может ни объявить контракт,
// который он даёт (`provides` манифеста ссылается на идентификатор, а типизировать службу
// нечем), ни потребовать чужой средствами SDK, — то есть версионирование существовало бы
// только для встроенных, а нужно оно ровно внешним.
//
// `CapabilityAccess` — тип поля `ctx.capabilities`, вида на тот же реестр служб. Второго
// реестра нет намеренно: довод в шапке `primitives/capability`.
export { defineCapability } from './primitives/capability';
export type {
  Capability,
  CapabilityAccess,
  CapabilityDeclaration,
  CapabilityProvider,
  CapabilityRequirement,
} from './primitives/capability';

// Сервисы платформы, к которым плагин обращается через `ctx.services`.
//
// Почему через реестр, а не полями контекста: **на момент активации плагина рабочей области
// ещё нет** — она появляется, когда пользователь открыл проект, то есть заведомо позже.
// Поле в контексте пришлось бы объявлять необязательным и всё равно проверять на каждом обращении.
export { SettingsServiceToken } from './services/settings';
export type { SettingsService } from './services/settings';
export { ThemeServiceToken } from './services/theme';
export type { ThemeService, ThemePreference } from './services/theme';
export { NotificationsServiceToken } from './services/notifications';
export type { NotificationsService } from './services/notifications';
export { DiagnosticsServiceToken } from './services/diagnostics/service';
export type { DiagnosticsService } from './services/diagnostics/service';

// Документы — рабочая область в объёме редактора: текст открытой вкладки, запись, активный
// ресурс. Без этой службы внешний плагин из каталога проекта не может быть редактором кода:
// его тело получает только `documentId`, а прочитать или записать текст средствами SDK было
// нечем — встроенные редакторы получают рабочую область портами, которые собирает композиция.
// Запись здесь — ТА ЖЕ дверь, что у человека и ассистента (`Workspace.writeText`): в рабочую
// копию, наружу только через сохранение оболочки; поэтому отдельных прав редактору не нужно,
// а `WriteOptions` лишь называет автора правки для журнала. `Document` — настоящий тип
// платформы, а не копия: подписка на смену текста у копии молчала бы.
export { DocumentsServiceToken } from './services/documents';
// Вторая половина рабочей области: что в ней ЛЕЖИТ и где. Отдельной службой, потому что
// права разные — здесь только чтение и адресация, а запись идёт одной дверью выше.
export { WorkspaceFilesServiceToken } from './services/workspace-files';
export type { WorkspaceFilesService } from './services/workspace-files';
// Единственная дверь НАРУЖУ, в источник, и единственная служба, которую оболочка отдаёт
// не всем: её просит право `workspace.save` в манифесте, и подтверждает его человек.
export { WorkspaceSaveServiceToken, WorkspaceSaveCapability } from './services/workspace-save';
export type { WorkspaceSaveService } from './services/workspace-save';
// Имена прав — чтобы манифест писался против типа, а не против строки в документации.
export { PLUGIN_PERMISSIONS } from './plugin/permissions';
export type { PluginPermission } from './plugin/permissions';
// Активная вкладка как React-значение: подписка на службу документов, без которой панель
// показывала бы документ, с которого ушли.
export { useActiveDocument } from './ui/useActiveDocument';
export type { DocumentsService, OpenDocumentOptions } from './services/documents';
export type { Document } from './workspace/document';
export type { WriteOptions } from './workspace/write-options';

// Фокус текстового редактора — контракт КАЖДОГО редактора текста, а не опция встроенного.
// Рабочая область откладывает перерисовку буфера по модели (ход ассистента, структурная
// правка), пока человек печатает, и «печатает ли он» узнаёт только отсюда. Редактор, который
// сюда не пишет, теряет набранное молча: ошибок не будет, буфер просто перепишут под руками.
// Обязанности редактора: `setFocused(id, true)` — текстовое поле документа получило фокус;
// `setFocused(id, false)` — потеряло, и ПОТОМ `DocumentsService.flush(id)`, чтобы рабочая
// область догнала буфер по модели (встроенный Monaco зовёт тот же глагол своим портом).
// Порядок несущий: `flush` спрашивает этот же реестр и при живом фокусе отложит перерисовку
// снова.
// Образец — обработчики фокуса в `plugins/editor-monaco/ui/MonacoEditor.tsx`.
// Токен, а не фабрика: реестр один на приложение — это возможность ОБОЛОЧКИ
// (`platform/services/host-capabilities`), и заводит её запуск, а не плагин.
export { TextEditorFocusToken } from './workspace/model/text-editor-focus';
export type { TextEditorFocusRegistry } from './workspace/model/text-editor-focus';

// Снимки вида — прокрутка, каретка, свёрнутые ветки: то, что редактор обязан помнить между
// открытиями вкладки, но не имеет права хранить в себе (тело размонтируют раньше, чем
// оболочка спросит). Хранилище общее на все редакторы и ключуется ПАРОЙ «вклад + документ»,
// поэтому `forEditor(id)` — не удобство, а граница: без неё снимок текстового редактора
// подставлялся бы структурному.
export { EditorViewStatesToken } from './workspace/model/editor-view-states';
export type { EditorViewStates, EditorViewStateSlice } from './workspace/model/editor-view-states';

// Выделение — общий канал между плагинами, которые показывают ОДИН документ с разных сторон
// (канвас редактора схемы и превью). Он обязан быть здесь, а не портом от композиции: плагины
// не импортируют друг друга, поэтому единственный способ договориться о выделении — общая
// служба платформы, и «непонятно, как передать выбранный узел» решается именно этой строкой.
export { SelectionServiceToken } from './services/selection';
export type { SelectionService } from './services/selection';

// ── Модель документа: второй вид документа поверх текста ────────────────────────
//
// Точка провайдеров модели обязана быть здесь, потому что структурный редактор — это
// плагин, а без неё он не может внести провайдера **типобезопасно**. Редактор схемы был
// вынужден объявить структурную копию, и она немедленно разошлась с оригиналом по
// параметру модели: копия описывала точку своей модели (`JsonFormSchema`),
// а настоящая точка держит `DocumentModelProvider<unknown>` — ядро моделей
// не различает. Разойтись в эту сторону копия обязана была: сузить чужую точку под себя
// нельзя, и компилятор это поймал на композиции.
//
// Провайдер конкретной модели вносится в точку без приведения: методы в TypeScript
// бивариантны, поэтому провайдер `JsonFormSchema` — это провайдер `unknown`.
export { DocumentModelPoint } from './workspace/model/provider';
export type {
  DocumentModelProvider,
  EditOp,
  ApplyResult,
  NodeId,
} from './workspace/model/provider';

// Порядок строгости диагностик. Без него каждый показывающий плагин заводит свою копию,
// и совпадение копий держится на комментарии, а не на компиляторе — ровно это и случилось
// в дереве файлов и на канвасе, пока порядок жил у платформы без выхода наружу.
export { SEVERITY_RANK } from './services/diagnostics/types';

// ── Меню ─────────────────────────────────────────────────────────────────────────
//
// Реэкспорт, а не копия типов у каждого плагина, по той же причине, что у панелей: точка
// расширения обязана быть ОДНИМ объектом для Host и плагина, иначе вклад уходит в двойник
// и теряется молча.
//
// Корневые меню Host здесь тоже видны (`MenuRootId`): плагин должен уметь СОСЛАТЬСЯ на `file`
// или `edit`, не выдумывая строку. Завести собственный корень он всё равно может — вкладом
// `kind: 'root'`, который встанет в зону между «Видом» и «Справкой».
export { MenuPoint, MENU_ROOT_IDS, CONTEXT_MENU_IDS } from './ui/menu/menu';
export type {
  ContextMenuId,
  MenuContribution,
  MenuDynamicContribution,
  MenuDynamicItem,
  MenuItemContribution,
  MenuPath,
  MenuRootContribution,
  MenuRootId,
  MenuSubmenuContribution,
  MenuTarget,
} from './ui/menu/menu';

// Контекстное меню дерева ресурсов — тот же `MenuPoint`, другой корень. Плагину нужны адрес
// этого корня и типизация цели щелчка: без них пункт «Переименовать» получал бы `unknown`
// и приводил бы его к нужной форме сам — каждый по-своему.
//
// `asResourceTarget` — тот же приём для третьего места, где цель приходит непрозрачной:
// динамическая группа (`kind: 'dynamic'`) получает её в `items`, а обёртки для `items`
// не существует и быть не может — она возвращает СПИСОК, а не булево. Без сужения плагин
// приводил бы `unknown` к своей форме `as`-ом, то есть доверял бы чужой строке.
export {
  RESOURCE_CONTEXT_MENU,
  argsOfResource,
  asResourceTarget,
  selectedIds,
  whenResource,
} from './ui/menu/resource-menu';
export type { ResourceMenuTarget } from './ui/menu/resource-menu';

// Ряд действий над открытым документом — тот же `MenuPoint`, поверхность `editor/title`.
// Плагину нужны её адрес и типизация цели: без них кнопка «показать предпросмотр» получала бы
// `unknown` и приводила бы его к нужной форме сама — каждый по-своему.
export { EDITOR_TITLE_MENU, argsOfEditor, whenEditor } from './ui/menu/editor-menu';
export type { EditorMenuTarget } from './ui/menu/editor-menu';

// ── Запросы к человеку и буфер записей дерева ───────────────────────────────────
// Обе службы нужны пунктам меню: «Новая папка…» обязана спросить имя, «Вставить» — знать,
// есть ли что вставлять. Портом их отдавать нельзя: спрашивают и копируют не только файлы —
// шаблоны формы точно так же спросят имя, а вклад чужого плагина точно так же положит
// в буфер свои записи.
export { PromptServiceToken } from './services/prompt';
// Выбор из списка — третий вид запроса («Недавно открытые» по `Ctrl+R`). Типы пункта и запроса
// нужны тому, кто список собирает: иначе он выводил бы их из сигнатуры `pick` окольным путём.
export type { PromptPickItem, PromptPickRequest, PromptService } from './services/prompt';
export { ResourceClipboardServiceToken } from './services/resource-clipboard';
export type {
  ClipboardMode,
  ClipboardState,
  ResourceClipboardService,
} from './services/resource-clipboard';
