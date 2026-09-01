/**
 * Раскладка оболочки в настройках: размеры групп панелей и состояние доков.
 *
 * Три вещи, которые здесь решены явно.
 *
 * **Хранилище — {@link SettingsService}, а не `localStorage`.** У `react-resizable-panels`
 * есть свой механизм запоминания (`useDefaultLayout` + `Storage`), и v1 пользуется именно им.
 * Здесь он не подходит: настройки Host уже умеют области (`user`/`workspace`), умолчания
 * вклада и уведомление о смене, а раскладка, спрятанная в чужом ключе `localStorage`,
 * не видна ни панели настроек, ни экспорту, ни сбросу. Поэтому библиотеке отдаётся
 * `defaultLayout` из настроек, а обратно берётся `onLayoutChanged`.
 *
 * **Область — `user`.** Ширина сайдбара принадлежит человеку, а не проекту: открыть другой
 * проект и обнаружить другую ширину — это не «настройка проекта», это потеря настройки.
 * Отсюда префикс `host.` (см. `scopeForKey` в services/settings).
 *
 * **Прочитанное из хранилища не является данными, пока не проверено.** В настройках лежит то,
 * что записала прошлая версия приложения: слот мог называться иначе, панель могла исчезнуть,
 * значение могло стать `NaN` после правки файла руками. Ненормализованная раскладка,
 * отданная в `defaultLayout`, не даёт ошибки — она даёт панель нулевой ширины, и разбираться
 * с этим приходится по симптому. Поэтому {@link normalizeSizes} и {@link normalizeDockState}
 * стоят между хранилищем и оболочкой.
 *
 * @module shell/platform/ui/chrome/layout-settings
 */

import type { SettingsService } from '@/shell/platform/services/settings';
import type { SlotId } from '../slots';

/**
 * Размеры панелей группы: идентификатор панели → доля (`flexGrow`).
 *
 * Форма совпадает с `Layout` из `react-resizable-panels` намеренно, но тип объявлен свой:
 * зависимость на типы библиотеки раскладки в модуле настроек означала бы, что смена
 * библиотеки трогает хранилище.
 */
export type PanelSizes = Readonly<Record<string, number>>;

/** Состояние дока: какая вкладка выбрана и раскрыт ли он. */
/**
 * Во что раскрыт док.
 *
 * Три состояния, а не два, потому что у нижнего дока полоса вкладок живёт ВНУТРИ него:
 * убрав тело, её надо где-то оставить, иначе развернуть док будет нечем. У боковых доков
 * такой заботы нет — их рейлы снаружи и видны всегда, поэтому они пользуются только
 * крайними состояниями.
 *
 * - `full` — полоса (если есть) и тело;
 * - `minimal` — только полоса вкладок: место занято на её высоту, значки на вкладках видны;
 * - `hidden` — дока нет вовсе.
 */
export type DockMode = 'full' | 'minimal' | 'hidden';

export interface DockState {
  /** Идентификатор активной панели или `null`, если выбор ещё не делали. */
  readonly activeId: string | null;
  readonly mode: DockMode;
}

/** Док раскрыт, вкладка не выбрана — до того, как выбор сделан или восстановлен. */
export const DEFAULT_DOCK_STATE: DockState = Object.freeze({ activeId: null, mode: 'full' });

/** Общий префикс ключей раскладки. Один — чтобы сброс раскладки был одной операцией. */
export const LAYOUT_KEY_PREFIX = 'host.shell.';

/** Ключ размеров группы панелей: `host.shell.layout.<groupId>`. */
export function layoutSettingsKey(groupId: string): string {
  return `${LAYOUT_KEY_PREFIX}layout.${groupId}`;
}

/** Ключ состояния дока: `host.shell.dock.<slot>.active` и `host.shell.dock.<slot>.open`. */
export function dockSettingsKey(slot: SlotId, field: 'active' | 'open'): string {
  return `${LAYOUT_KEY_PREFIX}dock.${slot}.${field}`;
}

/**
 * Приводит прочитанное из хранилища к размерам группы.
 *
 * Оставляет только известные панели с конечным положительным размером. `undefined` означает
 * «восстанавливать нечего» — библиотека раскладки сама расставит размеры по умолчанию,
 * и это лучше, чем частичная раскладка, где половина панелей схлопнута в ноль.
 *
 * Полнота набора **не** требуется: панель могла появиться после того, как размеры записаны
 * (включили плагин), и терять из-за неё ширины остальных не за что.
 */
