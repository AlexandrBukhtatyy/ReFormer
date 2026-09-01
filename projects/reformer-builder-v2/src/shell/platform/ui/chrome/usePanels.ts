/**
 * Подписки оболочки на реестры Host.
 *
 * Три хука, и все три — переходники `useSyncExternalStore` над тем, что живёт вне React:
 * точкой расширения, настройками и сервисом локализации. Держать их в одном модуле имеет
 * смысл именно потому, что у всех троих одна и та же тонкость — стабильность снимка.
 *
 * ## Стабильность снимка
 *
 * `useSyncExternalStore` вызывает `getSnapshot` на каждой перерисовке и сравнивает результат
 * по ссылке; новый объект каждый раз — это «The result of getSnapshot should be cached»
 * и бесконечный цикл. Поэтому:
 *
 * - {@link useContributions} отдаёт **то, что вернул реестр**, ничего не пересобирая: реестр
 *   кэширует отсортированный снимок ровно для этого (см. `primitives/extension-point`);
 * - {@link usePanels} фильтрует и сортирует **после** `useSyncExternalStore`, в `useMemo`;
 * - {@link useSetting} годится только для примитивных значений — объект из настроек пришлось
 *   бы сравнивать по содержимому, а служба настроек хранит то, что в неё положили, и своей
 *   нормализации не делает.
 *
 * @module shell/platform/ui/chrome/usePanels
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type {
  Contribution,
  ExtensionPoint,
  RootExtensionRegistry,
} from '@/shell/platform/primitives/extension-point';
import type { CommandContribution, CommandRegistry } from '@/shell/platform/primitives/command';
import type { ChordSnapshot, ChordState } from '@/shell/platform/ui/keyboard/chords';
import type { I18nService } from '@/shell/platform/services/i18n/i18n';
import type { SettingsService } from '@/shell/platform/services/settings';
import { selectPanels, type PanelEntry, type PanelPredicateErrorHandler } from './panels';
import { PanelPoint, type SlotId } from '../slots';
import {
  useWhenContext,
  type WhenContextStore,
} from '@/shell/platform/ui/state/when-context-store';

/**
 * Чтение точек расширения — всё, что оболочке нужно от реестра.
 *
 * Тип сужен намеренно: оболочка не вносит вкладов (у корневого реестра `contribute` нет
 * вовсе), и вид на реестр для плагина тоже подходит под эту форму, поэтому хуки одинаково
 * работают и с корневым реестром, и с видом.
 */
export type ExtensionReader = Pick<RootExtensionRegistry, 'get' | 'observe'>;

/** Все вклады точки, в порядке реестра. Перерисовывает при добавлении и снятии вклада. */
export function useContributions<T>(
  extensions: ExtensionReader,
  point: ExtensionPoint<T>
): readonly Contribution<T>[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = extensions.observe(point, onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [extensions, point]
  );
  const getSnapshot = useCallback(() => extensions.get(point), [extensions, point]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Видимые панели слота в порядке показа.
 *
 * Подписка идёт сразу на две вещи: набор вкладов (панель появилась или ушла вместе
 * с плагином) и контекст применимости (панель скрылась по `when`). Разделение принципиально:
 * первое случается при включении плагина, второе — при каждом переключении вкладки, и
 * смешивать их означало бы перерегистрацию вкладов на каждое движение фокуса.
 */
export function usePanels(
  extensions: ExtensionReader,
  store: WhenContextStore,
  slot: SlotId,
  onPredicateError?: PanelPredicateErrorHandler
): readonly PanelEntry[] {
  const entries = useContributions(extensions, PanelPoint);
  const ctx = useWhenContext(store);
  return useMemo(
    () => selectPanels(entries, slot, ctx, onPredicateError),
    [entries, slot, ctx, onPredicateError]
  );
}

/**
 * Все команды реестра, с перерисовкой при появлении и снятии любой из них.
 *
 * Нужен потому, что набор команд складывается ПОСЛЕ первой отрисовки: палитра и справка
 * регистрируют свои в эффектах, плагины — при активации. Меню, построенное на первом кадре
 * и ни на что не подписанное, осталось бы без них навсегда — «Вид» и «Справка» стояли бы
 * пустыми рядом с работающими сочетаниями клавиш. Ровно это и случилось при первом запуске.
 *
 * Снимок реестр кэширует сам (см. `getAll` в `primitives/command`) — без этого
 * `useSyncExternalStore` уходит в бесконечную перерисовку.
 */
export function useCommandSnapshot(
  commands: Pick<CommandRegistry, 'getAll' | 'onDidChange'>
): readonly CommandContribution[] {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = commands.onDidChange(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [commands]
  );
  const getSnapshot = useCallback(() => commands.getAll(), [commands]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Действующее значение настройки, с перерисовкой при его смене.
 *
 * Только для примитивов — см. оговорку о стабильности снимка в шапке модуля. Значение
 * возвращается сырым (`unknown`): оно пришло из хранилища и доверять ему нельзя, поэтому
 * нормализация — дело вызывающего (`layout-settings`).
 */
export function useSetting(settings: SettingsService, key: string): unknown {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = settings.onDidChange((changed) => {
        if (changed === key) onStoreChange();
      });
      return () => {
        subscription.dispose();
      };
    },
    [settings, key]
  );
  const getSnapshot = useCallback(() => settings.get<unknown>(key), [settings, key]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Текущая локаль — как повод перерисоваться, а не как значение.
 *
 * `t()` читается прямо из сервиса, но результат меняется при смене локали, а сервис
 * не является React-состоянием. Этот хук и есть недостающая связь: он ничего не переводит,
 * он делает перевод реактивным.
 */
export function useLocale(i18n: I18nService): string {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = i18n.onDidChangeLocale(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [i18n]
  );
  const getSnapshot = useCallback(() => i18n.locale, [i18n]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Ожидание второй ступени аккорда как React-значение.
 *
 * Хранилище живёт вне React (см. `./chords`), потому что читает его и диспетчер клавиш,
 * где React недоступен. Здесь только переходник — тот же приём, что у снимка команд рядом.
 *
 * `undefined` вместо условного вызова хука: аккорды передаются оболочке необязательным
 * входом, а вызывать хук по условию React не даёт.
 */
export function useChord(chords: ChordState | undefined): ChordSnapshot {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = chords?.subscribe(onStoreChange);
      return () => {
        subscription?.dispose();
      };
    },
    [chords]
  );
  const getSnapshot = useCallback(() => chords?.get() ?? IDLE_CHORD, [chords]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Пустое ожидание для сборки без аккордов. Ссылка одна: снимок обязан быть стабильным. */
const IDLE_CHORD: ChordSnapshot = Object.freeze({
  prefix: Object.freeze([]),
  labels: Object.freeze([]),
});
