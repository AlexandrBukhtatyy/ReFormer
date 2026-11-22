/**
 * Источник актуального {@link WhenContext} для оболочки.
 *
 * {@link WhenContext} — снимок: замороженный объект без методов, по которому команда решает,
 * доступна ли она, а панель — показывать ли себя. Снимок кто-то обязан обновлять, и это
 * место — здесь. Хранилище живёт вне React намеренно: контекст читают и команды (из
 * обработчика клавиш, из палитры, из ассистента), где React недоступен, и компоненты,
 * которым нужна перерисовка. Внешнее хранилище плюс `useSyncExternalStore` обслуживает оба
 * случая одним значением; состояние внутри компонента — только второй.
 *
 * ## Почему `useSyncExternalStore`, а не контекст с `useState`
 *
 * Требование `useSyncExternalStore` — `getSnapshot` обязан возвращать **ту же ссылку**, пока
 * ничего не изменилось, иначе React уходит в бесконечную перерисовку с «The result of
 * getSnapshot should be cached». Здесь это свойство даёт модель ядра: контекст — модель из пяти
 * полей, снимок — её `model.$` (computed), а лист модели не уведомляет при равном значении.
 * Поэтому {@link WhenContextStore.set} с патчем, ничего не меняющим, не рождает ни нового
 * объекта, ни уведомления — без ручного сравнения полей.
 *
 * Это не оптимизация. Каждое поле контекста — перерисовка всего, что на него подписано
 * (plugin-and-shell.md, «`WhenContext` остаётся на пяти полях»), а обновляется он из
 * обработчика `focusin`, то есть при каждом движении фокуса по интерфейсу.
 *
 * ## Кто обновляет какое поле
 *
 * - `focus` — оболочка, отсюда, через {@link useFocusTracking};
 * - `activeEditorId`, `activeResourceKind` — тот, кто владеет открытыми вкладками: хранилище
 *   вкладок в `./tabs`, при каждом изменении своего снимка. Там же снята двусмысленность
 *   `activeEditorId`: это идентификатор РЕСУРСА активной вкладки, а не идентификатор вклада
 *   редактора, — контракт называет его «null, если открытых вкладок нет», и только при таком
 *   прочтении `null` означает ровно это, а не ещё и «редактор для файла не нашёлся»;
 * - `hasSelection`, `previewMode` — активный редактор.
 *
 * Хранилище одно на приложение и создаётся композицией (`app/boot`), поэтому «кто обновляет»
 * — это вопрос к владельцу поля, а не к оболочке: она отдаёт `set` и не знает, что за ним.
 *
 * @module shell/platform/ui/state/when-context-store
 */

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { createModel } from '@reformer/core/model';
import type { Disposable } from '@reformer/builder-plugin-api/internal';
import { whenContext, type WhenContext } from '@reformer/builder-plugin-api/internal';
import { throwListenerErrors, toSource } from '@/shell/platform/primitives/signal-store';
import { classifyFocus, probeFromElement } from '@/shell/platform/ui/keyboard/focus';

/** Изменяемое хранилище одного снимка {@link WhenContext}. */
export interface WhenContextStore {
  /**
   * Текущий снимок. Ссылка стабильна между изменениями — это условие
   * `useSyncExternalStore`, а не деталь реализации.
   */
  get(): WhenContext;
  /**
   * Записывает изменившиеся поля. Патч, не меняющий ничего, не порождает уведомления.
   *
   * Возвращает `true`, если снимок сменился, — чтобы вызывающий мог не гадать, была ли
   * перерисовка.
   */
  set(patch: Partial<WhenContext>): boolean;
  /** Подписка на смену снимка. `dispose()` снимает её. */
  subscribe(listener: () => void): Disposable;
}

/**
 * Создаёт хранилище контекста.
 *
 * Начальное значение достраивается до полного через `whenContext(...)`: неуказанные поля
 * берутся из нейтрального контекста, поэтому добавление поля в {@link WhenContext} не ломает
 * ни одного вызова.
 */
export function createWhenContextStore(initial: Partial<WhenContext> = {}): WhenContextStore {
  const context = createModel<WhenContext>({ ...whenContext(initial) });
  // Политика ошибок — как у точки расширения и у смены локали: падение одного подписчика не
  // мешает остальным и не откатывает уже совершённое изменение, но и не теряется.
  const source = toSource(
    context.$,
    throwListenerErrors('ошибки в подписчиках контекста применимости')
  );

  return {
    get: (): WhenContext => context.$.peek(),

    set(patch: Partial<WhenContext>): boolean {
      // `undefined` в патче — «поле не трогаем», а не «сбрось поле»: `patch` модели так и
      // читает его. Изменился ли снимок, говорит его ссылка: равные значения листьев её не
      // двигают, а патч из обработчика фокуса чаще всего не меняет ничего.
      const before = context.$.peek();
      context.patch(patch);
      return context.$.peek() !== before;
    },

    subscribe: source.subscribe,
  };
}

/** Подписывает компонент на снимок контекста. */
export function useWhenContext(store: WhenContextStore): WhenContext {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = store.subscribe(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [store]
  );
  return useSyncExternalStore(subscribe, store.get, store.get);
}

/**
 * Держит поле `focus` в хранилище в соответствии с реальным фокусом документа.
 *
 * Один слушатель на документе, а не по слушателю на область: `focusin` всплывает, а вид
 * области объявляет разметка (см. `./focus`). Обратное — регистрация областей в реестре —
 * потребовало бы от каждой панели знать про оболочку и снимать регистрацию при размонтировании.
 *
 * `focusout` без `relatedTarget` означает, что фокус ушёл из документа целиком (переключились
 * на другое окно): тогда фокус — `none`. Уход фокуса на другой элемент обрабатывать не надо,
 * за ним сразу придёт `focusin`, и промежуточное `none` дало бы лишнюю перерисовку.
 */
export function useFocusTracking(store: WhenContextStore, enabled = true): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;

    const onFocusIn = (event: FocusEvent): void => {
      const target = event.target instanceof Element ? event.target : null;
      store.set({ focus: classifyFocus(probeFromElement(target)) });
    };
    const onFocusOut = (event: FocusEvent): void => {
      if (event.relatedTarget === null) store.set({ focus: 'none' });
    };

    // Первичная синхронизация: фокус мог оказаться где-то до подписки — например,
    // браузер восстановил его при перезагрузке страницы.
    store.set({ focus: classifyFocus(probeFromElement(document.activeElement)) });

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
    };
  }, [store, enabled]);
}
