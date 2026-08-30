/**
 * Предпочтения канваса как состояние React.
 *
 * Подписка, а не чтение при отрисовке: предпочтение меняет команда из полосы вкладок,
 * но хранится оно ВНЕ компонента ({@link './../canvas-prefs'}) — иначе вид сбрасывался бы
 * на дерево при каждом переключении вкладок, потому что тело редактора пересоздаётся
 * на пару «редактор + документ».
 *
 * ## Подписка внешнего хранилища, а не эффект с `setState`
 *
 * Тот же приём, что у сеансов ({@link './useSession'}). Эффект, синхронно зовущий `setState`,
 * даёт лишний каскад отрисовок и первый кадр со СТАРЫМ значением: между монтированием
 * и эффектом успевает пройти отрисовка, в которой вид ещё прежний. `useSyncExternalStore`
 * читает значение в той же отрисовке.
 *
 * Снимок кэшируется по значению: React сравнивает его ссылкой, и новый объект на каждый
 * вопрос означал бы вечную перерисовку.
 *
 * @module plugins/editor-schema/ui/usePrefs
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { DEFAULT_CANVAS_VIEW, type CanvasPrefs, type CanvasView } from '../canvas-prefs';

/** Снимок предпочтений: то, на что смотрит канвас. */
export interface CanvasPrefsSnapshot {
  readonly view: CanvasView;
}

/** Умолчание: канвас без стора остаётся деревом. */
const DEFAULTS: CanvasPrefsSnapshot = Object.freeze({ view: DEFAULT_CANVAS_VIEW });

/**
 * Текущие предпочтения; без стора — умолчания.
 *
 * `null` — законная сборка, а не отсутствие возможности: тест канваса и встраивание
 * поднимают его без настроек, и тогда вид ровно один, дерево.
 */
export function useCanvasPrefs(prefs: CanvasPrefs | null): CanvasPrefsSnapshot {
  const cache = useRef<CanvasPrefsSnapshot>(DEFAULTS);

  const subscribe = useCallback(
    (listener: () => void) => {
      if (prefs === null) return () => undefined;
      const subscription = prefs.subscribe(listener);
      return () => {
        subscription.dispose();
      };
    },
    [prefs]
  );

  const snapshot = useCallback((): CanvasPrefsSnapshot => {
    const view = prefs?.view() ?? DEFAULTS.view;
    const previous = cache.current;
    // Та же ссылка, пока значение то же: снимок сравнивается ссылкой, и новый объект
    // на каждый вопрос React принял бы за изменение — то есть за повод отрисоваться снова.
    if (previous.view === view) return previous;
    const next: CanvasPrefsSnapshot = { view };
    cache.current = next;
    return next;
  }, [prefs]);

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
