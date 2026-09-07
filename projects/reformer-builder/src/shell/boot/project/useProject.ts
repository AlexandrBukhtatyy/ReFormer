/**
 * Подписка React на открытый проект.
 *
 * Отдельным модулем, а не рядом с компонентом: файл с компонентом обязан экспортировать
 * только компоненты (иначе горячая замена перестаёт работать), а хук компонентом не является.
 * Тонкость та же, что у всех подписок оболочки, — стабильность снимка: держатель проекта
 * возвращает ту же ссылку на сессию, пока проект не сменился, поэтому оборачивать её здесь
 * ничем нельзя.
 *
 * @module shell/boot/project/useProject
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { ProjectHost } from './project';
import type { WorkspaceSession } from './workspace-session';

/** Часть держателя, нужная подписке. Сужение делает невозможным «компонент открыл проект сам». */
export type ProjectReader = Pick<ProjectHost, 'get' | 'subscribe'>;

/** Текущая сессия с перерисовкой при смене проекта. */
export function useProjectSession(project: ProjectReader): WorkspaceSession | null {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = project.subscribe(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [project]
  );
  return useSyncExternalStore(subscribe, project.get, project.get);
}
