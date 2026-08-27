/**
 * Типы состояния редактора.
 *
 * Источник истины — `JsonFormSchema` каждой вкладки (правится иммутабельно слоем `model/`).
 * Per-tab хранится всё, что не должно теряться при переключении вкладок (прототип §4): схема,
 * история снимков, выделение, активный шаг, baseline для dirty. `TabSource` несёт то, что нужно
 * Mode B для round-trip/конфликтов (спека §6/§7) — в M1 заполняется минимально.
 *
 * @module reformer-builder/store/types
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import type { FormRules } from '../model/rules';
import type { JsonPath } from '../model';

/**
 * Режим отображения схемы в центре (спека §9): `wire` — схематичный canvas, `runtime` — рендерер,
 * `code` — JSON-исходник схемы в Monaco (тот же двусторонний редактор, что и raw-панель).
 */
export type PreviewMode = 'wire' | 'runtime' | 'code';

/**
 * Режим вкладки «Renderer»: `edit` — холст (клик выделяет узел, работают хоткеи и drag-drop,
 * ввод в поля заблокирован), `test` — живая форма (поля принимают ввод, редактирование выключено).
 */
export type RuntimeMode = 'edit' | 'test';

/**
 * Как показывать markdown-файл в code-вкладке (в стиле VSCode): `code` — только Monaco,
 * `preview` — только рендер, `split` — редактор и рендер рядом с синхроскроллом.
 */
export type MarkdownView = 'code' | 'preview' | 'split';

/** Активная левая вкладка панели инструментов (спека §8); `null` — панель свёрнута. */
export type LeftPanel = 'files' | 'palette' | 'templates' | null;

/** Конкретная левая панель (без свёрнутого состояния) — для запоминания последней. */
export type LeftPanelKind = Exclude<LeftPanel, null>;

/**
 * Активная правая панель; `null` — зона свёрнута. Инспектор и ассистент занимают одну зону и
 * переключаются, а не соседствуют: обоим нужна ширина, а справа её на двоих не хватает.
 */
export type RightPanel = 'inspector' | 'agent' | null;

/** Конкретная правая панель (без свёрнутого состояния) — для запоминания последней. */
export type RightPanelKind = Exclude<RightPanel, null>;

/** Тема оболочки. */
export type Theme = 'light' | 'dark';

/**
 * Активная вкладка нижней панели: `raw` — JSON-исходник схемы, `model` — модель превью,
 * `registry` — значения `$dataSource` реестра превью, `form` — состояние живой формы (валидность
 * полей, ошибки, лог, статус сборки схем).
 */
export type BottomTab =
  | 'raw'
  | 'model'
  | 'validation'
  | 'formBehavior'
  | 'renderBehavior'
  | 'registry'
  | 'form';

/** Секция мок-данных превью: модель формы либо значения источников реестра. */
export type MockSection = 'model' | 'dataSources';

/** Правки мок-данных по секциям (JSON-текст каждой). Пропуск секции ⇒ синтез из схемы. */
export type MockDraft = Partial<Record<MockSection, string>>;

/** Происхождение вкладки: новая (Mode A) или файл проекта (Mode B). */
export interface TabSource {
  /**
   * `new` — форма Mode A (ещё не на диске), `file` — файл проекта (Mode B),
   * `template` — временный предпросмотр схемы шаблона: на диск не пишется, ⌘S отдаёт её экспортом.
   */
  kind: 'new' | 'file' | 'template';
  /** Отображаемое имя / имя файла. */
  name: string;
  /** Относительный путь в проекте (Mode B). */
  path?: string;
  /** Исходный текст файла — baseline round-trip (Mode B). */
  rawText?: string;
  /** Метка времени файла — детект внешних изменений (Mode B). */
  lastModified?: number;
  /** Файловый handle (Mode B, File System Access API). */
  handle?: FileSystemFileHandle;
}

/** Снимок для истории undo/redo (снимок схемы + выделения — спека §13). */
export interface HistorySnapshot {
  schema: JsonFormSchema;
  selectionPath: JsonPath | null;
  /**
   * Правила формы на момент снимка. Входят в историю наравне со схемой: правка правил — такая
   * же правка формы, и откатываться она обязана тем же Ctrl+Z. Вынести их за историю (как
   * `mock`) означало бы, что испорченное агентом правило вернуть нечем.
   */
  rules: FormRules;
}

