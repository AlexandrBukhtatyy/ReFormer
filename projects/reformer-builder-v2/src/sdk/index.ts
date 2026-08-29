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
 * Модуль этим и ценен: он делает видимой ЦЕНУ платформы для плагина. Пока здесь тринадцать
 * имён — плагин зависит от тринадцати имён, и любое расширение поверхности видно в diff'е
 * этого файла, а не растворяется в сотне импортов по всему `plugins/`.
 *
 * Отсюда же следует, чего здесь нет и не будет: реестров (`createExtensionRegistry`,
 * `createServiceRegistry`), рабочей области, хранилищ, оболочки. Плагин получает доступ
 * к ним через {@link PluginContext} — то есть по правилам, а не по импорту.
 *
 * ## Почему типы, а не реализация
 *
 * Значений здесь ровно два: {@link definePlugin} (проверка `id` и вывод типов в месте
 * объявления) и {@link ValidatorPoint} (типизированное имя точки расширения — оно обязано
 * быть ОДНИМ объектом для Host и для плагина, иначе вклад уйдёт в точку-двойник). Всё
 * остальное — типы, которые стираются на сборке: `@/sdk` не тянет за собой Host в бандл
 * плагина.
 *
 * ## Первый потребитель
 *
 * `plugins/validator-schema/` — валидатор схемы формы. Состав ниже продиктован им, и это
 * нормально: поверхность растёт по требованию, а не по воображению.
 *
 * @module sdk
 */

// Плагин: контракт и объявление.
export { definePlugin } from '../host/plugin/types';
export type { Plugin, PluginContext } from '../host/plugin/types';

// Освобождение: всё, что плагин регистрирует, он кладёт в `ctx.subscriptions`.
export type { Disposable } from '../host/primitives/disposable';

// Адресация: ресурс, на который смотрит документ.
export type { ResourceId, ResourceRef } from '../host/primitives/resource';

// Правила имён записей — платформенные, потому что их проверяет не только плагин файлов:
// шаблон формы спрашивает имя каталога ровно теми же правилами, и вторая их реализация
// разошлась бы с первой на первом же `aux.ts`, который Windows не даёт создать.
export { validateResourceName, splitName } from '../host/workspace/resource-names';
export type { NameRejection } from '../host/workspace/resource-names';

// Диагностика: то, во что плагин облекает найденное.
export type {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTarget,
  QuickFix,
  TextRange,
} from '../host/diagnostics/types';

// Отбор быстрых исправлений по реестру команд. Здесь, а не у каждого потребителя: проверять
// «команда вообще есть?» обязаны все, кто исправления ПОКАЗЫВАЕТ или применяет (панель проблем,
// канвас, ассистент), а плагины не видят друг друга и завели бы по копии — которые совпадали бы
// по договорённости, то есть до первой правки. Тот же довод, что у порядка строгости выше.
export { usableFixes, withUsableFixes } from '../host/diagnostics/fixes';
export type { CommandLookup, FixesOptions } from '../host/diagnostics/fixes';

// Валидация: точка расширения и контракт вклада.
export { ValidatorPoint } from '../host/validation/types';
export type { DocumentRef, ValidateContext, ValidatorContribution } from '../host/validation/types';

// Вид документа — дискриминант, по которому валидатор решает, ждать ли модель.
export type { DocumentKind } from '../host/workspace/document';

// ── Оболочка: точки расширения интерфейса ───────────────────────────────────────
//
// Панель и редактор — то, ради чего плагин чаще всего и пишется, поэтому их точки обязаны
// быть здесь. Пока их не было, плагин файлов был вынужден объявлять структурные копии типов
// и получать настоящие точки параметром из композиции: работало, проверялось компиляцией,
// но означало, что типобезопасно внести панель средствами SDK нельзя.
//
// Точка расширения обязана быть ОДНИМ объектом для Host и плагина — иначе вклад уйдёт
// в точку-двойник и потеряется молча. Поэтому здесь реэкспорт, а не переобъявление.
export { PanelPoint } from '../host/ui/slots';
export type { PanelContribution, SlotId } from '../host/ui/slots';
export { EditorPoint } from '../host/ui/editors';
export type { EditorContribution } from '../host/ui/editors';
export type { EditorProbe } from '../host/workspace/model/provider';
export { ResourceDecorationPoint } from '../host/ui/decorations';
export type { Decoration, ResourceDecorationContribution } from '../host/ui/decorations';
export { PaletteItemsPoint } from '../host/ui/palette';
export type { PaletteItem, PaletteItemProvider } from '../host/ui/palette';
export type { CommandContribution } from '../host/primitives/command';
export type { WhenContext, FocusTarget } from '../host/primitives/when-context';

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
export { defineService } from '../host/primitives/service';
export type { ServiceToken, ServiceRegistry } from '../host/primitives/service';

