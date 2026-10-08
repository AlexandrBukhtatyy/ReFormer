/**
 * Режим превью как состояние React: шапка дока и тело панели читают его одним хуком.
 *
 * @module plugins/base/app-preview/ui/usePreviewMode
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { PreviewMode, PreviewModeStore } from '../model';

export function usePreviewMode(store: PreviewModeStore): PreviewMode {
  const subscribe = useCallback(
    (notify: () => void) => {
      const subscription = store.subscribe(notify);
      return () => {
        subscription.dispose();
      };
    },
    [store]
  );
  return useSyncExternalStore(subscribe, () => store.get());
}
