/**
 * Итог по рабочей области, переживающий смену проекта.
 *
 * Строка состояния получает ОДИН источник на всё время жизни приложения — иначе она исчезала
 * бы до восстановления проекта, то есть ровно тогда, когда состояние интереснее всего. Смена
 * проекта для неё — смена содержимого, а не смена источника.
 *
 * Двойная подписка здесь неизбежна и потому явная: на держателя проекта (сессия сменилась)
 * и на итог самой сессии (счётчик изменился). Вторую держит эффект над текущим проектом: при
 * смене проекта очистка эффекта отпускает прежний итог, а новый запуск подписывается на свежий.
 *
 * Модуль типизован структурно и ничего не импортирует из `./project`: так он проверяется
 * в `node` без рабочей области, хранилищ и React.
 *
 * @module shell/boot/project/project-status
 */

import { createStore } from '@reformer/core/model';
import { signal } from '@reformer/core/signals';
import type { Disposable } from '@reformer/builder-plugin-api/internal';
import { logListenerErrors, signalFrom, toSource } from '@/shell/platform/primitives/signal-store';
import {
  NO_WORKSPACE_STATUS,
  type WorkspaceStatusSnapshot,
  type WorkspaceStatusSource,
} from '@/shell/platform/ui/state/status';

/** Держатель проекта в объёме, нужном строке состояния. */
export interface StatusProjectReader {
  get(): { readonly status: WorkspaceStatusSource } | null;
  subscribe(listener: () => void): Disposable;
}

/** Источник итога, который умеет отписаться. */
export interface DisposableStatusSource extends WorkspaceStatusSource, Disposable {}

export function createProjectStatusSource(project: StatusProjectReader): DisposableStatusSource {
  return createStore((scope) => {
    const current = signalFrom(
      () => project.get(),
      (onChange) => project.subscribe(onChange)
    );
    const snapshot = signal<WorkspaceStatusSnapshot>(NO_WORKSPACE_STATUS);

    scope.effect(() => {
      const status = current.value?.status;
      if (!status) {
        snapshot.value = NO_WORKSPACE_STATUS;
        return;
      }
      // Снимок сессии стабилен между изменениями, и сигнал сравнивает его по ссылке: тот же
      // объект подписчиков не будит — `useSyncExternalStore` требует ровно этого.
      snapshot.value = status.get();
      const subscription = status.subscribe(() => {
        snapshot.value = status.get();
      });
      return () => subscription.dispose();
    });

    return toSource(snapshot, logListenerErrors('[app] подписчик итога рабочей области упал'));
  });
}
