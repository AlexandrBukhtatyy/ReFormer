/**
 * `@builder/sdk` — вся поверхность платформы, видимая плагину.
 *
 * Это буквально тот объект, который загрузчик подставит плагину каталога под именем
 * `@builder/sdk`: встроенный плагин импортирует `@/sdk`, внешний получит то же самое
 * через линковщик, и разойтись они не смогут, потому что источник один.
 *
 * ## Правило состава
 *
 * Сюда попадает **только то, чем плагин пользуется**, и попадает по факту, а не «на будущее».
 * Модуль этим и ценен: он делает видимой ЦЕНУ платформы для плагина — сейчас это 117 имён,
 * и любое расширение поверхности видно в diff'е ОДНОГО файла, а не растворяется в сотне
 * импортов по всему `plugins/`. Поэтому файл и остаётся плоским списком: делить его
 * на `sdk/{primitives,ui,services}.ts` значило бы разменять единственное свойство,
 * ради которого он существует.
 *
 * Отсюда же следует, чего здесь нет и не будет: реестров (`createExtensionRegistry`,
 * `createServiceRegistry`), рабочей области, хранилищ, оболочки. Плагин получает доступ
 * к ним через {@link PluginContext} — то есть по правилам, а не по импорту.
 *
 * ## Что здесь значения, а не только типы
 *
 * Типов 71, значений 46 — и второе число не противоречит правилу «плагин видит платформу,
 * а не держит её». Значения бывают ровно четырёх родов, и каждый обязан быть значением:
 *
 * - **точки расширения** ({@link PanelPoint}, {@link EditorPoint}, {@link ValidatorPoint},
 *   {@link MenuPoint}, …) — типизированное имя точки обязано быть ОДНИМ объектом для платформы
 *   и для плагина, иначе вклад уйдёт в точку-двойник и потеряется молча;
 * - **токены служб** ({@link SettingsServiceToken}, {@link KeymapServiceToken}, …) — то же
 *   самое про личность: токен и есть ключ реестра, а не описание ключа;
 * - **объявители** {@link definePlugin} и {@link defineService} — проверка и вывод типов
 *   в месте объявления;
 * - **чистые функции и константы** без состояния ({@link parseWhen}, {@link formatChord},
 *   {@link validateResourceName}, {@link SEVERITY_RANK}, …) — вторая их реализация в плагине
 *   разошлась бы с платформенной, а состояния они не несут, поэтому копия ничем не лучше.
 *
 * Ни одно из них не тянет платформу в бандл плагина: это либо стираемые типы, либо мелкие
 * листовые модули.
 *
 * ## Первый потребитель
 *
 * `plugins/validator-schema/` — валидатор схемы формы. Состав ниже продиктован им и теми,
 * кто пришёл следом, и это нормально: поверхность растёт по требованию, а не по воображению.
 *
 * @module sdk
 */

// Плагин: контракт и объявление.
export { definePlugin } from '@/shell/platform/plugin/types';
export type { Plugin, PluginContext } from '@/shell/platform/plugin/types';

// Освобождение: всё, что плагин регистрирует, он кладёт в `ctx.subscriptions`.
export type { Disposable } from '@/shell/platform/primitives/disposable';

// Адресация: ресурс, на который смотрит документ.
export type { ResourceId, ResourceRef } from '@/shell/platform/primitives/resource';

// Правила имён записей — платформенные, потому что их проверяет не только плагин файлов:
// шаблон формы спрашивает имя каталога ровно теми же правилами, и вторая их реализация
// разошлась бы с первой на первом же `aux.ts`, который Windows не даёт создать.
export { validateResourceName, splitName } from '@/shell/platform/workspace/resource-names';
export type { NameRejection } from '@/shell/platform/workspace/resource-names';

// Диагностика: то, во что плагин облекает найденное.
export type {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTarget,
  QuickFix,
  TextRange,
} from '@/shell/platform/services/diagnostics/types';

// Отбор быстрых исправлений по реестру команд. Здесь, а не у каждого потребителя: проверять
// «команда вообще есть?» обязаны все, кто исправления ПОКАЗЫВАЕТ или применяет (панель проблем,
// канвас, ассистент), а плагины не видят друг друга и завели бы по копии — которые совпадали бы
// по договорённости, то есть до первой правки. Тот же довод, что у порядка строгости выше.
export { usableFixes, withUsableFixes } from '@/shell/platform/services/diagnostics/fixes';
export type { CommandLookup, FixesOptions } from '@/shell/platform/services/diagnostics/fixes';

// Валидация: точка расширения и контракт вклада.
export { ValidatorPoint } from '@/shell/platform/services/validation/types';
export type {
  DocumentRef,
  ValidateContext,
  ValidatorContribution,
} from '@/shell/platform/services/validation/types';