// Сервисы платформы, к которым плагин обращается через `ctx.services`.
//
// Почему через реестр, а не полями контекста: **на момент активации плагина рабочей области
// ещё нет** — она появляется, когда пользователь открыл проект, то есть заведомо позже.
// Поле в контексте пришлось бы объявлять необязательным и всё равно проверять на каждом обращении.
export { SettingsServiceToken } from '../host/services/settings';
export type { SettingsService } from '../host/services/settings';
export { ThemeServiceToken } from '../host/services/theme';
export type { ThemeService, ThemePreference } from '../host/services/theme';
export { NotificationsServiceToken } from '../host/services/notifications';
export type { NotificationsService } from '../host/services/notifications';
export { DiagnosticsServiceToken } from '../host/diagnostics/service';
export type { DiagnosticsService } from '../host/diagnostics/service';

// Выделение — общий канал между плагинами, которые показывают ОДИН документ с разных сторон
// (канвас редактора схемы и превью). Он обязан быть здесь, а не портом от композиции: плагины
// не импортируют друг друга, поэтому единственный способ договориться о выделении — общая
// служба платформы, и «непонятно, как передать выбранный узел» решается именно этой строкой.
export { SelectionServiceToken } from '../host/services/selection';
export type { SelectionService } from '../host/services/selection';

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
export { DocumentModelPoint } from '../host/workspace/model/provider';
export type {
  DocumentModelProvider,
  EditOp,
  ApplyResult,
  NodeId,
} from '../host/workspace/model/provider';

// Порядок строгости диагностик. Без него каждый показывающий плагин заводит свою копию,
// и совпадение копий держится на комментарии, а не на компиляторе — ровно это и случилось
// в дереве файлов и на канвасе, пока порядок жил у платформы без выхода наружу.
export { SEVERITY_RANK } from '../host/diagnostics/types';

// ── Меню ─────────────────────────────────────────────────────────────────────────
//
// Реэкспорт, а не копия типов у каждого плагина, по той же причине, что у панелей: точка
// расширения обязана быть ОДНИМ объектом для Host и плагина, иначе вклад уходит в двойник
// и теряется молча.
//
// Корневые меню Host здесь тоже видны (`MenuRootId`): плагин должен уметь СОСЛАТЬСЯ на `file`
// или `edit`, не выдумывая строку. Завести собственный корень он всё равно может — вкладом
// `kind: 'root'`, который встанет в зону между «Видом» и «Справкой».
export { MenuPoint, MENU_ROOT_IDS, CONTEXT_MENU_IDS } from '../host/ui/menu';
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
} from '../host/ui/menu';

// Контекстное меню дерева ресурсов — тот же `MenuPoint`, другой корень. Плагину нужны адрес
// этого корня и типизация цели щелчка: без них пункт «Переименовать» получал бы `unknown`
// и приводил бы его к нужной форме сам — каждый по-своему.
export {
  RESOURCE_CONTEXT_MENU,
  argsOfResource,
  selectedIds,
  whenResource,
} from '../host/ui/resource-menu';
export type { ResourceMenuTarget } from '../host/ui/resource-menu';

// Ряд действий над открытым документом — тот же `MenuPoint`, поверхность `editor/title`.
// Плагину нужны её адрес и типизация цели: без них кнопка «показать предпросмотр» получала бы
// `unknown` и приводила бы его к нужной форме сама — каждый по-своему.
export { EDITOR_TITLE_MENU, argsOfEditor, whenEditor } from '../host/ui/editor-menu';
export type { EditorMenuTarget } from '../host/ui/editor-menu';

// ── Запросы к человеку и буфер записей дерева ───────────────────────────────────
// Обе службы нужны пунктам меню: «Новая папка…» обязана спросить имя, «Вставить» — знать,
// есть ли что вставлять. Портом их отдавать нельзя: спрашивают и копируют не только файлы —
// шаблоны формы точно так же спросят имя, а вклад чужого плагина точно так же положит
// в буфер свои записи.
export { PromptServiceToken } from '../host/services/prompt';
export type { PromptService } from '../host/services/prompt';
export { ResourceClipboardServiceToken } from '../host/services/resource-clipboard';
export type {
  ClipboardMode,
  ClipboardState,
  ResourceClipboardService,
} from '../host/services/resource-clipboard';
