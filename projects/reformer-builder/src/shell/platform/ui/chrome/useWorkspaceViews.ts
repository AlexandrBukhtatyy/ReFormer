/**
 * Подписки оболочки на хранилища рабочей области: вкладки и дерево ресурсов.
 *
 * Отдельно от `./usePanels` по предмету: там переходники к реестрам Host (вклады, настройки,
 * словари), здесь — к тому, что живёт поверх рабочей области. Отдельно от самих хранилищ
 * (`./tabs`, `./resource-tree`) по зависимостям: правила вкладок и дерева проверяются
 * в окружении `node`, и React им не нужен ни для чего.
 *
 * Тонкость у обоих одна и та же — стабильность снимка: `getSnapshot` обязан возвращать ту же
 * ссылку, пока ничего не изменилось. Поэтому оба хранилища возвращают прежний объект,
 * когда изменение ничего не поменяло, а здесь снимок ничем не оборачивается.
 *
 * @module shell/platform/ui/chrome/useWorkspaceViews
 */

import { useCallback, useSyncExternalStore } from 'react';
import type {
  EditorChoices,
  EditorChoiceStore,
} from '@/shell/platform/ui/contributions/editor-choice';
import type { ResourceTreeState, ResourceTreeStore } from '@/shell/platform/ui/state/resource-tree';
import type { DocumentTabsStore, TabsState } from '@/shell/platform/ui/state/tabs';

/** Снимок вкладок с перерисовкой при их изменении. */
export function useDocumentTabs(store: DocumentTabsStore): TabsState {
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

/** Снимок выбора редактора («открыть с помощью») с перерисовкой при его изменении. */
export function useEditorChoices(store: EditorChoiceStore): EditorChoices {
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

/** Снимок дерева ресурсов с перерисовкой при его изменении. */
export function useResourceTree(store: ResourceTreeStore): ResourceTreeState {
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