/** Состояние одной открытой вкладки. */
export interface TabState {
  id: string;
  source: TabSource;
  /**
   * Вид вкладки: `form` — редактор формы (canvas/инспектор, источник истины `schema`);
   * `code` — редактор произвольного файла в Monaco (источник истины `text`). У `code`-вкладок
   * `schema`/история/выделение не используются (несут заглушку `emptySchema()`).
   */
  kind: 'form' | 'code';
  /** Текущая схема (источник истины для `form`; заглушка для `code`). */
  schema: JsonFormSchema;
  /** Baseline для dirty/diff: последний open/export (M1) или save (M2). */
  savedSchema: JsonFormSchema;
  /**
   * Правила формы: валидация, реактивные связи, условная видимость. Сайдкар — в схему их
   * положить нельзя (контракт `@reformer/renderer-json` закрыт), см. `model/rules`.
   */
  rules: FormRules;
  /** Baseline правил для dirty: правка правил делает вкладку грязной так же, как правка схемы. */
  savedRules: FormRules;
  /** Текст файла (`code`-вкладки) — источник истины. */
  text?: string;
  /** Baseline текста для dirty (`code`-вкладки). */
  savedText?: string;
  /** Язык Monaco по расширению файла (`code`-вкладки): typescript/css/markdown/… */
  language?: string;
  /**
   * Режим показа markdown-вкладки (`code`-вкладки с `language: 'markdown'`): исходник, рендер или
   * оба рядом. У остальных файлов не используется. Не путать с {@link TabState.preview} — то про
   * временную вкладку, а это про содержимое.
   */
  mdView?: MarkdownView;
  /**
   * Правки мок-данных для runtime/live-превью из нижней панели: по JSON-тексту на секцию
   * (`model` — вкладка «Модель», `dataSources` — вкладка «Registry»). Пропущенная секция ⇒
   * синтез из схемы. Превью-only: вне истории и dirty/save.
   */
  mock?: MockDraft;
  /** Стек отмены (снимки до текущего). */
  past: HistorySnapshot[];
  /** Стек повтора. */
  future: HistorySnapshot[];
  /** Активный (курсор) выделенный узел либо `null`. Всегда входит в {@link selectionPaths}. */
  selectionPath: JsonPath | null;
  /** Все выделенные узлы (мульти-выделение — смежная группа соседей); `[selectionPath]` при одиночном. */
  selectionPaths: JsonPath[];
  /** Якорь диапазона Shift-выделения (откуда растёт группа), либо `null`. */
  anchorPath: JsonPath | null;
  /** Узел под курсором (hover-подсветка). */
  hoverPath: JsonPath | null;
  /** Активный шаг wizard в canvas. */
  activeStep: number;
  /**
   * Были ли правки схемы с момента открытия вкладки. Важно для предпросмотра шаблона: нетронутый
   * остаётся временным (закрылся — открыл заново из панели), а тронутый становится черновиком с
   * локальной копией (см. `isDraft`). Переживает перезагрузку вместе с черновиком.
   */
  touched: boolean;
  /**
   * Preview-вкладка (как в VSCode): открыта одиночным кликом «на посмотреть» и потому переиспользуется
   * — следующий такой клик по другому файлу займёт её слот. Таких вкладок в редакторе не больше одной.
   * Снимается («вкладка закрепляется») двойным кликом по файлу/вкладке и первой же правкой содержимого.
   */
  preview: boolean;
  /** Ключ коалесинга: серия правок с одним ключом схлопывается в одну запись истории. */
  lastCoalesceKey: string | null;
}

/** Глобальные UI-флаги оболочки (спека §8/§9). */
export interface UiState {
  preview: PreviewMode;
  /** Режим вкладки «Renderer»: редактируем схему на живом рендере либо щупаем форму. */
  runtimeMode: RuntimeMode;
  /**
   * Исполнять ли схемы формы (`validation.ts` / `form-behavior.ts` / `render-behavior.ts` /
   * `registry.ts` из каталога рядом с `form.json`) в Renderer-превью. Выключено — превью рисует
   * layout по `form.json` на моках, как раньше. Включение требует подтверждения: код формы
   * исполняется в главном потоке.
   */
  liveSchemas: boolean;
  /** Скрывать `$html(div)`-контейнеры в схематике (чище дерево); их дети рисуются напрямую. */
  hideDivWrappers: boolean;
  /** Открыта ли модалка быстрого добавления компонента (Enter). */
  quickAddOpen: boolean;
  rawJsonOpen: boolean;
  /** Активная вкладка нижней панели (JSON схемы / мок-данные). */
  bottomTab: BottomTab;
  leftPanel: LeftPanel;
  /** Последняя раскрытая левая панель — тоггл ⌘B восстанавливает её, когда сайдбар был свёрнут. */
  lastLeftPanel: LeftPanelKind;
  rightPanel: RightPanel;
  /** Последняя раскрытая правая панель — тоггл ⌥⌘B восстанавливает её, когда зона была свёрнута. */
  lastRightPanel: RightPanelKind;
  theme: Theme;
  /** Запрос навигации в raw-JSON: строка (1-based) для reveal; `null` — активного запроса нет. */
  revealLine: number | null;
  /** Счётчик запросов reveal — растёт на каждый клик, чтобы повторный переход на ту же строку сработал. */
  revealNonce: number;
}

/** Полное состояние редактора. */
export interface EditorState {
  tabs: Record<string, TabState>;
  /** Порядок вкладок. */
  order: string[];
  activeTabId: string | null;
  ui: UiState;
}
