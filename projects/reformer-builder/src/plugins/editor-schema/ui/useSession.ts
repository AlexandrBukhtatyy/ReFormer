/**
 * Подписки React на реестр сеансов и на сам сеанс.
 *
 * Отдельно от компонентов по той же причине, по которой `host/ui/useWorkspaceViews` отделён
 * от оболочки: правила живут в чистых модулях, а здесь остаётся ровно переходник
 * `useSyncExternalStore` — три строки, в которых нечему ломаться, кроме стабильности снимка.
 *
 * Про стабильность и речь: `getSnapshot` обязан возвращать ту же ссылку, пока ничего
 * не изменилось. Поэтому сеанс отдаёт замороженный снимок и пересоздаёт его только на
 * изменении, а реестр — число версии: собирать объект на каждый вызов значило бы
 * перерисовывать панели бесконечно.
 *
 * @module plugins/editor-schema/ui/useSession
 */

import { useCallback, useSyncExternalStore } from 'react';
import type { SchemaEditorState, SchemaSession } from '../session/sessions';
import type { SessionRegistry } from '../session/sessions';

/** Активный сеанс с перерисовкой при его смене и при любой правке в нём. */
export function useActiveSession(registry: SessionRegistry): SchemaSession | null {
  useRegistryVersion(registry);
  return registry.active();
}

/** Сеанс документа с той же подпиской — для тела редактора, которое знает свой документ. */
export function useSessionOf(registry: SessionRegistry, documentId: string): SchemaSession | null {
  useRegistryVersion(registry);
  return registry.get(documentId);
}

/**
 * Состояние сеанса.
 *
 * Подписка идёт на реестр, а не на сеанс: реестр уже пересылает себе его изменения, и вторая
 * подписка означала бы две перерисовки на одну правку.
 */
export function useSessionState(
  registry: SessionRegistry,
  session: SchemaSession | null
): SchemaEditorState | null {
  useRegistryVersion(registry);
  return session === null ? null : session.get();
}

/** Версия реестра: то самое стабильное число, на которое подписан весь плагин. */
function useRegistryVersion(registry: SessionRegistry): number {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const subscription = registry.subscribe(onStoreChange);
      return () => {
        subscription.dispose();
      };
    },
    [registry]
  );
  const snapshot = useCallback(() => registry.version(), [registry]);
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
