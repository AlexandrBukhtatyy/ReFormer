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
 * ## Переезд идёт по частям
 *
 * Пакет наполняется слоями. Здесь уже весь контракт плагина — `definePlugin`, `PluginContext`
 * и всё, на что его поля ссылаются: службы, возможности, точки расширения, команды, события,
 * хранилища, словарь, — плюс примитивы без зависимостей, документ и модель документа, службы
 * рабочей области, вклады панелей, редакторов и декораций, диагностика и валидация. Не переехали
 * пока меню и палитра, клавиатура, токены остальных служб оболочки и хуки.
 *
 * Пока переезд не кончен, ПОВЕРХНОСТЬЮ ПЛАГИНА остаётся `@/sdk` билдера, и он обязан
 * оставаться её единственным описанием: всё, что переехало сюда, там реэкспортируется,
 * а не объявляется заново. Разойтись им нечем — источник один.
 *
 * @module @reformer/builder-plugin-api
 */

// Плагин: контракт и объявление.
export { definePlugin } from './plugin/types';
export type { Plugin, PluginContext } from './plugin/types';

// Служба: токен, объявитель и контракт реестра. Реестр плагин получает полем контекста,
// заводить свой ему нечем и незачем.
export { defineService } from './primitives/service';
export type { ServiceToken, ServiceRegistry } from './primitives/service';

// Возможность — это токен службы плюс версия, а не второй реестр. Довод — в шапке модуля.
export { defineCapability } from './primitives/capability';
export type {
  Capability,
  CapabilityAccess,
  CapabilityDeclaration,
  CapabilityProvider,
  CapabilityRequirement,
} from './primitives/capability';

// Команда: вклад, который плагин вносит в реестр видом из контекста. Разбор аккорда — тем же
// кодом, что и регистрация: разъедься написание, подпись плагина перестала бы совпадать с тем,
// что человек нажимает.
export type { CommandContribution } from './primitives/command';
export { MAX_CHORD_STEPS, normalizeChord, normalizeKeybinding } from './primitives/command';

// Словарь плагина: его строки в ЕГО пространстве имён.
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

// ── Клавиатура: условие применимости как данные ─────────────────────────────────
//
// Строку условия (`CommandContribution.when`) плагин пишет и без импорта, но разбирать её
// обязаны трое одинаково — реестр команд, диспетчер клавиш и тот, кто её показывает.
// Вторая реализация грамматики разошлась бы с первой на первом же операторе, а расхождение
// проявилось бы не отказом, а молча не сработавшей клавишей.
export { parseWhen, compileWhen, evaluateWhen, WHEN_TRUE } from './primitives/when-expr';
export type { WhenExpr, WhenNode, WhenParseError, WhenParseResult } from './primitives/when-expr';
export type { WhenContext, FocusTarget } from './primitives/when-context';

// ── Документ и рабочая область ──────────────────────────────────────────────────
//
// Документ — то, что уходит в редакторы, панели и ассистента: буфер без ручек управления.
// Рабочая область отдаётся ДВУМЯ службами, разделёнными по правам: что ОТКРЫТО (единственная
// дверь записи) и что ЛЕЖИТ и где (чтение и адресация). Сохранения наружу нет ни в одной.
export type { Document, DocumentKind } from './workspace/document';
export type { WriteOptions } from './workspace/write-options';
export { DocumentsServiceToken } from './services/documents';
export type { DocumentsService, OpenDocumentOptions } from './services/documents';
export { WorkspaceFilesServiceToken } from './services/workspace-files';
export type { WorkspaceFilesService } from './services/workspace-files';

// Модель документа: знание о формате приходит вкладом, в платформе его нет и быть не может.
export { DocumentModelPoint } from './workspace/model/provider';
export type {
  ApplyResult,
  DocumentModelProvider,
  EditOp,
  EditorProbe,
  NodeId,
} from './workspace/model/provider';

// Общее у текстовых редакторов: кто сейчас печатает и где была каретка. Провайдер — оболочка,
// потому что писать в них обязан каждый редактор и принадлежать они не могут ни одному.
export { TextEditorFocusToken } from './workspace/model/text-editor-focus';
export type { TextEditorFocusRegistry } from './workspace/model/text-editor-focus';
export { EditorViewStatesToken } from './workspace/model/editor-view-states';
export type { EditorViewStates, EditorViewStateSlice } from './workspace/model/editor-view-states';

// ── Вклады: панели, редакторы, декорации, настройки ─────────────────────────────
export { PanelPoint } from './ui/slots';
export type { PanelContribution, SlotId } from './ui/slots';
export { EditorPoint } from './ui/contributions/editors';
export type { EditorContribution } from './ui/contributions/editors';
export { ResourceDecorationPoint } from './ui/contributions/decorations';
export type { Decoration, ResourceDecorationContribution } from './ui/contributions/decorations';
export { CatalogPluginSettingsPoint } from './ui/contributions/plugin-settings';
export type { CatalogPluginSettingsContribution } from './ui/contributions/plugin-settings';

// ── Диагностика и валидация ─────────────────────────────────────────────────────
//
// Находка — данные, а не текст: одна и та же ошибка обязана выглядеть одинаково в редакторе,
// в панели проблем и в логе. Быстрые исправления называют команду строкой, и отбрасывать
// недоступные обязан тот, кто показывает, — функцией отсюда, а не своей копией.
export { SEVERITY_RANK } from './services/diagnostics/types';
export type {
  Diagnostic,
  DiagnosticSeverity,
  DiagnosticTarget,
  NodePart,
  QuickFix,
  TextRange,
} from './services/diagnostics/types';
export { usableFixes, withUsableFixes } from './services/diagnostics/fixes';
export type { CommandLookup, FixesOptions } from './services/diagnostics/fixes';
export { ValidatorPoint } from './services/validation/types';
export type {
  DocumentRef,
  ValidateContext,
  ValidatorContribution,
} from './services/validation/types';
