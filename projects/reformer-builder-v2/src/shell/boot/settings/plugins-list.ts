/**
 * Правила строки в разделе настроек «Плагины»: что показать и что разрешить нажать.
 *
 * Модуль ЧИСТЫЙ и без React намеренно. Правила состояний — единственное, что в этом разделе
 * можно проверить дёшево и без браузера, и они же — то, что разъедется с палитрой первым:
 * обе поверхности зовут один каталог, но решают отдельно, где кнопка активна. Держать решение
 * здесь означает, что расхождение видно в одном diff'е.
 *
 * Порт объявлен СТРУКТУРНО, а не импортом каталога: `shell/platform/plugin/catalog` уже
 * зависит от `shell/platform/ui/keyboard/keymap`, и прямой импорт в обратную сторону замкнул бы
 * подсистемы в цикл. Тот же приём и та же причина, что у `PluginManagerHost`.
 *
 * @module shell/boot/settings/plugins-list
 */

import type { Disposable } from '@/shell/platform/primitives/disposable';

/** Состояние плагина в каталоге. Копия перечисления каталога — структурно, без импорта. */
export type PluginRowState = 'disabled' | 'enabled' | 'failed';

/** Отказ загрузки: то, что показывается человеку. `cause` сюда не попадает — он для консоли. */
export interface PluginRowProblem {
  readonly code: string;
  readonly message: string;
  readonly file?: string;
}

/** Запись каталога в том объёме, в каком её читает раздел. */
export interface PluginCatalogEntry {
  readonly id: string;
  readonly name: string;
  readonly version?: string;
  readonly state: PluginRowState;
  readonly dev: boolean;
  readonly problem?: PluginRowProblem;
  readonly manifest?: { readonly apiVersion?: string };
}

/**
 * Что разделу нужно от каталога плагинов.
 *
 * `subscribe` обязателен: набор и состояния меняются мимо окна — из палитры, авто-перезагрузкой
 * dev-плагина, обходом проекта. Без подписки раздел показывал бы снимок на момент открытия.
 */
export interface PluginsSettingsPort {
  list(): readonly PluginCatalogEntry[];
  subscribe(listener: () => void): Disposable;
  enable(id: string): Promise<boolean>;
  disable(id: string): void;
  setDev(id: string, on: boolean): void;
  reload(id: string): Promise<boolean>;
  /**
   * Синхронизирован ли каталог с ОТКРЫТЫМ сейчас проектом.
   *
   * Не «открыт ли проект»: между сменой проекта и перечитыванием каталога список ещё содержит
   * плагины прежнего, и показывать их как действующие — врать. В это окно раздел говорит
   * «читаю каталог», а не «плагинов нет».
   */
  synced(): boolean;
  /** Открыт ли проект. Без него каталогу неоткуда взяться, и это отдельный ответ человеку. */
  hasProject(): boolean;
}

/** Что делает переключатель строки. У `failed` включение — это «попробовать снова». */
export type PluginToggleAction = 'enable' | 'disable' | 'retry';

/** Строка раздела: всё решено заранее, компоненту остаётся отрисовать. */
export interface PluginRow {
  readonly id: string;
  readonly name: string;
  /** Подпись версии, уже готовая к показу. `null` — версии нет, место не занимаем. */
  readonly version: string | null;
  readonly state: PluginRowState;
  readonly dev: boolean;
  /** Включён ли переключатель. У `failed` — выключен: вклады сняты, и врать нельзя. */
  readonly on: boolean;
  readonly toggle: PluginToggleAction;
  /** Перезагрузка имеет смысл только у работающего: у выключенного она ничего не включит. */
  readonly canReload: boolean;
  readonly problem: PluginRowProblem | null;
  readonly apiVersion: string | null;
}

/** Строки раздела в порядке показа. */
export function toRows(entries: readonly PluginCatalogEntry[]): readonly PluginRow[] {
  return (
    [...entries]
      // Порядок каталога — порядок обхода файловой системы, то есть произвольный на вид.
      // Сортировка по имени делает список стабильным между обходами: строка не прыгает
      // под курсором из-за того, что плагин перезагрузился.
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => ({
        id: entry.id,
        name: entry.name,
        version: entry.version ?? null,
        state: entry.state,
        dev: entry.dev,
        on: entry.state === 'enabled',
        toggle:
          entry.state === 'enabled' ? 'disable' : entry.state === 'failed' ? 'retry' : 'enable',
        canReload: entry.state === 'enabled',
        problem: entry.problem ?? null,
        apiVersion: entry.manifest?.apiVersion ?? null,
      }))
  );
}

/** Что показывает раздел вместо списка. `null` — показывать список. */
export type PluginsEmptyState = 'loading' | 'no-project' | 'no-plugins' | null;

/**
 * Пустые состояния разведены на три: они требуют разных действий от человека.
 *
 * «Читаю каталог» — подождать; «проект не открыт» — открыть папку; «плагинов нет» — положить
 * плагин в `.ui_builder/plugins`. Один общий текст на все три говорил бы «плагинов нет» там,
 * где их просто ещё не прочитали, и человек пошёл бы искать несуществующую поломку.
 */
export function emptyStateOf(port: PluginsSettingsPort): PluginsEmptyState {
  if (!port.hasProject()) return 'no-project';
  if (!port.synced()) return 'loading';
  return port.list().length === 0 ? 'no-plugins' : null;
}
