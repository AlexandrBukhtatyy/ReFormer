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
import type { JsonPath } from '../model';

/**
 * Режим отображения схемы в центре (спека §9): `wire` — схематичный canvas, `runtime` — рендерер,
 * `code` — JSON-исходник схемы в Monaco (тот же двусторонний редактор, что и raw-панель).
 */
export type PreviewMode = 'wire' | 'runtime' | 'code';

/** Активная левая вкладка панели инструментов (спека §8); `null` — панель свёрнута. */
export type LeftPanel = 'files' | 'palette' | 'templates' | null;

/** Конкретная левая панель (без свёрнутого состояния) — для запоминания последней. */
export type LeftPanelKind = Exclude<LeftPanel, null>;

/** Тема оболочки. */
export type Theme = 'light' | 'dark';

/**
 * Активная вкладка нижней панели: `raw` — JSON-исходник схемы, `model` — модель превью,
 * `registry` — значения `$dataSource` реестра превью.
 */
export type BottomTab = 'raw' | 'model' | 'registry';

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
  /** Текст файла (`code`-вкладки) — источник истины. */
  text?: string;
  /** Baseline текста для dirty (`code`-вкладки). */
  savedText?: string;
  /** Язык Monaco по расширению файла (`code`-вкладки): typescript/css/markdown/… */
  language?: string;
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
  /** Ключ коалесинга: серия правок с одним ключом схлопывается в одну запись истории. */
  lastCoalesceKey: string | null;
}

/** Глобальные UI-флаги оболочки (спека §8/§9). */
export interface UiState {
  preview: PreviewMode;
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
  rightOpen: boolean;
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