// Вид документа — дискриминант, по которому валидатор решает, ждать ли модель.
export type { DocumentKind } from '@/shell/platform/workspace/document';

// ── Оболочка: точки расширения интерфейса ───────────────────────────────────────
//
// Панель и редактор — то, ради чего плагин чаще всего и пишется, поэтому их точки обязаны
// быть здесь. Пока их не было, плагин файлов был вынужден объявлять структурные копии типов
// и получать настоящие точки параметром из композиции: работало, проверялось компиляцией,
// но означало, что типобезопасно внести панель средствами SDK нельзя.
//
// Точка расширения обязана быть ОДНИМ объектом для Host и плагина — иначе вклад уйдёт
// в точку-двойник и потеряется молча. Поэтому здесь реэкспорт, а не переобъявление.
export { PanelPoint } from '@/shell/platform/ui/slots';
export type { PanelContribution, SlotId } from '@/shell/platform/ui/slots';
export { EditorPoint } from '@/shell/platform/ui/contributions/editors';
export type { EditorContribution } from '@/shell/platform/ui/contributions/editors';
export type { EditorProbe } from '@/shell/platform/workspace/model/provider';
export { ResourceDecorationPoint } from '@/shell/platform/ui/contributions/decorations';
export type {
  Decoration,
  ResourceDecorationContribution,
} from '@/shell/platform/ui/contributions/decorations';
export { PaletteItemsPoint } from '@/shell/platform/ui/menu/palette';
export type { PaletteItem, PaletteItemProvider } from '@/shell/platform/ui/menu/palette';
export type { CommandContribution } from '@/shell/platform/primitives/command';
export type { WhenContext, FocusTarget } from '@/shell/platform/primitives/when-context';

// ── Клавиатура: условие применимости как данные ─────────────────────────────────
//
// Строку условия (`CommandContribution.when`) плагин пишет и без импорта, но разбирать её
// обязаны трое одинаково — реестр команд, диспетчер клавиш и тот, кто её показывает.
// Вторая реализация грамматики разошлась бы с первой на первом же операторе, а расхождение
// проявилось бы не отказом, а молча не сработавшей клавишей.
export {
  parseWhen,
  compileWhen,
  evaluateWhen,
  WHEN_TRUE,
} from '@/shell/platform/primitives/when-expr';
export type {
  WhenExpr,
  WhenNode,
  WhenParseError,
  WhenParseResult,
} from '@/shell/platform/primitives/when-expr';

// Контекстные ключи. Без них плагин может выразить «узел выделен на канвасе» только
// предикатом, читающим его собственный реестр сеансов, — то есть непрозрачно: такое условие
// нельзя ни сравнить с чужим при разрешении конфликта клавиш, ни показать в таблице клавиш.
// Область: плагин, открывающий своё окно, обязан её положить — иначе его клавиши не могут
// перебить глобальные, и «пока диалог открыт, работает не то» становится неисправимым снаружи.
export { ScopeStackServiceToken, DIALOG_SCOPE } from '@/shell/platform/ui/keyboard/scope';
export type { ScopeId, ScopeStack } from '@/shell/platform/ui/keyboard/scope';

// Действующее сочетание — только чтение. Плагин, показывающий в своём интерфейсе «нажмите X»,
// обязан показать ДЕЙСТВУЮЩЕЕ сочетание, а не объявленное: после переназначения человеком
// его подсказка иначе врёт.
export { chordOfCommand, KeymapServiceToken } from '@/shell/platform/ui/keyboard/keymap';
export type { KeymapService } from '@/shell/platform/ui/keyboard/keymap';
export type {
  KeybindingIndex,
  KeybindingLayer,
  KeybindingRule,
} from '@/shell/platform/ui/keyboard/keybinding-rules';
export {
  detectPlatformModifier,
  formatChord,
  formatKeybinding,
} from '@/shell/platform/ui/keyboard/keybindings';
export type { PlatformModifier } from '@/shell/platform/ui/keyboard/keybindings';

// Разбор аккорда — тем же кодом, что и регистрация: разъедься написание, подпись плагина
// перестала бы совпадать с тем, что человек нажимает.
export {
  MAX_CHORD_STEPS,
  normalizeChord,
  normalizeKeybinding,
} from '@/shell/platform/primitives/command';

export { ContextKeyServiceToken } from '@/shell/platform/services/context-keys';
export type {
  ContextKey,
  ContextKeyReader,
  ContextKeyService,
  ContextKeySnapshot,
} from '@/shell/platform/services/context-keys';

