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

/** Режим preview (спека §9). */
export type PreviewMode = 'wire' | 'runtime';

/** Активная левая вкладка панели инструментов (спека §8); `null` — панель свёрнута. */
export type LeftPanel = 'files' | 'palette' | null;

/** Тема оболочки. */
export type Theme = 'light' | 'dark';

/** Происхождение вкладки: новая (Mode A) или файл проекта (Mode B). */
export interface TabSource {
  kind: 'new' | 'file';
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
  /** Текущая схема (источник истины). */
  schema: JsonFormSchema;
  /** Baseline для dirty/diff: последний open/export (M1) или save (M2). */
  savedSchema: JsonFormSchema;
  /** Стек отмены (снимки до текущего). */
  past: HistorySnapshot[];
  /** Стек повтора. */
  future: HistorySnapshot[];
  /** Выделенный узел (путь) либо `null`. */
  selectionPath: JsonPath | null;
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
  rawJsonOpen: boolean;
  leftPanel: LeftPanel;
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
