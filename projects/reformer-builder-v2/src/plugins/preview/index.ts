/**
 * Публичная поверхность плагина превью: то, что берёт композиция, и ничего больше.
 *
 * Всё остальное — поверхности, компиляция сайдкаров, реестр компонентов, состояние — внутреннее
 * и меняется без согласования. Правило проверяется запретом импорта из каталога чужого плагина
 * глубже его корня.
 *
 * ## Что нужно от композиции
 *
 * ```ts
 * createPreviewPlugin({
 *   host: previewHost,                    // порт платформы, см. ниже
 *   i18n: i18n.forPlugin('preview'),      // пока в PluginContext нет своего i18n
 *   // surfacePoint: PreviewSurfacePoint, // когда точка появится в @/sdk — подставить её
 *   // slot: 'panel.bottom',              // раскладка — дело композиции
 * });
 * ```
 *
 * Порт (`app/preview-host.ts` по образцу `app/schema-host.ts`) обязан дать:
 *
 * - **документ и активную вкладку** — `documentOf`, `useActiveDocument`: рабочей области
 *   в `@/sdk` нет, а без ответа «на что смотрят сейчас» панель не знает, что показывать;
 * - **возможности источника** — `sourceOf(id)`: по ним и только по ним решается, монтировать ли
 *   компилирующую поверхность (`SourceCapabilities.executesCode`);
 * - **кит тремя разными вещами** — `catalog()` (какие имена бывают), `kit()` (как их резолвить),
 *   `kitNamespace()` (чем рисовать) плюс `onDidChangeKit`. Первые два берутся из
 *   `services.get(KitsServiceToken)` ЛЕНИВО, на каждый вызов. **Третьего в v2 нет ни у кого:**
 *   `lib/kits` намеренно не тянет React-адаптеры, поэтому namespace композиции придётся собрать
 *   самой (например, `import * as kit from '@reformer/ui-kit'`) — и лучше лениво, потому что
 *   это единственная часть превью, которая тянет за собой кит целиком;
 * - **файлы формы** — `siblings(id)` и `readText(id)` поверх Workspace (арифметика путей
 *   платформенная, отбор файлов — наш), плюс необязательный `onDidChangeFiles`;
 * - **загрузчик модулей** — `modules`: `ModuleLoaderToken` вместе с прогревом
 *   `createTypeScriptSupport(...).ensure`. Настоящий `ModuleLoader` присваивается
 *   в `PreviewModules` структурно; без него компилирующая поверхность честно говорит,
 *   что исполнение недоступно.
 *
 * Больше ничего: превью не сохраняет, не правит схему и не открывает чужих документов.
 *
 * ## Чего в плагине нет и почему
 *
 * **Хранилища мок-данных.** По контракту они живут в OPFS рядом с рабочей копией как авторский
 * артефакт. `PreviewContext.mock()` — место, куда они подключатся; сегодня он всегда отвечает
 * `null`, и поверхности синтезируют значения из схемы. Пустое место честнее места, которое
 * незаметно теряет содержимое при закрытии вкладки.
 *
 * **Общего выделения с редактором схемы.** Выбор узла кликом работает, но остаётся внутри
 * превью: канала «выделение документа» в v2 нет — редактор держит его в своих сеансах,
 * а плагины друг друга не импортируют. Нужен сервис или событие; это правка контракта,
 * а не плагина.
 *
 * @module plugins/preview/index
 */

export {
  createPreviewPlugin,
  builtinSurfaces,
  PREVIEW_PLUGIN_ID,
  type PreviewPluginOptions,
} from './plugin';

export { PreviewSurfacePoint } from './contract';

/**
 * Правило выбора поверхности, состояния документов и переходник контекста — наружу.
 *
 * Не «внутреннее, вырвавшееся в публичный интерфейс», а прямое следствие того, что поверхности
 * стало показывать двое: панель превью и живой вид редактора схемы. Композиция обязана дать
 * второму ТУ ЖЕ поверхность по ТОМУ ЖЕ правилу и с ТЕМ ЖЕ состоянием документа — иначе
 * переключение поверхности в панели не меняло бы форму в редакторе, а находки сборки
 * раздваивались бы. Реестр состояний поэтому и создаётся композицией — тем же приёмом,
 * которым она владеет реестрами Monaco, делимыми на троих.
 */
export { chooseSurface, surfaceRank } from './selection';
export type { SurfaceChoice, SurfaceFallback, SurfaceOption } from './selection';
export { createPreviewSessions } from './sessions';
export type { PreviewSessions } from './sessions';
export { documentRefOf } from './context';
export { fallbackMessage, surfaceTitle } from './label';
export type { PreviewStore, PreviewState } from './store';
export type { PreviewValues } from './contract';
export type {
  ExtensionPointRef,
  PreviewCapabilities,
  PreviewContext,
  PreviewMock,
  PreviewProblem,
  PreviewProblemPhase,
  PreviewSurface,
  SurfaceCatalog,
} from './contract';

export { PREVIEW_MESSAGES } from './messages';

export type {
  MessageSink,
  PreviewDocument,
  PreviewHost,
  PreviewModuleError,
  PreviewModuleGraph,
  PreviewModules,
  PreviewSourceCapabilities,
  Translate,
} from './host';

export { COMPILING_SURFACE_ID } from './compiling/surface';
export { RUNTIME_SURFACE_ID } from './runtime/surface';