// ── Сервисы: объявление своих и доступ к чужим ──────────────────────────────────
//
// Без `defineService` плагин **вообще не может объявить сервис** средствами SDK — а сервис это
// основной способ отдать другим плагинам состояние (какой кит активен, какой источник открыт).
// Обнаружено плагином китов: ему пришлось объявить структурную копию токена.
//
// Тонкость, из-за которой это не такая же тихая поломка, как с точками расширения: точки
// сравниваются **по идентичности объекта**, поэтому двойник теряет вклад молча; сервисы
// ключуются **по строке идентификатора**, поэтому структурный двойник сервис всё-таки находит.
// То есть цена дубликата здесь — типы и гигиена, а не потеря поведения. Но дублировать
// объявление в каждом плагине всё равно нельзя: `plugins/**` не могут импортировать друг друга.
export { defineService } from '@/shell/platform/primitives/service';
export type { ServiceToken, ServiceRegistry } from '@/shell/platform/primitives/service';

// Сервисы платформы, к которым плагин обращается через `ctx.services`.
//
// Почему через реестр, а не полями контекста: **на момент активации плагина рабочей области
// ещё нет** — она появляется, когда пользователь открыл проект, то есть заведомо позже.
// Поле в контексте пришлось бы объявлять необязательным и всё равно проверять на каждом обращении.
export { SettingsServiceToken } from '@/shell/platform/services/settings';
export type { SettingsService } from '@/shell/platform/services/settings';
export { ThemeServiceToken } from '@/shell/platform/services/theme';
export type { ThemeService, ThemePreference } from '@/shell/platform/services/theme';
export { NotificationsServiceToken } from '@/shell/platform/services/notifications';
export type { NotificationsService } from '@/shell/platform/services/notifications';
export { DiagnosticsServiceToken } from '@/shell/platform/services/diagnostics/service';
export type { DiagnosticsService } from '@/shell/platform/services/diagnostics/service';

// Выделение — общий канал между плагинами, которые показывают ОДИН документ с разных сторон
// (канвас редактора схемы и превью). Он обязан быть здесь, а не портом от композиции: плагины
// не импортируют друг друга, поэтому единственный способ договориться о выделении — общая
// служба платформы, и «непонятно, как передать выбранный узел» решается именно этой строкой.
export { SelectionServiceToken } from '@/shell/platform/services/selection';
export type { SelectionService } from '@/shell/platform/services/selection';

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
export { DocumentModelPoint } from '@/shell/platform/workspace/model/provider';
export type {
  DocumentModelProvider,
  EditOp,
  ApplyResult,
  NodeId,
} from '@/shell/platform/workspace/model/provider';

// Порядок строгости диагностик. Без него каждый показывающий плагин заводит свою копию,
// и совпадение копий держится на комментарии, а не на компиляторе — ровно это и случилось
// в дереве файлов и на канвасе, пока порядок жил у платформы без выхода наружу.
export { SEVERITY_RANK } from '@/shell/platform/services/diagnostics/types';

// ── Меню ─────────────────────────────────────────────────────────────────────────
//
// Реэкспорт, а не копия типов у каждого плагина, по той же причине, что у панелей: точка
// расширения обязана быть ОДНИМ объектом для Host и плагина, иначе вклад уходит в двойник
// и теряется молча.
//
// Корневые меню Host здесь тоже видны (`MenuRootId`): плагин должен уметь СОСЛАТЬСЯ на `file`
// или `edit`, не выдумывая строку. Завести собственный корень он всё равно может — вкладом
// `kind: 'root'`, который встанет в зону между «Видом» и «Справкой».
export { MenuPoint, MENU_ROOT_IDS, CONTEXT_MENU_IDS } from '@/shell/platform/ui/menu/menu';
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
} from '@/shell/platform/ui/menu/menu';

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
} from '@/shell/platform/ui/menu/resource-menu';
export type { ResourceMenuTarget } from '@/shell/platform/ui/menu/resource-menu';

// Ряд действий над открытым документом — тот же `MenuPoint`, поверхность `editor/title`.
// Плагину нужны её адрес и типизация цели: без них кнопка «показать предпросмотр» получала бы
// `unknown` и приводила бы его к нужной форме сама — каждый по-своему.
export { EDITOR_TITLE_MENU, argsOfEditor, whenEditor } from '@/shell/platform/ui/menu/editor-menu';
export type { EditorMenuTarget } from '@/shell/platform/ui/menu/editor-menu';

// ── Запросы к человеку и буфер записей дерева ───────────────────────────────────
// Обе службы нужны пунктам меню: «Новая папка…» обязана спросить имя, «Вставить» — знать,
// есть ли что вставлять. Портом их отдавать нельзя: спрашивают и копируют не только файлы —
// шаблоны формы точно так же спросят имя, а вклад чужого плагина точно так же положит
// в буфер свои записи.
export { PromptServiceToken } from '@/shell/platform/services/prompt';
export type { PromptService } from '@/shell/platform/services/prompt';
export { ResourceClipboardServiceToken } from '@/shell/platform/services/resource-clipboard';
export type {
  ClipboardMode,
  ClipboardState,
  ResourceClipboardService,
} from '@/shell/platform/services/resource-clipboard';