export function normalizeSizes(raw: unknown, panelIds: readonly string[]): PanelSizes | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;

  const source = raw as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const id of panelIds) {
    const value = source[id];
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue;
    result[id] = value;
  }
  return Object.keys(result).length === 0 ? undefined : Object.freeze(result);
}

/**
 * Приводит прочитанное к состоянию дока.
 *
 * Пустая строка в `active` — это «не выбрано», а не панель с пустым идентификатором:
 * такой панели быть не может, а пустая строка в хранилище получается сама собой при
 * ручной правке. Непонятное значение `open` — это `true`: закрытый по ошибке док выглядит
 * как пропавшая половина интерфейса.
 */
export function normalizeDockState(
  activeRaw: unknown,
  modeRaw: unknown,
  closed: DockMode = 'hidden'
): DockState {
  const activeId = typeof activeRaw === 'string' && activeRaw !== '' ? activeRaw : null;
  // Булево принимается тоже: так это поле хранилось раньше, и настройки людей переживают
  // правку. `false` означало «закрыт», а что такое «закрыт» — решает сам док.
  const mode: DockMode = isDockMode(modeRaw)
    ? modeRaw
    : typeof modeRaw === 'boolean'
      ? modeRaw
        ? 'full'
        : closed
      : DEFAULT_DOCK_STATE.mode;
  return Object.freeze({ activeId, mode });
}

/** Годится ли значение как режим дока. */
export function isDockMode(value: unknown): value is DockMode {
  return value === 'full' || value === 'minimal' || value === 'hidden';
}

/**
 * Что делает нажатие на вкладку рейла.
 *
 * Нажатие на активную вкладку сворачивает док, на другую — переключает и разворачивает.
 * Поведение взято у v1 и у редакторов вообще: одна и та же кнопка и выбирает, и убирает,
 * поэтому отдельная кнопка «свернуть» не нужна, а свёрнутый док разворачивается тем же
 * движением, которым сворачивался.
 */
export function toggleDock(
  current: DockState,
  clickedId: string,
  closed: DockMode = 'hidden'
): DockState {
  if (current.mode === 'full' && current.activeId === clickedId) {
    return Object.freeze({ activeId: clickedId, mode: closed });
  }
  return Object.freeze({ activeId: clickedId, mode: 'full' });
}

/** Читает и нормализует размеры группы. */
export function readPanelSizes(
  settings: SettingsService,
  groupId: string,
  panelIds: readonly string[]
): PanelSizes | undefined {
  return normalizeSizes(settings.get<unknown>(layoutSettingsKey(groupId)), panelIds);
}

/**
 * Записывает размеры группы.
 *
 * Запись возвращает промис, потому что за ней хранилище; вызывающему из обработчика события
 * ждать нечего — кэш настроек обновлён синхронно. Отказ записи не должен превращаться
 * в необработанное отклонение, поэтому у вызова в оболочке стоит `void … .catch(…)`.
 */
export function writePanelSizes(
  settings: SettingsService,
  groupId: string,
  sizes: PanelSizes
): Promise<void> {
  return settings.set(layoutSettingsKey(groupId), sizes);
}

/** Читает и нормализует состояние дока. */
export function readDockState(settings: SettingsService, slot: SlotId): DockState {
  return normalizeDockState(
    settings.get<unknown>(dockSettingsKey(slot, 'active')),
    settings.get<unknown>(dockSettingsKey(slot, 'open'))
  );
}

/** Записывает состояние дока двумя ключами — их читают и меняют независимо. */
export async function writeDockState(
  settings: SettingsService,
  slot: SlotId,
  state: DockState
): Promise<void> {
  await Promise.all([
    settings.set(dockSettingsKey(slot, 'active'), state.activeId ?? undefined),
    // Ключ прежний, значение теперь строка: читатель принимает и старое булево,
    // поэтому у людей с сохранённой раскладкой ничего не сбрасывается.
    settings.set(dockSettingsKey(slot, 'open'), state.mode),
  ]);
}
